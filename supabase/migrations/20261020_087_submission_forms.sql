-- 087 — Content submission forms: the editable athlete form (title,
-- instructions, deliverables checklist, limits, consent, confirmation) on
-- content_submission_forms, and the campaign ↔ videographer assignment table
-- behind the Videographers tab of /admin/content/submissions/[campaignId].
--
-- Builds on 083 (content_submission_forms, worker_jobs, is_postgame_staff())
-- and 085 (videographer_profiles). Every statement is idempotent. The Hub
-- feature-detects all of this: the screens render "—" / pending notes
-- until it is applied. FILE ONLY — not applied anywhere.
--
-- Note on `status`: 083 already created content_submission_forms.status
-- (default 'draft'). The add-if-not-exists below is a no-op there; the Hub
-- writes status = 'live' explicitly when it creates a form from the admin,
-- so the column default is left as 083 set it.

-- ------------------------------------------------------------ form fields
alter table public.content_submission_forms
  add column if not exists title             text,
  add column if not exists instructions      text,
  add column if not exists accepted_types    text[],
  add column if not exists max_size_mb       integer,
  add column if not exists deliverables      jsonb not null default '[]'::jsonb,
  add column if not exists deadline          date,
  add column if not exists consent_text      text,
  add column if not exists confirmation_text text,
  add column if not exists lucidlink_path    text,
  add column if not exists status            text not null default 'live';

comment on column public.content_submission_forms.title             is 'Headline on the athlete upload page. Falls back to the campaign name.';
comment on column public.content_submission_forms.instructions      is 'One or two lines under the headline.';
comment on column public.content_submission_forms.accepted_types    is 'File extensions the form accepts, lower-case, no dot (e.g. {jpg,png,heic,mp4,mov}). Empty = any image/video.';
comment on column public.content_submission_forms.max_size_mb       is 'Per-file size cap in MB. Null = no cap beyond the upload relay.';
comment on column public.content_submission_forms.deliverables      is 'Checklist: [{"kind":"photo"|"video","count":3,"note":"Feed photos, product visible"}]. min_photos / min_videos are kept in step with it.';
comment on column public.content_submission_forms.deadline          is 'Content due date shown on the form; athletes can keep adding files until then.';
comment on column public.content_submission_forms.consent_text      is 'One confirmation per line. Each becomes a checkbox athletes tick before the upload button turns on.';
comment on column public.content_submission_forms.confirmation_text is 'Shown once the last file is in.';
comment on column public.content_submission_forms.lucidlink_path    is 'Where files land, relative to the LucidLink filespace root. Set by the campaign; copied here for the form.';

-- ------------------------------------------------------------ videographers on a campaign
create table if not exists public.campaign_videographers (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  bigint not null references public.campaigns(campaign_id) on delete cascade,
  -- The videographer's app account (videographer_profiles.id from 085), not
  -- the legacy booking-roster row and not auth.users.
  user_id      uuid not null references public.videographer_profiles(id) on delete cascade,
  status       text not null default 'assigned'
               check (status in ('assigned','removed')),
  lucid_access text not null default 'pending'
               check (lucid_access in ('pending','granted','failed')),
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid,
  updated_at   timestamptz not null default now(),
  unique (campaign_id, user_id)
);
comment on table public.campaign_videographers is
  'Videographers assigned to a campaign (Submission forms → Videographers tab). lucid_access is set by the office worker once it grants the account this campaign''s LucidLink folders.';
create index if not exists campaign_videographers_campaign_idx on public.campaign_videographers (campaign_id);
create index if not exists campaign_videographers_user_idx     on public.campaign_videographers (user_id);

drop trigger if exists campaign_videographers_set_updated_at on public.campaign_videographers;
create trigger campaign_videographers_set_updated_at
  before update on public.campaign_videographers
  for each row execute function public.set_updated_at();

-- Staff policy, same shape as 083's loop (is_postgame_staff()).
alter table public.campaign_videographers enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_videographers'
      and policyname = 'campaign_videographers_staff_all'
  ) then
    create policy campaign_videographers_staff_all on public.campaign_videographers
      for all to authenticated
      using (public.is_postgame_staff()) with check (public.is_postgame_staff());
  end if;
end $$;
