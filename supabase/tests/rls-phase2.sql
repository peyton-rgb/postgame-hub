-- ======================================================================
-- Phase 2 RLS check — the six checks from the brief, as 20 assertions.
--
-- HOW TO RUN
--   Paste into the Supabase SQL editor (project xqaybwhpgxillpbbqtks) or run
--   it through the MCP execute_sql tool. It is ONE transaction and it is never
--   committed, so it writes nothing: the four test users, their contacts,
--   their brand attachments and two review_sessions all disappear when the
--   connection closes. Safe against production — which is the point, since
--   production's policies are the thing under test.
--
--   Verified after each run:
--     select count(*) from auth.users where email like 'rls-test-%';  -- 0
--     select count(*) from brand_contacts;                            -- 1
--     select count(*) from profiles;                                  -- 16
--
-- WHY IT NEEDS FIXTURES
--   The checks require four users: an admin, an athlete, a brand contact for
--   CVS, and a brand contact for a second brand. brand_contacts holds exactly
--   ONE row today and its profile_id is NULL, so no brand user with a
--   resolvable identity exists. my_brand_ids() keys on
--   brand_contacts.profile_id, so without fixtures every brand check would
--   "pass" by returning zero rows for entirely the wrong reason.
--
--   Two things the fixtures have to respect, both learned the hard way:
--     · profiles.id REFERENCES auth.users(id) — the auth row comes first.
--       (information_schema.constraint_column_usage hides this, because auth
--       is a different schema.)
--     · auth.users carries a handle_new_user() trigger that creates the
--       profiles row from NEW.email, so email goes on the auth.users insert
--       and access_level is set by a follow-up update.
--     · review_sessions.status and .brand_decision are both CHECK-constrained.
--       Legal values are 'sent_to_brand' and 'approve' — not 'pending' or
--       'approved'.
--
-- HOW A USER IS SIMULATED
--   auth.uid() reads request.jwt.claims->>'sub'. Setting the role to
--   `authenticated` and that claim to a profile id is exactly what PostgREST
--   does per request, so the policies see what they would see in production.
--
-- READING THE OUTPUT
--   One row per assertion with expected, actual and pass. Every row must say
--   true. Last run: 20/20, after migrations 050 and 051.
-- ======================================================================

begin;

create temp table rls_check (n int, name text, expected text, actual text, pass boolean) on commit drop;
grant all on rls_check to authenticated;
create temp table rls_ids (k text primary key, v uuid) on commit drop;
grant all on rls_ids to authenticated;

insert into rls_ids (k, v) values
  ('cvs',      '06ad6e6e-b859-461e-a496-14472397ab4e'),
  ('other',    '03eea40a-8b1c-4f47-be28-eafbe212054e'),
  ('u_admin',  gen_random_uuid()), ('u_athlete', gen_random_uuid()),
  ('u_cvs',    gen_random_uuid()), ('u_other',   gen_random_uuid()),
  ('c_cvs',    gen_random_uuid()), ('c_other',   gen_random_uuid());

insert into auth.users (id, email)
select v, 'rls-test-admin@pstgm.com'     from rls_ids where k='u_admin'
union all select v, 'rls-test-athlete@example.com' from rls_ids where k='u_athlete'
union all select v, 'rls-test-cvs@example.com'     from rls_ids where k='u_cvs'
union all select v, 'rls-test-other@example.com'   from rls_ids where k='u_other';

update profiles set role='admin',   access_level='admin'   where id=(select v from rls_ids where k='u_admin');
update profiles set role='athlete', access_level='athlete' where id=(select v from rls_ids where k='u_athlete');
update profiles set role='brand',   access_level='brand'   where id in (select v from rls_ids where k in ('u_cvs','u_other'));

insert into postgame_contacts (id, name)
select v,'RLS Test CVS Contact'   from rls_ids where k='c_cvs'
union all select v,'RLS Test Other Contact' from rls_ids where k='c_other';

