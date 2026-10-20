-- ============================================================
-- 084 — Campaign type, event details, playbook sheet links, storage
-- pointers, brand-approval wording, opt-in page extras, and the
-- campaign <-> saved audience join table.
--
-- Builds on 083 (blended admin schema). Every column is nullable and
-- added with `if not exists`, so re-running is safe and no existing
-- row changes. The campaign screens on branch blended/campaign read
-- these columns through a feature-detected second query and show
-- "—" when the column is missing, so the code works before AND after
-- this file is applied.
--
-- NOT applied anywhere yet. File only. Apply with apply_migration.
-- ============================================================

-- ---------- campaigns: type + event details ----------
alter table public.campaigns
  add column if not exists campaign_type text not null default 'social'
    check (campaign_type in ('social', 'event')),
  add column if not exists event_date date,
  add column if not exists event_start_time time,
  add column if not exists event_venue text,
  add column if not exists event_call_time time,
  add column if not exists event_activities text,
  add column if not exists event_wardrobe text,
  add column if not exists event_travel_notes text;

comment on column public.campaigns.campaign_type is 'social = athletes create and post on their own; event = an in-person appearance with a date, venue and call time.';
comment on column public.campaigns.event_date is 'Event campaigns only: the day of the event.';
comment on column public.campaigns.event_start_time is 'Event campaigns only: when the event starts.';
comment on column public.campaigns.event_venue is 'Event campaigns only: where it happens.';
comment on column public.campaigns.event_call_time is 'Event campaigns only: when athletes should arrive.';
comment on column public.campaigns.event_activities is 'Event campaigns only: what athletes do there.';
comment on column public.campaigns.event_wardrobe is 'Event campaigns only: what to wear.';
comment on column public.campaigns.event_travel_notes is 'Event campaigns only: parking, travel reimbursement, who to find on arrival.';

-- ---------- campaigns: playbook sheet links + storage pointers ----------
-- The three Google Sheets the old admin created on "New campaign". Until
-- that automation moves over they are pasted by hand on Edit campaign.
alter table public.campaigns
  add column if not exists internal_sheet_link text,
  add column if not exists external_sheet_link text,
  add column if not exists performance_tracker_link text,
  add column if not exists lucidlink_folder_path text,
  add column if not exists drive_folder_id text,
  add column if not exists brand_approves_in text
    check (brand_approves_in is null or brand_approves_in in ('portal', 'sheet', 'email'));

comment on column public.campaigns.internal_sheet_link is 'Google Sheet: the internal (Postgame-only) campaign sheet.';
comment on column public.campaigns.external_sheet_link is 'Google Sheet: the sheet shared with the brand.';
comment on column public.campaigns.performance_tracker_link is 'Google Sheet: the performance tracker. Mirrors campaign_storage.performance_tracker_url once provisioning writes it.';
comment on column public.campaigns.lucidlink_folder_path is 'LucidLink path for this campaign''s working files (not a URL).';
comment on column public.campaigns.drive_folder_id is 'Google Drive folder id for the campaign folder. Mirrors campaign_storage.campaign_folder_id once provisioning writes it.';
comment on column public.campaigns.brand_approves_in is 'Where the brand approves content: portal (brand portal), sheet (external sheet) or email.';

-- ---------- campaign_optin_pages: timeline, eligibility, hero ----------
alter table public.campaign_optin_pages
  add column if not exists timeline jsonb not null default '[]'::jsonb,
  add column if not exists eligibility jsonb not null default '{}'::jsonb,
  add column if not exists hero_media_url text;

comment on column public.campaign_optin_pages.timeline is '"What happens next" steps: [{"label":"Opt in","date":"by Nov 15"}, ...]. Shown as a timeline above next_steps_html.';
comment on column public.campaign_optin_pages.eligibility is '"Who''s eligible" block: {"show":true,"who":"College athletes","sports":"All sports","colleges":"...","min_followers":"10,000+ followers"}.';
comment on column public.campaign_optin_pages.hero_media_url is 'Hero video/photo at the top of the page. Falls back to the campaign''s mobile_app_cards row when null.';

-- ---------- campaign_audiences: which saved audiences are attached ----------
create table if not exists public.campaign_audiences (
  campaign_id   bigint not null references public.campaigns(campaign_id) on delete cascade,
  audience_id   uuid   not null references public.saved_audiences(id) on delete cascade,
  attached_at   timestamptz not null default now(),
  attached_by   uuid,
  invited_at    timestamptz,
  invited_count integer,
  optin_count   integer,
  primary key (campaign_id, audience_id)
);
comment on table public.campaign_audiences is 'Saved audiences attached to a campaign (the "Campaign audience" tab). invited_at / invited_count fill when the invite goes out; optin_count is recomputed from campaign_opt_ins.';
create index if not exists campaign_audiences_audience_id_idx on public.campaign_audiences (audience_id);

alter table public.campaign_audiences enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_audiences' and policyname = 'campaign_audiences_staff_all') then
    create policy campaign_audiences_staff_all on public.campaign_audiences
      for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff());
  end if;
end $$;

-- ---------- indexes the campaign page leans on ----------
create index if not exists campaign_opt_ins_campaign_stage_idx
  on public.campaign_opt_ins (campaign_id, is_optin, is_selected);
