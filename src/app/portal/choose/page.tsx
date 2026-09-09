import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BG, OFFWHITE, HAIR, MONO, BEBAS, ORANGE, CARD, CARD_B } from "@/lib/portal";
import { arimo } from "@/components/portal/fonts";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { getPreviewAdmin, listPreviewBrands } from "@/lib/portal/preview";
import {
  BRAND_LOGO_COLUMNS,
  groupLogosByBrand,
  resolveBrandLogo,
  type BrandLogoRow,
} from "@/lib/brand-logo";
import BrandPicker, { type PickerBrand } from "./BrandPicker";

// ============================================================
// /portal/choose — which brand does an admin want to look at?
//
// Where resolveSessionPortal() sends an admin who reaches the portal
// without a brand chosen, and where the preview banner's "Switch brand"
// goes. Brand users never arrive here: they have their own scope, so the
// resolver never has to ask them anything.
// ============================================================

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "View as brand — Postgame",
  robots: { index: false, follow: false },
};

export default async function ChooseBrandPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  // Staff below admin, athletes and clients have no business here.
  const admin = await getPreviewAdmin();
  if (!admin) redirect("/portal/denied");

  const brands = await listPreviewBrands();

  // One bulk logo read rather than a lookup per brand, matching how
  // /dashboard/brand-portals does it.
  const svc = createLiveServiceSupabase();
  const { data: logoRows } = await svc.from("brand_logos").select(BRAND_LOGO_COLUMNS).limit(5000);
  const logosByBrand = groupLogosByBrand((logoRows ?? []) as BrandLogoRow[]);

  const picker: PickerBrand[] = brands.map((b) => ({
    id: b.id,
    name: b.name || "Untitled brand",
    slug: b.slug,
    // The picker cell is a small square on a dark surface, so ask for this
    // brand's on_black mark and take nothing from another variant.
    logo: resolveBrandLogo(logosByBrand.get(b.id), { surface: "dark", prefer: "mark" })?.url ?? null,
  }));

  return (
    <div
      className={`${arimo.variable} w-full`}
      style={{
        background: BG,
        color: OFFWHITE,
        minHeight: "100vh",
        fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif",
      }}
    >
      <div className="mx-auto w-full max-w-[560px] px-5 md:px-6 pt-14 pb-20">
        <p style={{ ...MONO, fontSize: 11, color: ORANGE, margin: 0 }}>Admin preview</p>

        <h1
          style={{
            ...BEBAS,
            fontSize: 40,
            lineHeight: 0.9,
            letterSpacing: ".02em",
            color: "rgba(250,248,245,1)",
            margin: "12px 0 12px",
          }}
        >
          View as brand
        </h1>

        <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(250,248,245,.68)", margin: "0 0 8px" }}>
          Pick a brand to see the portal the way its contacts do. Nothing you do in preview is
          recorded as the client.
        </p>

        <p
          style={{
            fontSize: 16,
            lineHeight: 1.7,
            color: "rgba(250,248,245,.50)",
            margin: "0 0 26px",
          }}
        >
          Signed in as {admin.email ?? "a Postgame admin"}.
        </p>

        {searchParams.error === "unknown-brand" && (
          <div
            role="status"
            style={{
              marginBottom: 22,
              padding: 20,
              borderRadius: 16,
              background: CARD,
              border: `1px solid ${CARD_B}`,
              borderLeft: `2px solid ${ORANGE}`,
              fontSize: 16,
              lineHeight: 1.7,
              color: "rgba(250,248,245,.90)",
            }}
          >
            That brand link didn&rsquo;t match anything. Pick one below.
          </div>
        )}

        <BrandPicker brands={picker} />

        <p
          style={{
            ...MONO,
            fontSize: 10,
            color: "rgba(250,248,245,.38)",
            borderTop: `1px solid ${HAIR}`,
            paddingTop: 14,
            marginTop: 30,
          }}
        >
          <a href="/dashboard/brand-portals" style={{ color: "inherit", textDecoration: "none" }}>
            &larr; Back to the Hub
          </a>
        </p>
      </div>
    </div>
  );
}
