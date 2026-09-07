import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../db/prisma";
import { EMAIL_QUEUE_NAME, EmailJobPayload, enqueueEmailJob } from "../queues/emailQueue";
import { tryConsumeHourlySlot } from "../services/rateLimiter";
import { sendEmail } from "../services/emailService";
import { notifyRateLimitHit } from "../services/slackService";
import { env } from "../config/env";
import { indexEmail } from "../services/searchIndex";

async function processEmailJob(job: Job<EmailJobPayload>) {
  const { emailJobId } = job.data;

  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { sender: true, batch: true },
  });

  if (!emailJob) {
    // Nothing to do - row was deleted. Don't throw (would retry forever).
    console.warn(`EmailJob ${emailJobId} not found, skipping.`);
    return;
  }

  // --- Idempotency guard -------------------------------------------------
  // If this row is already SENT (or currently PROCESSING by another
  // worker/retry), don't send again. This is what makes restarts and
  // BullMQ's at-least-once delivery safe.
  if (emailJob.status === "SENT") {
    return;
  }
  if (emailJob.status === "PROCESSING") {
    // Could be a duplicate delivery attempt (BullMQ retry). Bail out;
    // the in-flight attempt owns this send.
    return;
  }

  // --- Rate limit check ----------------------------------------------------
  const maxPerHour = emailJob.batch.hourlyLimit || env.DEFAULT_MAX_EMAILS_PER_HOUR;
  const { allowed, retryAt } = await tryConsumeHourlySlot(emailJob.senderId, maxPerHour);

  if (!allowed && retryAt) {
    // Don't drop the job - push it to the next hour window and re-enqueue
    // under a new (versioned) jobId, preserving relative order since jobs
    // for the same sender all land at the same retryAt and BullMQ processes
    // delayed jobs in the order their delay elapses.
    const newVersion = emailJob.version + 1;
    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        status: "RESCHEDULED",
        scheduledFor: retryAt,
        version: newVersion,
      },
    });
    const newJob = await enqueueEmailJob(emailJob.id, retryAt, newVersion);
    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId: newJob.id },
    });

    await notifyRateLimitHit({
      userId: emailJob.batch.userId,
      senderEmail: emailJob.sender.fromEmail,
      retryAt,
      queuedCount: 1,
    });
    return;
  }

  // --- Mark as processing before the network call (idempotency guard) ------
  await prisma.emailJob.update({
    where: { id: emailJob.id },
    data: { status: "PROCESSING" },
  });

  // --- Minimum delay between sends for this sender --------------------------
  // BullMQ concurrency lets N jobs run in parallel; this per-job sleep
  // throttles how fast any single sender's jobs actually hit SMTP,
  // mimicking provider throttling as required.
  if (emailJob.sender.minDelayMs > 0) {
    await new Promise((res) => setTimeout(res, emailJob.sender.minDelayMs));
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
        lastError: previewUrl ? `preview: ${previewUrl}` : null,
      },
    });

    await indexEmail({ ...emailJob, status: "SENT", sentAt });
    console.log(`Sent ${emailJob.toEmail} (${messageId}) ${previewUrl ?? ""}`);
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
    throw err; // let BullMQ's retry/backoff policy handle re-attempts
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

emailWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

console.log(
  `Email worker started (concurrency=${env.WORKER_CONCURRENCY}, minDelay/sender configurable, maxPerHour default=${env.DEFAULT_MAX_EMAILS_PER_HOUR})`
);