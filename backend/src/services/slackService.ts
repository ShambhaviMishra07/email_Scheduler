import axios from "axios";
import { prisma } from "../db/prisma";

/**
 * Notifies the user's Slack the moment a sender's hourly limit is hit.
 * - If the user never connected Slack: no-op, no crash (per spec).
 * - If they connect later: works immediately, no redeploy needed, because
 *   we look the integration up fresh from the DB on every call rather than
 *   caching it at boot.
 */
export async function notifyRateLimitHit(params: {
  userId: string;
  senderEmail: string;
  retryAt: Date;
  queuedCount: number;
}) {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId: params.userId },
  });

  if (!integration || !integration.webhookUrl) {
    // Not connected - silently skip, this is expected behavior.
    return;
  }

  const text =
    `:rotating_light: *Hourly send limit reached* for \`${params.senderEmail}\`\n` +
    `${params.queuedCount} email(s) are being pushed to the next window, resuming at ` +
    `${params.retryAt.toISOString()}.`;

  try {
    await axios.post(integration.webhookUrl, { text });
  } catch (err) {
    // Don't let a Slack failure break the send pipeline.
    console.error("Slack notification failed:", (err as Error).message);
  }
}