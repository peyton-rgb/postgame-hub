// ============================================================
// Slack delivery (env-gated) — Phase 2 stub, fleshed out in Phase 3.
//
// sendSlack() posts a manager event to Slack via SLACK_WEBHOOK_URL. If the env
// var is unset it NO-OPS (logs once) so in-app notifications still work.
// ============================================================

import type { ManagerEvent } from "@/lib/manager-notify";

export function formatSlack(ev: ManagerEvent): string {
  // Plain text for now; Phase 3 adds mrkdwn + a link back to the Hub.
  return ev.message ? `${ev.title} — ${ev.message}` : ev.title;
}

export async function sendSlack(_type: string, _text: string): Promise<void> {
  if (!process.env.SLACK_WEBHOOK_URL) {
    // No-op until configured (Phase 3 / Peyton adds the webhook). TODO.
    return;
  }
  // Real delivery implemented in Phase 3.
}
