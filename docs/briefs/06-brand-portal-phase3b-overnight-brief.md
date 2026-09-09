# Brand Portal — Phase 3b–3e: Build the rest of the portal (overnight run)

**Status:** Ready for Claude Code, autonomous. Do not stop to ask questions; make the call, write it in the run log, keep going.
**Branch:** `portal/phase-3b-pages`, stacked on `portal/phase-3a-dashboard`. One PR at the end, draft, base `portal/phase-3a-dashboard`. Use the worktree for every build and render.
**Goal by morning:** every section in the rail is a real page on real data, in the dashboard's visual system, so Peyton can click through the whole portal as CVS and give feedback. Rough edges are fine. Placeholder data is not.
**Governing rules (unchanged from 3a):** reads go through `portal_campaigns` or brand-fenced tables; never `campaign_recaps` directly; never budget / spend / payout / rate / `paypal_*`; every number comes from a query or is not shown; no dashes standing in for data; athletes, photos and names come from the database only; no brand name in chrome copy; no JetBrains Mono; Bebas headings, Anton figures, Arimo body; orange is a surface only on the Waiting-on-you card.

## Run order and what each page is

Build in this order. After each page: render it in the worktree as CVS, screenshot at 1440×900 and 390 wide, append a section to `docs/briefs/runs/phase3b-run.md` with what's real, what's empty, and any call you made. Commit per page.

### 1. Campaigns list — `/portal/campaigns`
Cards in a responsive grid, filter pills All · Live · Wrapped, quarter filter from `portal_campaigns.quarter`, search by name.
- Live card: name (Bebas), quarter · campaign_type, athlete count from `athletes.campaign_id` if > 0, progress bar only if `athlete_deliverables` has rows for it (it won't yet — then no bar), "Live" chip.
- Wrapped card (`delivered` or `closed`): name, quarter, hero thumbnail (`hero_image_url` or first `media.is_hero`), up to three Anton stats from `kpi_targets`/`public_sections` if present, else athlete count only, "View results" link if a recap is published.
- Sort: live first, then by `admin_created_on` desc.

### 2. Campaign detail — `/portal/campaigns/[slug]`
Hero (hero image, edge-blended, name in Anton, quarter · type · platform), then tabs. Tab set depends on state: live → Overview · Athletes · Content · Approvals; wrapped → Overview · Athletes · Content · Results.
- **Overview:** description, stats row (athletes, schools, media count — only those with data), Postgame contact from `manager_name` / `manager_email`, Drive download button if `drive_content_folder_id` is set (link to the folder; never display the folder title).
- **Athletes:** grid of athlete cards from `athletes.campaign_id`: headshot (first `media` photo for that athlete on the campaign, else initials), name, school, sport, followers, top reel views if present. School filter chips. Click → nothing this phase.
- **Content:** 2-column masonry of `media` for the campaign, filters Posts · BTS · Photos (from `media.type` / category), lightbox on click, Drive download button.
- **Results (wrapped only):** rendered from structured recap fields — headline, key takeaways, KPI figures, top content — obeying `public_sections` visibility. If the recap has no structured content, show "Results are being prepared" with the hero and athlete count; never fabricate.
- **Approvals (live only):** reads `review_sessions` for the campaign; empty state today.

### 3. Content — `/portal/content`
The tablet gallery: all brand media across campaigns, newest first, 5-across at desktop, filters All · Reels · Posts · Stories · BTS · Photos plus Campaign / Athlete / School dropdowns, "New" tag on media created in the last 14 days, video duration if the row has it, lightbox, multi-select + "Download selected" (zip via a server route; if that's more than an hour, ship single-file download and log it).

### 4. Reports — `/portal/reports`
Recap library: every wrapped campaign with a published recap, grouped by quarter, thumbnail card (hero), name, quarter, "Open recap" to the existing recap route. Quarter filter. Empty state if none.

### 5. Athletes — `/portal/athletes`
All athletes who have appeared on any of the brand's campaigns, deduplicated by athlete, with headshot, school, sport, followers, campaigns count, most recent campaign. Search, school and sport filters. Sort by followers desc.

### 6. Settings — `/portal/settings`
Team: rows from `brand_contacts` for the brand (name, email, role, status), read-only this phase. Brand logo: from `brand_logos`, read-only. Notifications: three toggles rendered disabled with "Coming soon". Sign out.

### 7. Rail + tab bar
Wire every rail icon and the phone tab bar to these routes; active state on the current section; tooltips as on the dashboard.

### 8. Dashboard links
Every "See all / All athletes / All results / Calendar ›" on the dashboard now points at the matching page. Campaign cards link to detail. Top posts link to the athlete's row on the campaign's Athletes tab.

## Data facts already established (don't re-discover)
- CVS: 6 active campaigns (all empty of athletes and media), 46 wrapped (10 closed hold the real content: SPF, The Tournament, W/CWS, Holiday, Chicago Activation, Minute Clinic, 26 Spring Epic Beauty, CVS '26 Q1, Mother's Day, RMH Boston).
- Athletes live on `athletes.campaign_id` (2,096 CVS rows, 1,523 distinct), metrics in `athletes.metrics` (per-platform objects; `ig_reel.views` is the ranking field; exclude exact multiples of 100,000 — campaign aggregates).
- Media: 460 CVS rows, 8 hero. `athlete_deliverables` and `review_sessions` are effectively empty — every tile that depends on them renders its empty state.
- `portal_campaigns` view exists (migration 046). Reuse it.

## Phase 2 RLS — last, as its own PR
When the pages are done, read `docs/briefs/02-brand-portal-phase2-rls-brief.md` and implement it on a separate branch `portal/phase-2-rls` from `main`: helper functions, policies, the 6-check test script. Run the test script and put its output in the PR. Do not merge anything.

## Do not
- Do not touch `/portal/login`, the Phase 1 callback, middleware gating, or the admin preview.
- Do not modify `campaign_recaps`, `athletes`, or `media` data. Read only.
- Do not push to `main`. Do not merge PRs.
- Do not invent metrics, names, dates, or copy that claims a result.

## Final report (write it in `docs/briefs/runs/phase3b-run.md` and paste it in the PR body)
Per page: screenshot paths, which tiles/sections are real vs empty for CVS and why, every judgement call you made, anything you skipped and the reason. End with the three things Peyton should look at first tomorrow.
