-- Phase 1 of the templated content submission form (SPEC-submission-form.md).
-- 1a. submission_links gains deliverables / brief_url / updated_at.
-- 1b. New parent table `submissions` — identity + acknowledgements belong to the
--     submission, not to each file.
-- 1c. tier3_submissions gains a nullable submission_id pointing at that parent.
--
-- Nothing is migrated: tier3_submissions has 0 rows and submission_links has 1.
-- Every existing column is left exactly as it is.

-- ---------------------------------------------------------------- 1a
alter table public.submission_links
  add column if not exists deliverables int,
  add column if not exists brief_url    text,
  add column if not exists updated_at   timestamptz not null default now();

-- Matches the repo-wide pattern (public.set_updated_at, used by bts_submissions,
-- campaign_briefs, concepts, creator_briefs).
drop trigger if exists submission_links_set_updated_at on public.submission_links;
create trigger submission_links_set_updated_at
  before update on public.submission_links
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------- 1b
create table if not exists public.submissions (
  id                    uuid primary key default gen_random_uuid(),

  submission_link_token text        not null
    references public.submission_links(token) on delete cascade,
  campaign_id           uuid        not null
    references public.campaign_recaps(id)    on delete cascade,

  athlete_first_name    text        not null,
  athlete_last_name     text        not null,
  ig_handle             text        not null,   -- trimmed, leading @ stripped
  phone                 text        not null,   -- digits only, formatting is display
  school                text        not null,
  email                 text        not null,

  athlete_id            uuid
    references public.athletes(id)             on delete set null,

  ack_instructions_at   timestamptz not null,
  ack_music_at          timestamptz not null,

  submitted_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists submissions_submission_link_token_idx
  on public.submissions (submission_link_token);
create index if not exists submissions_campaign_id_idx
  on public.submissions (campaign_id);
create index if not exists submissions_athlete_id_idx
  on public.submissions (athlete_id);
create index if not exists submissions_submitted_at_idx
  on public.submissions (submitted_at desc);

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row
  execute function public.set_updated_at();

-- RLS mirrors tier3_submissions. The public form writes through
-- createServiceSupabase() (service role), so no anon policy is needed or wanted.
alter table public.submissions enable row level security;

drop policy if exists service_role_all on public.submissions;
create policy service_role_all on public.submissions
  for all using (auth.role() = 'service_role');

drop policy if exists authenticated_read on public.submissions;
create policy authenticated_read on public.submissions
  for select using (auth.role() = 'authenticated');

drop policy if exists authenticated_update_review on public.submissions;
create policy authenticated_update_review on public.submissions
  for update using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------- 1c
-- Nullable: the 0 existing rows and any legacy import won't have a parent.
-- SET NULL on delete so file rows survive if the parent submission is removed.
alter table public.tier3_submissions
  add column if not exists submission_id uuid
    references public.submissions(id) on delete set null;

create index if not exists tier3_submissions_submission_id_idx
  on public.tier3_submissions (submission_id);