insert into brand_contacts (contact_id, brand_id, role, status, invited_email, signup_email, profile_id, activated_at)
select (select v from rls_ids where k='c_cvs'), (select v from rls_ids where k='cvs'),
       'approver','active','rls-test-cvs@example.com','rls-test-cvs@example.com',
       (select v from rls_ids where k='u_cvs'), now()
union all
select (select v from rls_ids where k='c_other'), (select v from rls_ids where k='other'),
       'approver','active','rls-test-other@example.com','rls-test-other@example.com',
       (select v from rls_ids where k='u_other'), now();

-- Truth, computed as the session user (RLS bypassed), for comparison.
create temp table rls_truth on commit drop as
select (select count(*) from campaign_recaps) as recaps_all,
       (select count(*) from campaign_recaps where brand_id=(select v from rls_ids where k='cvs')) as recaps_cvs,
       (select count(*) from athletes) as athletes_all,
       (select count(*) from athletes a where a.campaign_id in
          (select id from campaign_recaps where brand_id=(select v from rls_ids where k='cvs'))) as athletes_cvs,
       (select count(*) from media) as media_all,
       (select count(*) from media m where m.campaign_id in
          (select id from campaign_recaps where brand_id=(select v from rls_ids where k='cvs'))) as media_cvs,
       (select count(*) from brands) as brands_all;
grant all on rls_truth to authenticated;

-- review_sessions is empty database-wide, so check 5 needs its own rows.
-- campaign_id references brand_campaigns, NOT campaign_recaps.
insert into rls_ids (k,v) select 'cvs_bc',   id from brand_campaigns where brand_id='06ad6e6e-b859-461e-a496-14472397ab4e' limit 1;
insert into rls_ids (k,v) select 'other_bc', id from brand_campaigns where brand_id='03eea40a-8b1c-4f47-be28-eafbe212054e' limit 1;
insert into rls_ids (k,v) values ('rs_cvs',gen_random_uuid()), ('rs_other',gen_random_uuid());

insert into review_sessions (id, campaign_id, status, notes)
select (select v from rls_ids where k='rs_cvs'), (select v from rls_ids where k='cvs_bc'), 'sent_to_brand','original notes';
insert into review_sessions (id, campaign_id, status, notes)
select (select v from rls_ids where k='rs_other'), (select v from rls_ids where k='other_bc'),'sent_to_brand','original notes';

set local role authenticated;

-- ==== CHECK 1 · athlete unchanged =====================================
do $$ declare a uuid; begin select v into a from rls_ids where k='u_athlete';
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true); end $$;
insert into rls_check select 1,'athlete: unrestricted reads unchanged',
  (select recaps_all||'/'||athletes_all||'/'||media_all||'/'||brands_all from rls_truth),
  (select count(*) from campaign_recaps)||'/'||(select count(*) from athletes)||'/'||(select count(*) from media)||'/'||(select count(*) from brands),
  (select recaps_all||'/'||athletes_all||'/'||media_all||'/'||brands_all from rls_truth) =
  ((select count(*) from campaign_recaps)||'/'||(select count(*) from athletes)||'/'||(select count(*) from media)||'/'||(select count(*) from brands));

-- ==== CHECK 2 · admin unchanged =======================================
do $$ declare a uuid; begin select v into a from rls_ids where k='u_admin';
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true); end $$;
insert into rls_check select 2,'admin: unrestricted reads unchanged',
  (select recaps_all||'/'||athletes_all||'/'||media_all||'/'||brands_all from rls_truth),
  (select count(*) from campaign_recaps)||'/'||(select count(*) from athletes)||'/'||(select count(*) from media)||'/'||(select count(*) from brands),
  (select recaps_all||'/'||athletes_all||'/'||media_all||'/'||brands_all from rls_truth) =
  ((select count(*) from campaign_recaps)||'/'||(select count(*) from athletes)||'/'||(select count(*) from media)||'/'||(select count(*) from brands));

-- ==== CHECK 3 · CVS contact sees CVS and only CVS =====================
do $$ declare a uuid; begin select v into a from rls_ids where k='u_cvs';
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true); end $$;

