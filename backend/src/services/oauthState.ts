import crypto from "crypto";
import { env } from "../config/env";

// Signs {userId, exp} so the Slack OAuth `state` param can't be forged or
// replayed against a different account.
export function signState(userId: string): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000 });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyState(state: string): string | null {
  const [b64, sig] = state.split(".");
  if (!b64 || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(b64)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null; // tampered
  }

  const { userId, exp } = JSON.parse(Buffer.from(b64, "base64url").toString());
  if (Date.now() > exp) return null; // expired

  return userId;
}