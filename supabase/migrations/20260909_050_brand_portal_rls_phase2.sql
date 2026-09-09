-- Brand portal Phase 2: fence the brand role, leave everyone else untouched.
--
-- THE HOLE THIS CLOSES. These tables grant SELECT to every `authenticated`
-- user with USING (true): campaign_recaps, athletes, media, brands,
-- brand_logos, package_deliverables. review_sessions and review_comments grant
-- ALL — read AND write — to every authenticated user. A brand contact signs in
-- as `authenticated`, so today they can read (and in two cases write) every
-- other brand's data through the API. The UI does not show it; the database
-- must refuse it.
--
-- SHAPE OF THE FIX. Every rewritten policy reads:
--     USING ( not is_brand_user() or <this brand's scope> )
-- so a staff user or an athlete evaluates the left side to true and sees
-- exactly what they saw before. Net change for non-brand users: none. That is
-- the property the test script checks first, before it checks anything else.
--
-- ----------------------------------------------------------------------
-- TWO THINGS THE BRIEF DID NOT ACCOUNT FOR, BOTH VERIFIED AGAINST THE DB
-- ----------------------------------------------------------------------
--
-- 1. A POLICY GRANTED "TO public" ALSO GRANTS TO `authenticated`.
--    In Postgres the PUBLIC role includes every role, and permissive policies
--    for the same command are OR'd together. So fencing only the
--    *_select_authenticated policies would have left every "Public can view X
--    in published campaigns" policy standing as an open door: 84 published
--    recaps, 3,266 athlete rows, and all their media, readable by any brand
--    user regardless of brand.
--
--    Proved rather than assumed, on a throwaway table, in a transaction that
--    was rolled back: with the authenticated policy set to USING (false) and a
--    second policy TO public USING (published), the authenticated role still
--    saw the published row.
--
--    So each of those policies is re-created TO anon. anon behaviour is
--    byte-identical — the public recap page uses createPlainSupabase(), the
--    anon key — and authenticated users stop inheriting it. Where a signed-in
--    non-brand user actually needed that access (media_campaigns,
--    media_athletes), a fenced `authenticated` policy is added alongside.
--
-- 2. review_sessions.campaign_id REFERENCES brand_campaigns, NOT campaign_recaps.
--    The brief says to scope it through campaign_recaps. That is the
--    campaign_optins/optin_campaigns class of name-twin trap CLAUDE.md warns
--    about, and it would have produced a policy that silently matches nothing:
--    a campaign_recaps id compared against a brand_campaigns foreign key never
--    equals anything. Confirmed from information_schema: review_sessions
--    .campaign_id and posting_packages.campaign_id both reference
--    brand_campaigns(id). Both are scoped through brand_campaigns.brand_id
--    here, which is populated on 1,088 of 1,089 rows. The one null-brand row
--    is invisible to every brand user, which is the correct direction to fail.
--
-- SUPERSEDED IN PART BY MIGRATION 051. The predicates below call
-- is_brand_user() bare, which Postgres evaluates PER ROW; on `select count(*)
-- from athletes` (9,436 rows) that measured 1,214 ms against a 1.8 ms
-- RLS-bypassed baseline — a 650x regression on every staff read. Migration 051
-- re-creates the same predicates with the call wrapped as
-- `(select public.is_brand_user())`, which the planner hoists into an InitPlan
-- and evaluates once: 35 ms. This file is kept as applied because it is what
-- the database actually ran; 051 is the current shape.
--
-- Rollback: this migration only replaces policies and adds two functions and
-- one trigger. To undo, restore each policy to USING (true) / TO public and
-- drop is_brand_user(), my_brand_ids() and review_sessions_brand_columns().
-- ======================================================================

-- ---- 1 · Helper functions -------------------------------------------

-- Detection FAILS SAFE. A false negative here means a brand user is not
-- recognised and reads everything, so this deliberately errs toward saying
-- yes: either identity column, or simply holding an unrevoked brand_contacts
-- row, is enough. `not is_staff()` guards the other direction — a staff member
-- who somehow carried a brand marker would otherwise lose their own access,
-- since the policies being fenced are what staff read through.
--
-- The repo's authority on identity is profiles.access_level: is_staff() reads
-- it, Phase 1's middleware reads it, and today it agrees with profiles.role on
-- all 16 rows. Both are checked so that a future divergence over-restricts
-- rather than under-restricts.
create or replace function public.is_brand_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_staff()) and (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (access_level = 'brand' or role = 'brand')
    )
    or exists (
      select 1 from public.brand_contacts
      where profile_id = auth.uid()
        and revoked_at is null
    )
  );
$$;

