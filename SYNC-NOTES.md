# How the admin sync works

_Plain-English note. Last verified 2026-07-13 against Supabase project `xqaybwhpgxillpbbqtks`._

## The short version

A small **Node job runs every 10 minutes** and keeps Supabase in step with our
**legacy Postgame admin** (`pstgm.com/admin/campaigns.cfm`, and what looks like an
Airtable base). It reads from those sources and writes two tables in Supabase:
`admin_campaigns` and `recap_intake_flags`. Nothing in this repo runs it — it lives
outside the hub app.

## What runs, and where from

- It's a **Node process talking to the Supabase REST API** (every request shows
  user-agent `node`). We caught it live in the API logs.
- It fires **every 10 minutes, on the dot** — a clean, drift-free cadence.
- It is **not** any of these (all checked):
  - **not** a Postgres `pg_cron` job — pg_cron isn't even installed on the project
  - **not** a Supabase Edge Function — none of the deployed functions do this
  - **not** a Vercel cron in this repo — `vercel.json` has no `crons` block
  - **not** a GitHub Action — those drift and skip; this doesn't
- The **source code is not in this repo or on this machine** (nothing here references
  `admin_campaigns` or `recap_intake_flags`). It's deployed somewhere with the
  Supabase service-role key in its environment — most likely a **standalone always-on
  worker (e.g. a Fly.io machine)** or a **Vercel Cron in a separate project**. Exact
  host is still unconfirmed; that's the one open question.

## What it writes

**`admin_campaigns`** — a mirror of the campaigns in the legacy admin.
- Columns: `admin_id`, `name`, `brand`, `status`, `synced_at`
- ~589 rows today (52 `active`, 537 `archived`)
- Has a staging sibling, `_admin_campaigns_staging`, used while refreshing
- `synced_at` is the "last touched" breadcrumb (last full refresh: 2026-07-10)

**`recap_intake_flags`** — the intake reconciler's output.
- Columns: `item_id`, `campaign_id`, `reasons`, `flagged_at`
- Each cycle it lines up admin campaigns against `campaign_recaps.admin_campaign_id`
  (plus `brands`) and drops a flag row when an item needs attention — the `reasons`
  column says why.
- `item_id` values look like **Airtable record IDs** (e.g. `Rec0BGDAFE6NP`), which is
  why we think Airtable is one of the upstream sources.

## How often

- **Every 10 minutes** for the intake reconcile / poll.
- The larger full mirror refresh (the one that bumps `synced_at` across all rows)
  appears to run less often — last one was **2026-07-10**.

## What breaks if it stops

Nothing goes down immediately — but things quietly go stale:

- **New or changed campaigns from the admin stop appearing.** `admin_campaigns` and its
  `brand` list freeze at the last sync, so anything that reads them (admin/matching
  tooling, brand pickers fed from this table) shows old data.
- **Intake gaps stop being flagged.** `recap_intake_flags` won't update, so
  recaps that are missing an admin match — or whatever the reconciler watches for —
  won't get surfaced. Problems pile up silently instead of being caught.
- **The public hub and recap pages keep working.** The live site reads
  `campaign_recaps`, `athletes`, `media`, etc. — it does **not** read `admin_campaigns`
  directly — so `/recap/[slug]` and the dashboard keep rendering fine. The damage is
  "our data drifts out of date," not "the site is down."

**How you'd notice it stopped:** `max(synced_at)` on `admin_campaigns` (and
`max(flagged_at)` on `recap_intake_flags`) stops advancing. If either is more than a
few hours old, the job isn't running.

## Open question / next step

To pin down exactly where the job is hosted, check **Fly.io** (`fly apps list`) for a
sync/worker app and your **Vercel projects** for a cron config. The runner has the
service-role key, so whoever owns that host owns the sync.
