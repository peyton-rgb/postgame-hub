// ============================================================
// Brand-portal invite email.
//
// TRANSPORT NOTE FOR PEYTON: the brief said "send via the Gmail MCP
// connector". An MCP connector is a tool available to the assistant in a
// chat session — a deployed Next.js server cannot call one. This uses
// the transport the Hub already sends production mail through
// (nodemailer -> Gmail, GMAIL_USER / GMAIL_APP_PASSWORD, same as
// /api/creator-briefs/upload/notify), which IS the authenticated Postgame
// mailbox, just reached with an app password instead of MCP.
//
// SENDER is a config constant below — change it in one place.
//
// Design: dark Postgame field, brand logo on a light card (brand logos
// are usually dark-ink; 7-Eleven for one has only logo_primary_url set,
// so putting it on dark would risk an invisible mark). Inline styles
// only, and a system font stack — email clients do not load webfonts, so
// the 4-font system degrades here by necessity rather than by choice.
// No NCAA terms anywhere.
// ============================================================

import nodemailer from "nodemailer";
import { pickBrandLogo } from "@/lib/portal";

/** The mailbox invites are sent FROM. Flagged for Peyton. */
export const INVITE_SENDER_NAME = "Postgame";

/** Invite links stop working this many days after they are sent. */
export const INVITE_TTL_DAYS = 14;

const ORANGE = "#D73F09";

export interface InviteEmailInput {
  toEmail: string;
  contactName: string;
  brandName: string;
  brandLogoUrl: string | null;
  roleLabel: string;
  signupUrl: string;
  expiresAt: Date;
}

export interface SendResult {
  sent: boolean;
  error: string | null;
}

/**
 * Brand logo for the email. Delegates to the portal's existing
 * pickBrandLogo rather than keeping a second fallback chain that could
 * drift from it — the portal and the invite must show the same mark.
 * Adds logo_mark_url / logo_url as last resorts for brands the portal
 * chain misses.
 */
export function resolveBrandLogo(brand: {
  logo_light_url?: string | null;
  logo_white_url?: string | null;
  logo_primary_url?: string | null;
  logo_dark_url?: string | null;
  logo_mark_url?: string | null;
  logo_url?: string | null;
}): string | null {
  return pickBrandLogo(brand) || brand.logo_mark_url || brand.logo_url || null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderInviteEmail(input: InviteEmailInput): { subject: string; html: string; text: string } {
  const brand = escapeHtml(input.brandName);
  const who = escapeHtml(input.contactName);
  const role = escapeHtml(input.roleLabel);
  const url = input.signupUrl;
  const expires = input.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const logoBlock = input.brandLogoUrl
    ? `<div style="background:#ffffff;border-radius:10px;padding:18px 22px;display:inline-block;">
         <img src="${escapeHtml(input.brandLogoUrl)}" alt="${brand}" style="height:36px;width:auto;display:block;border:0;" />
       </div>`
    : // Honest fallback — the brand name set, never a placeholder mark.
      `<div style="background:#ffffff;border-radius:10px;padding:14px 22px;display:inline-block;
                   font-size:17px;font-weight:700;color:#1a1a1c;letter-spacing:-0.01em;">${brand}</div>`;

  const subject = `You've been invited to the ${input.brandName} portal`;

  // The charset declaration is load-bearing, not boilerplate: without it
  // clients fall back to latin-1 and every em-dash and curly quote in the
  // copy renders as mojibake ("Hi Peter â€" you've been given...").
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0e0e10;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e10;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161619;border:1px solid #2a2a2f;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:34px 34px 0;text-align:center;">
          ${logoBlock}
        </td></tr>
        <tr><td style="padding:26px 34px 0;text-align:center;">
          <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                     font-size:21px;line-height:1.3;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">
            You've been invited to the ${brand} portal
          </h1>
          <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:14px;line-height:1.6;color:#a1a1a8;">
            Hi ${who} — you've been given <strong style="color:#ffffff;">${role}</strong> access to
            ${brand}'s campaigns, assets and reporting on the Postgame Hub.
          </p>
        </td></tr>
        <tr><td style="padding:26px 34px 0;text-align:center;">
          <a href="${url}"
             style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:15px;font-weight:600;padding:13px 30px;border-radius:8px;">
            Set up your login
          </a>
        </td></tr>
        <tr><td style="padding:20px 34px 34px;text-align:center;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                    font-size:12px;line-height:1.6;color:#6b6b72;">
            This link is for you only and expires on ${expires}.<br />
            If it has expired, ask your Postgame contact to resend it.
          </p>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                font-size:11px;color:#4d4d54;">Postgame</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `You've been invited to the ${input.brandName} portal`,
    ``,
    `Hi ${input.contactName} — you've been given ${input.roleLabel} access to ${input.brandName}'s campaigns, assets and reporting on the Postgame Hub.`,
    ``,
    `Set up your login: ${url}`,
    ``,
    `This link is for you only and expires on ${expires}.`,
    `If it has expired, ask your Postgame contact to resend it.`,
    ``,
    `Postgame`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Send it. Never throws — the caller decides what a failure means for
 * the attachment's status, and a dead mailbox must not 500 the admin.
 */
export async function sendInviteEmail(input: InviteEmailInput): Promise<SendResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return { sent: false, error: "GMAIL_USER / GMAIL_APP_PASSWORD not configured" };
  }

  try {
    const { subject, html, text } = renderInviteEmail(input);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"${INVITE_SENDER_NAME}" <${user}>`,
      to: input.toEmail,
      subject,
      html,
      text,
    });
    return { sent: true, error: null };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
