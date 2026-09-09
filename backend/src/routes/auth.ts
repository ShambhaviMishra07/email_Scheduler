import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

export const authRouter = Router();

const oauthClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

authRouter.get("/google", (_req, res) => {
  const url = oauthClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "consent",
  });
  res.redirect(url);
});

authRouter.get("/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send("Missing code");

  try {
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      return res.status(400).send("Google account missing required fields");
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: { email: payload.email, name: payload.name ?? payload.email, avatarUrl: payload.picture },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture,
      },
    });

    (req.session as any).userId = user.id;
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

authRouter.get("/me", async (req, res) => {
  const userId = (req.session as any)?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ error: "Not logged in" });

  res.json({ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl });
});

authRouter.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});