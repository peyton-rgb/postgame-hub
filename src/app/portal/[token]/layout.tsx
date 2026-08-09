import { getPortalBrand, getPostgameMark } from "@/lib/portal-data";
import {
  BG,
  OFFWHITE,
  HAIR,
  INK_LABEL,
  MONO,
  pickBrandLogo,
} from "@/lib/portal";
import { anton, arimo } from "./fonts";
import PortalNav from "./PortalNav";

// Private frame shared by every /portal/[token] route. Renders the utility
// strip, the Postgame x client lockup, and the tab nav on the portal's dark
// ground. The token gates everything: no brand match -> 404, and we never
// render another brand's logo.
//
// The brand is fetched ONCE here via getPortalBrand(); every child route calls
// the same helper rather than re-querying `brands` itself.

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [brand, postgameMark] = await Promise.all([
    getPortalBrand(token),
    getPostgameMark(),
  ]);

  const brandLogo = pickBrandLogo(brand);

  return (
    <div
      className={`${anton.variable} ${arimo.variable} w-full`}
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
        <div className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 flex items-center justify-between gap-4 py-2 md:h-[34px] md:py-0 flex-wrap">
          <div style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: "rgba(250,248,245,.38)" }}>
            Postgame &times; {brand.name} &middot; Brand Portal
          </div>
          <div style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: "rgba(250,248,245,.38)" }}>
            Confidential
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
        <div className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 flex items-center justify-between gap-5 h-[66px]">
          <div className="flex items-center gap-4 min-w-0">
            {/* Hard rule 1: the Postgame mark is a FILE. If the file is
                missing we render nothing here rather than setting the word
                "POSTGAME" in a typeface. */}
            {postgameMark ? (
              <img
                src={postgameMark}
                alt="Postgame"
                style={{ height: 17, width: "auto", flex: "0 0 auto", objectFit: "contain" }}
                className="block max-w-full"
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
              <img
                src={brandLogo}
                alt={brand.name}
                style={{ height: 23, width: "auto", flex: "0 0 auto", objectFit: "contain" }}
                className="block max-w-full"
              />
            ) : (
              <span
                className="inline-flex items-center rounded-[3px] px-2 py-1 min-w-0"
                style={{
                  border: "1px dashed rgba(250,248,245,.22)",
                  ...MONO,
                  fontSize: 10,
                  color: INK_LABEL,
                }}
                title="No logo on file for this brand"
              >
                <span className="truncate">{brand.name} &middot; no logo on file</span>
              </span>
            )}
          </div>

          <PortalNav token={token} />
        </div>
      </header>

      {children}

      {/* Bottom padding so the mobile tab bar never covers page content. */}
      <div aria-hidden className="h-[72px] md:h-0" />
    </div>
  );
}
