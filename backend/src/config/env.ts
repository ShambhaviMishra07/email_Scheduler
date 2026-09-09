import "dotenv/config";

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

export const env = {
  PORT: parseInt(process.env.PORT ?? "4000", 10),
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Worker tuning - all configurable, nothing hardcoded per the assignment spec
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY ?? "5", 10),
  DEFAULT_MIN_DELAY_MS: parseInt(process.env.DEFAULT_MIN_DELAY_MS ?? "2000", 10),
  DEFAULT_MAX_EMAILS_PER_HOUR: parseInt(
    process.env.DEFAULT_MAX_EMAILS_PER_HOUR ?? "200",
    10
  ),

  // Google OAuth
  // GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  // GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // GOOGLE_CALLBACK_URL:
  //   process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/api/auth/google/callback",

  GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
GOOGLE_CALLBACK_URL: required("GOOGLE_CALLBACK_URL"),
  // Slack OAuth
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID ?? "",
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET ?? "",
  SLACK_REDIRECT_URI:
    process.env.SLACK_REDIRECT_URI ?? "http://localhost:4000/api/slack/callback",

  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-secret-change-me",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:3000",

  // Elasticsearch
  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
};