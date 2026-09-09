import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { searchEmails } from "../services/searchIndex";

export const emailsRouter = Router();

const withSender = Prisma.validator<Prisma.EmailJobDefaultArgs>()({
  include: { sender: true },
});
type EmailJobWithSender = Prisma.EmailJobGetPayload<typeof withSender>;

emailsRouter.get("/scheduled", async (_req, res) => {
  const rows = await prisma.emailJob.findMany({
    where: { status: { in: ["SCHEDULED", "RESCHEDULED", "PROCESSING"] } },
    orderBy: { scheduledFor: "asc" },
    include: { sender: true },
  });
  res.json(
    rows.map((r: EmailJobWithSender) => ({
      id: r.id,
      email: r.toEmail,
      subject: r.subject,
      scheduledTime: r.scheduledFor,
      status: r.status,
    }))
  );
});

emailsRouter.get("/sent", async (_req, res) => {
  const rows = await prisma.emailJob.findMany({
    where: { status: { in: ["SENT", "FAILED"] } },
    orderBy: { sentAt: "desc" },
    include: { sender: true },
  });
  res.json(
    rows.map((r: EmailJobWithSender) => ({
      id: r.id,
      email: r.toEmail,
      subject: r.subject,
      sentTime: r.sentAt,
      status: r.status.toLowerCase(),
    }))
  );
});

emailsRouter.get("/search", async (req, res) => {
  const q = (req.query.q as string) ?? "";
  if (!q) return res.json([]);
  const results = await searchEmails(q);
  res.json(results);
});