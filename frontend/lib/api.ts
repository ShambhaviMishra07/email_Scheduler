import type {
  User,
  ScheduledEmail,
  SentEmail,
  Sender,
  EmailDetail,
} from "@/types";

// All requests go through Next's rewrite (see next.config.js), same-origin,
// so the session cookie set by the backend is sent automatically.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error
        ? JSON.stringify(body.error)
        : `Request failed: ${res.status}`
    );
  }

  return res.json();
}

export const api = {
  me: () => request<User>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  getSenders: (userId: string) =>
    request<Sender[]>(`/senders?userId=${userId}`),

  createSender: (userId: string) =>
    request<Sender>("/senders", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  getScheduled: () =>
    request<ScheduledEmail[]>("/emails/scheduled"),

  getSent: () =>
    request<SentEmail[]>("/emails/sent"),

  getEmailDetail: (id: string) =>
    request<EmailDetail>(`/emails/${id}`),

  scheduleEmail: (payload: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
  }) =>
    request<{ batchId: string; scheduled: number }>("/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  slackStatus: () =>
    request<{ connected: boolean }>("/slack/status"),
};

export const GOOGLE_LOGIN_URL = "/api/auth/google";
export const SLACK_CONNECT_URL = "/api/slack/connect";