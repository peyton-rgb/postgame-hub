// ============================================================
// "Your Postgame Team" — mockup screen 3.
//
// Two named humans a client can actually email:
//   Campaign Manager  campaign_recaps.owner_id   (migration 023)
//   Account Lead      brands.account_owner_id    (migration 029)
//
// DATA-STATE DISCIPLINE: an unassigned seat renders "Being assigned",
// never a fake name and never a silent gap. Right now zero campaigns
// have owner_id set, so the Campaign Manager seat will legitimately read
// "Being assigned" everywhere until someone is picked in admin — that is
// the honest state, not a bug.
//
// Rendered on TWO surfaces from one component: the brand-portal campaign
// page (so clients know who to chase) and /admin/campaigns/[id] (so
// staff can see the same ownership without a second implementation).
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";
import { isMissingSchemaError } from "@/lib/admin/auth";

export interface TeamMember {
  roleLabel: string;
  name: string | null;
  email: string | null;
  blurb: string;
}

const CAMPAIGN_MANAGER_BLURB = "Runs this campaign day to day — timings, creators, deliverables.";
const ACCOUNT_LEAD_BLURB = "Owns the Postgame relationship — scope, commercials, escalations.";

function displayName(p: { full_name?: string | null; display_name?: string | null } | null): string | null {
  return p?.full_name?.trim() || p?.display_name?.trim() || null;
}

export async function loadPostgameTeam(opts: {
  campaignId?: string | null;
  brandId?: string | null;
}): Promise<TeamMember[]> {
  const svc = createServiceSupabase();

  let manager: TeamMember = {
    roleLabel: "Campaign Manager",
    name: null,
    email: null,
    blurb: CAMPAIGN_MANAGER_BLURB,
  };
  let lead: TeamMember = {
    roleLabel: "Account Lead",
    name: null,
    email: null,
    blurb: ACCOUNT_LEAD_BLURB,
  };

  if (opts.campaignId) {
    const res = await svc
      .from("campaign_recaps")
      .select("owner_id, profiles:owner_id(full_name, display_name, email)")
      .eq("id", opts.campaignId)
      .maybeSingle();
    if (!res.error && res.data) {
      const p = normaliseJoin(res.data.profiles);
      manager = { ...manager, name: displayName(p), email: p?.email ?? null };
    }
  }

  if (opts.brandId) {
    const res = await svc
      .from("brands")
      .select("account_owner_id, profiles:account_owner_id(full_name, display_name, email)")
      .eq("id", opts.brandId)
      .maybeSingle();
    // Pre-029 the column does not exist — leave the seat unassigned
    // rather than surfacing a schema error to a client.
    if (!res.error && res.data) {
      const p = normaliseJoin(res.data.profiles);
      lead = { ...lead, name: displayName(p), email: p?.email ?? null };
    } else if (res.error && !isMissingSchemaError(res.error)) {
      // A real error is still not worth showing a client a stack trace.
    }
  }

  return [manager, lead];
}

interface ProfileJoin {
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
}

function normaliseJoin(v: unknown): ProfileJoin | null {
  if (!v) return null;
  return (Array.isArray(v) ? v[0] : v) as ProfileJoin;
}

/**
 * Presentational block. `tone` picks the palette: the client portal runs
 * on the dark ground, the admin campaign page on the white admin system.
 */
export function PostgameTeamBlock({
  members,
  tone = "dark",
}: {
  members: TeamMember[];
  tone?: "dark" | "light";
}) {
  const assigned = members.filter((m) => m.email);
  const mailto =
    assigned.length > 0
      ? `mailto:${assigned.map((m) => m.email).join(",")}?subject=${encodeURIComponent("Question for my Postgame team")}`
      : null;

  const dark = tone === "dark";
  const c = {
    bg: dark ? "rgba(250,248,245,.035)" : "#ffffff",
    border: dark ? "rgba(250,248,245,.11)" : "#e7e5e4",
    ink: dark ? "rgba(250,248,245,1)" : "#1c1917",
    body: dark ? "rgba(250,248,245,.68)" : "#57534e",
    label: dark ? "rgba(250,248,245,.50)" : "#78716c",
    hair: dark ? "rgba(250,248,245,.09)" : "#f5f5f4",
  };

  return (
    <section
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: c.label,
          marginBottom: 14,
        }}
      >
        Your Postgame Team
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {members.map((m, i) => (
          <div
            key={m.roleLabel}
            style={{
              paddingTop: i === 0 ? 0 : 14,
              borderTop: i === 0 ? "none" : `1px solid ${c.hair}`,
            }}
          >
            <div style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: c.label }}>
              {m.roleLabel}
            </div>

            {m.name || m.email ? (
              <>
                <div style={{ marginTop: 3, fontSize: 14.5, fontWeight: 600, color: c.ink }}>
                  {m.name ?? m.email}
                </div>
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    style={{ fontSize: 12.5, color: "#D73F09", textDecoration: "none" }}
                  >
                    {m.email}
                  </a>
                )}
              </>
            ) : (
              // Never a placeholder human. The seat is honest about itself.
              <div
                style={{
                  marginTop: 3,
                  fontSize: 14,
                  fontWeight: 600,
                  color: c.label,
                  fontStyle: "italic",
                }}
              >
                Being assigned
              </div>
            )}

            <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: c.body }}>
              {m.blurb}
            </div>
          </div>
        ))}
      </div>

      {mailto ? (
        <a
          href={mailto}
          style={{
            display: "inline-block",
            marginTop: 16,
            background: "#D73F09",
            color: "#fff",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
            padding: "9px 18px",
            borderRadius: 8,
          }}
        >
          Email your team
        </a>
      ) : (
        <div style={{ marginTop: 16, fontSize: 12, color: c.label }}>
          Email will appear here once your team is assigned.
        </div>
      )}
    </section>
  );
}
