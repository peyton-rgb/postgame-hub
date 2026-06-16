# Athlete App — Orientation (Phase 0)

The athlete-facing section of the Postgame Hub. Athletes log in, see brand deals,
opt in, upload content for approval, post it live, paste the link, get verified, get paid.

## Stack (verified live)
- **Next.js 14.2** App Router, React 18.3, TypeScript 5, Tailwind 3.4.
- **Supabase** project `xqaybwhpgxillpbbqtks` (postgame-agent-portal shares infra; this is the Hub project).
- Hosted on **Vercel** (`postgame-hub`). We push `feature/athlete-app` → Vercel builds a PREVIEW. Do NOT merge to main.

## Auth setup (reuse this — do not reinvent)
- Email/password via Supabase Auth. Login page: `src/app/login/page.tsx` (signInWithPassword).
- Session stored in **cookies** via `@supabase/ssr`.
- Clients in `src/lib/`:
  - `supabase.ts` → `createBrowserSupabase()` (cookie browser client, for client components),
    `createPlainSupabase()` (anon, older pages), `createServiceSupabase()` (service role, server only).
  - `supabase-server.ts` → `createServerSupabase()` (cookie-aware, respects RLS),
    `createServiceSupabase()` (service role).
- **Middleware** `src/middleware.ts` gates `/dashboard/:path*` and `/login`. Matcher must be
  extended to also protect `/athlete/:path*`. (Staff go to /dashboard; athletes to /athlete.)

## Design system (verified)
- Tokens in `src/app/globals.css` `:root` — true black `#000`, orange `#D73F09`, glass surfaces,
  radii. Mockup uses near-black `#07070a` + off-white `#FAF8F5` + green `#34C759` accent.
- Fonts loaded in `src/app/layout.tsx` via next/font: **Bebas Neue** → `--font-bebas` (display,
  uppercase; class `.d` / `.pgd`), **Arial** body. Inter/JetBrains Mono also available.
- Pixel reference: `docs/athlete-app/postgame-athlete-app-mockup.html` (14 screens).
  iOS "Liquid Glass" dark look, mobile bottom tab bar: Deals / My deals / Earnings / Profile.

## Data model (verified live)
- **`optin_campaigns`** = canonical deals table (2 rows). Columns: id, slug, brand_id,
  admin_campaign_id, title, headline, goal, products, social_platforms[], requirements, payout,
  deadline, notice, hero_image_url, accent_color, status, published_at, created/updated_at.
  - Live test deal: goodr **"Summer Series"** (`summer-series-6t3y`, status `live`).
  - **BUG (fix in Phase 2):** Summer Series `goal` text wrongly says "iHerb" — make it goodr-specific.
  - Other row: CVS "Mother's Day" (`draft`).
- **`profiles`** = identity (14 rows): id, email, full_name, display_name, avatar_url, role,
  created/updated_at. role is plain `text` (no enum) → adding "athlete" needs NO type alter.
  Phase 1 adds: paypal_linked, paypal_email, ig_handle, tiktok_handle, school, sport.
- **`media`** (3697 rows): id, athlete_id, campaign_id, type, file_url, thumbnail_url, **slot**
  (feed/reel), storage_path, storage_bucket, drive_file_id, sort_order, created/updated_at, etc.
  This is where per-deliverable content lands (Phase 3).
- **Opt-in pipeline (REUSE, do not parallel-build):**
  - `src/app/campaign-optin/[slug]/page.tsx` inserts to `campaign_optin_submissions`
    as `{ optin_id, data: jsonb }`.
  - `campaign_optin_submissions`: id, optin_id, data(jsonb), created_at, status, synced_at,
    error_message, ig_handle.
  - `pending_optins`: id, optin_campaign_id, ig_handle, submitted_at, source, user_agent,
    ip_address, forwarded_to_admin_at, admin_response.
  - Dashboard side: `src/app/dashboard/campaign-optin/`.
  - (Exact column roles re-verified at Phase 2 before writing the opt-in.)

## HARD STOPS / guardrails (from brief)
- No live credentials/keys committed — env vars only. Stub all payout execution.
- Additive DB only — new tables/columns. Never drop/truncate/rename/alter existing.
- Do NOT touch `deals`, `deal_tracker`, `campaign_optins` (public marketing showcase).
- Every new table: RLS on, athlete can read/write only their own rows.
- DB changes as versioned migrations in `supabase/migrations/`.
- Banned copy: "March Madness", "Final Four", "Elite Eight", "Sweet Sixteen".
- Push `feature/athlete-app` only → Vercel PREVIEW. No prod deploy, no merge to main.

## Route plan
- `/athlete` (deals home), `/athlete/deals/[slug]` (detail/opt-in), `/athlete/my-deals`,
  `/athlete/my-deals/[id]` (tracker + upload + post), `/athlete/earnings`, `/athlete/profile`,
  `/athlete/onboarding` (profile setup). Nested layout with bottom tab bar; no marketing SiteNav.
- Manager verification view lives Hub-side under `/dashboard/...` (Phase 4).

## Deliverable status flow (per item: feed vs reel)
To upload → Uploaded → In review → Approved → To post → Pending verification → Verified → Paid.
A deal pays only when ALL its deliverables are Verified. Two gates: (1) content approval
(Postgame + brand), (2) post verification (manager confirms live link → triggers payout 30d out).