insert into rls_check select 3,'CVS contact: is_brand_user() and my_brand_ids() resolve',
  'true/1', is_brand_user()::text||'/'||(select count(*) from my_brand_ids()),
  is_brand_user() and (select count(*) from my_brand_ids())=1;
insert into rls_check select 4,'CVS contact: campaign_recaps = CVS only',
  (select recaps_cvs::text from rls_truth), (select count(*)::text from campaign_recaps),
  (select recaps_cvs from rls_truth)=(select count(*) from campaign_recaps)
  and (select count(*) from campaign_recaps where brand_id<>(select v from rls_ids where k='cvs'))=0;
insert into rls_check select 5,'CVS contact: athletes = CVS campaigns only',
  (select athletes_cvs::text from rls_truth), (select count(*)::text from athletes),
  (select athletes_cvs from rls_truth)=(select count(*) from athletes);
insert into rls_check select 6,'CVS contact: media = CVS campaigns only',
  (select media_cvs::text from rls_truth), (select count(*)::text from media),
  (select media_cvs from rls_truth)=(select count(*) from media);
insert into rls_check select 7,'CVS contact: brands = 1 (own brand)',
  '1', (select count(*)::text from brands),
  (select count(*) from brands)=1 and (select count(*) from brands where id<>(select v from rls_ids where k='cvs'))=0;
insert into rls_check select 8,'CVS contact: brand_logos = own brand only',
  '0 foreign',
  (select count(*)::text from brand_logos where brand_id is not null and brand_id<>(select v from rls_ids where k='cvs'))||' foreign',
  (select count(*) from brand_logos where brand_id is not null and brand_id<>(select v from rls_ids where k='cvs'))=0;

-- The bypass migration 050 closed: a policy granted TO public also grants to
-- `authenticated`, and permissive policies OR. Before the fix this returned 84
-- published recaps and 3,266 athlete rows to any brand user.
insert into rls_check select 9,'CVS contact: no bypass via the TO public policies',
  '0 foreign published',
  (select count(*)::text from campaign_recaps where published and brand_id<>(select v from rls_ids where k='cvs'))||' foreign published',
  (select count(*) from campaign_recaps where published and brand_id<>(select v from rls_ids where k='cvs'))=0;

-- portal_campaigns is security_invoker, so it inherits the policy above.
-- A plain view would have run as its owner and bypassed every rule here.
insert into rls_check select 10,'CVS contact: portal_campaigns scoped too (security_invoker)',
  '0 foreign',
  (select count(*)::text from portal_campaigns where brand_id<>(select v from rls_ids where k='cvs'))||' foreign',
  (select count(*) from portal_campaigns where brand_id<>(select v from rls_ids where k='cvs'))=0
  and (select count(*) from portal_campaigns)>0;

-- ==== CHECK 4 · second-brand contact sees zero CVS rows ===============
do $$ declare a uuid; begin select v into a from rls_ids where k='u_other';
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true); end $$;
insert into rls_check select 11,'other-brand contact: zero CVS recaps','0',
  (select count(*)::text from campaign_recaps where brand_id=(select v from rls_ids where k='cvs')),
  (select count(*) from campaign_recaps where brand_id=(select v from rls_ids where k='cvs'))=0;
insert into rls_check select 12,'other-brand contact: zero CVS athletes','0',
  (select count(*)::text from athletes a where a.campaign_id in
     (select id from campaign_recaps where brand_id=(select v from rls_ids where k='cvs'))),
  (select count(*) from athletes a where a.campaign_id in
     (select id from campaign_recaps where brand_id=(select v from rls_ids where k='cvs')))=0;
insert into rls_check select 13,'other-brand contact: sees only its own brand row','1',
  (select count(*)::text from brands),
  (select count(*) from brands)=1 and (select count(*) from brands where id=(select v from rls_ids where k='other'))=1;

