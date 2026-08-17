// ============================================================
// /portal/denied — where a client login lands when it reaches for a
// surface it is not scoped to (/admin/*, /dashboard/*, another brand's
// portal).
//
// Friendly, not accusatory: the usual visitor here is a client who
// followed a stale link or a bookmark, not an attacker. It says which
// brands they CAN reach and gives them the way back.
// ============================================================

import Link from "next/link";
import { getBrandSession } from "@/lib/portal/brand-session";
import { BG, CARD, CARD_B, INK_BODY, INK_LABEL, OFFWHITE, ORANGE, RADIUS } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalDeniedPage() {
  const session = await getBrandSession();
  const brands = session?.brands ?? [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: OFFWHITE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: CARD,
          border: `1px solid ${CARD_B}`,
          borderRadius: RADIUS * 2,
          padding: "34px 30px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: INK_LABEL,
          }}
        >
          Postgame
        </div>

        <h1 style={{ margin: "14px 0 0", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em" }}>
          That area isn&apos;t part of your account
        </h1>

        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: INK_BODY }}>
          {brands.length > 0 ? (
            <>
              This login is scoped to{" "}
              <strong style={{ color: OFFWHITE }}>
                {brands.map((b) => b.brandName).join(" and ")}
              </strong>
              . Everything you have access to lives in your portal.
            </>
          ) : (
            <>
              This login doesn&apos;t currently reach any brand. If you think that&apos;s wrong,
              your Postgame contact can check your access.
            </>
          )}
        </p>

        {brands.length > 0 && (
          <Link
            href="/portal"
            style={{
              display: "inline-block",
              marginTop: 22,
              background: ORANGE,
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              padding: "11px 26px",
              borderRadius: RADIUS,
            }}
          >
            Back to your portal
          </Link>
        )}
      </div>
    </main>
  );
}
