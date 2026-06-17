# Manager Layer — Slack Setup

Manager notifications (submissions, posts awaiting verification, compliance
flags, deadlines) post to Slack **in addition** to the in-app bell/inbox. Slack
is **env-gated and off by default** — without a webhook the Slack path no-ops
and in-app notifications still fire.

> ⚠️ HARD STOP: nothing posts to a real Slack workspace until **you** add
> `SLACK_WEBHOOK_URL` to the environment. No webhook is committed to the repo.

## 1. Create an Incoming Webhook (one-time)
1. Slack → **Apps** → create/choose an app for your workspace.
2. Enable **Incoming Webhooks**, **Add New Webhook to Workspace**, pick the
   channel (e.g. `#postgame-ops`).
3. Copy the webhook URL (`https://hooks.slack.com/services/...`). The channel is
   baked into the webhook — messages go there.

## 2. Set env vars
Add to Vercel (Preview/Production) or `.env.local`:

| Var | Required | Purpose |
|---|---|---|
| `SLACK_WEBHOOK_URL` | to enable Slack | The incoming webhook URL. Unset → no-op. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Base for the "Open in the Hub" link (absolute). |
| `SLACK_DRY_RUN` | no | `1` → log the payload instead of sending (testing, no workspace). |
| `SLACK_EVENTS` | no | Comma-separated allowlist of event types to post; unset = all. |

Never paste the webhook into the repo or chat.

## 3. Which events post
The same events as the in-app bell, one message each (already batched — a single
"submitted N items" message, never one per file):

| `type` | When |
|---|---|
| `content_submitted` | An athlete/videographer submitted content for approval |
| `post_awaiting_verification` | An athlete posted a live link to verify |
| `compliance_flag` | The auto-editor hard-gated content on compliance |
| `new_optin` | An athlete opted into a campaign |
| `deadline_soon` / `deadline_passed` | A live campaign is due soon / overdue with incomplete deliverables |

Each message is Slack mrkdwn: an emoji + the title, the detail line, and a link
back to the filtered review queue (`/dashboard/athlete-deals?campaign=…`).

## 4. Deadline checks (scheduled)
Deadline events aren't triggered by a user action, so run the check on a
schedule: point a **Vercel cron** at `GET /api/staff/manager/check-deadlines`
with header `x-cron-key: $CRON_SECRET` (set `CRON_SECRET` in env). The check is
deduped — a campaign won't be re-nudged within 24h.

## 5. Test without a workspace
Set `SLACK_DRY_RUN=1` (no webhook needed): the sender logs the exact payload it
would post instead of sending, so you can confirm formatting safely.
