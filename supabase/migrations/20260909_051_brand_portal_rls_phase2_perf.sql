-- Phase 2 RLS, performance correction to migration 050.
--
-- THE PROBLEM. 050 wrote its predicates as `not public.is_brand_user() or ...`.
-- A bare function call in a policy is evaluated PER ROW, and is_brand_user()
-- runs two EXISTS queries each time. Measured on `select count(*) from
-- athletes` (9,436 rows) as `authenticated`:
--
--     RLS bypassed (session user):     1.8 ms
--     050 as written:              1,214.4 ms      -- 650x slower
--     this migration:                 35.6 ms
--
-- The brand subplans correctly showed "never executed" for a non-brand user,
-- so the scope logic was right; the cost was is_brand_user() itself, 9,436
-- times.
--
-- THE FIX. Wrapping the call in a scalar subquery — `(select
-- public.is_brand_user())` — makes it uncorrelated, so the planner hoists it
-- into an InitPlan and evaluates it ONCE per query. Confirmed in the plan:
-- "InitPlan 1 -> Result (actual rows=1 loops=1)". This is Supabase's
-- documented RLS performance pattern.
--
-- The predicates are otherwise IDENTICAL to 050. supabase/tests/rls-phase2.sql
-- was re-run after this migration: 20 of 20 checks still pass.
--
-- 050 is kept in the repo as applied, because it is what the database ran;
-- this file is the current shape of every policy it touches.
--
-- Rollback: re-run migration 050.

-- ---- campaign_recaps -------------------------------------------------
drop policy if exists "campaign_recaps_select_authenticated" on public.campaign_recaps;
create policy "campaign_recaps_select_authenticated"
  on public.campaign_recaps for select to authenticated
  using (
    not (select public.is_brand_user())
    or brand_id in (select public.my_brand_ids())
  );

-- ---- brands ----------------------------------------------------------
drop policy if exists "brands_select_authenticated" on public.brands;
create policy "brands_select_authenticated"
  on public.brands for select to authenticated
  using (
    not (select public.is_brand_user())
    or id in (select public.my_brand_ids())
  );

-- ---- brand_logos -----------------------------------------------------
drop policy if exists "brand_logos_select_authenticated" on public.brand_logos;
create policy "brand_logos_select_authenticated"
  on public.brand_logos for select to authenticated
  using (
    not (select public.is_brand_user())
    or brand_id in (select public.my_brand_ids())
  );

drop policy if exists "brand_logos_write_staff" on public.brand_logos;
create policy "brand_logos_write_staff"
  on public.brand_logos for insert to authenticated
  with check ((select public.is_staff()));

drop policy if exists "brand_logos_update_staff" on public.brand_logos;
create policy "brand_logos_update_staff"
  on public.brand_logos for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists "brand_logos_delete_staff" on public.brand_logos;
create policy "brand_logos_delete_staff"
  on public.brand_logos for delete to authenticated
  using ((select public.is_staff()));

-- ---- athletes --------------------------------------------------------
drop policy if exists "athletes_select_authenticated" on public.athletes;
create policy "athletes_select_authenticated"
  on public.athletes for select to authenticated
  using (
    not (select public.is_brand_user())
    or campaign_id in (
      select id from public.campaign_recaps
      where brand_id in (select public.my_brand_ids())
    )
  );

-- ---- media -----------------------------------------------------------
drop policy if exists "media_auth_read" on public.media;
create policy "media_auth_read"
  on public.media for select to authenticated
  using (
    not (select public.is_brand_user())
    or campaign_id in (
      select id from public.campaign_recaps
      where brand_id in (select public.my_brand_ids())
    )
  );

-- ---- media_campaigns -------------------------------------------------
drop policy if exists "media_campaigns_select_authenticated" on public.media_campaigns;
create policy "media_campaigns_select_authenticated"
  on public.media_campaigns for select to authenticated
  using (
    not (select public.is_brand_user())
    or campaign_recap_id in (
      select id from public.campaign_recaps
      where brand_id in (select public.my_brand_ids())
    )
  );

drop policy if exists "media_campaigns_insert" on public.media_campaigns;
create policy "media_campaigns_insert"
  on public.media_campaigns for insert to authenticated
  with check (not (select public.is_brand_user()));

