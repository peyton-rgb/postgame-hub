-- ============================================================
-- Sync: admin_import.campaign_opt_ins (+ app_campaign_selections)
--       -> public.campaign_opt_ins
--
-- Plain English: one row per athlete per campaign (invited, opted in,
-- selected, signed, posted, paid), keyed by the old admin's opt-in number.
-- Re-running UPDATES existing rows instead of duplicating them.
--
-- Skipped on purpose:
--   * opt-ins whose campaign no longer exists in public.campaigns
--     (deleted in the old admin; ~27k rows) — nothing to attach them to.
--   * opt-in numbers that are not plain numbers (8 rows).
-- Left empty for now:
--   * payment_id / invoice_id — filled when payments and invoices sync.
--   * selected_by — it points at the old admin's logins, not Hub people.
-- Athlete: admin user number -> people.admin_user_id (~94% match); the
-- Instagram handle is always kept so unmatched rows stay identifiable.
-- Run in campaign-sized batches (edit the FILTER line) to stay under the
-- database's statement time limit.
-- ============================================================
insert into public.campaign_opt_ins as t (
  campaign_opt_in_id, campaign_id, person_id, instagram_username,
  amount_paid, date_committed, date_contract_sign, date_invited, date_optin, date_paid,
  date_posted, date_request_update, date_selected, date_stamp,
  flag_delete, is_committed, is_invited, is_optin, is_selected,
  method_paid, pay_manually, sms_confirm,
  notify, notified_at, reminded_at, unselected_at, updated_at
)
select
  o.campaign_opt_in_id::bigint,
  o.campaign_id::bigint,
  p.id,
  nullif(btrim(o.instagram_username), ''),
  o.amount_paid, o.date_committed, o.date_contract_sign, o.date_invited, o.date_optin, o.date_paid,
  o.date_posted, o.date_request_update, o.date_selected, o.date_stamp,
  lower(btrim(o.flag_delete))  in ('1','true','t','yes'),
  lower(btrim(o.is_committed)) in ('1','true','t','yes'),
  lower(btrim(o.is_invited))   in ('1','true','t','yes'),
  lower(btrim(o.is_optin))     in ('1','true','t','yes'),
  lower(btrim(o.is_selected))  in ('1','true','t','yes'),
  o.method_paid,
  lower(btrim(o.pay_manually)) in ('1','true','t','yes'),
  o.sms_confirm is not null,
  coalesce(s.notify, true), s.notified_at, s.reminded_at, s.unselected_at,
  now()
from admin_import.campaign_opt_ins o
join public.campaigns c on c.campaign_id = case when o.campaign_id ~ '^\d+$' then o.campaign_id::bigint end
left join public.people p on p.admin_user_id = case when o.user_id ~ '^\d+$' then o.user_id::bigint end
left join admin_import.app_campaign_selections s on s.campaign_opt_in_id = o.campaign_opt_in_id
where o.campaign_opt_in_id ~ '^\d+$'
  /*FILTER*/
on conflict (campaign_opt_in_id) do update set
  campaign_id = excluded.campaign_id,
  person_id = coalesce(excluded.person_id, t.person_id),
  instagram_username = excluded.instagram_username,
  amount_paid = excluded.amount_paid, date_committed = excluded.date_committed,
  date_contract_sign = excluded.date_contract_sign, date_invited = excluded.date_invited,
  date_optin = excluded.date_optin, date_paid = excluded.date_paid, date_posted = excluded.date_posted,
  date_request_update = excluded.date_request_update, date_selected = excluded.date_selected,
  date_stamp = excluded.date_stamp, flag_delete = excluded.flag_delete,
  is_committed = excluded.is_committed, is_invited = excluded.is_invited,
  is_optin = excluded.is_optin, is_selected = excluded.is_selected,
  method_paid = excluded.method_paid, pay_manually = excluded.pay_manually, sms_confirm = excluded.sms_confirm,
  notify = excluded.notify, notified_at = excluded.notified_at, reminded_at = excluded.reminded_at,
  unselected_at = excluded.unselected_at, updated_at = now();
