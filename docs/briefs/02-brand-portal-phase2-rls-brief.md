# Brand Portal — Phase 2: Access rules (RLS)

Repo: `peyton-rgb/postgame-hub` · Supabase project: `xqaybwhpgxillpbbqtks`
Depends on Phase 1 (magic-link sign-in, `brand_contacts.profile_id`). **Must ship before any real brand contact is invited.**

## Why this matters
Audit on 2026-09-08 found these tables grant SELECT to all `authenticated` users unconditionally (`USING (true)`): `campaign_recaps`, `athletes`, `media`, `brands`, `brand_logos`, `package_deliverables`; and `review_sessions` / `review_comments` grant **ALL** (read + write) to all authenticated users. `media_campaigns` and `media_athletes` grant SELECT to `public`. A brand user is `authenticated`, so today they could read every brand's data. The UI won't show it; the database must refuse it.

## Approach: fence the brand role, leave everyone else untouched
Do not rewrite staff or athlete policies. For each affected table, replace the unconditional policy with one that behaves identically for non-brand users and scopes brand users to their own brand. Net effect for athletes and staff: zero change. Verify that with the test plan below.

### 1. Helper functions (SECURITY DEFINER, `search_path = public`, STABLE)
- `is_brand_user()` → `exists (select 1 from profiles where id = auth.uid() and role = 'brand')`
- `my_brand_ids()` → `select brand_id from brand_contacts where profile_id = auth.uid() and status = 'active' and revoked_at is null` (returns `setof uuid`). Confirm the exact `status` value used for active contacts before hardcoding it.
- Grant EXECUTE on both to `authenticated`. Existing helpers `is_staff()` and `is_postgame_staff()` already exist — reuse, don't duplicate.

### 2. Policy changes (one migration, named `brand_portal_rls_phase2`)
Pattern for every SELECT policy currently `USING (true)` on `authenticated`:
```sql
USING ( not is_brand_user() or <brand scope> )
```
Brand scope per table:
- `campaign_recaps` → `brand_id in (select my_brand_ids())`
- `brands` → `id in (select my_brand_ids())`
- `brand_logos` → `brand_id in (select my_brand_ids())`
- `athletes` → `campaign_id in (select id from campaign_recaps where brand_id in (select my_brand_ids()))`
- `media` → `campaign_id in (select id from campaign_recaps where brand_id in (select my_brand_ids()))`
- `media_campaigns` → `campaign_recap_id in (select id from campaign_recaps where brand_id in (select my_brand_ids()))`; also change role from `public` to `authenticated` on this and `media_athletes` unless a public recap page depends on anon access (check `app/` for anon reads first; if it does, keep a separate anon policy scoped to `published = true` recaps).
- `media_athletes` → via `media_id → media.campaign_id` as above.
- `package_deliverables` → via package → campaign; inspect `posting_packages` to find the campaign link.
- `athlete_deliverables` → add a brand SELECT policy scoped via `optin_campaign_id → campaign` (existing own/staff policies stay).
- `review_sessions` → split the "Auth users full access" ALL policy into: SELECT `not is_brand_user() or campaign_id in (...)`; UPDATE for brand users limited to columns `brand_decision`, `brand_decided_at` (enforce with a `WITH CHECK` plus a BEFORE UPDATE trigger that rejects other column changes when `is_brand_user()`); INSERT/DELETE `not is_brand_user()`.
- `review_comments` → SELECT via session → campaign; INSERT for brand users only with `author_type = 'brand'` and session in scope; no UPDATE/DELETE for brand users.
- `brand_contacts` → add SELECT for brand users: `brand_id in (select my_brand_ids())` (they can see their own team list). Existing staff policy stays.
- `profiles` → no change; existing `id = auth.uid() or is_staff()` is correct.

**Admin preview:** admins already pass every policy via `is_staff()`. The preview brand is chosen in the app layer (`getPortalBrand`), not in RLS. Do not add RLS logic for preview.

### 3. Safe-columns view for the portal
Create `portal_campaigns` as a view with `security_invoker = true` (so the caller's RLS applies — a plain view would run as its owner and bypass the rules above). Columns: `id, name, slug, brand_id, lifecycle_status, description, hero_image_url, thumbnail_url, tags, public_sections, manager_name, manager_email, drive_content_folder_id, admin_created_on, quarter (from settings), campaign_type (from settings), content_type (from settings), platform (from settings), key_takeaways (from settings), kpi_targets (from settings)`. **Do not** expose `settings` whole (it can contain `budget`), `pin_hash`, `tracker_*`, `brief_*`, `drive_contracts_folder_id`, `drive_trackers_folder_id`, `admin_account_id`, `owner_id`, `frameio_url`, `recap_config`, or `metric_overrides`. Portal pages query this view, never `campaign_recaps` directly.

### 4. Never-visible list (enforce by omission from views, and grep the portal code)
`brand_campaigns.budget`, `campaign_briefs.budget`, `campaign_recaps.settings->>'budget'`, all of `payouts`, `profiles.paypal_*`, `athlete_deliverables.paid_at`, `videographer_*`, `contracts`, `deals`, `deal_tracker`, `agent_*`, `board_tasks`.

## Test plan (write as a script in `scripts/rls-check.ts` or SQL under `supabase/tests/`)
Run as four users: an admin, an athlete, a brand contact for CVS, and a brand contact for a second brand.
1. Athlete: every query the athlete app makes today returns the same rows before and after. (Snapshot counts before migrating.)
2. Admin: unchanged.
3. CVS contact: `select count(*) from portal_campaigns` = CVS campaigns only (48 today). `select count(*) from campaign_recaps where brand_id <> <cvs>` = 0. Same for `athletes`, `media`, `brands`, `review_sessions`.
4. Second-brand contact: sees zero CVS rows.
5. CVS contact attempting `update review_sessions set notes = 'x'` → rejected. `update review_sessions set brand_decision = 'approved'` on own session → allowed; on another brand's session → 0 rows.
6. CVS contact `select settings from campaign_recaps` → either denied or, if column access can't be blocked, confirm the portal code never selects it (grep) and the view is what pages use.

## Done when
- Migration applied, `supabase db pull` reflected in repo.
- All six checks pass and are committed as a repeatable test.
- No portal page queries `campaign_recaps`, `brands`, or `athletes` directly — only `portal_campaigns` and scoped tables.
- Peyton can invite a real CVS contact without them being able to read another brand's row, even with direct API access.
