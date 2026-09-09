export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface ScheduledEmail {
  id: string;
  email: string;
  subject: string;
  scheduledTime: string;
  status: "SCHEDULED" | "RESCHEDULED" | "PROCESSING";
}

export interface SentEmail {
  id: string;
  email: string;
  subject: string;
  sentTime: string | null;
  status: "sent" | "failed";
}

export interface Sender {
  id: string;
  fromEmail: string;
  maxPerHour: number;
  minDelayMs: number;
}