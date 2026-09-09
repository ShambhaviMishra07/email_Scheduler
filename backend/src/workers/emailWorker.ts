
import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../db/prisma";
import {
  EMAIL_QUEUE_NAME,
  EmailJobPayload,
  enqueueEmailJob,
} from "../queues/emailQueue";
import {
  tryConsumeHourlySlot,
  claimNotificationSlot,
  getCurrentHourCount,
} from "../services/rateLimiter";
import { sendEmail } from "../services/emailService";
import { notifyRateLimitHit } from "../services/slackService";
import { env } from "../config/env";
import { indexEmail } from "../services/searchIndex";

// If a row has been "PROCESSING" longer than this, we assume the worker
// that claimed it crashed mid-send rather than being genuinely in flight.
const STALE_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes

async function processEmailJob(job: Job<EmailJobPayload>) {
  const { emailJobId } = job.data;

  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { sender: true, batch: true },
  });

  if (!emailJob) {
    console.warn(`EmailJob ${emailJobId} not found, skipping.`);
    return;
  }

  // --- Idempotency guard -------------------------------------------------
  if (emailJob.status === "SENT") {
    return; // already delivered, nothing to do
  }

  if (emailJob.status === "PROCESSING") {
    const msSinceUpdate = Date.now() - emailJob.updatedAt.getTime();

    if (msSinceUpdate < STALE_PROCESSING_MS) {
      // Genuinely still in flight elsewhere — throw (not return!) so
      // BullMQ retries with backoff instead of marking this attempt
      // "completed" when nothing was actually sent.
      throw new Error(
        `EmailJob ${emailJob.id} already PROCESSING (${msSinceUpdate}ms ago) — retrying later`
      );
    }

    // Stale: the previous attempt crashed mid-send. Fall through and
    // reclaim it.
    console.warn(`Reclaiming stale PROCESSING EmailJob ${emailJob.id}`);
  }

  // --- Rate limit check --------------------------------------------------
  const maxPerHour =
    emailJob.batch.hourlyLimit || env.DEFAULT_MAX_EMAILS_PER_HOUR;

  const { allowed, retryAt } = await tryConsumeHourlySlot(
    emailJob.senderId,
    maxPerHour
  );

  if (!allowed && retryAt) {
    const newVersion = emailJob.version + 1;

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        status: "RESCHEDULED",
        scheduledFor: retryAt,
        version: newVersion,
      },
    });

    const newJob = await enqueueEmailJob(
      emailJob.id,
      retryAt,
      newVersion
    );

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId: newJob.id },
    });

    // Only the first job to hit the limit in this window actually pings Slack.
    const shouldNotify = await claimNotificationSlot(emailJob.senderId);

    if (shouldNotify) {
      await notifyRateLimitHit({
        userId: emailJob.batch.userId,
        senderEmail: emailJob.sender.fromEmail,
        retryAt,
        queuedCount: await getCurrentHourCount(emailJob.senderId),
      });
    }

    return;
  }

  // --- Claim the row (idempotency guard) -------------------------------
  // Uses updateMany + status filter so two workers racing on the same
  // stale row can't both "win" the claim.
  const claim = await prisma.emailJob.updateMany({
    where: {
      id: emailJob.id,
      status: {
        in: ["SCHEDULED", "RESCHEDULED", "PROCESSING"],
      },
    },
    data: {
      status: "PROCESSING",
    },
  });

  if (claim.count === 0) {
    // Someone else claimed it between our read and this write.
    return;
  }

  if (emailJob.sender.minDelayMs > 0) {
    await new Promise((res) =>
      setTimeout(res, emailJob.sender.minDelayMs)
    );
  }

  try {
    const { messageId, previewUrl } = await sendEmail(
      emailJob.sender,
      emailJob.toEmail,
      emailJob.subject,
      emailJob.body
    );

    const sentAt = new Date();

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        status: "SENT",
        sentAt,
        lastError: previewUrl
          ? `preview: ${previewUrl}`
          : null,
      },
    });

    await indexEmail({
      ...emailJob,
      status: "SENT",
      sentAt,
    });

    console.log(
      `Sent ${emailJob.toEmail} (${messageId}) ${previewUrl ?? ""}`
    );
  } catch (err) {
    const message = (err as Error).message;

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        status: "FAILED",
        lastError: message,
        attempts: { increment: 1 },
      },
    });

    throw err;
  }
}

export const emailWorker = new Worker<EmailJobPayload>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on("failed", (job, err) =>
  console.error(`Job ${job?.id} failed:`, err.message)
);

emailWorker.on("completed", (job) =>
  console.log(`Job ${job.id} completed`)
);

console.log(
  `Email worker started (concurrency=${env.WORKER_CONCURRENCY}, maxPerHour default=${env.DEFAULT_MAX_EMAILS_PER_HOUR})`
);

