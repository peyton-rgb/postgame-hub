// ============================================================
// Generic outbound mail.
//
// The Hub already sends production mail through nodemailer -> Gmail with
// GMAIL_USER / GMAIL_APP_PASSWORD. That transport was written out twice, once
// in lib/admin/invite-email.ts and once in api/creator-briefs/upload/notify,
// each welded to the one message it sends. This is the same transport with the
// content taken out, so a caller with a subject and a body does not have to
// paste a third copy.
//
// Neither existing caller is changed here. Extracting them is a separate job
// with its own blast radius; this file exists so new senders have somewhere to
// go that is not a fourth copy.
//
// STUB-SAFE: no credentials, or a send failure, resolves to { sent: false }
// with a reason. Never throws — a dead mailbox must not fail an agent run.
// ============================================================

import nodemailer from "nodemailer";

/** The mailbox operational mail is sent FROM. */
export const MAIL_SENDER_NAME = "Postgame Hub";

export interface MailInput {
  to: string;
  subject: string;
  /** Plain text. Required — it is the body for clients that refuse HTML. */
  text: string;
  /** Optional HTML alternative. */
  html?: string;
}

export interface MailResult {
  sent: boolean;
  error: string | null;
}

/**
 * Send one message. Returns rather than throws, always.
 *
 * The transport is built per call. These are low-volume operational messages
 * (a budget alert, a weekly digest), so a pooled connection would be a cache
 * with nothing to cache and one more thing to hold open in a serverless
 * function that is about to be frozen.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return { sent: false, error: "GMAIL_USER / GMAIL_APP_PASSWORD not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"${MAIL_SENDER_NAME}" <${user}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    return { sent: true, error: null };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
