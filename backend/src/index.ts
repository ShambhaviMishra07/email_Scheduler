import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import "./workers/emailWorker";

import { env } from "./config/env";
import { emailQueue } from "./queues/emailQueue";
import { recoverPendingJobs, reclaimStuckProcessingJobs } from "./queues/recovery";
import { scheduleRouter } from "./routes/schedule";
import { emailsRouter } from "./routes/email";
import { sendersRouter } from "./routes/senders";
import { authRouter } from "./routes/auth";
import { slackRouter } from "./routes/slack";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(
  cookieSession({
    name: "session",
    secret: env.SESSION_SECRET,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  })
);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter });
app.use("/admin/queues", serverAdapter.getRouter());

app.use("/api/schedule", scheduleRouter);
app.use("/api/emails", emailsRouter);
app.use("/api/senders", sendersRouter);
app.use("/api/auth", authRouter);
app.use("/api/slack", slackRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

async function main() {
  // await recoverPendingJobs();
  // await reclaimStuckProcessingJobs();


  console.log("Starting recovery...");
await recoverPendingJobs();
console.log("Pending jobs recovered");

await reclaimStuckProcessingJobs();
console.log("Stuck jobs reclaimed");

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
    console.log(`Bull Board dashboard: http://localhost:${env.PORT}/admin/queues`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});