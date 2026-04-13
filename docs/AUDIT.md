# Postgame Hub — Full System Audit

**Date:** April 13, 2026
**Project:** `postgame-hub` (Supabase ID: `xqaybwhpgxillpbbqtks`, Vercel: `postgame-hub.vercel.app`, GitHub: `peyton-rgb/postgame-hub`)
**Owner:** Peyton Jula

---

## TL;DR — The Diagnosis

Your Hub isn't broken. It's **overgrown**. Here's the honest picture:

1. **The database is healthier than it feels.** 30 tables, 86 migrations, ~3,000 real records (1,280 athletes / 1,083 brand_campaigns / 1,305 media / 416 deals). The schema works.
2. **Six security errors need fixing today.** Not theoretical — actual ERROR-level lints from Supabase's own linter. ~30 min of work.
3. **Your RLS is effectively turned off.** 32 tables have policies that say "any authenticated user can do anything." That's not security — that's a placeholder you forgot to replace.
4. **You have ghost tables.** 9 tables with 0 rows that you built and never used. Some are duplicates of tables that *do* have data.
5. **The "I can't find anything" problem isn't a code problem — it's a structure problem.** No README, no architecture doc, no consistent naming, scripts scattered across `~/scripts` and `~/postgame/hub`.

**The fix isn't a rewrite. It's a one-week cleanup. Plan at the bottom.**

---

# PART 1 — The Stack (What Each Tool Does and Why)

You're using six tools. Each has one job. When you're confused, it's almost always because you're looking in the wrong tool. Pin this section.

| Tool | Its ONE job | What lives there | What does NOT live there |
|---|---|---|---|
| **GitHub** (`peyton-rgb/postgame-hub`) | Source of truth for code. The history. | Every `.tsx`, `.ts`, `.sql` migration file, `package.json`. The branches. | Secrets, env vars, the database itself, deployed URLs |
| **Vercel** (`postgame-hub.vercel.app`) | Runs the Next.js app on the internet. Reads from GitHub, deploys on push. | Environment variables (the secrets), domains, build logs, edge runtime | Your code (it just clones from GitHub), the database |
| **Supabase** (project `xqaybwhpgxillpbbqtks`) | The database + file storage + auth + serverless functions | Tables, rows, RLS policies, storage buckets, edge functions, migrations history | UI code, deployed pages |
| **VS Code** | Edit code locally on the iMac/MacBook. | Your local working copy of the GitHub repo | Anything live |
| **Cursor** | Same as VS Code but with AI built in | Same as VS Code | Same as VS Code |
| **Terminal** | Talk to GitHub (git), Vercel (vercel CLI), Supabase (supabase CLI), and run scripts | Local scripts in `~/scripts/`, git commands, deployment commands | — |

**The mental model:** You write code in **VS Code/Cursor** → push it to **GitHub** → Vercel sees the push and **builds + deploys** → the deployed app talks to **Supabase** for data. **Terminal** is the glue.

**Your `~/scripts/` directory is separate.** Those Google Drive renaming scripts have nothing to do with the Hub deployment. They're Peyton's local utilities. They should NOT live next to Hub code.

---

# PART 2 — Supabase Deep Dive (Live Data)

## 2.1 — Tables (30 total)

Sorted by row count so you can see what's actually being used vs. dead weight.

### ✅ ACTIVELY USED (has real data)

| Table | Rows | Purpose |
|---|---|---|
| `media` | 1,305 | All campaign content files (the big one) |
| `athletes` | 1,280 | Athlete master records |
| `brand_campaigns` | 1,083 | Every brand × campaign instance |
| `deals` | 416 | Public-facing deals roll-up |
| `brands` | 120 | Brand master list |
| `press_articles` | 66 | Press coverage |
| `campaign_recaps` | 26 | Public recap pages |
| `case_studies` | 18 | Public case studies |
| `briefs` | 8 | Brief Builder content |
| `ros_shoots` | 8 | Run-of-show shoots |
| `pages` | 3 | Public site pages |
| `page_sections` | 4 | Section blocks for pages |
| `deal_tracker` | 3 | Deal tracker entries |
| `run_of_shows` | 2 | Run-of-show parents |
| `optin_campaigns` | 2 | Opt-in landing campaigns |
| `pending_optins` | 1 | Submitted opt-ins |
| `pitch_pages` | 1 | Pitch Page Creator content |
| `newsletters` | 1 | Newsletter records |
| `page_athletes` | 6 | Junction: pages ↔ athletes |

