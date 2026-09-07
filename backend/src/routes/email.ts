import { Router } from "express";
import { prisma } from "../db/prisma";
import { searchEmails } from "../services/searchIndex";

export const emailsRouter = Router();

// GET /api/emails/scheduled
emailsRouter.get("/scheduled", async (_req, res) => {
  const rows = await prisma.emailJob.findMany({
    where: { status: { in: ["SCHEDULED", "RESCHEDULED", "PROCESSING"] } },
    orderBy: { scheduledFor: "asc" },
    include: { sender: true },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.toEmail,
      subject: r.subject,
      scheduledTime: r.scheduledFor,
      status: r.status,
    }))
  );
});

// GET /api/emails/sent
emailsRouter.get("/sent", async (_req, res) => {
  const rows = await prisma.emailJob.findMany({
    where: { status: { in: ["SENT", "FAILED"] } },
    orderBy: { sentAt: "desc" },
    include: { sender: true },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.toEmail,
      subject: r.subject,
      sentTime: r.sentAt,
      status: r.status.toLowerCase(),
    }))
  );
});

// GET /api/emails/search?q=...  (Elasticsearch)
emailsRouter.get("/search", async (req, res) => {
  const q = (req.query.q as string) ?? "";
  if (!q) return res.json([]);
  const results = await searchEmails(q);
  res.json(results);
});