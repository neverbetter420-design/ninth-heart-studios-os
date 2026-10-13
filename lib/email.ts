// Phase 8 — Email via Google Workspace.
//
// Sends through Gmail's SMTP with an app password. Free, uses the Workspace
// account she already pays for, sends from her real business address.
//
// Setup (Hailey, one time):
//   1. Google Account → Security → 2-Step Verification (must be on)
//   2. Security → App passwords → generate one for "NHS OS"
//   3. .env.local: GMAIL_USER=you@ninthheartstudios.com
//                GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
//
// The app password lives in .env.local (server-only, never committed, never
// in the database). If it leaks, revoke it in Google Account settings —
// the Workspace password itself is never touched.

import nodemailer from "nodemailer";

export type EmailConfig = {
  user: string;
  appPassword: string;
};

export function getEmailConfig(): EmailConfig | null {
  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !appPassword) return null;
  return { user, appPassword };
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null;
}

export type SendEmailArgs = {
  to: string;
  subject: string;
  body: string;
};

/**
 * Sends one email through Gmail SMTP. Plain text, from the Workspace address.
 * Throws if not configured or if Gmail rejects it — the caller logs the
 * outcome to sent_emails either way.
 */
export async function sendEmail(args: SendEmailArgs): Promise<{ messageId: string }> {
  const config = getEmailConfig();
  if (!config) {
    throw new Error(
      "Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local.",
    );
  }

  const to = args.to.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("A valid recipient address is required.");
  }
  if (!args.subject.trim()) throw new Error("A subject is required.");
  if (!args.body.trim()) throw new Error("A body is required.");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: config.user, pass: config.appPassword },
  });

  const info = await transporter.sendMail({
    from: config.user,
    to,
    subject: args.subject.trim(),
    text: args.body,
  });

  return { messageId: info.messageId ?? "" };
}
