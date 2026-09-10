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
    where: {
      status: {
        in: ["SCHEDULED", "RESCHEDULED", "PROCESSING"],
      },
    },
    orderBy: {
      scheduledFor: "asc",
    },
    include: {
      sender: true,
    },
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
    where: {
      status: {
        in: ["SENT", "FAILED"],
      },
    },
    orderBy: {
      sentAt: "desc",
    },
    include: {
      sender: true,
    },
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

// GET /api/emails/:id - full detail for the preview pane
emailsRouter.get("/:id", async (req, res) => {
  const row = await prisma.emailJob.findUnique({
    where: {
      id: req.params.id,
    },
    include: {
      sender: true,
    },
  });

  if (!row) {
    return res.status(404).json({
      error: "Not found",
    });
  }

  res.json({
    id: row.id,
    email: row.toEmail,
    subject: row.subject,
    body: row.body,
    status: row.status,
    scheduledTime: row.scheduledFor,
    sentTime: row.sentAt,
    lastError: row.lastError,
    fromEmail: row.sender.fromEmail,
  });
});