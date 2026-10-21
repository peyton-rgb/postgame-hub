-- ============================================================
-- 098 — frameio_connection: slots for the registered webhook.
--
-- Frame.io returns a webhook's signing secret exactly once, when the webhook
-- is created. /api/frameio/register-webhook stores it here so nobody has to
-- copy it by hand, and /api/frameio/webhook reads it to check each delivery.
--
-- frameio_connection is staff-only (RLS) and already holds the OAuth tokens,
-- so the secret sits beside them. Adds two nullable columns; no data changes.
-- ============================================================

alter table public.frameio_connection
  add column if not exists webhook_id     text,
  add column if not exists webhook_secret text;
