// ============================================================
// POST /api/creator-briefs/upload/notify
//
// PUBLIC endpoint — no auth required (slug = access key).
// Called by the frontend after each athlete folder finishes
// uploading. Sends notifications to the campaign manager via:
//   1. Slack message to #postgame-productions
//   2. Email to the Postgame contacts listed on the brief
//
// Body (JSON): {
//   slug: string,         — creative brief slug
//   athleteName: string,   — folder name / athlete
//   fileCount: number,     — how many files were uploaded
//   fileNames: string[]    — list of file names
// }
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const getAdminSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// Helper: look up a Slack user ID by their email address.
// Uses the Slack Web API's users.lookupByEmail method.
// Returns the user ID (like "U12345") or null if not found.
async function getSlackUserIdByEmail(email: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.ok ? data.user.id : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const adminSupabase = getAdminSupabase();

  const body = await request.json();
  const { slug, athleteName, fileCount, fileNames } = body;

  if (!slug || !athleteName) {
    return NextResponse.json(
      { error: 'slug and athleteName are required' },
      { status: 400 }
    );
  }

  // --- Look up the brief for context ---
  const { data: brief } = await adminSupabase
    .from('creator_briefs')
    .select('id, title, slug, postgame_contacts, athlete_name')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!brief) {
    return NextResponse.json(
      { error: 'Brief not found' },
      { status: 404 }
    );
  }

  const briefTitle = brief.title || 'Untitled Brief';
  const hubUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.pstgm.com';
  const intakeUrl = `${hubUrl}/dashboard/intake`;
  const briefUrl = `${hubUrl}/creator-brief/${slug}`;

  // --- Build the notification message ---
  const fileList = (fileNames || []).slice(0, 5).join(', ');
  const moreFiles = (fileNames || []).length > 5
    ? ` and ${(fileNames || []).length - 5} more`
    : '';

  // --- 1. Send Slack DMs to each contact on the brief ---
  try {
    const slackText =
      `📸 *New footage uploaded*\n\n` +
      `*Athlete:* ${athleteName}\n` +
      `*Campaign:* ${briefTitle}\n` +
      `*Files:* ${fileCount || 0} file${(fileCount || 0) !== 1 ? 's' : ''}\n` +
      (fileList ? `*Names:* ${fileList}${moreFiles}\n` : '') +
      `\n<${intakeUrl}|View in Intake Queue> · <${briefUrl}|View Brief>`;

    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (slackToken) {
      // Get email addresses from the brief's contacts
      const contacts = (brief.postgame_contacts || []) as Array<{
        name: string;
        email?: string;
        role: string;
      }>;

      const contactEmails = contacts
        .filter((c) => c.email)
        .map((c) => c.email as string);

      // Always include admin
      const adminEmail = process.env.NOTIFICATION_EMAIL || 'peyton@pstgm.com';
      if (!contactEmails.includes(adminEmail)) {
        contactEmails.push(adminEmail);
      }

      // Look up each contact's Slack user ID by email, then DM them
      for (const email of contactEmails) {
        const slackUserId = await getSlackUserIdByEmail(email, slackToken);
        if (slackUserId) {
          // Sending a DM: use the user's ID as the "channel"
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${slackToken}`,
            },
            body: JSON.stringify({
              channel: slackUserId,
              text: slackText,
              unfurl_links: false,
            }),
          });
        }
      }
    } else {
      console.log('SLACK NOTIFICATION (no bot token configured):', slackText);
    }
  } catch (err) {
    console.error('Slack notification failed:', err);
    // Don't fail the whole request if Slack fails
  }

  // --- 2. Send email notification via Gmail SMTP ---
  try {
    // Get contacts from the brief to email
    const contacts = (brief.postgame_contacts || []) as Array<{
      name: string;
      email?: string;
      role: string;
    }>;

    const emailRecipients = contacts
      .filter((c) => c.email)
      .map((c) => c.email as string);

    // Also always notify the default admin email
    const adminEmail = process.env.NOTIFICATION_EMAIL || 'peyton@pstgm.com';
    if (!emailRecipients.includes(adminEmail)) {
      emailRecipients.push(adminEmail);
    }

    if (emailRecipients.length > 0) {
      const gmailUser = process.env.GMAIL_USER;
      const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

      if (gmailUser && gmailAppPassword) {
        // Create a nodemailer "transporter" — this is the thing that
        // actually connects to Gmail's mail servers and sends the email.
        // We use SMTP (Simple Mail Transfer Protocol) on port 465 with SSL.
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,        // e.g. hub@pstgm.com
            pass: gmailAppPassword, // Google App Password (not the regular password)
          },
        });

        await transporter.sendMail({
          from: `"Postgame Hub" <${gmailUser}>`,
          to: emailRecipients.join(', '),
          subject: `New footage: ${athleteName} — ${briefTitle}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px;">
              <h2 style="color: #D73F09;">New Footage Uploaded</h2>
              <p><strong>Athlete:</strong> ${athleteName}</p>
              <p><strong>Campaign:</strong> ${briefTitle}</p>
              <p><strong>Files:</strong> ${fileCount || 0} file${(fileCount || 0) !== 1 ? 's' : ''}</p>
              ${fileList ? `<p style="color: #666; font-size: 14px;">${fileList}${moreFiles}</p>` : ''}
              <br/>
              <a href="${intakeUrl}" style="background: #D73F09; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Review in Intake Queue</a>
              <br/><br/>
              <p style="color: #999; font-size: 12px;">
                Uploaded via <a href="${briefUrl}" style="color: #D73F09;">creative brief</a>
              </p>
            </div>
          `,
        });
      } else {
        console.log(
          `EMAIL NOTIFICATION (no Gmail credentials configured): ` +
          `To: ${emailRecipients.join(', ')} | ` +
          `Subject: New footage uploaded - ${athleteName} | ` +
          `Body: ${fileCount} files uploaded for ${briefTitle}`
        );
      }
    }
  } catch (err) {
    console.error('Email notification failed:', err);
  }

  return NextResponse.json({ success: true });
}
