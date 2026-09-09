import { redisConnection } from "../config/redis";

const LUA_INCR_AND_CHECK = `
local current = redis.call("INCR", KEYS[1])
if tonumber(current) == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end
local limit = tonumber(ARGV[1])
if tonumber(current) > limit then
  redis.call("DECR", KEYS[1])
  return 0
end
return 1
`;

function hourBucketKey(senderId: string, date: Date): string {
  const iso = date.toISOString();
  const hour = iso.slice(0, 13);
  return `ratelimit:${senderId}:${hour}`;
}

export function nextHourBoundary(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

export async function tryConsumeHourlySlot(
  senderId: string,
  maxPerHour: number,
  now: Date = new Date()
): Promise<{ allowed: boolean; retryAt?: Date }> {
  const key = hourBucketKey(senderId, now);
  const result = await redisConnection.eval(
    LUA_INCR_AND_CHECK,
    1,
    key,
    maxPerHour.toString(),
    "3700"
  );
  if (result === 1) return { allowed: true };
  return { allowed: false, retryAt: nextHourBoundary(now) };
}

export async function getCurrentHourCount(senderId: string, now: Date = new Date()) {
  const key = hourBucketKey(senderId, now);
  const val = await redisConnection.get(key);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Phase 3 addition: ensures only the first job that hits the limit in a
 * given hour window triggers a Slack notification (SET NX = atomic
 * "set if not exists", safe across many concurrent workers).
 */
export async function claimNotificationSlot(
  senderId: string,
  now: Date = new Date()
): Promise<boolean> {
  const iso = now.toISOString();
  const hour = iso.slice(0, 13);
  const key = `ratelimit-notified:${senderId}:${hour}`;
  const result = await redisConnection.set(key, "1", "EX", 3700, "NX");
  return result === "OK";
}