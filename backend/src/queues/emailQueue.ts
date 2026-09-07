import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-send";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    // Keep completed/failed jobs around briefly so the Bull Board dashboard
    // is useful, but don't let Redis grow unbounded.
    removeOnComplete: { age: 3600, count: 5000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

export interface EmailJobPayload {
  emailJobId: string; // Prisma EmailJob.id - the source of truth
}

/**
 * Enqueues (or re-enqueues) a delayed job for a given EmailJob row.
 *
 * Idempotency: jobId is deterministic and versioned
 * (`email:<emailJobId>:v<version>`). BullMQ refuses to add a second job
 * with the same jobId while one is active/waiting/delayed, so calling this
 * twice for the same version is a safe no-op - which is exactly what
 * happens on server restart when we re-sync DB -> queue.
 */
export async function enqueueEmailJob(
  emailJobId: string,
  runAt: Date,
  version: number
) {
  const delay = Math.max(0, runAt.getTime() - Date.now());
  const jobId = `email:${emailJobId}:v${version}`;

  const job = await emailQueue.add(
    "send-email",
    { emailJobId } satisfies EmailJobPayload,
    { jobId, delay }
  );

  return job;
}