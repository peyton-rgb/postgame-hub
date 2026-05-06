// ============================================================
// Slack notification service
// Sends notifications to a Slack channel when briefs are published
// or other important events happen.
//
// Requires: SLACK_WEBHOOK_URL env variable
// (Create an Incoming Webhook in Slack: your workspace Settings →
//  Apps → Incoming Webhooks → Add New Webhook)
//
// Optional: SLACK_NOTIFICATIONS_ENABLED env variable
// Set to "false" to disable without removing the webhook URL.
// ============================================================

interface SlackBriefNotification {
  briefName: string;
  brandName: string;
  publishedBy: string;
}

/**
 * Sends a Slack notification when a brief is published.
 * If Slack is not configured, logs a warning and returns silently
 * (doesn't crash the publish flow).
 */
export async function sendSlackNotification(
  payload: SlackBriefNotification
): Promise<void> {
  // Check if Slack notifications are explicitly disabled
  if (process.env.SLACK_NOTIFICATIONS_ENABLED === 'false') {
    console.log('Slack notifications disabled via env flag');
    return;
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      'SLACK_WEBHOOK_URL is not set — skipping Slack notification. ' +
      'To enable, add a Slack Incoming Webhook URL to your env vars.'
    );
    return;
  }

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📋 New Brief Published',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Brief:*\n${payload.briefName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Brand:*\n${payload.brandName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Published by:*\n${payload.publishedBy}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in Hub',
              emoji: true,
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://postgame-hub.vercel.app'}/dashboard/campaign-briefs`,
          },
        ],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}`);
  }
}
