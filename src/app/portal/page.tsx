// ============================================================
// /portal — brand home (mockup screen 2).
//
// The session-based way into the portal. The token-gated
// /portal/[token] surfaces are untouched and still work; this adds a
// second door to the same rooms. Retiring portal_token links is a later,
// Peyton-gated step.
//
// Counts are REAL — campaign_recaps and review_sessions for the brands
// this session can actually reach. A tile with nothing behind it says
// zero, it does not hide.
// ============================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrandSession, type BrandScopeEntry } from "@/lib/portal/brand-session";
import { getPendingReviewCount } from "@/lib/portal-data";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import {
  BG,
  CARD,
  CARD_B,
  HAIR,
  INK_BODY,
  INK_LABEL,
  OFFWHITE,
  ORANGE,
  RADIUS,
} from "@/lib/portal";

export const dynamic = "force-dynamic";
// Belt and braces alongside createLiveServiceSupabase(): force-dynamic
// alone did NOT stop Next's Data Cache from serving a stale invite here.
export const fetchCache = "force-no-store";


export default async function PortalHome({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await getBrandSession();

  // Not a brand login at all — staff and anonymous belong elsewhere.
  if (!session) redirect("/login");
  if (session.schemaPending || session.brands.length === 0) redirect("/portal/denied");

  // Which brand are we looking at? Defaults to the first in scope.
  const requested = searchParams.brand;
  const active: BrandScopeEntry =
    session.brands.find((b) => b.brandId === requested) ?? session.brands[0];

  const svc = createLiveServiceSupabase();
  const [campaignCount, approvalCount, assetCount] = await Promise.all([
    countCampaigns(svc, active.brandId),
    getPendingReviewCount(active.brandId),
    countAssets(svc, active.brandId),
  ]);

  const roleLabel = active.role === "approver" ? "Approver" : "Viewer";
  const scopeNames = session.brands.map((b) => b.brandName).join(" and ");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: OFFWHITE,
        padding: "28px 20px 96px",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 22 }}>
          {active.brandLogoUrl ? (
            <div style={{ background: "#fff", borderRadius: RADIUS, padding: "9px 13px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.brandLogoUrl}
                alt={active.brandName}
                style={{ height: 24, width: "auto", display: "block" }}
              />
            </div>
          ) : (
            <span style={{ fontSize: 17, fontWeight: 700 }}>{active.brandName}</span>
          )}

          {/* Switcher appears ONLY when there is something to switch to. */}
          {session.brands.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {session.brands.map((b) => {
                const on = b.brandId === active.brandId;
                return (
                  <Link
                    key={b.brandId}
                    href={`/portal?brand=${b.brandId}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                      padding: "6px 13px",
                      borderRadius: 99,
                      color: on ? "#fff" : INK_BODY,
                      background: on ? ORANGE : "rgba(250,248,245,.06)",
                      border: `1px solid ${on ? ORANGE : CARD_B}`,
                    }}
                  >
                    {b.brandName}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {active.brandName}
        </h1>

        {/* Scope line — says plainly what this login can and cannot see. */}
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: INK_LABEL }}>
          Signed in as {session.contactName || session.email} · {roleLabel} ·{" "}
          {session.brands.length > 1
            ? `this account sees ${scopeNames}`
            : `this account sees ${active.brandName} only`}
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            marginTop: 26,
          }}
        >
          <Tile label="Campaigns" value={campaignCount} hint="in this account" />
          <Tile
            label="Awaiting your approval"
            value={approvalCount}
            hint={approvalCount === 0 ? "nothing waiting on you" : "needs a decision"}
            accent={approvalCount > 0}
          />
          <Tile label="Asset library" value={assetCount} hint="files delivered" />
        </div>

        <p style={{ marginTop: 26, fontSize: 12, lineHeight: 1.6, color: INK_LABEL }}>
          Your existing portal links keep working — this login is an additional way in, not a
          replacement.
        </p>
      </div>

      <PortalTabBarLite />
    </main>
  );
}

async function countCampaigns(
  svc: ReturnType<typeof createLiveServiceSupabase>,
  brandId: string
): Promise<number> {
  const { count } = await svc
    .from("campaign_recaps")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId);
  return count ?? 0;
}

async function countAssets(
  svc: ReturnType<typeof createLiveServiceSupabase>,
  brandId: string
): Promise<number> {
  const { data: recaps } = await svc
    .from("campaign_recaps")
    .select("id")
    .eq("brand_id", brandId);
  const ids = (recaps ?? []).map((r: { id: string }) => r.id);
  if (!ids.length) return 0;
  // `media` is the asset table the token portal's library page reads —
  // matched deliberately so both doors report the same number. There is
  // no `media_items` table despite the admin dashboard's tile label.
  const { count } = await svc
    .from("media")
    .select("id", { count: "exact", head: true })
    .in("campaign_id", ids);
  return count ?? 0;
}

function Tile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${accent ? "rgba(215,63,9,.5)" : CARD_B}`,
        borderRadius: RADIUS,
        padding: "18px 18px 16px",
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: accent ? ORANGE : OFFWHITE,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: INK_LABEL,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: INK_BODY }}>{hint}</div>
    </div>
  );
}

/** Mobile bottom bar — mirrors the token portal's tab bar affordance. */
function PortalTabBarLite() {
  const items = [
    { label: "Home", href: "/portal" },
    { label: "Campaigns", href: "/portal#campaigns" },
    { label: "Assets", href: "/portal#assets" },
  ];
  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        borderTop: `1px solid ${HAIR}`,
        background: "rgba(7,7,10,.92)",
        backdropFilter: "blur(26px)",
      }}
      className="md:hidden"
    >
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "13px 0",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: INK_BODY,
            textDecoration: "none",
          }}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