comment on function public.is_brand_user() is
  'True when the current user is a brand-portal user and not staff. Deliberately over-inclusive: a missed detection would leave a brand user unfenced, so either identity column or an unrevoked brand_contacts row qualifies.';

-- The attachment link, brand_contacts.profile_id (migration 045) — NOT
-- postgame_contacts.profile_id, which is the identity link. Same column name,
-- two tables, two meanings; see the CLAUDE.md landmine.
-- 'active' is the only status value present in the table today.
create or replace function public.my_brand_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select brand_id
  from public.brand_contacts
  where profile_id = auth.uid()
    and status = 'active'
    and revoked_at is null;
$$;

comment on function public.my_brand_ids() is
  'Brands the current user has an active, unrevoked brand_contacts attachment to. Empty for staff, athletes and anon, which is why every policy pairs it with `not is_brand_user() or ...`.';

grant execute on function public.is_brand_user() to authenticated;
grant execute on function public.my_brand_ids() to authenticated;

-- ---- 2 · campaign_recaps --------------------------------------------

drop policy if exists "campaign_recaps_select_authenticated" on public.campaign_recaps;
create policy "campaign_recaps_select_authenticated"
  on public.campaign_recaps for select to authenticated
  using (
    not public.is_brand_user()
    or brand_id in (select public.my_brand_ids())
  );

-- Re-target the two TO public policies at anon. Same predicate, same rows for
-- a logged-out visitor; authenticated users no longer inherit them.
drop policy if exists "Public can read public recaps" on public.campaign_recaps;
create policy "Public can read public recaps"
  on public.campaign_recaps for select to anon
  using (status = 'published' and visibility = any (array['public', 'both']));

drop policy if exists "Public can view public campaigns" on public.campaign_recaps;
create policy "Public can view public campaigns"
  on public.campaign_recaps for select to anon
  using (published = true and visibility = any (array['public', 'both']));

-- ---- 3 · brands ------------------------------------------------------

drop policy if exists "brands_select_authenticated" on public.brands;
create policy "brands_select_authenticated"
  on public.brands for select to authenticated
  using (
    not public.is_brand_user()
    or id in (select public.my_brand_ids())
  );

drop policy if exists "Public can read client brands" on public.brands;
create policy "Public can read client brands"
  on public.brands for select to anon
  using (show_on_clients_page = true and archived = false);

drop policy if exists "Public read active brands" on public.brands;
create policy "Public read active brands"
  on public.brands for select to anon
  using (archived = false);

-- ---- 4 · brand_logos -------------------------------------------------

-- This was ALL (read AND write) to every authenticated user, not SELECT as the
-- brief assumed. Splitting it also narrows writes from "anyone signed in" to
-- staff, which is the direction migration 044 took the four core tables. No
-- athlete or brand surface writes brand logos; the staff admin surfaces do.
drop policy if exists "Auth users full access to brand_logos" on public.brand_logos;

drop policy if exists "brand_logos_select_authenticated" on public.brand_logos;
create policy "brand_logos_select_authenticated"
  on public.brand_logos for select to authenticated
  using (
    not public.is_brand_user()
    or brand_id in (select public.my_brand_ids())
  );

drop policy if exists "brand_logos_write_staff" on public.brand_logos;
create policy "brand_logos_write_staff"
  on public.brand_logos for insert to authenticated
  with check (public.is_staff());

drop policy if exists "brand_logos_update_staff" on public.brand_logos;
create policy "brand_logos_update_staff"
  on public.brand_logos for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "brand_logos_delete_staff" on public.brand_logos;
create policy "brand_logos_delete_staff"
  on public.brand_logos for delete to authenticated
  using (public.is_staff());

drop policy if exists "Public can read brand_logos" on public.brand_logos;
create policy "Public can read brand_logos"
  on public.brand_logos for select to anon
  using (true);

-- ---- 5 · athletes ----------------------------------------------------

drop policy if exists "athletes_select_authenticated" on public.athletes;
create policy "athletes_select_authenticated"
  on public.athletes for select to authenticated
  using (
    not public.is_brand_user()
    or campaign_id in (
      select id from public.campaign_recaps
      where brand_id in (select public.my_brand_ids())
    )
  );

drop policy if exists "Public can view athletes in published campaigns" on public.athletes;
create policy "Public can view athletes in published campaigns"
  on public.athletes for select to anon
  using (
    exists (
      select 1 from public.campaign_recaps
      where campaign_recaps.id = athletes.campaign_id
        and campaign_recaps.published = true
    )
  );

-- ---- 6 · media -------------------------------------------------------

