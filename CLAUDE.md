# CLAUDE.md — Postgame Hub

Read this before touching anything. It applies to every session, including
autonomous ones spawned by Dispatch with edits on auto-accept.

---

## What this is
The Postgame Hub: the internal operating system for Postgame, an NIL sports-marketing
agency connecting brands with college athletes. Next.js 14 (App Router) · TypeScript ·
Tailwind · Supabase (Postgres + Storage + RLS) · deployed on Vercel.

- Repo: `github.com/peyton-rgb/postgame-hub`
- Live repo path: `~/postgame/hub` (stale copies exist elsewhere — confirm before file work)
- Production: `postgame-hub.vercel.app`
- Supabase project ID: `xqaybwhpgxillpbbqtks` — **always reference by ID, never by name.**
  Several projects exist and the names mislead.

---

## HARD RULES — do not violate without explicit approval in the session

### Protected files — never modify without being asked directly
- `src/components/CampaignRecap.tsx`
- `src/components/Top50Recap.tsx`
- `src/components/CampaignMediaPicker.tsx`

These render live client-facing recaps. Breaking them breaks work already delivered.

### Git
- Stage by **explicit filename**. Never `git add -A` — it sweeps in scratch files.
- Merge via the **GitHub PR page**, never terminal-to-main. Squash-merge only.
- Never force-push. `--force-with-lease` only, and only on a branch you rebased.
- `fetch` before any push.
- **Never push without confirming with Peyton first.**

### Database
- SELECT the affected rows **before** any UPDATE or DELETE. Scope with WHERE. SELECT again to verify.
- Use `apply_migration` for schema changes (DDL), not `execute_sql` — it creates tracked history.
- Show before/after on anything destructive.

### One agent per repo
Only one agent works this repo at a time. If another Claude Code or Cowork session may be
active, stop and ask. Parallel sessions cause branch drift. Use a git worktree for real parallelism.

---

## Schema landmines

**Name twins — these are different tables. Check which one you need.**
- `campaign_recaps` (canonical campaign entity) ≠ `brand_campaigns` (1,089 legacy rows) ≠ the `campaigns` view
- `athletes` (9,436) ≠ `athletes_master` (scaffolded, never populated) ≠ `people` (52,809, migrated ColdFusion roster)
- If a task says "athletes," confirm which table before writing.

**Other traps**
- **Ownership lives on the column; curation lives in the link table.** `media.campaign_id` is
  populated on every row (4,533/4,533, 89 campaigns) and `media.athlete_id` on 4,370 rows
  (1,458 athletes) — use these for "media belonging to this campaign/athlete".
  `media_campaigns` (2,120 rows, only 30 campaigns; carries `display_order` + `section`) and
  `media_athletes` (2,130 rows, 685 athletes; carries `role`) are CURATION tables — they control
  placement and tagging inside a recap, not ownership. Querying them when you meant ownership
  under-reports by roughly 3×. Verified 2026-09-04.
- `media.type` values are `'image'` and `'video'` — never `'photo'`.
- Name matching needs `ILIKE` + `TRIM()`. Duplicates and trailing spaces exist.
- `agent_runs.agent_name` is a Postgres **enum**. New agent names require
  `ALTER TYPE ... ADD VALUE` in a migration before they can log.
- Supabase Storage thumbnails: use the `/render/image/public/` endpoint with `?width=N&quality=N`.
- `logo_dark_url` = dark-ink logo, for LIGHT backgrounds.
  `logo_light_url` = light-ink logo, for DARK backgrounds. The name describes the ink, not the background.

---

## Brand rules — non-negotiable on any generated output
- The Postgame mark on any product, mockup, or graphic is **always the real logo file** from the
  `brands` table (Postgame brand ID `7a0e28e9-d62f-427d-a207-cd22596fcf50`).
  **Never render "POSTGAME" as typography on a product.** Writing "Postgame" as a company name in body copy is fine.
- Never AI-generate or redraw a client logo. Pull colors, fonts, and logos from that client's `brands` row.
- Never use NCAA trademark terms ("March Madness," "Final Four," "Elite Eight," "Sweet Sixteen")
  in brand-facing copy. Use "the tournament" or "the Big Dance." Internal names are grandfathered.
- Design system: true black `#07070a`, brand orange `#D73F09` (accent only, never a background fill),
  off-white `#FAF8F5`. Bebas Neue (display), Anton (heavy headlines), Arimo/Arial (body),
  JetBrains Mono (labels). Liquid Glass Dark aesthetic.
- Every surface gets checked mobile-first through desktop before it's considered done.

---

## Reuse before rebuild
Assume the piece already exists. Check first, build last. Known reusable blocks:
- **DrivePicker** — shared "import from Drive" component. Use `corpora: "allDrives"`, never `"user,allDrives"` (400 error).
- **Brand logo lockup** — logos always from the `brands` table.
- **Liquid Glass surfaces** — the frosted dark UI style.
- **Token-gated public pages** — the pattern behind brand portals and athlete delivery.
- **Recap renderer** — rosters, galleries, hero metrics, platform toggles, PPTX export.
- **Agent framework** — `agent_runs` logging + intake / brief_writer / creative_director pattern.

If a change to a shared component starts reaching into unrelated areas, stop and ask.

---

## How to work
1. **Investigate before building.** Read the actual file or run a SELECT. Don't trust a summary,
   a doc, or memory — docs here have claimed tables existed that didn't.
2. **Design before build.** Anything visual gets mocked up and approved before code.
3. **One verified step at a time.** Commit, test, confirm, then proceed. Don't stack unverified changes.
4. **Smoke test first.** Prove it on one example — one athlete, one campaign, one clip — before batching.
5. **"Should fix" is not "did fix."** Verify before declaring done.

Peyton is a self-taught vibe coder. Define technical terms plainly the first time they come up,
and explain what code does before running it. Messes in the codebase came from AI-generated
instructions, not from him — untangle them, don't assign blame.

---

## Verified state — 2026-09-04
Re-verify before trusting these numbers.

- `people` 52,809 · `athletes` 9,436 · `media` 4,533 · `campaign_recaps` 636 · `brands` 132 ·
  `brand_logos` 377 · `colleges` 1,197 · `videographers` 414
- **The `intake` agent is FIXED.** All 51 real failures date from May 7–8. The one July 31 failure
  is a deliberate forced test. Older docs calling intake "stalled, revive first" are wrong.
- `inspo_items`: 566 of 568 embedded (the backlog is done), but only **42 approved of 568**.
  The bottleneck is human triage, not embedding. Shipping the Approve/Reject UI is the current keystone.
- Undocumented but live agents: `admin_sync` (29 runs, 0 failures, daily) and `video_evaluator` (17 runs / 1 failure).
- Housekeeping: 3 orphaned `running` rows in `agent_runs`; archive tables
  (`_archive_admin_campaigns_staging_20260812`, `_brand_color_rollback_20260727`,
  `_deprecated_brand_heroes`) still sit in the `public` schema.
