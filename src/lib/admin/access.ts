// ============================================================
// Access management domain — the vocabulary for /admin/access.
//
// One row per HUMAN (postgame_contacts), with per-brand attachments
// (brand_contacts) carrying role + status. Both the contact_type /
// agency_name columns and the whole brand_contacts table arrive with
// migration 028 — UNAPPLIED. Every read goes through safeQuery so the
// screen degrades to an honest pending state instead of crashing.
// ============================================================

export type ContactType = "brand" | "agency";
export type AttachmentRole = "approver" | "viewer";
export type AttachmentStatus = "on_file" | "invited" | "active" | "bounced" | "revoked";

/**
 * Seats per brand. Hardcoded until seat billing is a real product decision —
 * there is no seats column on brands, and inventing one would be fiction.
 * When billing lands this becomes brands.seat_limit and this constant dies.
 */
export const DEFAULT_SEATS_PER_BRAND = 3;

/** Statuses that consume a seat. On-file contacts deliberately do not. */
export const SEAT_HOLDING_STATUSES: AttachmentStatus[] = ["active", "invited", "bounced"];

export function holdsSeat(status: AttachmentStatus): boolean {
  return SEAT_HOLDING_STATUSES.includes(status);
}

export const ROLE_LABEL: Record<AttachmentRole, string> = {
  approver: "Approver",
  viewer: "Viewer",
};

export interface StatusMeta {
  label: string;
  /** Tailwind classes for the pill. */
  chip: string;
  /** Longer plain-English line used under the chip / in mobile cards. */
  hint: string;
}

export const STATUS_META: Record<AttachmentStatus, StatusMeta> = {
  active: {
    label: "Active",
    chip: "bg-green-50 text-green-700",
    hint: "signed in",
  },
  invited: {
    label: "Invited",
    chip: "bg-amber-50 text-amber-800",
    hint: "not yet opened",
  },
  bounced: {
    label: "Bounced — resend",
    chip: "bg-red-50 text-red-700",
    hint: "invite email failed",
  },
  on_file: {
    label: "On file — not invited",
    chip: "bg-yellow-50 text-yellow-800",
    hint: "no invite sent yet",
  },
  revoked: {
    label: "Revoked",
    chip: "bg-stone-100 text-stone-500 line-through",
    hint: "access withdrawn",
  },
};

export function isAttachmentStatus(v: string | null | undefined): v is AttachmentStatus {
  return v === "on_file" || v === "invited" || v === "active" || v === "bounced" || v === "revoked";
}

export function isAttachmentRole(v: string | null | undefined): v is AttachmentRole {
  return v === "approver" || v === "viewer";
}

export function isContactType(v: string | null | undefined): v is ContactType {
  return v === "brand" || v === "agency";
}

// ------------------------------------------------------------
// Row shapes
// ------------------------------------------------------------

export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contact_type: ContactType;
  agency_name: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

/**
 * Mirrors the APPLIED brand_contacts schema (migration 028). Note what is
 * deliberately absent: there is no bounced_at, no bounce_reason, no
 * last_active_at and no created_by column in the database, so this type
 * does not pretend to carry them. status='bounced' is still a valid state
 * — it just has no timestamp of its own.
 */
export interface AttachmentRow {
  id: string;
  contact_id: string;
  brand_id: string;
  brand_name: string | null;
  role: AttachmentRole;
  status: AttachmentStatus;
  invited_email: string | null;
  signup_email: string | null;
  invited_at: string | null;
  activated_at: string | null;
  revoked_at: string | null;
  /** 029: why the last invite email failed to send, if it did. */
  invite_send_error: string | null;
}

/** One human, with every brand they can reach. */
export interface IdentityRow {
  contact: ContactRow;
  attachments: AttachmentRow[];
}

/**
 * The address the person actually receives mail at: their signup email,
 * falling back to whatever address the most recent invite was sent to.
 * Contacts on file with neither show an honest dash, never a guess.
 */
export function displayEmail(identity: IdentityRow): { value: string; fromInvite: boolean } | null {
  if (identity.contact.email) return { value: identity.contact.email, fromInvite: false };
  // An address they actually signed up with beats one we merely sent to.
  const signed = identity.attachments.find((a) => a.signup_email);
  if (signed?.signup_email) return { value: signed.signup_email, fromInvite: false };
  const invited = identity.attachments
    .filter((a) => a.invited_email)
    .sort((a, b) => (b.invited_at ?? "").localeCompare(a.invited_at ?? ""))[0];
  if (invited?.invited_email) return { value: invited.invited_email, fromInvite: true };
  return null;
}

/**
 * "also attached to N other brands" — the cross-brand lens that makes an
 * agency person leaving a one-screen answer. Counts live attachments only
 * (revoked ones are history, not reach).
 */
export function otherBrandCount(identity: IdentityRow, excludeBrandId?: string): number {
  return identity.attachments.filter(
    (a) => a.status !== "revoked" && a.brand_id !== excludeBrandId
  ).length;
}

/** Group flat join rows into one entry per human, preserving query order. */
export function groupByIdentity(
  contacts: ContactRow[],
  attachments: AttachmentRow[]
): IdentityRow[] {
  const byContact = new Map<string, AttachmentRow[]>();
  for (const a of attachments) {
    const list = byContact.get(a.contact_id);
    if (list) list.push(a);
    else byContact.set(a.contact_id, [a]);
  }
  return contacts.map((contact) => ({
    contact,
    // Live attachments first, then revoked; alphabetical within each.
    attachments: (byContact.get(contact.id) ?? []).sort((x, y) => {
      const xr = x.status === "revoked" ? 1 : 0;
      const yr = y.status === "revoked" ? 1 : 0;
      if (xr !== yr) return xr - yr;
      return (x.brand_name ?? "").localeCompare(y.brand_name ?? "");
    }),
  }));
}

/** Seat usage for one brand. */
export interface SeatUsage {
  used: number;
  total: number;
  onFile: number;
}

export function seatLine(usage: SeatUsage): string {
  return (
    `${usage.used} of ${usage.total} seats used — Active, Invited, and bounced invites hold a seat` +
    ` · On-file contacts don't use a seat until invited` +
    ` · Seat billing later, tracked now.`
  );
}
