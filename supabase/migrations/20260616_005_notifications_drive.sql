-- ============================================================
-- Athlete App — Phase 6: notifications + Drive folders
--
-- Additive only.
-- 1. notify_athletes_new_deal: when a campaign goes live (insert or status
--    flips to 'live'), drop a "new deal" notification for every athlete.
--    Reuses the existing public.notifications table. (Next-step nudges —
--    approved / changes / verified — are emitted from the app's API routes.)
-- 2. athlete_campaign_optins.drive_folder_id caches the Google Drive folder
--    created for the deal on first upload.
-- ============================================================

-- ── 1. New-deal notification trigger ──
create or replace function public.notify_athletes_new_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- NB: notifications.related_campaign_id FKs to campaign_recaps (not
  -- optin_campaigns), so we don't set it — the deal is encoded in link_url.
  if NEW.status = 'live' and (TG_OP = 'INSERT' or OLD.status is distinct from 'live') then
    insert into public.notifications (user_id, notification_type, title, message, link_url)
    select p.id,
           'new_deal',
           'New deal just dropped',
           coalesce(NEW.title, 'A new deal') || ' is live — opt in now to claim your spot.',
           '/athlete/deals/' || NEW.slug
    from public.profiles p
    where p.role = 'athlete';
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_athletes_new_deal on public.optin_campaigns;
create trigger trg_notify_athletes_new_deal
  after insert or update of status on public.optin_campaigns
  for each row execute function public.notify_athletes_new_deal();

-- ── 2. Drive folder cache ──
alter table public.athlete_campaign_optins
  add column if not exists drive_folder_id text;
