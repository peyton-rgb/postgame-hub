-- ============================================================
-- Sync: admin_import.profiles (old admin's scraped social profiles)
--       -> public.athlete_profiles
-- Also: admin_import.sports -> public.sports, admin_import.teams -> public.teams
-- (run those two first; profiles point at them).
--
-- Plain English: one row per athlete social profile (Instagram / TikTok / X
-- handles, followers, engagement, NIL value), keyed by the old admin's
-- profile number. Re-running UPDATES rows instead of duplicating them.
--
-- Colleges: the Hub's colleges table uses DIFFERENT numbers from the old
-- admin, so colleges are matched by school name (or a school_aliases
-- spelling). ~96% of profiles with a college match; the rest keep the
-- college as text in athlete_profiles.college.
-- Sports: same numbers as the old admin (copied as-is).
-- Teams: same numbers as the old admin; their college matched by name.
-- Profile type: left empty — the old admin's profile_types list was not in
-- the nightly copy, so its numbers can't be decoded yet.
-- Owner: admin user number -> people.admin_user_id.
-- Batch by profile_id range (edit FILTER) to stay under the time limit.
-- ============================================================

-- 1. sports
insert into public.sports (sport_id, sport)
select sport_id::bigint, btrim(sport) from admin_import.sports where sport_id ~ '^\d+$'
on conflict (sport_id) do update set sport = excluded.sport, updated_at = now();

-- 2. teams (college matched by name)
with oc as (select college_id, lower(btrim(coalesce(nullif(collegename,''), name))) nm from admin_import.colleges),
hub as (select id, lower(btrim(name)) nm from public.colleges
        union select college_id, lower(btrim(alias)) from public.school_aliases where college_id is not null),
hubu as (select nm, min(id) id from hub group by nm having count(distinct id) = 1),
cmap as (select oc.college_id old_id, h.id hub_id from oc join hubu h on h.nm = oc.nm)
insert into public.teams (team_id, college_id, conference, date_ranked, date_stamp, date_updated, gender, instagram_followers, nil_value,
  ranking_conference_instagram, ranking_conference_nil_value, ranking_conference_tik_tok, ranking_conference_twitter,
  ranking_overall_instagram, ranking_overall_nil_value, ranking_overall_tik_tok, ranking_overall_twitter,
  sport_id, team_name, tik_tok_followers, twitter_followers)
select t.team_id::bigint, cm.hub_id, t.conference, t.date_ranked::timestamptz, t.date_stamp::timestamptz, t.date_updated::timestamptz, t.gender,
  case when t.instagram_followers::text ~ '^\d+(\.\d+)?$' then round(t.instagram_followers::text::numeric)::bigint end,
  case when t.nil_value::text ~ '^-?\d+(\.\d+)?$' then t.nil_value::text::numeric end,
  t.ranking_conference_instagram::text, t.ranking_conference_nil_value::text, t.ranking_conference_tik_tok::text, t.ranking_conference_twitter::text,
  t.ranking_overall_instagram::text, t.ranking_overall_nil_value::text, t.ranking_overall_tik_tok::text, t.ranking_overall_twitter::text,
  s.sport_id, btrim(t.team_name),
  case when t.tik_tok_followers::text ~ '^\d+(\.\d+)?$' then round(t.tik_tok_followers::text::numeric)::bigint end,
  case when t.twitter_followers::text ~ '^\d+(\.\d+)?$' then round(t.twitter_followers::text::numeric)::bigint end
from admin_import.teams t
left join cmap cm on cm.old_id = t.college_id
left join public.sports s on s.sport_id::text = t.sport_id
where t.team_id ~ '^\d+$'
on conflict (team_id) do nothing;

-- 3. athlete profiles
with oc as (select college_id, lower(btrim(coalesce(nullif(collegename,''), name))) nm from admin_import.colleges),
hub as (select id, lower(btrim(name)) nm from public.colleges
        union select college_id, lower(btrim(alias)) from public.school_aliases where college_id is not null),
hubu as (select nm, min(id) id from hub group by nm having count(distinct id) = 1),
cmap as (select oc.college_id old_id, h.id hub_id from oc join hubu h on h.nm = oc.nm)
insert into public.athlete_profiles as t (
  profile_id, avg_comments, avg_likes, avg_views, biography, city, class, class_college, class_hs,
  college, college_id, conference, date_cached, date_html_created, date_last_algo_run, date_last_checked,
  date_last_engage, date_last_engage_twitter, date_last_ranked, date_last_scrape, date_last_scrape_tik_tok,
  date_last_scrape_twitter, date_last_story_cached, date_stamp, engagement, engagement_rate, error,
  f_name, fbid, fbpage, flag, followers, following, full_name, gender, high_school, igid, image_url,
  include_in_rankings, instagram_reach, instagram_username, is_archived, is_business, is_master,
  is_private, is_verified, l_name, last_college_id, nil_adjustment, nil_algo, nil_value, pro_id,
  professional, profile_image_url, profile_pic, profile_pic_hd, rating, sport, sport_id, sport2,
  sport2_id, state, team_id, tik_tok_engagement, tik_tok_followers, tik_tok_likes, tik_tok_reach,
  tik_tok_username, twitter_engagement, twitter_followers, twitter_reach, twitter_username,
  owner_person_id, website, updated_at
)
select
  p.profile_id::bigint, p.avg_comments, p.avg_likes, p.avg_views, p.biography, p.city, p.class, p.class_college, p.class_hs,
  nullif(btrim(p.college), ''), c1.hub_id, p.conference, p.date_cached, p.date_html_created, p.date_last_algo_run, p.date_last_checked,
  p.date_last_engage, p.date_last_engage_twitter, p.date_last_ranked, p.date_last_scrape, p.date_last_scrape_tik_tok,
  p.date_last_scrape_twitter, p.date_last_story_cached, p.date_stamp, p.engagement, p.engagement_rate, p.error,
  p.f_name, p.fbid, p.fbpage,
  lower(btrim(p.flag)) in ('1','true','t','yes'),
  case when p.followers ~ '^\d+(\.\d+)?$' then round(p.followers::numeric)::bigint end,
  case when p.following ~ '^\d+(\.\d+)?$' then round(p.following::numeric)::bigint end,
  p.full_name, p.gender, p.high_school, p.igid, p.image_url,
  lower(btrim(p.include_in_rankings)) in ('1','true','t','yes'),
  case when p.instagram_reach ~ '^\d+(\.\d+)?$' then round(p.instagram_reach::numeric)::bigint end,
  nullif(lower(btrim(p.instagram_username)), ''),
  lower(btrim(p.is_archived)) in ('1','true','t','yes'),
  lower(btrim(p.is_business)) in ('1','true','t','yes'),
  lower(btrim(p.is_master))   in ('1','true','t','yes'),
  lower(btrim(p.is_private))  in ('1','true','t','yes'),
  lower(btrim(p.is_verified)) in ('1','true','t','yes'),
  p.l_name, c2.hub_id, p.nil_adjustment, p.nil_algo, p.nil_value,
  case when p.pro_id ~ '^\d+$' then p.pro_id::bigint end,
  lower(btrim(p.professional)) in ('1','true','t','yes'),
  p.profile_image_url, p.profile_pic, p.profile_pic_hd, p.rating, p.sport, s1.sport_id, p.sport2,
  s2.sport_id, p.state, tm.team_id, p.tik_tok_engagement,
  round(p.tik_tok_followers)::bigint,
  case when p.tik_tok_likes ~ '^\d+(\.\d+)?$' then round(p.tik_tok_likes::numeric)::bigint end,
  case when p.tik_tok_reach ~ '^\d+(\.\d+)?$' then round(p.tik_tok_reach::numeric)::bigint end,
  nullif(btrim(p.tik_tok_username), ''), p.twitter_engagement,
  case when p.twitter_followers ~ '^\d+(\.\d+)?$' then round(p.twitter_followers::numeric)::bigint end,
  case when p.twitter_reach ~ '^\d+(\.\d+)?$' then round(p.twitter_reach::numeric)::bigint end,
  nullif(btrim(p.twitter_username), ''),
  pe.id, p.website, now()
from admin_import.profiles p
left join cmap c1 on c1.old_id = p.college_id
left join cmap c2 on c2.old_id = p.last_college_id
left join public.sports s1 on s1.sport_id::text = p.sport_id
left join public.sports s2 on s2.sport_id::text = p.sport2_id
left join public.teams tm on tm.team_id::text = p.team_id
left join public.people pe on pe.admin_user_id = case when p.user_id_owner ~ '^\d+$' then p.user_id_owner::bigint end
where p.profile_id ~ '^\d+$'
  /*FILTER*/
on conflict (profile_id) do nothing;
