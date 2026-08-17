// ============================================================
// Admin audit log — every confirmed admin write also records
// who / what / when / before / after into admin_audit_log.
//
// The table arrives with migration 027 (UNAPPLIED tonight), so this
// helper is deliberately fail-open: if the insert errors for ANY
// reason (table missing, RLS, network), we log to the server console
// and return — the primary write is never blocked by auditing.
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";

export interface AuditEntry {
  actorId: string;
  actorEmail?: string | null;
  action: string; // e.g. "campaign.update", "payout.mark_paid"
  entity: string; // table or domain, e.g. "campaign_recaps"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function logAdminAction(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceSupabase();
    const { error } = await supabase.from("admin_audit_log").insert({
      actor_id: entry.actorId,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      before_state: entry.before ?? null,
      after_state: entry.after ?? null,
    });
    if (error) {
      console.error(
        `[admin-audit] insert failed (${entry.action} on ${entry.entity}): ${error.message} — apply migration 027 if it hasn't been run yet`
      );
    }
  } catch (err) {
    console.error("[admin-audit] unexpected failure:", err);
  }
}
