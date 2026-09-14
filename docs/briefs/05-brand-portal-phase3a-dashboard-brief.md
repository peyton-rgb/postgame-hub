# Brand Portal — Phase 3a: Brand Dashboard (Home)

**Status:** Ready for Claude Code
**Branch:** `portal/phase-3a-dashboard` (from `main` after PR #248 merges; if not merged yet, branch from `portal/phase-1-signin`)
**Replaces:** the current `PortalDashboardBody` at `/portal`. The existing dashboard is not the target design. Rebuild the page body; keep `SessionPortalShell`, `resolveSessionPortal()`, the admin preview banner, and the brand-gating from Phase 1 untouched.
**Design reference:** `docs/briefs/reference/brand-dashboard-desktop-1440x900.html` (copy `mockfit-screen-desktop-dashboard-1440x900.html` from the Brand Portal Briefs folder into the repo at that path). Open it in a browser at 1440×900 — that is the target, tile for tile. Phone reference: `portal-phone-screens-390x844.html`, screen 1.
**Design system:** `.claude/skills/postgame-design-system/SKILL.md` governs. Two sanctioned exceptions for this page, both already in the reference: (1) the "Waiting on you" card is a solid orange fill — the one place orange is a surface; (2) no JetBrains Mono anywhere on portal pages. Bebas Neue headings, Anton figures, Arimo body.

## What the page is

A brand manager signs in and lands here. It answers three questions without scrolling: what's live, what did we get, what do I need to do. Everything on it is scoped to the signed-in brand via `resolveSessionPortal()` — never query by anything the user could edit.

## Layout (from the reference)

- Left icon rail (72px): Postgame icon (`brands.logo_icon_svg_url` for the Postgame brand), Home / Campaigns / Content / Reports / Calendar icons, settings and avatar at the bottom. Home is active.
- Top bar: pill nav (Home · Campaigns · Athletes · Content · Reports), search, "This quarter" range selector, Notifications, orange circular avatar with a person outline (not initials).
- Header: "Welcome back" (Bebas, no brand name in the heading), date line, four KPIs right-aligned.
- 12-column tile grid, 6 rows, 10px gap. Tiles in this order and these spans:
  1. **Waiting on you** — cols 1–3, rows 1–2. Orange card.
  2. **Posts going live** — cols 4–7, rows 1–2. Stacked bar chart, Week/Month/Quarter toggle.
  3. **Deliverables** — cols 8–9, rows 1–2. Ring + platform split.
  4. **Latest wrapped** — cols 10–12, rows 1–3. Photo tile.
  5. **Live campaign roster** — cols 1–7, rows 3–5. Table.
  6. **This week** — cols 8–9, rows 3–5. Schedule.
  7. **Top posts · 30 days** — cols 10–12, rows 4–6.
  8. **Campaigns** — cols 1–9, row 6. Six compact cards.
- Below 1100px: rail collapses to icons only, grid goes to 6 columns and tiles stack in the order above. Below 640px: use the phone reference (single column, bottom tab bar).

## Data — what each tile reads, and what to do when the data isn't there

All reads go through `portal_campaigns` (the view from the Phase 2 brief) or tables already fenced to the brand. **Never** read `campaign_recaps` directly from portal code, and never surface `settings.budget`, spend, payouts, athlete rates, or `profiles.paypal_*`.

| Tile | Source | Fallback when empty |
|---|---|---|
| KPI: Live campaigns | count of `portal_campaigns` where `lifecycle_status = 'active'` | `0` |
| KPI: Athletes active | distinct `athlete_id` in `athlete_deliverables` joined to the brand's active campaigns | `0` |
| KPI: Reach · 14 days | sum of `settings.kpi_targets`/metrics only if a verified reach field exists on delivered recaps in the window; **otherwise hide this KPI** | hidden |
| KPI: Posts this month | count of `athlete_deliverables` with a posted timestamp this month | `0` |
| Waiting on you | `review_sessions` open for the brand (content review) + `athlete_deliverables` awaiting brand approval + caption edit requests. Each row: type icon (video / photo / text), title, campaign · athlete, due chip. Count badge. "Review all N" → Approvals. | Card stays orange, body reads "Nothing waiting on you" |
| Posts going live | `athlete_deliverables` grouped by posted date, split feed+reels / stories / scheduled | Empty chart with axis, "No posts scheduled this week" |
| Deliverables | delivered ÷ total `athlete_deliverables` across active campaigns; platform split from deliverable platform field | Ring at 0%, split hidden |
| Latest wrapped | most recent `portal_campaigns` with `lifecycle_status = 'delivered'`; photo = that campaign's hero media (`media.is_hero`, `hero_order`), name in Anton; the four figures ONLY from that recap's structured fields (`settings.kpi_targets` / `public_sections`) — any figure not present is omitted, never zero-filled | Tile shows the campaign name and "Recap delivered" with no figures |
| Live campaign roster | first active campaign (most recent start): athletes from `athlete_deliverables` joined to `athletes`; headshot = first `media` photo for that athlete on that campaign, else initials; school, deliverables summary, progress (posted/total), status chip (Opted in / Scheduled / In review / Caption edit / Posted), reach only if a per-post metric exists, next post day | "No live campaign" with a link to Campaigns |
| This week | next 5 dated events: posts going live (`athlete_deliverables` scheduled dates), review deadlines, recap deliveries | "Nothing scheduled" |
| Top posts · 30 days | top 3 `athlete_deliverables` by a verified metric in the last 30 days; **if no per-post metrics exist, replace this tile with "Recent posts"** (three most recent, no numbers) | as above |
| Campaigns | six most recent `portal_campaigns`: live first with posted/total progress in orange, then wrapped with "Recap delivered" | fewer cards, never placeholders |

Rule for every number on this page: it comes from a query or it isn't shown. No illustrative figures, no dashes standing in for data, no "—" where a real value should be. If a whole tile has no backing data yet, render the empty state described above.

Names and photos: athletes shown are the brand's own campaign athletes, from the database. Never a stock image, never a placeholder name.

## Brand-neutral chrome

The page must not contain the brand's name in copy except where data puts it there (campaign names, the brand logo in the rail if `brand_logos` has one). Greeting is "Welcome back", not "Welcome back, CVS".

## Admin preview

Works identically under the Phase 1 admin preview (`?brand=` / cookie). Writes from "Review all" record the admin's `profiles.id` as actor, never a brand contact.

## Acceptance

1. Signed in as an admin previewing CVS: page renders every tile with CVS's real campaigns (4 active, 44 delivered/closed as of 2026-09-08), real athletes, real hero photos. No placeholder text anywhere.
2. Previewing a brand with one active campaign and no recaps: Latest wrapped shows the empty state; Campaigns shows one card.
3. Previewing a brand with nothing: every tile shows its empty state; page still looks designed, not broken.
4. No query on the page reads `campaign_recaps` directly, `budget`, spend, or payout fields (grep the diff).
5. 1440×900 screenshot matches the reference for layout, spacing, type, and color. Attach it to the PR alongside a 390-wide screenshot.
6. Lighthouse accessibility ≥ 90; every icon-only control has a label.

## Out of scope

Campaigns list, Campaign detail tabs, Content gallery, Reports, Settings — those are 3b onward. Notifications and search are visual only this phase (render, no behavior) — note that in the PR.
