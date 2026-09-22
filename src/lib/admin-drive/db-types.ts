// ============================================================
// The schema as migrations 067-071 leave it, on top of the generated types.
//
// TEMPORARY, AND DELETABLE IN ONE MOVE. The moment 067-071 are applied to
// production and `database.types.ts` is regenerated, everything here becomes a
// duplicate: delete this file and point the imports at `@/lib/database.types`.
//
// Why this exists rather than hand-edits to the generated file:
//
//   • database.types.ts is GENERATED. PR #281 regenerated it precisely because
//     it had drifted from the live schema; typing new columns into it by hand
//     is how that drift started, and the next regeneration would silently
//     revert them.
//   • Regenerating it from the practice branch is not an option either. That
//     branch also carries migrations 060-066, which live only on the redesign
//     branch — generating there would put columns into main's types that
//     production does not have, which is worse than missing ones. Missing
//     columns fail loudly at compile time; phantom columns fail at runtime.
//
// So the additions sit here, beside the code that needs them, labelled as
// ahead of the generator rather than pretending to be its output.
// ============================================================

import type { Database as Generated, Json } from "@/lib/database.types";

type Tables = Generated["public"]["Tables"];

/** Add columns to a generated table type without restating the rest of it. */
type WithColumns<T extends { Row: object; Insert: object; Update: object }, Add> = Omit<
  T,
  "Row" | "Insert" | "Update"
> & {
  Row: T["Row"] & Add;
  Insert: T["Insert"] & Partial<Add>;
  Update: T["Update"] & Partial<Add>;
};

/** Migration 067. drive_parent_folder_id / master_tracker_* already existed. */
type BrandDriveColumns = {
  drive_legal_folder_id: string | null;
  drive_sales_materials_folder_id: string | null;
  drive_brand_assets_folder_id: string | null;
};

/** Migration 068. The two tracker sheets beside the Performance Tracker. */
type CampaignDriveColumns = {
  tracker_internal_sheet_id: string | null;
  tracker_internal_url: string | null;
  tracker_external_sheet_id: string | null;
  tracker_external_url: string | null;
};

/** Migration 070. */
type AdminDriveQueueRow = {
  id: string;
  cf_campaign_id: string;
  admin_account_id: string;
  payload: Json;
  status: string;
  attempts: number;
  last_error: string | null;
  applied_at: string | null;
  applied_campaign_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Columns with a default are optional on insert; the rest are required. */
type InsertOf<Row, Defaulted extends keyof Row> = Omit<Row, Defaulted> &
  Partial<Pick<Row, Defaulted>>;

/**
 * Migration 071's new enum member.
 *
 * Applied to the agent_runs TABLE, not only to `Enums`. Inside the generated
 * file every column is typed as `Database["public"]["Enums"]["agent_name"]`
 * where `Database` is the GENERATED type — a self-reference that widening
 * `Enums` out here cannot reach. Overriding `Enums` alone type-checks and does
 * nothing.
 */
type AgentName = Generated["public"]["Enums"]["agent_name"] | "admin_drive_service";

export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables" | "Enums"> & {
    Tables: Omit<Tables, "brands" | "campaign_recaps" | "agent_runs"> & {
      brands: WithColumns<Tables["brands"], BrandDriveColumns>;
      campaign_recaps: WithColumns<Tables["campaign_recaps"], CampaignDriveColumns>;
      agent_runs: Omit<Tables["agent_runs"], "Row" | "Insert" | "Update"> & {
        Row: Omit<Tables["agent_runs"]["Row"], "agent_name"> & { agent_name: AgentName };
        Insert: Omit<Tables["agent_runs"]["Insert"], "agent_name"> & { agent_name: AgentName };
        Update: Omit<Tables["agent_runs"]["Update"], "agent_name"> & { agent_name?: AgentName };
      };
      admin_drive_queue: {
        Row: AdminDriveQueueRow;
        Insert: InsertOf<
          AdminDriveQueueRow,
          | "id"
          | "status"
          | "attempts"
          | "last_error"
          | "applied_at"
          | "applied_campaign_id"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<AdminDriveQueueRow>;
        Relationships: [];
      };
    };
    Enums: Omit<Generated["public"]["Enums"], "agent_name"> & { agent_name: AgentName };
  };
};

/**
 * The Update shape for one table.
 *
 * The contract builds patches as `Record<string, string>` keyed by column name
 * — the keys come from BRAND_FIELDS / CAMPAIGN_FIELDS, which are real columns,
 * but nothing in the type system carries that fact from the map to the call.
 * Casting through this named alias keeps the cast in one place and says which
 * table it is being trusted against.
 */
export type UpdateFor<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
