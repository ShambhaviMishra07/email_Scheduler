import { prisma } from "../db/prisma";
import { emailQueue, enqueueEmailJob } from "./emailQueue";

/**
 * Runs once when the API process boots.
 *
 * Problem it solves: BullMQ jobs live in Redis; EmailJob rows live in
 * Postgres. If Redis is wiped/restarted independently of Postgres (or the
 * process crashed between "insert row" and "enqueue job"), the two can
 * drift out of sync. This walks every row that should still be pending and
 * makes sure a matching BullMQ job exists - without ever re-sending
 * anything already SENT and without creating duplicates.
 */
export async function recoverPendingJobs() {
  const pending = await prisma.emailJob.findMany({
    where: { status: { in: ["SCHEDULED", "RESCHEDULED"] } },
  });

  let recovered = 0;

  for (const row of pending) {
    const jobId = `email:${row.id}:v${row.version}`;
    const existing = await emailQueue.getJob(jobId);

    if (existing) {
      // Already present in the queue (normal case after a plain restart)
      // - BullMQ retains delayed jobs across a Redis restart as long as
      // AOF persistence is on (see docker-compose: --appendonly yes).
      continue;
    }

    // Missing from the queue - re-add it. If scheduledFor is in the past
    // (e.g. server was down through the send time), it'll be picked up
    // immediately with delay=0 rather than being lost.
    await enqueueEmailJob(row.id, row.scheduledFor, row.version);
    await prisma.emailJob.update({
      where: { id: row.id },
      data: { bullJobId: jobId },
    });
    recovered++;
  }

  if (recovered > 0) {
    console.log(`Recovery: re-enqueued ${recovered} job(s) missing from the queue.`);
  } else {
    console.log("Recovery: queue already in sync with DB, nothing to do.");
  }
}