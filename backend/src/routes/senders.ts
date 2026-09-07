import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { createEtherealAccount } from "../services/emailService";
import { env } from "../config/env";

export const sendersRouter = Router();

const CreateSenderSchema = z.object({
  userId: z.string().uuid(),
  maxPerHour: z.number().int().positive().optional(),
  minDelayMs: z.number().int().nonnegative().optional(),
});

// POST /api/senders - provisions a new Ethereal inbox as a sender identity
sendersRouter.post("/", async (req, res) => {
  const parsed = CreateSenderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const creds = await createEtherealAccount();
  const sender = await prisma.sender.create({
    data: {
      userId: parsed.data.userId,
      fromEmail: creds.fromEmail,
      smtpHost: creds.smtpHost,
      smtpPort: creds.smtpPort,
      smtpUser: creds.smtpUser,
      smtpPass: creds.smtpPass,
      maxPerHour: parsed.data.maxPerHour ?? env.DEFAULT_MAX_EMAILS_PER_HOUR,
      minDelayMs: parsed.data.minDelayMs ?? env.DEFAULT_MIN_DELAY_MS,
    },
  });

  res.status(201).json(sender);
});

// GET /api/senders?userId=...
sendersRouter.get("/", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  const senders = await prisma.sender.findMany({
    where: userId ? { userId } : undefined,
  });
  res.json(senders);
});