-- ==== CHECK 5 · review_sessions writes ================================
do $$ declare a uuid; begin select v into a from rls_ids where k='u_cvs';
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true); end $$;

insert into rls_check select 14,'CVS contact: sees own review_session, not the foreign one',
  '1 own / 0 foreign',
  (select count(*)::text from review_sessions where id=(select v from rls_ids where k='rs_cvs'))||' own / '||
  (select count(*)::text from review_sessions where id=(select v from rls_ids where k='rs_other'))||' foreign',
  (select count(*) from review_sessions where id=(select v from rls_ids where k='rs_cvs'))=1
  and (select count(*) from review_sessions where id=(select v from rls_ids where k='rs_other'))=0;

-- 5a · a non-decision column must be refused by the column trigger
do $$ begin update review_sessions set notes='x' where id=(select v from rls_ids where k='rs_cvs');
  insert into rls_check values (15,'CVS contact: update notes REFUSED','error 42501','allowed (LEAK)',false);
exception when others then
  insert into rls_check values (15,'CVS contact: update notes REFUSED','error 42501','refused '||sqlstate, sqlstate='42501'); end $$;

-- 5b · the decision itself, on own session, must be allowed
do $$ declare n int; begin
  update review_sessions set brand_decision='approve', brand_decided_at=now() where id=(select v from rls_ids where k='rs_cvs');
  get diagnostics n=row_count;
  insert into rls_check values (16,'CVS contact: brand_decision on own session ALLOWED','1 row',n||' rows',n=1);
exception when others then
  insert into rls_check values (16,'CVS contact: brand_decision on own session ALLOWED','1 row','error '||sqlstate||': '||sqlerrm,false); end $$;

-- 5c · the same decision on another brand's session must touch nothing
do $$ declare n int; begin
  update review_sessions set brand_decision='approve' where id=(select v from rls_ids where k='rs_other');
  get diagnostics n=row_count;
  insert into rls_check values (17,'CVS contact: brand_decision on foreign session touches 0 rows','0 rows',n||' rows',n=0);
exception when others then
  insert into rls_check values (17,'CVS contact: brand_decision on foreign session touches 0 rows','0 rows','error '||sqlstate,false); end $$;

-- 5d · insert and delete are staff-only
do $$ begin insert into review_sessions (campaign_id,status) values ((select v from rls_ids where k='cvs_bc'),'sent_to_brand');
  insert into rls_check values (18,'CVS contact: insert review_session REFUSED','error 42501','allowed (LEAK)',false);
exception when others then
  insert into rls_check values (18,'CVS contact: insert review_session REFUSED','error 42501','refused '||sqlstate, sqlstate='42501'); end $$;

do $$ declare n int; begin delete from review_sessions where id=(select v from rls_ids where k='rs_cvs');
  get diagnostics n=row_count;
  insert into rls_check values (19,'CVS contact: delete review_session touches 0 rows','0 rows',n||' rows',n=0);
exception when others then
  insert into rls_check values (19,'CVS contact: delete review_session touches 0 rows','0 rows','refused '||sqlstate, sqlstate='42501'); end $$;

-- ==== CHECK 6 · settings unreachable through the portal's view ========
insert into rls_check select 20,'portal_campaigns does not expose settings / budget','none',
  coalesce((select string_agg(column_name,',') from information_schema.columns
            where table_schema='public' and table_name='portal_campaigns'
              and column_name in ('settings','pin_hash','owner_id','admin_account_id','recap_config','metric_overrides','frameio_url')),'none'),
  not exists (select 1 from information_schema.columns where table_schema='public' and table_name='portal_campaigns'
              and column_name in ('settings','pin_hash','owner_id','admin_account_id','recap_config','metric_overrides','frameio_url'));

reset role;

-- Full detail:
select n, name, expected, actual, pass from rls_check order by n;

-- Or the one-line verdict:
--   select count(*) filter (where pass) as passed, count(*) as total,
--          coalesce(string_agg(n||' '||name, ' | ') filter (where not pass), 'none') as failures
--   from rls_check;

rollback;
