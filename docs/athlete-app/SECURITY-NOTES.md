# Athlete App — Security notes for Peyton (read before promoting to prod)

The athlete app introduces **public self-signup** (athletes are real authenticated
users). That turns some pre-existing, latent permissiveness into live exposure.
I did NOT change these because they touch staff-critical tables and I didn't want
to risk breaking the dashboard while you were away. Each is a quick, additive fix
(new/replacement RLS policy) — recommend doing them before go-live.

## What I already locked down (done)
- **Signup role:** new signups can only self-assign `athlete` (never a staff role);
  default stays `campaign_manager`. (migration 001)
- **Profile self-update:** a trigger freezes `profiles.role` and `paypal_linked`
  against client self-update (the self-update RLS policy is column-blind). (001)
- **New athlete tables** (`athlete_campaign_optins`, `athlete_deliverables`,
  `payouts`): RLS on, athlete reads only their own rows; staff read via
  `is_staff()`; all writes go through service-role API routes.
- **profiles role CHECK** widened to allow `athlete` (signup would have failed
  otherwise). (migration 006)

## Recommended before prod (NOT done — your call)
1. **`optin_campaigns` is athlete-writable.** Its policy `optin_campaigns_auth_write`
   grants `ALL` to every authenticated user — so an athlete could, via a crafted
   client call, edit/delete a deal. Tighten writes to staff only, e.g. replace with
   a policy using the existing `public.is_staff()` helper:
   ```sql
   drop policy if exists optin_campaigns_auth_write on public.optin_campaigns;
   create policy optin_campaigns_staff_write on public.optin_campaigns
     for all to authenticated using (public.is_staff()) with check (public.is_staff());
   ```
   (Verify staff dashboards still write after this.)
2. **`media` is fully athlete-writable.** Policy `Auth users full access to media`
   grants `ALL` to authenticated. Athletes can read/write every media row via the
   client. The athlete app doesn't rely on this (it stores uploads on
   `athlete_deliverables`), so consider scoping media writes to staff similarly.
3. **`slot_assignments` has RLS disabled** (flagged by Supabase advisor, pre-existing
   and unrelated to this app) — anyone with the anon key can read/write it. Enable
   RLS + add policies.
4. **Signup default role** is still `campaign_manager` for any signup that doesn't
   pass `role=athlete` metadata. With public signup live, consider flipping the
   default to the least-privileged role and elevating staff explicitly.

## Other operational notes
- **Preview is behind Vercel deployment protection** (login wall). To let a
  non-Vercel athlete test the preview, turn off Deployment Protection for previews
  in Vercel settings — or test it yourself while logged into Vercel.
- **Email confirmation:** if Supabase Auth has "Confirm email" on, athlete signup
  shows a "check your email" step (good for the verified-identity requirement).
- **PayPal payouts are STUBBED** — no credentials, no money moves. A pending payout
  row is created 30 days out on verification; execution is a documented TODO.
- **Google Drive folders** are created on upload only if `ATHLETE_DRIVE_ROOT_FOLDER_ID`
  + `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` are set; otherwise it no-ops (TODO logged).
- **Native push notifications** are out of scope (needs APNs/FCM + a native wrapper);
  in-app notifications + unread bell are implemented.
