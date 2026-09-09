# Brand Portal — Phase 1, Step 2: Magic-link sign-in

Repo: `peyton-rgb/postgame-hub` · Supabase project: `xqaybwhpgxillpbbqtks`

## Goal
A brand manager (e.g. someone at CVS) can sign in to the Hub with a magic link and land on `/portal`. Nothing else in the portal exists yet — this step is sign-in only.

## What already exists (reuse, don't rebuild)
- Supabase Auth is already wired for the athlete app. Match its client setup, session handling, and middleware pattern.
- `profiles` has a `role` column; `brand` is already a valid value.
- `brand_contacts` holds invites: `brand_id`, `invited_email`, `signup_email`, `role`, `status`, `invite_token`, `invited_at`, `activated_at`, `revoked_at`.
- **New (migration `brand_contacts_add_profile_id` already applied in Supabase):** `brand_contacts.profile_id uuid → profiles.id`, indexed. Run `supabase db pull` first so the repo has this migration.

## Build
1. **Route `/portal/login`** — single email field. On submit:
   - Look up `brand_contacts` where `lower(invited_email) = lower(input)` or `lower(signup_email) = lower(input)`, and `status` is not revoked.
   - If no match: show "That email isn't on a brand account yet. Ask your Postgame contact for an invite." Do not send a link. Do not reveal whether the email exists elsewhere.
   - If match: call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <site>/portal/auth/callback } })`. Show "Check your email."
2. **Route `/portal/auth/callback`** — exchange the code for a session, then:
   - Ensure a `profiles` row exists for the user with `role = 'brand'` (create if missing; do not overwrite an existing non-brand role — if the email already belongs to a staff/athlete profile, sign out and show an error).
   - Set `brand_contacts.profile_id = auth.uid()` and `activated_at = now()` on the matching row(s) where `profile_id` is null.
   - Redirect to `/portal`.
3. **Route `/portal`** — placeholder page: brand name pulled via `brand_contacts → brands`, and a sign-out button. That's it.
4. **Middleware** — any `/portal/*` route except `/portal/login` and `/portal/auth/callback` requires a session whose profile role is `brand` **or `admin`**. Athletes and other staff roles hitting `/portal` get redirected to their own home.
5. **Admin "view as brand" preview**
   - Applies only when `profiles.role = 'admin'`. Brand users never see any of this; a `?brand=` param on a brand session is ignored.
   - Entry points: `/portal?brand=<brands.slug>` (e.g. `/portal?brand=cvs`), and a "View as brand" picker in the existing Hub admin nav that links there. Persist the chosen brand in a cookie so navigating within `/portal` keeps it.
   - If an admin hits `/portal` with no brand chosen, show the picker (searchable list of non-archived `brands`) instead of the placeholder page.
   - Resolve the "current brand" in one shared server helper: `getPortalBrand(session)` → for brand users, from `brand_contacts.profile_id`; for admins, from the cookie/param. Every future portal page calls this helper and nothing else, so preview and real sessions can never diverge.
   - **Multi-brand fallback (rare, build minimal):** a contact may be attached to more than one brand. `getPortalBrand` returns the brand stored in the same cookie if it's one the user is allowed, otherwise the first active brand by name. Reuse the admin brand picker as a small "{Brand} ▾" control in the portal header that renders only when the user has more than one allowed brand (admins: all brands; brand users: their `brand_contacts` rows). Single-brand users never see it.
   - Render a persistent banner at the top of every portal page in preview: "Admin preview · Viewing as {brand name} · Switch brand · Exit preview". Orange rule, Mono label, glass surface per the design system. Exit clears the cookie and returns to the Hub admin.
   - Any write action taken in preview (none exist in this step; approvals come later) must record the admin's `profiles.id` as the actor, never a brand contact. Leave a comment in the helper noting this for Phase 5.

## Constraints
- Follow the Postgame design system skill (`/mnt/skills/user/postgame-design-system/SKILL.md`): Liquid Glass Dark, four fonts, orange only as accent, bottom tab bar on mobile (not needed yet for a login page).
- Brand logo on the login/placeholder page comes from `brand_logos` (variant for dark ground), never drawn or typed.
- No RLS policies in this step — that's Phase 2. The placeholder page may use a server-side query with the service role for the brand name only.
- Do not expose or select `budget` columns anywhere.
- No new tables. The one schema change is already applied.

## Done when
- An email in `brand_contacts` receives a magic link, lands on `/portal`, and sees their brand name.
- An email not in `brand_contacts` gets the "not on a brand account" message and no email is sent.
- `brand_contacts.profile_id` is filled after first sign-in.
- An athlete or non-admin staff session cannot reach `/portal`.
- Peyton's admin session can open `/portal?brand=cvs`, sees the CVS placeholder with the preview banner, can switch to another brand, and can exit back to the Hub admin.
- A brand session with `?brand=<other-brand>` in the URL still sees only its own brand.
- Migration is in `supabase/migrations` in the repo.
