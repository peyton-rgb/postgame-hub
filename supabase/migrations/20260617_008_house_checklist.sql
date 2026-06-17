-- ============================================================
-- Auto Editor — Phase 0: the House Checklist (Postgame's rubric)
--
-- Postgame's platform-wide definition of "good," separate from any single
-- deal's brief. Seeded data so it can be edited without a code change. Powers
-- curation (Phase 2), the compliance gate, and suggestions (Phase 3).
--
-- Category priority (reflected in weight): Authenticity > Compliance >
-- Performance > Brand > Technical. Compliance items are HARD GATES — a fail
-- flags/blocks the item regardless of other scores.
--
-- Additive only. RLS: staff (is_staff()) read/write. Server scoring uses the
-- service role (bypasses RLS).
-- ============================================================

create table if not exists public.house_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,                 -- authenticity|compliance|performance|brand|technical
  rule        text not null,
  applies_to  text[] not null default '{photo,video}',  -- subset of {photo,video}
  is_hard_gate boolean not null default false,
  weight      int not null default 1,        -- category priority (higher = weighs more)
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_house_checklist_active on public.house_checklist_items (active, category);

alter table public.house_checklist_items enable row level security;

drop policy if exists hci_staff_read on public.house_checklist_items;
create policy hci_staff_read on public.house_checklist_items
  for select to authenticated using (public.is_staff());

drop policy if exists hci_staff_write on public.house_checklist_items;
create policy hci_staff_write on public.house_checklist_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Seed the rubric (idempotent: only seed when empty) ──
insert into public.house_checklist_items (category, rule, applies_to, is_hard_gate, weight, sort_order)
select * from (values
  -- 1. Authenticity (weight 5)
  ('authenticity', 'Reads like the athlete''s real voice/content, not a stiff ad read.', array['photo','video'], false, 5, 10),
  ('authenticity', 'Native to the platform, not a repurposed TV spot.', array['photo','video'], false, 5, 11),
  ('authenticity', 'Genuine, believable enthusiasm.', array['photo','video'], false, 5, 12),
  -- 2. Compliance (weight 4, HARD GATE)
  ('compliance', 'FTC #ad / paid-partnership disclosure present (in caption AND on-screen where applicable).', array['photo','video'], true, 4, 20),
  ('compliance', 'No competing brands visible.', array['photo','video'], true, 4, 21),
  ('compliance', 'No copyrighted music likely to be muted.', array['video'], true, 4, 22),
  -- 3. Performance (weight 3)
  ('performance', 'Strong hook in the first 1–2 seconds (face or motion, not a title card).', array['video'], false, 3, 30),
  ('performance', 'Scroll-stopping opening frame / thumbnail.', array['photo','video'], false, 3, 31),
  ('performance', 'Clear payoff or story arc.', array['video'], false, 3, 32),
  ('performance', 'Trend / audio alignment where relevant.', array['video'], false, 3, 33),
  ('performance', 'Caption + on-screen text that drives engagement.', array['photo','video'], false, 3, 34),
  -- 4. Brand (weight 2)
  ('brand', 'Follows the deal''s brand guidelines (colors, do''s/don''ts).', array['photo','video'], false, 2, 40),
  ('brand', 'Product clearly visible and in focus.', array['photo','video'], false, 2, 41),
  ('brand', 'Logo present, not cropped or obscured.', array['photo','video'], false, 2, 42),
  ('brand', 'Brand shown in a positive, on-brief context.', array['photo','video'], false, 2, 43),
  -- 5. Technical (weight 1)
  ('technical', 'High resolution / sharp (not blurry or soft-upscaled).', array['photo','video'], false, 1, 50),
  ('technical', 'Good sound quality — clear audio, no wind/clipping, music balanced under voice.', array['video'], false, 1, 51),
  ('technical', 'Correct orientation / ratio (9:16 vertical for reels/stories).', array['photo','video'], false, 1, 52),
  ('technical', 'Good exposure & lighting.', array['photo','video'], false, 1, 53),
  ('technical', 'Steady (not shaky).', array['video'], false, 1, 54),
  ('technical', 'Length within the platform''s sweet spot.', array['video'], false, 1, 55)
) as v(category, rule, applies_to, is_hard_gate, weight, sort_order)
where not exists (select 1 from public.house_checklist_items);
