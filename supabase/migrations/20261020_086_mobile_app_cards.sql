-- ============================================================
-- 086 — Mobile app cards (the athlete app home feed) in the Hub shape.
--
-- Screens: /admin/mobile-app/cards (list + order), /admin/mobile-app/cards/new,
-- /admin/mobile-app/cards/[id] (editor + preview + SVG export) and
-- /admin/mobile-app/feed (phone-framed feed preview).
--
-- Where the data lives today: the Lovable admin's Supabase project
-- (mobile_app_cards + mobile_app_card_whitelist). Troy moves the rows
-- across. Migration 083 already declares both tables in the LOVABLE
-- shape (layout/aspect/bg/fg/accent/radius/padding/link_type …, and a
-- one-row-per-card whitelist of arrays). This file is written to work
-- in BOTH orders:
--
--   * 083 not applied → creates the tables in the Hub shape below.
--   * 083 applied     → keeps every 083 column (nothing is dropped; the
--                        Hub's campaign Playbook reads video_url /
--                        image_url / link_campaign_id) and ADDS the Hub
--                        columns; converts the whitelist from arrays to
--                        one row per (card, kind, value).
--
-- Column notes
--   card_type   'optin' (1080×1920 9:16) · 'coming_soon' (1080×1080 1:1)
--               · 'strip_banner' (1920×380). Default 'optin'. The CHECK
--               is added NOT VALID so rows 083/Lovable wrote with other
--               values ('campaign_opt_in', 'campaign_promo', …) do not
--               block the migration; new writes must use the three
--               values. Troy: map Lovable card_type values on import
--               (campaign_opt_in → optin, coming_soon → coming_soon,
--               strip_banner → strip_banner; campaign_promo and
--               featured_post have no Hub equivalent yet — park them as
--               'coming_soon' + status 'archived' or hold them back).
--   campaign_id BIGINT, not uuid: campaigns.campaign_id is the ColdFusion
--               campaign number (083). A uuid here could never reference
--               it. link_campaign_id (083) is left as-is.
--   visibility  'everyone' | 'whitelist'. A whitelisted card shows to a
--               user who matches ANY of: audience_id (saved_audiences),
--               or a college / sport / handle row in the whitelist.
--   status      'draft' | 'live' | 'archived' (083's CHECK is kept).
--
-- RLS: staff policy exactly like 083 (is_postgame_staff()), on both tables.
-- File only — NOT applied anywhere.
-- ============================================================

-- ---------- mobile_app_cards ----------
create table if not exists public.mobile_app_cards (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default 'Untitled card',
  card_type      text not null default 'optin',
  status         text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  sort_order     integer not null default 0,
  brand_id       uuid references public.brands(id) on delete set null,
  campaign_id    bigint,
  headline       text,
  eyebrow        text,
  body           text,
  cta_label      text,
  cta_href       text,
  bg_color       text,
  media_url      text,
  poster_url     text,
  visibility     text not null default 'everyone',
  audience_id    uuid,
  schedule_start timestamptz,
  schedule_end   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 083 columns the Hub's campaign Playbook already reads. Present here so
  -- the same code works whether 083 ran first or not.
  video_url        text,
  image_url        text,
  link_campaign_id bigint
);
comment on table public.mobile_app_cards is 'Cards on the athlete mobile app home feed. Edited at /admin/mobile-app/cards.';

-- Add the Hub columns when 083 created the table first.
alter table public.mobile_app_cards
  add column if not exists headline       text,
  add column if not exists eyebrow        text,
  add column if not exists body           text,
  add column if not exists cta_label      text,
  add column if not exists cta_href       text,
  add column if not exists bg_color       text,
  add column if not exists media_url      text,
  add column if not exists poster_url     text,
  add column if not exists visibility     text not null default 'everyone',
  add column if not exists audience_id    uuid,
  add column if not exists schedule_start timestamptz,
  add column if not exists schedule_end   timestamptz,
  add column if not exists sort_order     integer not null default 0,
  add column if not exists brand_id       uuid,
  add column if not exists campaign_id    bigint,
  add column if not exists video_url      text,
  add column if not exists image_url      text,
  add column if not exists link_campaign_id bigint;

alter table public.mobile_app_cards alter column card_type set default 'optin';

comment on column public.mobile_app_cards.card_type is 'optin (1080x1920) | coming_soon (1080x1080) | strip_banner (1920x380)';
comment on column public.mobile_app_cards.campaign_id is 'campaigns.campaign_id (bigint, the ColdFusion campaign number).';
comment on column public.mobile_app_cards.visibility is 'everyone | whitelist (audience_id and/or mobile_app_card_whitelist rows).';
comment on column public.mobile_app_cards.media_url is 'Full-bleed photo or video (https). poster_url is the still used for video + SVG export.';

do $$ begin
  -- card_type CHECK, NOT VALID so legacy/Lovable rows don't block the file.
  if not exists (select 1 from pg_constraint where conname = 'mobile_app_cards_card_type_check') then
    alter table public.mobile_app_cards
      add constraint mobile_app_cards_card_type_check
      check (card_type in ('optin', 'coming_soon', 'strip_banner')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mobile_app_cards_visibility_check') then
    alter table public.mobile_app_cards
      add constraint mobile_app_cards_visibility_check
      check (visibility in ('everyone', 'whitelist')) not valid;
  end if;
  -- status CHECK when 083 did not create one.
  if not exists (select 1 from pg_constraint where conname = 'mobile_app_cards_status_check') then
    alter table public.mobile_app_cards
      add constraint mobile_app_cards_status_check
      check (status in ('draft', 'live', 'archived')) not valid;
  end if;
  -- Foreign keys (083 adds brand_id / campaign_id ones itself; guard on name).
  if not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
                 where k.contype = 'f' and k.conrelid = 'public.mobile_app_cards'::regclass and a.attname = 'brand_id') then
    alter table public.mobile_app_cards add foreign key (brand_id) references public.brands(id) on delete set null;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'campaigns' and c.relkind = 'r')
     and not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
                     where k.contype = 'f' and k.conrelid = 'public.mobile_app_cards'::regclass and a.attname = 'campaign_id') then
    alter table public.mobile_app_cards add foreign key (campaign_id) references public.campaigns(campaign_id) on delete set null;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'saved_audiences' and c.relkind = 'r')
     and not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
                     where k.contype = 'f' and k.conrelid = 'public.mobile_app_cards'::regclass and a.attname = 'audience_id') then
    alter table public.mobile_app_cards add foreign key (audience_id) references public.saved_audiences(id) on delete set null;
  end if;