drop policy if exists "media_auth_read" on public.media;
create policy "media_auth_read"
  on public.media for select to authenticated
  using (
    not public.is_brand_user()
    or campaign_id in (
      select id from public.campaign_recaps
      where brand_id in (select public.my_brand_ids())
    )
  );

drop policy if exists "Public can view media in published campaigns" on public.media;
create policy "Public can view media in published campaigns"
  on public.media for select to anon
  using (
    exists (
      select 1 from public.campaign_recaps
      where campaign_recaps.id = media.campaign_id
        and campaign_recaps.published = true
    )
  );

-- ---- 7 · media_campaigns (curation table) ----------------------------

-- SELECT was TO public USING (true): every row readable by anyone at all.
-- anon keeps that, because the public recap page reads it with the anon key;
-- signed-in users get a fenced policy instead of inheriting the open one.
drop policy if exists "media_campaigns_select" on public.media_campaigns;
create policy "media_campaigns_select"
  on public.media_campaigns for select to anon
  using (true);

drop policy if exists "media_campaigns_select_authenticated" on public.media_campaigns;
create policy "media_campaigns_select_authenticated"
  on public.media_campaigns for select to authenticated
  using (
    not public.is_brand_user()
    or campaign_recap_id in (
      select id from public.campaign_recaps
      where brand_id in (select public.my_brand_ids())
    )
  );

-- Writes were open to any authenticated user. A brand user has no reason to
-- curate a recap, so they are excluded; staff and athletes are unchanged.
drop policy if exists "media_campaigns_insert" on public.media_campaigns;
create policy "media_campaigns_insert"
  on public.media_campaigns for insert to authenticated
  with check (not public.is_brand_user());

drop policy if exists "media_campaigns_update" on public.media_campaigns;
create policy "media_campaigns_update"
  on public.media_campaigns for update to authenticated
  using (not public.is_brand_user()) with check (not public.is_brand_user());

drop policy if exists "media_campaigns_delete" on public.media_campaigns;
create policy "media_campaigns_delete"
  on public.media_campaigns for delete to authenticated
  using (not public.is_brand_user());

-- ---- 8 · media_athletes (curation table) -----------------------------

drop policy if exists "media_athletes_select" on public.media_athletes;
create policy "media_athletes_select"
  on public.media_athletes for select to anon
  using (true);

drop policy if exists "media_athletes_select_authenticated" on public.media_athletes;
create policy "media_athletes_select_authenticated"
  on public.media_athletes for select to authenticated
  using (
    not public.is_brand_user()
    or media_id in (
      select m.id from public.media m
      where m.campaign_id in (
        select id from public.campaign_recaps
        where brand_id in (select public.my_brand_ids())
      )
    )
  );

drop policy if exists "media_athletes_insert" on public.media_athletes;
create policy "media_athletes_insert"
  on public.media_athletes for insert to authenticated
  with check (not public.is_brand_user());

drop policy if exists "media_athletes_update" on public.media_athletes;
create policy "media_athletes_update"
  on public.media_athletes for update to authenticated
  using (not public.is_brand_user()) with check (not public.is_brand_user());

drop policy if exists "media_athletes_delete" on public.media_athletes;
create policy "media_athletes_delete"
  on public.media_athletes for delete to authenticated
  using (not public.is_brand_user());

-- ---- 9 · package_deliverables ----------------------------------------

-- package_id -> posting_packages.campaign_id -> brand_campaigns.brand_id.
-- posting_packages.campaign_id references brand_campaigns, NOT campaign_recaps
-- (verified in information_schema) — the same name-twin as review_sessions.
drop policy if exists "package_deliverables_read" on public.package_deliverables;
create policy "package_deliverables_read"
  on public.package_deliverables for select to authenticated
  using (
    not public.is_brand_user()
    or package_id in (
      select pp.id from public.posting_packages pp
      where pp.campaign_id in (
        select bc.id from public.brand_campaigns bc
        where bc.brand_id in (select public.my_brand_ids())
      )
    )
  );

-- ---- 10 · athlete_deliverables ---------------------------------------

-- This table has no unconditional policy to fence: today it is
-- athlete_id = auth.uid() OR is_staff(), which is why the authenticated role
-- reads 0 of its 4 rows. The brief asks for a brand SELECT policy, so this
-- ADDS scoped access rather than removing any. Scope is
-- optin_campaign_id -> optin_campaigns.brand_id (optin_campaigns is the LIVE
-- spine; campaign_optins is the empty legacy table — CLAUDE.md landmine).
drop policy if exists "deliv_select_brand" on public.athlete_deliverables;
create policy "deliv_select_brand"
  on public.athlete_deliverables for select to authenticated
  using (
    public.is_brand_user()
    and optin_campaign_id in (
      select oc.id from public.optin_campaigns oc
      where oc.brand_id in (select public.my_brand_ids())
    )
  );

