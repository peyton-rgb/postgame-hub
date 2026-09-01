# RECAP BUILDER — SESSION HANDOFF (2026-08-31 overnight)
> For the next planner thread. Read this + `claude_RECAP-BUILDER-HERO-SPEC.md` before doing anything.
> Campaign for all prototyping: **ghost-amp-961** (Brooks Ghost Amp), Supabase `xqaybwhpgxillpbbqtks`.

## Where the build stands
Page-per-step wizard prototypes, real data, one page at a time → approve → next. Order (FINAL):
**Athletes · Overview · Hero · Performers · Content · Takeaways · Sections** — and on the public page,
Takeaways renders **after the Roster**, near the end.

Done & approved (HTML prototypes in /outputs and committed to `docs/recap-builder/prototypes/` on main):
1. **builder-01-athletes.html** — tracker + Drive scan + per-athlete content column
2. **builder-02-overview.html** — metric/platform toggles, zero rule, live preview, focus-follow
3. **builder-03-hero-v11.html** — FROZEN. Full rules in `claude_RECAP-BUILDER-HERO-SPEC.md` (webp
   transformer, ratio modes, eased fades w/ floor, natural-height boxes, prose standard 19px white).
4. **builder-04-performers-v2.html** — FROZEN tonight. Auto top 5 only (no manual), basis toggle
   **Engagements/Impressions on BOTH builder and public section** (one synced state), cards = photo
   with rank numeral + orange underline top-left, IG glass icon bottom-right → instagram.com/{handle},
   single toggled metric with source attribution ("13.3K ENGAGEMENTS · VIA IG FEED", source =
   argmax across channels per basis), thumbnail per performer via "Select thumbnail" button →
   popup picker of their staged photos, amber flag banner "N of 5 need a thumbnail" (gates publish
   checklist in real build), saves thumb_media_id per athlete.
   Impressions formula: feed impressions + story total_impressions + reel views + tiktok views.

NOTE: the repo copies of prototypes 01–03 are one revision stale (rail order + hero v11 tweaks came
after the commit). Refresh docs/recap-builder/ in the next docs PR, and add 04 + this handoff.

## Design imports from recap-mockup-yourbrand (DECIDED tonight)
Source: `~/postgame/hub-recap-er/public/recap-mockup-yourbrand_10.html` (untracked, 43MB, served at
localhost:3000/recap-mockup-yourbrand_10.html — dev server must be running; CC starts it).
- **REJECTED: numbered section kickers / period headers.** Keep current kicker + Bebas style.
- **ADOPT #2 — "Rundown" Overview layout:** orange-left-ruled intro paragraph with inline orange
  stat highlights + right-side spec table (mono labels / white values / hairline rows: campaign
  name, platforms, content type, etc.). Binds to existing Overview-step fields.
- **ADOPT #3 — Campaign timeline:** 4 Anton month blocks (index, big month, sub-date, hairline,
  mono label + note) + "N DAYS · KICKOFF TO DELIVERY" meta. Auto-hide if dates missing.
- **ADOPT #4 — Statement Takeaways:** ONE giant Anton headline sentence with orange emphasis
  phrases + two hairline-topped support lines. This IS the Takeaways design; builder step =
  headline field + control to mark the orange phrase + support lines. **Takeaways page is the
  next thing to build, in this style.**
- **ADOPT #5 — stat band styling:** vertical hairline dividers, orange mini bar-sparkline + mono
  sub-caption under each number; KPI glass cards with orange top tick. Applies to The Numbers.
- **ADOPT #9 — post-type breakdown cards:** IG Reels / Feed / Stories cards (platform icon, huge
  Anton stat, hairline metric rows, orange eng-rate last row). Zero rule hides absent platforms.
- **ADOPT #11 — roster table flourishes:** mono column headers, orange POST↗ / REEL↗ links,
  Drive icon button per row.
- **SKIP:** their leaderboard + performer photo row (ours is better), map (no state column),
  masonry (have it), scroll animations (polish phase, not builder-blocking).

## Next steps, in order
1. **Takeaways page** (builder-05) in statement style (#4) — real Ghost Amp copy, same chrome
   (rail step 6, preview panel, zero rule, autosave).
2. **Content page** — per-athlete content boxes; 102-tile grid w/ athlete filter; reuse AssetModal
   pattern from portal; hero/BIC selection.
3. **Sections & Publish page** — order/visibility list (encodes Takeaways-after-Roster), publish
   gate incl. thumbnail flags, Republish warns-not-blocks.
4. **Merge** all pages into one multi-step HTML prototype; refresh repo docs (stale copies + 04 +
   05–07 + this handoff) in one docs PR.
5. **Master CC brief**: port from docs/recap-builder/prototypes verbatim; hero spec is law; safety
   gate (own branch → Vercel preview → revertible recap_config; published recaps untouched until
   explicit republish); note the brief REVERSES the older one-page-scroll instruction.

## Environment facts (laptop session)
- Machine: MacBook (user peytonjula, home /Users/p). CC session live; dev server `hub-recap-er`
  (branch local/recap-builder) on :3000 — worktrees: hub, hub-recap, hub-recap-er, hub-intake,
  hub-uxsandbox under ~/postgame.
- Chrome extension: TWO browsers on the account — iMac ("Browser 1") and **"Mackbook Pro"** (named
  tonight). Use list_connected_browsers → select "Mackbook Pro" for anything on localhost:3000.
  file:// URLs are blocked for the extension — serve via the dev server instead.
- Backups done tonight: `local/recap-builder` (18 commits) pushed to origin, NOT merged — keep it
  that way. `docs/recap-builder-spec` PR merged to main (docs-only). PR #226 still open (Peyton's
  call). Stale PRs #42–#148 = future housekeeping.
- CC offered a `.git/info/exclude` line for the 43MB mockup in public/ — Peyton should accept.

## Data references (verified tonight)
- Top 5 by engagements: Andi Vanmeter 13,291 · Sophine 1,171 · Emily Pierce 930 · Pierce Graber
  804 · Lauren Lewis 758 (0 photos → initials card).
- Top 5 by impressions: Andi 64,290 · Ethan Cook 40,713 (story-driven) · Kailey 14,458 (reel) ·
  Emily 13,705 · Sophine 10,941.
- Metrics live in `athletes.metrics` jsonb (ig_feed / ig_reel / ig_story / tiktok);
  `is_featured` / `featured_order` columns exist for the featured writes.
- All photo URLs & handles are embedded in builder-04-performers-v2.html.

## How to start the next thread
Open a new chat in this project and say:
"Continue the recap builder. Read claude_RECAP-BUILDER-HANDOFF.md and
claude_RECAP-BUILDER-HERO-SPEC.md from project knowledge, then build the Takeaways page."
