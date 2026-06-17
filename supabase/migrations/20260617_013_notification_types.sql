-- ============================================================
-- Fix: widen notifications.notification_type CHECK to the types the app emits
--
-- The CHECK only allowed 8 legacy types, so several notifications the app
-- already emits would fail at the DB:
--   athlete-side: new_deal, changes_requested, post_verified, payout_scheduled
--   manager-side (new): content_submitted, post_awaiting_verification,
--                       compliance_flag, new_optin, deadline_soon, deadline_passed
--
-- Additive: only ADDS allowed values; all existing values stay valid and no
-- row is changed. (Same approach as the profiles_role_check widening.)
-- ============================================================

alter table public.notifications drop constraint if exists notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type = any (array[
    -- legacy (kept)
    'task_assigned', 'task_completed', 'content_uploaded', 'content_approved',
    'content_rejected', 'brief_created', 'comment', 'system',
    -- athlete-side (emitted since the athlete app phases)
    'new_deal', 'changes_requested', 'post_verified', 'payout_scheduled',
    -- manager-side (this layer)
    'content_submitted', 'post_awaiting_verification', 'compliance_flag',
    'new_optin', 'deadline_soon', 'deadline_passed'
  ]));
