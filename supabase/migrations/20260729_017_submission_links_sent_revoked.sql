-- Submission Forms list: NOT SENT pill + Mark sent + Revoke need timestamps
-- the 9-column submission_links table didn't carry. Both nullable, empty table.
alter table public.submission_links
  add column if not exists sent_at    timestamptz,
  add column if not exists revoked_at timestamptz;