### ⚠️ EMPTY / SUSPECT (0 rows — built but unused)

| Table | Rows | Verdict |
|---|---|---|
| `brand_athletes` | 0 | **Likely dead.** Old "hub_participants" pattern. Athletes are linked via `media.athlete_id` and `page_athletes` instead. |
| `brand_posts` | 0 | **Dead.** Old "hub_posts." Never adopted. |
| `brand_media` | 0 | **Dead.** Old "hub_campaign_media." Replaced by `media`. |
| `brand_assets` | 0 | **Dead.** Brand kit data lives in `brands.logo_*` columns instead. |
| `media_folders` | 0 | **Suspect.** Built for media library but never populated. |
| `media_files` | 0 | **Suspect.** Same — replaced by `media` table. |
| `page_media` | 0 | **Suspect.** Junction never wired up. |
| `campaign_instructions` | 0 | **Dead.** Never used. |
| `campaign_optins` | 0 | **Dead.** Replaced by `optin_campaigns`. |
| `campaign_optin_submissions` | 0 | **Dead.** Replaced by `pending_optins`. |
| `tier3_submissions` | 0 | New, in-progress |

**Translation:** You have at least **9 tables you can drop** (after confirming nothing in code references them). That's roughly 30% of your schema that's confusing you for no reason.

## 2.2 — The "Three Pairs of Doppelgängers" Problem

This is the single biggest source of your "where does this live" pain. You renamed tables mid-build and didn't fully migrate:

| Old name (dead policies still reference) | Current name | Status |
|---|---|---|
| `hub_campaigns` | `brand_campaigns` | Renamed, but RLS policies still say "Auth full access hub_campaigns" |
| `hub_participants` | `brand_athletes` (empty) → really `media.athlete_id` | Triple-confused |
| `hub_campaign_media` | `brand_media` (empty) → really `media` | Triple-confused |
| `hub_posts` | `brand_posts` (empty) | Just dead |
| `hub_pages` | `pages` | Renamed cleanly |
| `campaigns` | `campaign_recaps` | Renamed cleanly |

When you grep your code for "campaigns" you get hits across `brand_campaigns`, `campaign_recaps`, `optin_campaigns`, `campaign_instructions` — that's why nothing feels findable.

## 2.3 — Edge Functions (only 2)

| Name | Status | Verify JWT |
|---|---|---|
| `upload-brand-logos` | ACTIVE | ❌ NO |
| `fix-light-logos` | ACTIVE | ❌ NO |

Both are one-shot brand-kit utilities. Neither has JWT verification. Low risk because they don't write sensitive data, but they're publicly callable. **Recommend: delete after one-time use, or add JWT verify.**

## 2.4 — Migrations (86 total)

History is intact. Recent activity (last 7 days) shows healthy iteration: SEO columns, deal splitting, RLS lockdown attempts, auth policy fixes. The most recent two (`fix_auth_full_access_policies_with_check`) were attempts to tighten the very policies that the security advisor is still flagging — meaning **the fix didn't fully take.** See Part 3.

---

# PART 3 — Critical Findings (Sorted by Severity)

## 🔴 CRITICAL — Fix this week

### C1. Six SECURITY DEFINER views exposed to the public web (ERROR-level)

These views run with the creator's permissions, bypassing the caller's RLS:
- `public.public_campaign_recaps`
- `public.public_deals`
- `public.public_brands`
- `public.public_pages`
- `public.public_press`
- `public.public_deal_tracker`

**Impact:** Anyone hitting your public site can potentially read more rows than your RLS would allow. Probably not exfiltrating sensitive data right now (these are designed to be public), but it's an architectural footgun.

**Fix:** Recreate each view with `SECURITY INVOKER` or convert to functions with explicit RLS checks. [Supabase docs](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).

### C2. RLS is "always true" on 30+ tables

Every table with a policy named like "Auth users full access to X" has `USING (true) WITH CHECK (true)` for authenticated role. Translation: **any logged-in user can read, write, update, or delete any row in any of these tables.** That includes you, your team, and any account you ever invite.

