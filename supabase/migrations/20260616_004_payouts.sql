-- ============================================================
-- Athlete App — Phase 5: payouts (PayPal, stubbed)
--
-- Additive only. One payout row per fully-verified deal. Payment terms:
-- issued 30 days after the deal is verified (scheduled_for). Actual PayPal
-- execution is STUBBED — no credentials, no money movement. Amounts come from
-- the deal's free-text payout (amount_label); amount_cents is left null until
-- a manager sets a real figure, so we never fabricate dollar values.
-- ============================================================

create table if not exists public.payouts (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references public.profiles(id) on delete cascade,
  optin_id          uuid not null references public.athlete_campaign_optins(id) on delete cascade,
  optin_campaign_id uuid not null references public.optin_campaigns(id) on delete cascade,
  amount_cents      integer,
  currency          text not null default 'USD',
  amount_label      text,
  status            text not null default 'pending',  -- pending | processing | paid | failed
  provider          text not null default 'paypal',
  paypal_email      text,
  provider_ref      text,
  scheduled_for     timestamptz not null,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (optin_id)
);

create index if not exists idx_payouts_athlete on public.payouts (athlete_id);
create index if not exists idx_payouts_status on public.payouts (status);

alter table public.payouts enable row level security;

-- Athlete: read only their own payouts. (All writes go through service-role
-- server code — payouts must never be client-writable.)
drop policy if exists payouts_select_own on public.payouts;
create policy payouts_select_own on public.payouts
  for select to authenticated using (athlete_id = auth.uid());

-- Staff: read all payouts.
drop policy if exists payouts_staff_read on public.payouts;
create policy payouts_staff_read on public.payouts
  for select to authenticated using (public.is_staff());