end $$;

create index if not exists mobile_app_cards_status_sort_idx on public.mobile_app_cards (status, sort_order);
create index if not exists mobile_app_cards_brand_id_idx on public.mobile_app_cards (brand_id);
create index if not exists mobile_app_cards_campaign_id_idx on public.mobile_app_cards (campaign_id);
create index if not exists mobile_app_cards_audience_id_idx on public.mobile_app_cards (audience_id);

-- ---------- mobile_app_card_whitelist ----------
-- 083 shape: card_id PK + audience_ids/college_ids/sports/ig_handles arrays.
-- Hub shape: one row per (card_id, kind, value). Convert if the 083 shape is
-- what exists (its rows are carried over; audience_ids[1] moves onto the
-- card's audience_id — the Hub editor holds one audience per card).
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'mobile_app_card_whitelist' and column_name = 'audience_ids')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'mobile_app_card_whitelist' and column_name = 'kind') then
    alter table public.mobile_app_card_whitelist rename to mobile_app_card_whitelist_083;
    -- Free the auto-generated constraint names for the new table.
    if exists (select 1 from pg_constraint where conname = 'mobile_app_card_whitelist_pkey') then
      alter table public.mobile_app_card_whitelist_083 rename constraint mobile_app_card_whitelist_pkey to mobile_app_card_whitelist_083_pkey;
    end if;
    if exists (select 1 from pg_constraint where conname = 'mobile_app_card_whitelist_card_id_fkey') then
      alter table public.mobile_app_card_whitelist_083 rename constraint mobile_app_card_whitelist_card_id_fkey to mobile_app_card_whitelist_083_card_id_fkey;
    end if;
  end if;
end $$;

create table if not exists public.mobile_app_card_whitelist (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.mobile_app_cards(id) on delete cascade,
  kind       text not null check (kind in ('college', 'sport', 'handle')),
  value      text not null,
  created_at timestamptz not null default now(),
  unique (card_id, kind, value)
);
comment on table public.mobile_app_card_whitelist is 'Who sees a whitelisted app card: one row per college / sport / Instagram handle. Audiences live on mobile_app_cards.audience_id.';
create index if not exists mobile_app_card_whitelist_card_id_idx on public.mobile_app_card_whitelist (card_id);

do $$ begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'mobile_app_card_whitelist_083') then
    insert into public.mobile_app_card_whitelist (card_id, kind, value)
      select card_id, 'college', v from public.mobile_app_card_whitelist_083, unnest(college_ids) as v
      union all
      select card_id, 'sport', v from public.mobile_app_card_whitelist_083, unnest(sports) as v
      union all
      select card_id, 'handle', lower(ltrim(v, '@')) from public.mobile_app_card_whitelist_083, unnest(ig_handles) as v
    on conflict (card_id, kind, value) do nothing;

    update public.mobile_app_cards c
       set audience_id = w.audience_ids[1],
           visibility  = 'whitelist'
      from public.mobile_app_card_whitelist_083 w
     where w.card_id = c.id
       and (cardinality(w.audience_ids) > 0 or cardinality(w.college_ids) > 0
            or cardinality(w.sports) > 0 or cardinality(w.ig_handles) > 0);

    drop table public.mobile_app_card_whitelist_083;
  end if;
end $$;

-- ---------- RLS (staff policy, same as 083) + updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['mobile_app_cards', 'mobile_app_card_whitelist'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_staff_all') then
      execute format('create policy %I on public.%I for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff())', t || '_staff_all', t);
    end if;
  end loop;
  if exists (select 1 from pg_proc where proname = 'set_updated_at')
     and not exists (select 1 from pg_trigger where tgname = 'mobile_app_cards_set_updated_at' and tgrelid = 'public.mobile_app_cards'::regclass) then
    create trigger mobile_app_cards_set_updated_at before update on public.mobile_app_cards
      for each row execute function public.set_updated_at();
  end if;
end $$;
