// ============================================================
// Athlete account data (Phase 3) — server-side reads for the profile tab.
//
// Contracts, shipping and squad invites all read through the cookie-aware
// server client, so RLS scopes every query to the logged-in athlete's own
// rows (contracts: SELECT own; athlete_shipping: own row; squad_invites: own).
// Writes happen client-side (browser client) where the table allows it, or via
// a service route where it doesn't (contract PDFs). Nothing here uses the
// service role.
// ============================================================

import { createServerSupabase } from "@/lib/supabase-server";

export type ContractRow = {
  id: string;
  title: string;
  contractType: string | null;
  signedAt: string | null;
  hasPdf: boolean;
};

export type ShippingRow = {
  shirtSize: string | null;
  shoeSize: string | null;
  pantsSize: string | null;
  hatSize: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type SquadInvite = {
  id: string;
  inviteeName: string;
  inviteeContact: string | null;
  status: string;
  invitedAt: string | null;
};

export type ProfileExtras = {
  w9Status: string;
  w9Year: number | null;
  reachTotal: number | null;
  reachSyncedAt: string | null;
  classYear: string | null;
};

export type AccountData = {
  contracts: ContractRow[];
  shipping: ShippingRow | null;
  squad: SquadInvite[];
  extras: ProfileExtras;
};

const EMPTY_EXTRAS: ProfileExtras = {
  w9Status: "needed",
  w9Year: null,
  reachTotal: null,
  reachSyncedAt: null,
  classYear: null,
};

export async function getAccountData(athleteId: string): Promise<AccountData> {
  const supabase = createServerSupabase();

  const [contractsRes, shippingRes, squadRes, extrasRes] = await Promise.all([
    supabase
      .from("contracts")
      .select("id,title,contract_type,signed_at,pdf_storage_path")
      .eq("athlete_id", athleteId)
      .order("signed_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("athlete_shipping")
      .select("shirt_size,shoe_size,pants_size,hat_size,address_line1,address_line2,city,state,zip")
      .eq("athlete_id", athleteId)
      .maybeSingle(),
    supabase
      .from("squad_invites")
      .select("id,invitee_name,invitee_contact,status,invited_at")
      .eq("inviter_id", athleteId)
      .order("invited_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("w9_status,w9_year,reach_total,reach_synced_at,class_year")
      .eq("id", athleteId)
      .maybeSingle(),
  ]);

  // Silent failures look like empty results — surface read errors in the log so
  // an RLS or column mistake doesn't masquerade as "no data".
  if (contractsRes.error) console.error("[athlete-account] contracts:", contractsRes.error.message);
  if (shippingRes.error) console.error("[athlete-account] shipping:", shippingRes.error.message);
  if (squadRes.error) console.error("[athlete-account] squad:", squadRes.error.message);
  if (extrasRes.error) console.error("[athlete-account] extras:", extrasRes.error.message);

  const contracts: ContractRow[] = (contractsRes.data ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    contractType: c.contract_type,
    signedAt: c.signed_at,
    hasPdf: !!c.pdf_storage_path,
  }));

  const s: any = shippingRes.data;
  const shipping: ShippingRow | null = s
    ? {
        shirtSize: s.shirt_size,
        shoeSize: s.shoe_size,
        pantsSize: s.pants_size,
        hatSize: s.hat_size,
        addressLine1: s.address_line1,
        addressLine2: s.address_line2,
        city: s.city,
        state: s.state,
        zip: s.zip,
      }
    : null;

  const squad: SquadInvite[] = (squadRes.data ?? []).map((i: any) => ({
    id: i.id,
    inviteeName: i.invitee_name,
    inviteeContact: i.invitee_contact,
    status: i.status,
    invitedAt: i.invited_at,
  }));

  const e: any = extrasRes.data;
  const extras: ProfileExtras = e
    ? {
        w9Status: e.w9_status ?? "needed",
        w9Year: e.w9_year,
        reachTotal: e.reach_total,
        reachSyncedAt: e.reach_synced_at,
        classYear: e.class_year,
      }
    : EMPTY_EXTRAS;

  return { contracts, shipping, squad, extras };
}
