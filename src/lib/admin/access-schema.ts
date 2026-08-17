// ============================================================
// Live schema probe for /admin/access.
//
// Migration 028 is applied to the database — so "is it applied?" must
// be a QUESTION ASKED AT RUNTIME, never a hardcoded constant. The list
// banner, the per-row attachment copy, and every write guard all read
// this one probe, so the screen can never claim one thing and do
// another.
//
// WHY POSTGREST AND NOT information_schema:
// PostgREST keeps its own schema cache. A table can exist in Postgres
// while the API layer still reports it missing (PGRST205,
// "…in the schema cache") until that cache reloads. information_schema
// would answer "applied" while the very next write 404s — which is
// exactly the half-write this probe exists to prevent. So we ask the
// same client, through the same layer, that the writes use.
//
// Result is memoised per request via React cache(): one round trip per
// render or action, not one per row.
// ============================================================

import { cache } from "react";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";

export const MIGRATION_028 = "20260817_028_brand_contacts_junction.sql";

/** The junction table 028 creates. Named once so the probe is testable. */
const ATTACHMENT_TABLE = "brand_contacts";

export interface AccessSchemaState {
  /** brand_contacts is readable through PostgREST. */
  attachments: boolean;
  /** postgame_contacts.contact_type / .agency_name are readable. */
  identityFields: boolean;
  /** Everything 028 delivers is live — the screen runs at full fidelity. */
  ready: boolean;
  /** Human-readable list of what is still missing, for the banner. */
  missing: string[];
}

/**
 * `select ... limit 0` — no rows transferred, but PostgREST still has to
 * resolve the relation and the columns, which is precisely what we want
 * to know. A missing-schema error means "not there"; any other error
 * (network, RLS) is not a schema verdict, so we do not refuse writes
 * over it — those surface as normal errors at write time instead.
 */
async function probeRelation(table: string, columns: string): Promise<boolean> {
  try {
    const supabase = createServiceSupabase();
    const { error } = await supabase.from(table).select(columns).limit(0);
    if (!error) return true;
    return !isMissingSchemaError(error);
  } catch {
    return false;
  }
}

export const getAccessSchemaState = cache(async (): Promise<AccessSchemaState> => {
  const [attachments, identityFields] = await Promise.all([
    probeRelation(ATTACHMENT_TABLE, "id"),
    probeRelation("postgame_contacts", "id, contact_type, agency_name"),
  ]);

  const missing: string[] = [];
  if (!attachments) missing.push("per-brand attachments (role, status, invites)");
  if (!identityFields) missing.push("contact type (Brand / Agency) and agency name");

  return { attachments, identityFields, ready: attachments && identityFields, missing };
});
