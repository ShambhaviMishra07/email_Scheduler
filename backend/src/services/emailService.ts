import nodemailer, { Transporter } from "nodemailer";

// Cache one transporter per sender so we're not reconnecting on every send.
const transporterCache = new Map<string, Transporter>();

export interface SenderCreds {
  id: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

function getTransporter(sender: SenderCreds): Transporter {
  const cached = transporterCache.get(sender.id);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: false, // Ethereal uses STARTTLS on 587
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
  });

  transporterCache.set(sender.id, transporter);
  return transporter;
}

export async function sendEmail(
  sender: SenderCreds,
  to: string,
  subject: string,
  html: string
) {
  const transporter = getTransporter(sender);
  const info = await transporter.sendMail({
    from: sender.fromEmail,
    to,
    subject,
    html,
  });

  // Ethereal gives you a preview URL - handy for the demo video.
  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  return { messageId: info.messageId, previewUrl };
}

/**
 * Helper used at Sender-creation time to spin up a fresh Ethereal test
 * account (fake SMTP inbox) so each sender has real, working credentials.
 */
export async function createEtherealAccount() {
  const testAccount = await nodemailer.createTestAccount();
  return {
    smtpHost: testAccount.smtp.host,
    smtpPort: testAccount.smtp.port,
    smtpUser: testAccount.user,
    smtpPass: testAccount.pass,
    fromEmail: testAccount.user,
  };
}