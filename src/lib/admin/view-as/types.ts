// ============================================================
// View as (Staff / Brand employee / Athlete) — shared types.
// Client-safe: no server imports. Loaders live in ./queries.ts.
// ============================================================

export type ViewMode = "staff" | "brand" | "athlete";

export interface PickOption {
  id: string;
  label: string;
}

/** A brand as the preview shell needs it: name + the two logo inks. */
export interface PreviewBrandHead {
  id: string;
  name: string;
  /** light-ink mark (logo_light_url, then white) — for the dark nav */
  logoOnDark: string | null;
  /** dark-ink mark (logo_dark_url, then primary) — for white cards */
  logoOnLight: string | null;
}

/** An app user (profiles.access_level = 'athlete') as the preview shows them. */
export interface PreviewAthlete {
  id: string;
  name: string;
  email: string | null;
  igHandle: string | null;
  tiktokHandle: string | null;
  school: string | null;
  sport: string | null;
  classYear: string | null;
  avatarUrl: string | null;
  paypalLinked: boolean | null;
  w9Status: string | null;
  reachTotal: number | null;
}

/** One brand row on the staff Brand portals list. */
export interface PortalBrandRow {
  id: string;
  name: string;
  logo: string | null;
  total: number;
  active: number;
  latestName: string | null;
  latestDate: string | null;
  /** active brand_contacts rows; null = table unreadable */
  users: number | null;
}

export type ReviewStatus = "Needs approval" | "Changes requested" | "Approved";

/** A deliverable the Postgame team sent to the brand for approval. */
export interface ReviewPiece {
  id: string;
  athleteName: string;
  igHandle: string | null;
  school: string | null;
  campaign: string;
  slot: string | null;
  slotIndex: number | null;
  isVideo: boolean;
  fileUrl: string | null;
  thumbUrl: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  note: string | null;
  status: ReviewStatus;
}

/** One opt-in / selection on the athlete's "My deals" list. */
export interface AthleteDeal {
  optinId: string;
  campaignId: string;
  title: string;
  brandName: string | null;
  brandLogoOnDark: string | null;
  status: string | null;
  payout: string | null;
  deadline: string | null;
  createdAt: string | null;
  deliverables: {
    id: string;
    slot: string | null;
    status: string | null;
    paidAt: string | null;
    postedAt: string | null;
  }[];
}

export function deliverableLabel(slot: string | null, index: number | null): string {
  const s = (slot ?? "post").toLowerCase();
  const name = s === "reel" ? "Reel" : s === "feed" ? "Feed post" : s === "story" ? "Story" : s === "tiktok" ? "TikTok" : s.charAt(0).toUpperCase() + s.slice(1);
  return index != null ? `${name} ${index + 1}` : name;
}

export function shortDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? v + "T12:00:00" : v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relDay(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
