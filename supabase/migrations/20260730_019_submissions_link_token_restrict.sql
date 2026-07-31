-- Follow-up to 20260730_018. That migration created
-- submissions.submission_link_token with ON DELETE CASCADE; the intended rule is
-- RESTRICT, so deleting a submission_link that still has submissions is refused
-- rather than silently taking the submission rows with it.
--
-- Written as a separate migration rather than an edit to 018 because 018 is
-- already recorded in the live migration ledger — an amended 018 would be
-- skipped as already-applied and would never reach this database.
--
-- Deleting a campaign_recap is unaffected: submissions.campaign_id cascades from
-- campaign_recaps, so the child rows are gone before the submission_links cascade
-- reaches this constraint. Verified against the live database before applying.

alter table public.submissions
  drop constraint submissions_submission_link_token_fkey;

alter table public.submissions
  add constraint submissions_submission_link_token_fkey
    foreign key (submission_link_token)
    references public.submission_links(token)
    on delete restrict;
