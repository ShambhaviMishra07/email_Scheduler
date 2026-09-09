
import { Router } from "express";
import axios from "axios";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { signState, verifyState } from "../services/oauthState";

export const slackRouter = Router();

function requireUserId(req: any): string | null {
  return req.session?.userId ?? null;
}

// GET /api/slack/connect - kicks off Slack's OAuth authorize flow
slackRouter.get("/connect", (req, res) => {
  const userId = requireUserId(req);
  if (!userId) return res.status(401).send("Login required");

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: "incoming-webhook",
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: signState(userId),
  });

  res.redirect(
    `https://slack.com/oauth/v2/authorize?${params.toString()}`
  );
});

// GET /api/slack/callback - exchanges code for a webhook + team info
slackRouter.get("/callback", async (req, res) => {
  const { code, state } = req.query as {
    code?: string;
    state?: string;
  };

  if (!code || !state) {
    return res.status(400).send("Missing code/state");
  }

  const userId = verifyState(state);

  if (!userId) {
    return res.status(400).send("Invalid or expired state");
  }

  try {
    const { data } = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      })
    );

    if (!data.ok) {
      console.error("Slack OAuth error:", data.error);
      return res.redirect(
        `${env.FRONTEND_URL}/dashboard?slack=error`
      );
    }

    await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        teamId: data.team.id,
        accessToken: data.access_token,
        webhookUrl: data.incoming_webhook?.url,
        channelId: data.incoming_webhook?.channel_id,
      },
      create: {
        userId,
        teamId: data.team.id,
        accessToken: data.access_token,
        webhookUrl: data.incoming_webhook?.url,
        channelId: data.incoming_webhook?.channel_id,
      },
    });

    res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack=connected`
    );
  } catch (err) {
    console.error("Slack callback failed:", err);
    res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack=error`
    );
  }
});

// GET /api/slack/status
slackRouter.get("/status", async (req, res) => {
  const userId = requireUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Login required" });
  }

  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
  });

  res.json({ connected: !!integration });
});

// POST /api/slack/disconnect
slackRouter.post("/disconnect", async (req, res) => {
  const userId = requireUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Login required" });
  }

  await prisma.slackIntegration.deleteMany({
    where: { userId },
  });

  res.json({ ok: true });
});


