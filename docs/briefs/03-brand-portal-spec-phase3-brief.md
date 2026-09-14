# Brand Portal — Spec and Phase 3 brief (read-only screens)

Repo: `peyton-rgb/postgame-hub` · Supabase project: `xqaybwhpgxillpbbqtks`
Depends on Phase 1 (sign-in, `getPortalBrand`) and Phase 2 (RLS, `portal_campaigns` view). Design decisions below were made with Peyton on 2026-09-08 using CVS as the reference brand.

---

## 1. What the portal is
A brand manager signs in and sees only their brand's campaigns with Postgame. It answers three questions: what's live, what did we get, what do I need to do. It is read-only except Approvals (Phase 5) and Settings (Phase 7).

**Source of truth:** `admin_campaigns` (ColdFusion cache) is the master campaign list. The portal never reads it directly; it reads `campaign_recaps`, which has a row for every admin campaign, through the `portal_campaigns` view.

**Money is never shown.** No budget, spend, rates, or payouts anywhere. See never-show list in the Phase 2 brief.

## 2. State model
Two states, from `campaign_recaps.lifecycle_status`:

| Portal state | lifecycle_status | Tabs on detail page |
|---|---|---|
| Live | `active` | Overview · Athletes · Content · Approvals |
| Wrapped | `delivered` (and `closed` until backfilled) | Overview · Athletes · Content · Results |

No Planning state — recap rows only exist once a campaign is real in the admin. `draft` rows, if any appear, are hidden from the portal.

## 3. Navigation
Bottom tab bar on mobile (never hamburger, never top nav): **Home · Campaigns · Content · Reports**. Settings is reached from the avatar top-right. Desktop: same four items as a left rail; keep the fluid container and Liquid Glass tokens.

In admin preview, a persistent banner sits above everything: "Admin preview · Viewing as {brand} · Switch brand · Exit preview".

## 4. Screens in Phase 3 scope
Build these three. Everything else is a later phase; leave tab-bar items for them present but pointing at a "Coming soon" placeholder that uses the design system.

