// ============================================================
// The brand portal's private frame — utility strip, Postgame × client
// lockup, tab nav, bottom tab bar.
//
// Lifted verbatim out of /portal/[token]/layout.tsx so BOTH doors into
// the portal render the same chrome:
//   /portal/{token}   token visitor   (basePath = /portal/{token})
//   /portal           signed-in user  (basePath = /portal)
//
// The frame knows nothing about how the brand was resolved. A token
// visitor and a signed-in client see one room, not two.
//
// `session` is the only difference between the doors: a token visitor is
// anonymous to us, so their strip carries only "Confidential". A
// signed-in client gets their name, role and scope line — facts the
// token version genuinely cannot know, rather than decoration.
// ============================================================

import { BG, OFFWHITE, HAIR, MONO, BEBAS } from "@/lib/portal";
import { anton, arimo } from "@/components/portal/fonts";
import PortalNav, { PortalTabBar } from "@/components/portal/PortalNav";
import type { PortalBrand } from "@/lib/portal-data";

export interface PortalSessionChrome {
  /** The signed-in person's name, or their email if we have no name. */
  personLabel: string;
  /** Approver | Viewer, for the brand currently in view. */
  roleLabel: string;
  /** Every brand this login can reach — drives the switcher. */
  brands: { brandId: string; brandName: string }[];
  activeBrandId: string;
}

export default function PortalFrame({
  brand,
  brandLogo,
  postgameMark,
  basePath,
  reviewCount,
  session,
  children,
}: {
  brand: PortalBrand;
  brandLogo: string | null;
  postgameMark: string | null;
  basePath: string;
  reviewCount: number;
  session?: PortalSessionChrome | null;
  children: React.ReactNode;
}) {
  const multiBrand = (session?.brands.length ?? 0) > 1;

  return (
    <div
      className={`pv2-root ${anton.variable} ${arimo.variable} w-full`}
      style={{
        background: BG,
        color: OFFWHITE,
        minHeight: "100vh",
        fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif",
      }}
    >
      {/* Utility strip. No "data as of" date — we have no verified freshness
          timestamp, and inventing one would be a fabricated fact (rule 6). */}
      <div
        style={{
          borderBottom: `1px solid ${HAIR}`,
          background: "rgba(250,248,245,.02)",
        }}
      >
        <div className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 flex items-center justify-between gap-4 py-2 md:min-h-[34px] flex-wrap">
          <div style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: "rgba(250,248,245,.38)" }}>
            Postgame &times; {brand.name} &middot; Brand Portal
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Scope line — carried over from the interim page. Says plainly
                what this login can and cannot reach. */}
            {session && (
              <span style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: "rgba(250,248,245,.38)" }}>
                {session.personLabel} &middot; {session.roleLabel} &middot;{" "}
                {session.brands.length > 1
                  ? `sees ${session.brands.map((b) => b.brandName).join(" + ")}`
                  : `sees ${brand.name} only`}
              </span>
            )}
            <span style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: "rgba(250,248,245,.38)" }}>
              Confidential
            </span>
          </div>
        </div>
      </div>

      {/* Sticky header: lockup left, tabs right. */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(7,7,10,.90)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        <div className="pv2-header-in mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 flex items-center justify-between gap-5 min-h-[66px]">
          <div className="flex items-center gap-4 min-w-0">
            {/* Hard rule 1: the Postgame mark is a FILE. If the file is
                missing we render nothing here rather than setting the word
                "POSTGAME" in a typeface. */}
            {postgameMark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postgameMark}
                alt="Postgame"
                style={{ height: 17, width: "auto", flex: "0 0 auto", objectFit: "contain" }}
                className="pv2-pg block max-w-full"
              />
            ) : null}

            <span
              aria-hidden
              style={{ width: 1, height: 20, background: "rgba(250,248,245,.20)", flex: "0 0 auto" }}
            />

            {/* Hard rule 2: client logos come from the database. A missing
                logo is a LABELLED EMPTY SLOT bound to the column — never an
                approximation, never a redrawn mark. */}
            {brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogo}
                alt={brand.name}
                style={{ height: 23, width: "auto", flex: "0 0 auto", objectFit: "contain" }}
                className="pv2-cl block max-w-full"
              />
            ) : (
              // No logo on file. The brand name set in the portal's own display
              // type, at the height the logo would occupy — not a dashed
              // placeholder box reading "<Brand> · no logo on file", which told
              // the client about a gap in our own data on every tab.
              <span
                className="pv2-cl inline-flex items-center min-w-0"
                style={{ ...BEBAS, fontSize: 19, lineHeight: "23px", letterSpacing: ".01em", color: OFFWHITE }}
              >
                <span className="truncate">{brand.name}</span>
              </span>
            )}

            {/* Brand switcher — ONLY when there is somewhere to switch to. */}
            {multiBrand && session && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {session.brands.map((b) => {
                  const on = b.brandId === session.activeBrandId;
                  return (
                    <a
                      key={b.brandId}
                      href={`${basePath}?brand=${b.brandId}`}
                      style={{
                        ...MONO,
                        fontSize: 10,
                        letterSpacing: ".12em",
                        textDecoration: "none",
                        padding: "5px 10px",
                        borderRadius: 999,
                        color: on ? "#fff" : "rgba(250,248,245,.60)",
                        background: on ? "rgba(215,63,9,1)" : "rgba(250,248,245,.06)",
                        border: `1px solid ${on ? "rgba(215,63,9,1)" : "rgba(250,248,245,.15)"}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.brandName}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <PortalNav basePath={basePath} reviewCount={reviewCount} />
        </div>
      </header>

      {children}

      {/* Sticky bottom tab bar (<=750px). Sticky rather than fixed, so it
          never covers page content and needs no spacer. */}
      <PortalTabBar basePath={basePath} reviewCount={reviewCount} />
    </div>
  );
}
