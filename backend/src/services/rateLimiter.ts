import { redisConnection } from "../config/redis";

/**
 * Fixed-hour-window counter, keyed by sender + calendar hour (UTC).
 * e.g. ratelimit:<senderId>:2026-09-07T14
 *
 * Why fixed window (not sliding/leaky bucket)?
 *  - Simple to reason about and to explain "next available hour window" resets.
 *  - Good enough given the requirement is "N emails per hour", not strict
 *    smoothing. Documented as a trade-off in the README.
 *
 * Atomicity: we use a single Lua script (via a MULTI/EVAL) so INCR + EXPIRE
 * + the limit check happen as one atomic unit, which stays correct even
 * with many worker processes / instances hitting Redis concurrently.
 */

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
  const iso = date.toISOString(); // 2026-09-07T14:32:10.000Z
  const hour = iso.slice(0, 13); // 2026-09-07T14
  return `ratelimit:${senderId}:${hour}`;
}

export function nextHourBoundary(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

/**
 * Attempts to consume one slot from the sender's hourly budget.
 * Returns { allowed: true } if the send should proceed now, or
 * { allowed: false, retryAt } with the next hour boundary to try again.
 */
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
    "3700" // TTL slightly over an hour so the key self-cleans
  );

  if (result === 1) {
    return { allowed: true };
  }
  return { allowed: false, retryAt: nextHourBoundary(now) };
}

export async function getCurrentHourCount(senderId: string, now: Date = new Date()) {
  const key = hourBucketKey(senderId, now);
  const val = await redisConnection.get(key);
  return val ? parseInt(val, 10) : 0;
}