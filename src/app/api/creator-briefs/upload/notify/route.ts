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

const getAdminSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// Slack channel for upload notifications
const SLACK_CHANNEL_ID = 'C093WTTJ7QS'; // #postgame-productions

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

  // --- 1. Send Slack notification ---
  try {
    const slackText =
      `📸 *New footage uploaded*\n\n` +
      `*Athlete:* ${athleteName}\n` +
      `*Campaign:* ${briefTitle}\n` +
      `*Files:* ${fileCount || 0} file${(fileCount || 0) !== 1 ? 's' : ''}\n` +
      (fileList ? `*Names:* ${fileList}${moreFiles}\n` : '') +
      `\n<${intakeUrl}|View in Intake Queue> · <${briefUrl}|View Brief>`;

    // Use Slack Bot Token to post via the Slack Web API
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (slackToken) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${slackToken}`,
        },
        body: JSON.stringify({
          channel: SLACK_CHANNEL_ID,
          text: slackText,
          unfurl_links: false,
        }),
      });
    } else {
      console.log('SLACK NOTIFICATION (no bot token configured):', slackText);
    }
  } catch (err) {
    console.error('Slack notification failed:', err);
    // Don't fail the whole request if Slack fails
  }

  // --- 2. Send email notification ---
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
      // Use Supabase Edge Function or a simple email service
      // For now, we'll use Supabase's built-in email via the auth system
      // or a webhook. We'll log it and you can wire up SendGrid/Resend later.

      // Simple approach: store the notification in a notifications table
      // so the dashboard can show it, and send email via a service
      console.log(
        `EMAIL NOTIFICATION: To: ${emailRecipients.join(', ')} | ` +
        `Subject: New footage uploaded - ${athleteName} | ` +
        `Body: ${fileCount} files uploaded for ${briefTitle}`
      );

      // If Resend API key is available, send the email
      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Postgame Hub <notifications@pstgm.com>',
            to: emailRecipients,
            subject: `📸 New footage: ${athleteName} — ${briefTitle}`,
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
          }),
        });
      }
    }
  } catch (err) {
    console.error('Email notification failed:', err);
  }

  return NextResponse.json({ success: true });
}