-- ---- 11 · review_sessions --------------------------------------------

-- Was ALL to every authenticated user. Split by command so a brand user can
-- read their own campaigns' sessions and record a decision, and nothing else.
drop policy if exists "Auth users full access" on public.review_sessions;

drop policy if exists "review_sessions_select" on public.review_sessions;
create policy "review_sessions_select"
  on public.review_sessions for select to authenticated
  using (
    not public.is_brand_user()
    or campaign_id in (
      select bc.id from public.brand_campaigns bc
      where bc.brand_id in (select public.my_brand_ids())
    )
  );

drop policy if exists "review_sessions_insert" on public.review_sessions;
create policy "review_sessions_insert"
  on public.review_sessions for insert to authenticated
  with check (not public.is_brand_user());

drop policy if exists "review_sessions_delete" on public.review_sessions;
create policy "review_sessions_delete"
  on public.review_sessions for delete to authenticated
  using (not public.is_brand_user());

drop policy if exists "review_sessions_update" on public.review_sessions;
create policy "review_sessions_update"
  on public.review_sessions for update to authenticated
  using (
    not public.is_brand_user()
    or campaign_id in (
      select bc.id from public.brand_campaigns bc
      where bc.brand_id in (select public.my_brand_ids())
    )
  )
  with check (
    not public.is_brand_user()
    or campaign_id in (
      select bc.id from public.brand_campaigns bc
      where bc.brand_id in (select public.my_brand_ids())
    )
  );

-- WITH CHECK can restrict which ROWS a brand user may leave behind, but not
-- which COLUMNS they may touch. A trigger is the only way to say "a brand user
-- may change brand_decision and brand_decided_at and nothing else" — without
-- it, the UPDATE policy above would let them rewrite notes, tokens or
-- editor_deadline on their own sessions.
create or replace function public.review_sessions_brand_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_brand_user() then
    return new;
  end if;

  -- Strip the two brand-writable columns from both rows and compare what is
  -- left. Anything still different is a column a brand user may not touch.
  -- jsonb rather than hstore so no extension is required, and subtractive
  -- rather than a column-by-column list so a column added to this table later
  -- is refused by default instead of silently becoming writable.
  if (to_jsonb(new) - 'brand_decision' - 'brand_decided_at')
     is distinct from
     (to_jsonb(old) - 'brand_decision' - 'brand_decided_at') then
    raise exception
      'brand users may only update brand_decision and brand_decided_at on review_sessions'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists review_sessions_brand_columns_trg on public.review_sessions;
create trigger review_sessions_brand_columns_trg
  before update on public.review_sessions
  for each row execute function public.review_sessions_brand_columns();

-- ---- 12 · review_comments --------------------------------------------

drop policy if exists "Auth users full access" on public.review_comments;

drop policy if exists "review_comments_select" on public.review_comments;
create policy "review_comments_select"
  on public.review_comments for select to authenticated
  using (
    not public.is_brand_user()
    or session_id in (
      select rs.id from public.review_sessions rs
      where rs.campaign_id in (
        select bc.id from public.brand_campaigns bc
        where bc.brand_id in (select public.my_brand_ids())
      )
    )
  );

drop policy if exists "review_comments_insert" on public.review_comments;
create policy "review_comments_insert"
  on public.review_comments for insert to authenticated
  with check (
    not public.is_brand_user()
    or (
      author_type = 'brand'
      and session_id in (
        select rs.id from public.review_sessions rs
        where rs.campaign_id in (
          select bc.id from public.brand_campaigns bc
          where bc.brand_id in (select public.my_brand_ids())
        )
      )
    )
  );

drop policy if exists "review_comments_update" on public.review_comments;
create policy "review_comments_update"
  on public.review_comments for update to authenticated
  using (not public.is_brand_user()) with check (not public.is_brand_user());

drop policy if exists "review_comments_delete" on public.review_comments;
create policy "review_comments_delete"
  on public.review_comments for delete to authenticated
  using (not public.is_brand_user());

-- ---- 13 · brand_contacts ---------------------------------------------

-- Brand users can see their own team list. The existing staff policy
-- ("Staff full access", is_postgame_staff()) is untouched.
drop policy if exists "brand_contacts_select_own_brand" on public.brand_contacts;
create policy "brand_contacts_select_own_brand"
  on public.brand_contacts for select to authenticated
  using (
    public.is_brand_user()
    and brand_id in (select public.my_brand_ids())
  );