Tables affected: `athletes`, `brand_assets`, `brand_athletes`, `brand_campaigns`, `brand_media`, `brand_posts`, `brands`, `briefs`, `campaign_instructions`, `campaign_optin_submissions`, `campaign_optins`, `campaign_recaps`, `case_studies`, `deal_tracker`, `deals`, `media`, `media_files`, `media_folders`, `newsletters`, `optin_campaigns`, `page_athletes`, `page_media`, `page_sections`, `pages`, `pending_optins`, `pitch_pages`, `press_articles`, `ros_shoots`, `run_of_shows`.

**Impact:** Today, low — you're the only authenticated user. Tomorrow, when you onboard a teammate, this becomes a real problem.

**Fix decision:** Either (a) accept this is a single-user app and document it, or (b) replace `USING (true)` with role-based checks. Pick one.

### C3. Two duplicate INSERT/UPDATE policies bypass auth on `pending_optins` and `campaign_optin_submissions`

Anonymous users can insert anything into `pending_optins` and `campaign_optin_submissions` with no validation. This is intentional for opt-in forms, but **add rate limiting** at the API layer or you'll get spammed.

## 🟠 HIGH — Fix this month

### H1. RLS performance bombs on `tier3_submissions`

Three policies call `auth.<function>()` per row instead of `(select auth.<function>())`. Doesn't matter at 0 rows — will matter at 10,000.

### H2. Multiple permissive policies on 27 table+role+action combos

Every public-readable table has overlapping "auth full access" + "public read published" policies. Postgres runs both for every query. Pick one.

### H3. Mutable search_path on 2 functions

`set_updated_at` and `touch_optin_campaigns_updated_at` — minor security hygiene. Add `SET search_path = public, pg_temp`.

### H4. Leaked password protection is OFF in Supabase Auth

Free fix in dashboard. Auth → Policies → enable "Leaked password protection" (HaveIBeenPwned check).

## 🟡 MEDIUM — Cleanup backlog

### M1. 32 unused indexes

Dead weight slowing down writes. Examples: `idx_run_of_shows_brand`, `brand_assets_type_idx`, `idx_briefs_slug`, `idx_pages_type`. Drop them.

### M2. 4 sets of duplicate indexes

- `campaign_optins`: `campaign_optins_brand_id_idx` ≡ `idx_campaign_optins_brand_id`
- `campaign_recaps`: `idx_campaigns_slug` ≡ `recaps_slug_idx`
- `deals`: `deals_brand_id_idx` ≡ `idx_deals_brand`
- `pages`: `idx_hub_pages_type` ≡ `idx_pages_type`

Drop the older one in each pair (the `idx_hub_*` and earlier-named ones).

### M3. 2 missing FK indexes

- `pitch_pages.brand_id` — add index
- `tier3_submissions.recap_id` — add index

### M4. 9 ghost tables (listed in 2.1)

Drop after code search confirms zero references.

### M5. Auth DB connections capped at 10

Will throttle once you get real concurrency. Switch to percentage-based allocation.

---

# PART 4 — What I Need From You (Vercel + GitHub)

I can't pull these via tools — the connectors don't expose the right endpoints. Run these in your terminal on the iMac, paste output back, and I'll fold them into the audit.

## 4.1 — From your terminal, in `~/postgame/hub`:

```bash
# Save all outputs to one file
mkdir -p ~/postgame-audit && cd ~/postgame-audit

# === GIT / GITHUB ===
echo "=== BRANCHES ===" > git-state.txt
git -C ~/postgame/hub branch -a >> git-state.txt
echo -e "\n=== LAST 30 COMMITS ===" >> git-state.txt
git -C ~/postgame/hub log --oneline -30 >> git-state.txt
echo -e "\n=== UNCOMMITTED CHANGES ===" >> git-state.txt
git -C ~/postgame/hub status >> git-state.txt
echo -e "\n=== STASHES ===" >> git-state.txt
git -C ~/postgame/hub stash list >> git-state.txt

# === REPO STRUCTURE (top 3 levels, no node_modules) ===
echo "=== TREE ===" > tree.txt
find ~/postgame/hub -maxdepth 3 -type d \
  -not -path '*/node_modules*' \
  -not -path '*/.next*' \
  -not -path '*/.git*' >> tree.txt

# === ROUTES (Next.js app router) ===
echo "=== ROUTES ===" > routes.txt
find ~/postgame/hub/src/app -name 'page.tsx' -o -name 'route.ts' 2>/dev/null \
  | sed "s|$HOME/postgame/hub/src/app||" >> routes.txt

# === PACKAGE DEPENDENCIES ===
cp ~/postgame/hub/package.json package.json

# === VERCEL (requires `vercel` CLI logged in) ===
cd ~/postgame/hub
vercel env ls > ~/postgame-audit/vercel-env.txt 2>&1
vercel ls --scope=$(cat .vercel/project.json 2>/dev/null | grep orgId | cut -d'"' -f4) > ~/postgame-audit/vercel-deployments.txt 2>&1 || echo "Run: vercel link first" > ~/postgame-audit/vercel-deployments.txt

ls ~/postgame-audit/
```

