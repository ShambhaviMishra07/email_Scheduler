import { prisma } from "../db/prisma";
import { emailQueue, enqueueEmailJob } from "./emailQueue";

export async function recoverPendingJobs() {
  const pending = await prisma.emailJob.findMany({
    where: { status: { in: ["SCHEDULED", "RESCHEDULED"] } },
  });

  let recovered = 0;

  for (const row of pending) {
    const jobId = `email:${row.id}:v${row.version}`;
    const existing = await emailQueue.getJob(jobId);
    if (existing) continue;

    await enqueueEmailJob(row.id, row.scheduledFor, row.version);
    await prisma.emailJob.update({ where: { id: row.id }, data: { bullJobId: jobId } });
    recovered++;
  }

  if (recovered > 0) {
    console.log(`Recovery: re-enqueued ${recovered} job(s) missing from the queue.`);
  } else {
    console.log("Recovery: queue already in sync with DB, nothing to do.");
  }
}

const STALE_PROCESSING_MS = 5 * 60 * 1000;

/**
 * Catches rows stuck at PROCESSING because the worker process itself was
 * killed (not just the job) — e.g. `kill -9`, OOM, container crash.
 * Since there's no BullMQ job to redeliver in that case (the process that
 * would've retried it is gone), we reset the row to SCHEDULED and
 * re-enqueue with delay=0 so the *next* worker instance picks it up.
 */
export async function reclaimStuckProcessingJobs() {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);

  const stuck = await prisma.emailJob.findMany({
    where: { status: "PROCESSING", updatedAt: { lt: cutoff } },
  });

  for (const row of stuck) {
    const newVersion = row.version + 1;
    await prisma.emailJob.update({
      where: { id: row.id },
      data: { status: "SCHEDULED", scheduledFor: new Date(), version: newVersion },
    });
    const job = await enqueueEmailJob(row.id, new Date(), newVersion);
    await prisma.emailJob.update({ where: { id: row.id }, data: { bullJobId: job.id } });
  }

  if (stuck.length > 0) {
    console.log(`Recovery: reclaimed ${stuck.length} stuck PROCESSING job(s).`);
  }
}