drop policy if exists "media_campaigns_update" on public.media_campaigns;
create policy "media_campaigns_update"
  on public.media_campaigns for update to authenticated
  using (not (select public.is_brand_user()))
  with check (not (select public.is_brand_user()));

drop policy if exists "media_campaigns_delete" on public.media_campaigns;
create policy "media_campaigns_delete"
  on public.media_campaigns for delete to authenticated
  using (not (select public.is_brand_user()));

-- ---- media_athletes --------------------------------------------------
drop policy if exists "media_athletes_select_authenticated" on public.media_athletes;
create policy "media_athletes_select_authenticated"
  on public.media_athletes for select to authenticated
  using (
    not (select public.is_brand_user())
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
  with check (not (select public.is_brand_user()));

drop policy if exists "media_athletes_update" on public.media_athletes;
create policy "media_athletes_update"
  on public.media_athletes for update to authenticated
  using (not (select public.is_brand_user()))
  with check (not (select public.is_brand_user()));

drop policy if exists "media_athletes_delete" on public.media_athletes;
create policy "media_athletes_delete"
  on public.media_athletes for delete to authenticated
  using (not (select public.is_brand_user()));

-- ---- package_deliverables --------------------------------------------
drop policy if exists "package_deliverables_read" on public.package_deliverables;
create policy "package_deliverables_read"
  on public.package_deliverables for select to authenticated
  using (
    not (select public.is_brand_user())
    or package_id in (
      select pp.id from public.posting_packages pp
      where pp.campaign_id in (
        select bc.id from public.brand_campaigns bc
        where bc.brand_id in (select public.my_brand_ids())
      )
    )
  );

-- ---- athlete_deliverables --------------------------------------------
drop policy if exists "deliv_select_brand" on public.athlete_deliverables;
create policy "deliv_select_brand"
  on public.athlete_deliverables for select to authenticated
  using (
    (select public.is_brand_user())
    and optin_campaign_id in (
      select oc.id from public.optin_campaigns oc
      where oc.brand_id in (select public.my_brand_ids())
    )
  );

-- ---- review_sessions -------------------------------------------------
drop policy if exists "review_sessions_select" on public.review_sessions;
create policy "review_sessions_select"
  on public.review_sessions for select to authenticated
  using (
    not (select public.is_brand_user())
    or campaign_id in (
      select bc.id from public.brand_campaigns bc
      where bc.brand_id in (select public.my_brand_ids())
    )
  );

drop policy if exists "review_sessions_insert" on public.review_sessions;
create policy "review_sessions_insert"
  on public.review_sessions for insert to authenticated
  with check (not (select public.is_brand_user()));

drop policy if exists "review_sessions_delete" on public.review_sessions;
create policy "review_sessions_delete"
  on public.review_sessions for delete to authenticated
  using (not (select public.is_brand_user()));

drop policy if exists "review_sessions_update" on public.review_sessions;
create policy "review_sessions_update"
  on public.review_sessions for update to authenticated
  using (
    not (select public.is_brand_user())
    or campaign_id in (
      select bc.id from public.brand_campaigns bc
      where bc.brand_id in (select public.my_brand_ids())
    )
  )
  with check (
    not (select public.is_brand_user())
    or campaign_id in (
      select bc.id from public.brand_campaigns bc
      where bc.brand_id in (select public.my_brand_ids())
    )
  );

-- ---- review_comments -------------------------------------------------
drop policy if exists "review_comments_select" on public.review_comments;
create policy "review_comments_select"
  on public.review_comments for select to authenticated
  using (
    not (select public.is_brand_user())
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
    not (select public.is_brand_user())
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
  using (not (select public.is_brand_user()))
  with check (not (select public.is_brand_user()));

drop policy if exists "review_comments_delete" on public.review_comments;
create policy "review_comments_delete"
  on public.review_comments for delete to authenticated
  using (not (select public.is_brand_user()));

-- ---- brand_contacts --------------------------------------------------
drop policy if exists "brand_contacts_select_own_brand" on public.brand_contacts;
create policy "brand_contacts_select_own_brand"
  on public.brand_contacts for select to authenticated
  using (
    (select public.is_brand_user())
    and brand_id in (select public.my_brand_ids())
  );
