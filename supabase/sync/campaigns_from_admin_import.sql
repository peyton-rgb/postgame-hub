-- ============================================================
-- Sync: admin_import.campaigns (nightly copy of the old admin) -> public.campaigns
--
-- Plain English: copies every campaign from the old admin's nightly copy
-- into the Hub's campaigns table, keyed by the same campaign number
-- (e.g. 1020). Running it again UPDATES existing campaigns instead of
-- duplicating them, so it is safe to re-run after each nightly refresh.
--
-- Brand: admin account number -> brands.admin_brand_id.
-- Manager / assistant: admin user number -> people.admin_user_id.
-- Text flags ('1', 'true') become real true/false; text counts become numbers.
--
-- Filter: edit the WHERE line at the bottom to sync one campaign (smoke test)
-- or remove it to sync all.
-- ============================================================
insert into public.campaigns as t (
  campaign_id, brand_id, affiliate_ad_id, affiliate_landing_page, affiliate_link,
  affiliate_param_template, affiliate_shorten_enabled, agreement, asana_link,
  assistant_person_id, manager_person_id, campaign_brief_link, campaign_details_link,
  campaign_goals, campaign_introduction, campaign_kpi, campaign_name, campaign_note,
  campaign_objective, campaign_overview, campaign_recap_link, campaign_style_guide,
  campaign_tracker, campaign_webpage, college_id_list, college_id_list_add,
  content_quality, content_type, contract, custom_tracking, date_stamp, discount,
  est_athlete_spend, est_margin_goal, est_videographer_spend, expected_pay_date,
  instagram_hashtag, instagram_hashtag2, instagram_hashtag3,
  instagram_mention, instagram_mention2, instagram_mention3,
  invoice_link, is_active, is_auto_select, management_fee,
  max_per_user_payment, min_per_user_payment, other_spend, sentiment_analysis, sow_link,
  tik_tok_hash_tag2, tik_tok_hash_tag3, tik_tok_hashtag, tik_tok_mention2, tik_tok_mention3, tiktok_mention,
  total, total_budget, total_contract_signed, total_is_selected, total_opt_in, total_paid,
  total_selected_audience, total_targets, user_stamp,
  utm_campaign, utm_content, utm_medium, utm_source, updated_at
)
select
  c.campaign_id::bigint,
  b.id,
  c.affiliate_ad_id, c.affiliate_landing_page, c.affiliate_link,
  c.affiliate_param_template, c.affiliate_shorten_enabled, c.agreement, c.asana_link,
  pa.id, pm.id, c.campaign_brief_link, c.campaign_details_link,
  c.campaign_goals, c.campaign_introduction, c.campaign_kpi, btrim(c.campaign_name), c.campaign_note,
  c.campaign_objective, c.campaign_overview, c.campaign_recap_link, c.campaign_style_guide,
  c.campaign_tracker, c.campaign_webpage, c.college_id_list, c.college_id_list_add,
  c.content_quality, c.content_type, c.contract, c.custom_tracking, c.date_stamp, c.discount,
  c.est_athlete_spend, c.est_margin_goal, c.est_videographer_spend, c.expected_pay_date,
  c.instagram_hashtag, c.instagram_hashtag2, c.instagram_hashtag3,
  c.instagram_mention, c.instagram_mention2, c.instagram_mention3,
  c.invoice_link,
  lower(btrim(c.is_active)) in ('1','true','t','yes'),
  lower(btrim(c.is_auto_select)) in ('1','true','t','yes'),
  c.management_fee,
  c.max_per_user_payment, c.min_per_user_payment, c.other_spend, c.sentiment_analysis::text, c.sow_link,
  c.tik_tok_hash_tag2, c.tik_tok_hash_tag3, c.tik_tok_hashtag, c.tik_tok_mention2, c.tik_tok_mention3, c.tiktok_mention,
  c.total, c.total_budget,
  case when c.total_contract_signed ~ '^-?\d+(\.\d+)?$' then round(c.total_contract_signed::numeric)::bigint end,
  case when c.total_is_selected ~ '^-?\d+(\.\d+)?$' then round(c.total_is_selected::numeric)::bigint end,
  case when c.total_opt_in ~ '^-?\d+(\.\d+)?$' then round(c.total_opt_in::numeric)::bigint end,
  c.total_paid,
  case when c.total_selected_audience ~ '^-?\d+(\.\d+)?$' then round(c.total_selected_audience::numeric)::bigint end,
  case when c.total_targets ~ '^-?\d+(\.\d+)?$' then round(c.total_targets::numeric)::bigint end,
  c.user_stamp,
  c.utm_campaign, c.utm_content, c.utm_medium, c.utm_source, now()
