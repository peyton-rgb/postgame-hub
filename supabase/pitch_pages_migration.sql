-- ============================================================
-- pitch_pages table
-- ============================================================

create table if not exists pitch_pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  brand_id    uuid references brands(id),
  title       text,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  content     jsonb not null default '{"sections":[]}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid
);

-- Index for slug lookups
create index if not exists idx_pitch_pages_slug on pitch_pages(slug);

-- RLS
alter table pitch_pages enable row level security;

-- Any authenticated user can read/write all pitch pages (internal team tool)
create policy "Authenticated users can read all pitch pages"
  on pitch_pages for select
  to authenticated
  using (true);

create policy "Authenticated users can insert pitch pages"
  on pitch_pages for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update pitch pages"
  on pitch_pages for update
  to authenticated
  using (true);

create policy "Authenticated users can delete pitch pages"
  on pitch_pages for delete
  to authenticated
  using (true);

-- Published pages are publicly readable
create policy "Public can read published pitch pages"
  on pitch_pages for select
  to anon
  using (status = 'published');
