import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { enqueueEmailJob } from "../queues/emailQueue";

export const scheduleRouter = Router();

const ScheduleSchema = z.object({
  senderId: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
  startTime: z.coerce.date(),
  delayMs: z.number().int().nonnegative().default(2000),
  hourlyLimit: z.number().int().positive().default(200),
});

// POST /api/schedule
// Body-parsed recipients come either from manual entry or from the
// frontend's CSV/text upload parse step (see Compose New Email UI).
scheduleRouter.post("/", async (req, res) => {
  const parsed = ScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { senderId, subject, body, recipients, startTime, delayMs, hourlyLimit } =
    parsed.data;

  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) return res.status(404).json({ error: "Sender not found" });

  const batch = await prisma.emailBatch.create({
    data: {
      userId: sender.userId,
      subject,
      body,
      startTime,
      delayMs,
      hourlyLimit,
    },
  });

  // Stagger each recipient by delayMs so the intra-batch spacing is
  // reflected in scheduledFor even before the worker's own min-delay kicks in.
  const created = [];
  for (let i = 0; i < recipients.length; i++) {
    const scheduledFor = new Date(startTime.getTime() + i * delayMs);
    const row = await prisma.emailJob.create({
      data: {
        batchId: batch.id,
        senderId,
        toEmail: recipients[i],
        subject,
        body,
        scheduledFor,
      },
    });
    const job = await enqueueEmailJob(row.id, scheduledFor, row.version);
    await prisma.emailJob.update({
      where: { id: row.id },
      data: { bullJobId: job.id },
    });
    created.push(row);
  }

  res.status(201).json({ batchId: batch.id, scheduled: created.length });
});