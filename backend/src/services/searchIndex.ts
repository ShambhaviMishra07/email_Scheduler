import axios from "axios";
import { env } from "../config/env";

export const EMAIL_INDEX = "reachinbox-emails";

let esAvailable: boolean | null = null;

async function checkEs(): Promise<boolean> {
  if (esAvailable !== null) return esAvailable;
  try {
    await axios.get(env.ELASTICSEARCH_URL, { timeout: 1000 });
    esAvailable = true;
  } catch {
    esAvailable = false;
    console.warn("Elasticsearch not reachable - search indexing disabled (safe no-op).");
  }
  return esAvailable;
}

export async function indexEmail(doc: {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  senderId: string;
  scheduledFor: Date;
  sentAt?: Date | null;
}) {
  if (!(await checkEs())) return;
  try {
    await axios.put(`${env.ELASTICSEARCH_URL}/${EMAIL_INDEX}/_doc/${doc.id}`, {
      toEmail: doc.toEmail,
      subject: doc.subject,
      body: doc.body,
      status: doc.status,
      senderId: doc.senderId,
      scheduledFor: doc.scheduledFor,
      sentAt: doc.sentAt ?? null,
    });
  } catch (err) {
    console.error("ES index failed:", (err as Error).message);
  }
}

export async function searchEmails(query: string) {
  if (!(await checkEs())) return [];
  try {
    const res = await axios.post(`${env.ELASTICSEARCH_URL}/${EMAIL_INDEX}/_search`, {
      query: {
        multi_match: {
          query,
          fields: ["toEmail", "subject", "body"],
        },
      },
    });
    return res.data.hits.hits.map((h: any) => ({ id: h._id, ...h._source }));
  } catch (err) {
    console.error("ES search failed:", (err as Error).message);
    return [];
  }
}