Then either paste the contents of those 6 files in chat, or zip the folder and upload it.

## 4.2 — One quick check I want you to eyeball yourself:

Open Vercel dashboard → `postgame-hub` project → Settings → Environment Variables. Count how many you have. If it's more than ~10, we likely have stale secrets to prune.

---

# PART 5 — The Cleanup Plan (Ordered, Step-by-Step)

Don't do these out of order. Each step is 30–90 minutes.

### Day 1 — Stop the bleeding (Supabase critical)
1. Fix the 6 SECURITY DEFINER views (C1)
2. Enable leaked password protection (H4)
3. Drop the 4 duplicate indexes (M2)
4. Add the 2 missing FK indexes (M3)

### Day 2 — Map your code
5. You run the terminal commands in Part 4
6. I produce a route-by-route map and identify dead code
7. I write you a `README.md` and `ARCHITECTURE.md` to commit at the repo root

### Day 3 — Drop the ghosts
8. Search code for references to the 9 empty tables
9. Drop the truly orphaned ones via migration
10. Drop the 32 unused indexes

### Day 4 — RLS decision day
11. Decide: single-user app (document it) OR multi-user (rebuild policies)
12. If multi-user: write proper RLS by role, drop the "always true" policies
13. Consolidate the 27 multiple-permissive-policy collisions

### Day 5 — Repo hygiene
14. Move `~/scripts/` utilities to a separate `postgame-utilities` repo
15. Standardize: every file in `src/` has a one-line comment header explaining its job
16. Delete unused `.tsx` files (we'll find them in step 6)
17. Tag a git release `v1.0-cleanup` so you have a known-good rollback point

---

# PART 6 — Naming Convention Going Forward

So we never have `hub_X` vs `brand_X` vs `campaign_X` confusion again:

**Tables:**
- `{noun}` for master tables: `brands`, `athletes`, `media`
- `{parent}_{child}` for junctions: `page_athletes`, `brand_campaigns`
- `{noun}_{purpose}` for derived: `campaign_recaps`, `pitch_pages`

**No more `hub_` prefix anywhere.** It's all "the Hub" — the prefix means nothing.

**Routes:**
- `/dashboard/*` = private, requires auth
- `/(public)/*` = public-facing
- `/api/*` = server functions

**Files:**
- Components: PascalCase: `PitchEditor.tsx`
- Utilities: kebab-case: `csv-parser.ts`
- Migrations: `YYYYMMDDHHMMSS_descriptive_snake_case.sql`

---

# Appendix A — Quick Reference Card

```
WHERE DOES X LIVE?
  Code              → GitHub: peyton-rgb/postgame-hub
  Local edits       → ~/postgame/hub on iMac
  Secrets           → Vercel env vars (NOT in code, NOT in GitHub)
  Tables/data       → Supabase project xqaybwhpgxillpbbqtks
  Files/images      → Supabase Storage bucket: campaign-media
  Build/deploy      → Vercel (auto from GitHub main)
  Drive scripts     → ~/scripts/ (separate from Hub!)

WHEN SOMETHING BREAKS, CHECK IN THIS ORDER:
  1. Vercel deploy log (did the build fail?)
  2. Browser console (frontend error?)
  3. Vercel function log (API route error?)
  4. Supabase logs (database error?)
  5. Supabase advisors (was a policy added that broke things?)
```
