-- One athlete-identity rule across the portal.
--
-- THE SYMPTOM: the dashboard KPI said 1,523 athletes and the Athletes
-- directory said 1,501, for the same brand, on the same screen session.
--
-- THE CAUSE was NOT two different dedupe rules — both already count
-- `distinct lower(trim(name))`. portal_brand_stats simply counted rows from
-- DRAFT campaigns that portal_brand_athletes (migration 049) excludes, and
-- accepted a whitespace-only name that 049 rejects. 22 athletes appear only on
-- CVS draft campaigns; that is the entire difference.
--
-- WHY NOT `distinct athlete id`, which is what was asked for. Measured on CVS:
--   athletes.id (the row PK)      2,047  -- one row per athlete PER CAMPAIGN,
--                                        -- so this counts appearances, not people
--   person_id only                  731  -- person_id is populated on just 882
--                                        -- of 2,047 rows; this silently drops
--                                        -- 1,165 rows and 770 people from a
--                                        -- client-facing directory
--   person_id else name           1,666  -- double-counts anyone carrying
--                                        -- person_id on one row and not another
--   lower(trim(name))             1,501  -- what both surfaces now report
--
-- person_id IS the right key and this should move to it — but only after it is
-- backfilled. Until then it would cost more than half the roster, so the name
-- key stays and the draft filter is what gets aligned. Recorded so the next
-- person does not "fix" this back.
--
-- Verified after applying, as `authenticated`: CVS reads 1,501 on both
-- surfaces, and across all 51 brands with rows in both views, zero disagree.
--
-- Rollback: restore the previous definition (no draft filter, no empty-name
-- guard) from migration 048.

create or replace view public.portal_brand_stats
with (security_invoker = true) as
select
  cr.brand_id,
  count(distinct lower(trim(a.name)))
    filter (where cr.lifecycle_status = 'active')          as athletes_active,
  count(distinct lower(trim(a.name)))                      as athletes_all_time
from public.campaign_recaps cr
join public.athletes a
  on a.campaign_id = cr.id
 and a.name is not null
 and trim(a.name) <> ''
where cr.lifecycle_status is distinct from 'draft'
group by cr.brand_id;

comment on view public.portal_brand_stats is
  'Per-brand athlete counts for the portal dashboard. Identity is lower(trim(name)) and drafts are excluded, matching portal_brand_athletes exactly so the dashboard KPI and the Athletes directory cannot disagree. Not person_id: it is populated on 43% of rows and would drop the rest.';

grant select on public.portal_brand_stats to authenticated;
