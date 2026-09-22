-- Invoice PDFs the Hub uploads to Drive on the admin's behalf.
--
-- Brief 15 §1c. The admin posts the PDF and the submitter's details; the Hub
-- names the file per the convention, uploads it to the campaign's Athlete or
-- Videographer Invoices folder, and records the upload here so the Hub can
-- list invoices later. The admin stores the returned link on its own invoice
-- record — this table is the Hub's copy, not the source of truth for billing.
--
-- NO PDF CONTENTS are parsed or stored. This table holds where the file went
-- and who it came from, nothing more.
--
-- APPLIED to the recap-editor-test branch (jlxdxuqfmnnpwvmozgmm) on 2026-09-22.
-- NOT applied to production.

create table if not exists public.invoice_files (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaign_recaps(id) on delete cascade,
  cf_campaign_id   text not null,
  submitter_kind   text not null check (submitter_kind in ('athlete','videographer')),
  submitter_name   text not null,
  invoice_number   text,
  -- The name actually written to Drive, including any " (2)" suffix. Stored
  -- because the suffix is decided at upload time from what is already in the
  -- folder, and the next upload needs to know what it is competing with.
  drive_file_name  text not null,
  drive_file_id    text not null,
  web_view_link    text,
  submitted_at     timestamptz,
  uploaded_at      timestamptz not null default now()
);

-- One Drive file, one row. A retried upload that reused an existing file must
-- not create a second record of it.
create unique index if not exists invoice_files_drive_file_id_key
  on public.invoice_files (drive_file_id);

-- The lookup the duplicate-name rule makes on every upload: everything this
-- person has already submitted for this campaign in this role.
create index if not exists invoice_files_campaign_submitter_idx
  on public.invoice_files (campaign_id, submitter_kind, lower(submitter_name));

alter table public.invoice_files enable row level security;

-- Written only by the service role (the endpoint). Staff can read.
create policy "Service role manages invoice files"
  on public.invoice_files for all to service_role using (true) with check (true);
create policy "Authenticated users can view invoice files"
  on public.invoice_files for select to authenticated using (true);