### 4.1 Campaigns list — `/portal/campaigns`
- Header: eyebrow `{Brand} · Campaigns` (Mono, orange), H1 "All campaigns" (Bebas), subline `{n} live · {n} wrapped` (Arimo 68%).
- Filter pills: All / Live / Wrapped. Search box below (client-side filter on name).
- Sorted: live first, then wrapped by `admin_created_on` desc.
- **Live card:** name (Bebas 22), chip "Live" (orange outline), subline `{quarter} · {campaign_type} · {platform}`, progress bar = posted deliverables / total, footer left `Posted {x} of {y}`, footer right `{n} waiting on you` in orange when review sessions with empty `brand_decision` exist for this campaign.
- **Wrapped card:** name, chip "Wrapped" (grey outline), same subline, three Anton figures (Athletes · Posts · Reach) from the recap, link "View results →".
- Data: `portal_campaigns` filtered by brand; counts from `athlete_deliverables` (posted vs total) and `review_sessions` (pending); wrapped figures from recap metrics (reuse whatever the public recap page computes — don't reimplement).
- Empty state: "No campaigns yet" + one line "Your Postgame contact will add your first campaign here."

### 4.2 Campaign detail — `/portal/campaigns/[slug]`
- Back link "← Campaigns" (Mono 50%).
- Hero: `hero_image_url` with edge-blend into black; if null, labelled empty slot, never a stock image.
- Title: `name` in Anton uppercase; chip for state; subline `{quarter} · {campaign_type}` (live) or `{quarter} · Recap delivered {date}` (wrapped).
- Tab row (Mono, orange underline on active). Tab set per §2. In Phase 3 only Overview, Athletes, Content render; Approvals/Results tabs are present but show a design-system placeholder.

**Overview tab**
- Card "Objective": `description` (Arimo 16, 68%). If null → placeholder chip "Awaiting brief".
- Two stat cards: Athletes, Schools (count distinct `athletes.school`). Anton figures.
- Card "Timeline": four rows derived from `athlete_deliverables` timestamps — Brief approved (from `campaign_briefs.status` if present), Athletes opted in (first `uploaded_at`), Content in review (any `sent_to_brand_at` without `approved_at`), Posts live (first `posted_at`). Each row: check icon (orange) if reached, dot if current, hollow circle if pending. Show date or "—".
- Card "Your Postgame contact": `manager_name`, "Campaign lead", `mailto:manager_email` icon. If null → "Contact: —" placeholder.

**Athletes tab**
- Filter chips: All schools + one per distinct school (cap at 8, then "More").
- Row per athlete: headshot slot (see §6), name (Bebas 18), subline `{school} · {sport} · {ig_followers} followers`, status chip from `athlete_deliverables.status` for this campaign (Opted in / In review / Posted). Tapping a row opens their delivered posts for this campaign only.
- Sort: posted first, then by `ig_followers` desc.
- Data: `athletes where campaign_id = recap.id`, joined to `athlete_deliverables`.

**Content tab**
- Filter chips: All / Posts / BTS / Photos, mapped from `media.type`.
- Download icon top-right → opens `https://drive.google.com/drive/folders/{drive_content_folder_id}` in a new tab. **Never display the folder's title.**
- 2-col grid (mobile) of 4:5 tiles: thumbnail from `media.thumbnail_url`; play icon (orange) for video; caption `{athlete name} · {platform/type}` (Mono 50%). Tiles get edge-blend.
- Data: `media` via `media_campaigns.campaign_recap_id`, athlete via `media_athletes`.
- Empty state: "Content lands here as it's delivered."

### 4.3 Placeholders (Home, Content-global, Reports, Settings, Approvals tab, Results tab)
One shared component: eyebrow "Coming soon", one line describing what will be there, styled as a Card surface. Not a blank page.

## 5. Data access rules for all portal code
- Read campaigns only through `portal_campaigns`. Never `select *` from `campaign_recaps`.
- Every page resolves the brand with `getPortalBrand(session)` (from Phase 1) and passes `brand_id` explicitly into queries even though RLS also enforces it. Belt and braces.
- Use the user's Supabase client (RLS applies). The service-role client is not allowed in `app/portal/**`. Add a lint rule or a code comment guard.
- Never render: any column on the never-show list, `settings` whole, Drive folder titles, other brands' names, athlete rates or payout state.

## 6. Design system requirements (from the Postgame design-system skill — read it before writing UI)
- Tokens: `#07070A` ground, `#FAF8F5` ink at 100/90/68/50 opacity ladder, `#D73F09` accent only. Liquid Glass surfaces (Raised 0.07 fill / Card 0.04 fill, 1px borders at 0.14 / 0.10, radius 16).
- Fonts: Bebas Neue (display), Anton (campaign title + stat figures only), Arimo (body, never below 16px), JetBrains Mono (labels, uppercase, letterspaced).
- **Client logo comes from `brand_logos` (variant for dark ground). Never drawn, never typed.** Postgame mark is the logo file, never the word set in type.
- **Placeholders, not fakes.** Missing figure → `—` with chip "Awaiting verified data". Missing athlete headshot → empty circle. Missing quote/description → labelled empty slot. No realistic invented names anywhere, including seed data for dev — use "Athlete Name", "Campaign name".
- Athlete headshot: no column exists today. Use the first `media` row for that athlete in this campaign with `type` = photo, cropped to a circle using `focal_x`/`focal_y`. If none, empty circle. Do not add a column in this phase.
- Every image with a hard edge on the black ground gets the edge-blend gradient on its empty side.
- No NCAA trademark terms in any brand-facing string. Campaign names come from the database as-is (Peyton controls them); do not derive display strings from Drive folder or tracker tab names.
- Copy: short, active, sentence case, no press-release tone. "4 live · 44 wrapped", not "You have four exciting campaigns".

## 7. Out of scope for Phase 3
Approvals actions (Phase 5), Results tab (Phase 4), Home and Reports (Phase 6), Settings, team invites, notifications (Phase 7), desktop-specific layouts beyond the fluid container, any write to the database from `/portal`.

## 8. Done when
- Signed in as a CVS brand contact (or admin preview as CVS): Campaigns list shows 48 campaigns split live/wrapped with correct counts; tapping one opens detail with Overview, Athletes, Content populated from real data; placeholders render for the rest.
- No page in `app/portal/**` imports the service-role client or queries `campaign_recaps`/`brands` directly.
- Every empty field renders as a labelled placeholder, not a blank and not a fake.
- Mobile at 380px width: two-column max, bottom tab bar, no hover-only interactions.
- Screenshots of all three screens in the PR, one live campaign and one wrapped.