from admin_import.campaigns c
left join lateral (select id from public.brands x where x.admin_brand_id = c.account_id order by x.archived, x.created_at limit 1) b on true
left join lateral (select id from public.people x where x.admin_user_id::text = c.campaign_manager_user_id limit 1) pm on true
left join lateral (select id from public.people x where x.admin_user_id::text = c.campaign_assistant_user_id limit 1) pa on true
where c.campaign_id ~ '^\d+$'
  /*FILTER*/
on conflict (campaign_id) do update set
  brand_id = excluded.brand_id,
  affiliate_ad_id = excluded.affiliate_ad_id, affiliate_landing_page = excluded.affiliate_landing_page,
  affiliate_link = excluded.affiliate_link, affiliate_param_template = excluded.affiliate_param_template,
  affiliate_shorten_enabled = excluded.affiliate_shorten_enabled, agreement = excluded.agreement,
  asana_link = excluded.asana_link,
  assistant_person_id = coalesce(excluded.assistant_person_id, t.assistant_person_id),
  manager_person_id = coalesce(excluded.manager_person_id, t.manager_person_id),
  campaign_brief_link = excluded.campaign_brief_link, campaign_details_link = excluded.campaign_details_link,
  campaign_goals = excluded.campaign_goals, campaign_introduction = excluded.campaign_introduction,
  campaign_kpi = excluded.campaign_kpi, campaign_name = excluded.campaign_name,
  campaign_note = excluded.campaign_note, campaign_objective = excluded.campaign_objective,
  campaign_overview = excluded.campaign_overview, campaign_recap_link = excluded.campaign_recap_link,
  campaign_style_guide = excluded.campaign_style_guide, campaign_tracker = excluded.campaign_tracker,
  campaign_webpage = excluded.campaign_webpage, college_id_list = excluded.college_id_list,
  college_id_list_add = excluded.college_id_list_add, content_quality = excluded.content_quality,
  content_type = excluded.content_type, contract = excluded.contract, custom_tracking = excluded.custom_tracking,
  date_stamp = excluded.date_stamp, discount = excluded.discount,
  est_athlete_spend = excluded.est_athlete_spend, est_margin_goal = excluded.est_margin_goal,
  est_videographer_spend = excluded.est_videographer_spend, expected_pay_date = excluded.expected_pay_date,
  instagram_hashtag = excluded.instagram_hashtag, instagram_hashtag2 = excluded.instagram_hashtag2,
  instagram_hashtag3 = excluded.instagram_hashtag3, instagram_mention = excluded.instagram_mention,
  instagram_mention2 = excluded.instagram_mention2, instagram_mention3 = excluded.instagram_mention3,
  invoice_link = excluded.invoice_link, is_active = excluded.is_active, is_auto_select = excluded.is_auto_select,
  management_fee = excluded.management_fee, max_per_user_payment = excluded.max_per_user_payment,
  min_per_user_payment = excluded.min_per_user_payment, other_spend = excluded.other_spend,
  sentiment_analysis = excluded.sentiment_analysis, sow_link = excluded.sow_link,
  tik_tok_hash_tag2 = excluded.tik_tok_hash_tag2, tik_tok_hash_tag3 = excluded.tik_tok_hash_tag3,
  tik_tok_hashtag = excluded.tik_tok_hashtag, tik_tok_mention2 = excluded.tik_tok_mention2,
  tik_tok_mention3 = excluded.tik_tok_mention3, tiktok_mention = excluded.tiktok_mention,
  total = excluded.total, total_budget = excluded.total_budget,
  total_contract_signed = excluded.total_contract_signed, total_is_selected = excluded.total_is_selected,
  total_opt_in = excluded.total_opt_in, total_paid = excluded.total_paid,
  total_selected_audience = excluded.total_selected_audience, total_targets = excluded.total_targets,
  user_stamp = excluded.user_stamp, utm_campaign = excluded.utm_campaign, utm_content = excluded.utm_content,
  utm_medium = excluded.utm_medium, utm_source = excluded.utm_source, updated_at = now()
returning campaign_id, campaign_name, brand_id, is_active;
