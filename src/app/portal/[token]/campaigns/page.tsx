import type { Metadata } from "next";
import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase";
import { getPortalBrand } from "@/lib/portal-data";
import { brandSafe } from "@/lib/brand-safe";
import {
  ORANGE,
  CARD_B,
  RADIUS,
  BEBAS,
  MONO,
  INK_BODY,
  INK_LABEL,
  pickBrandLogo,
} from "@/lib/portal";
import { loadPostgameTeam, PostgameTeamBlock } from "@/components/PostgameTeam";

// Campaigns tab. Every campaign for this brand — published and draft alike.
// Campaigns with media get the normal card; campaigns with none get an
// inactive "content uploading soon" card. We show EVERY campaign either way,
// so the count on this page always reconciles with the dashboard stat bar.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Campaigns`,
    description: `Campaigns for ${brand.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function PortalCampaignsPage({ params }: Props) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  const supabase = createServiceSupabase();

  const { data: recapsRaw } = await supabase
    .from("campaign_recaps")
    .select("id, name, slug, published, created_at, hero_image_url, thumbnail_url")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const recaps = (recapsRaw || []) as any[];
  const recapIds = recaps.map((r) => r.id);

  // Which campaigns have media at all. media.campaign_id is authoritative.
  const { data: mediaRaw } = recapIds.length
    ? await supabase.from("media").select("campaign_id").in("campaign_id", recapIds)
    : { data: [] as any[] };

  const populated = new Set<string>();
  for (const m of (mediaRaw || []) as any[]) populated.add(m.campaign_id);

  const publishedCount = recaps.filter((r) => r.published).length;
  const archivedCount = recaps.length - publishedCount;
  const brandLogo = pickBrandLogo(brand);

  return (
    <main className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 pt-10 pb-24">
      <div className="flex items-baseline justify-between gap-5 flex-wrap mb-8">
        <div>
          <div style={{ ...MONO, fontSize: 11, letterSpacing: ".18em", color: ORANGE }}>Campaigns</div>
          <h1 className="uppercase mt-2.5" style={{ ...BEBAS, fontSize: "clamp(30px,5vw,40px)", lineHeight: 1, letterSpacing: ".012em" }}>
            Everything we&rsquo;ve made with {brand.name}
          </h1>
        </div>
        <div style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: INK_LABEL }}>
          {publishedCount} published &middot; {archivedCount} archived
        </div>
      </div>

      {recaps.length === 0 ? (
        <p style={{ fontSize: 16, color: INK_BODY }}>No campaigns to show yet.</p>
      ) : (
        <div className="pv2-campaign-grid grid gap-4 grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-3">
          {recaps.map((r) => {
            const safeName = brandSafe(r.name || "");

            // No media yet -> inactive card, not clickable.
            if (!populated.has(r.id)) {
              return (
                <div
                  key={r.id}
                  aria-label={`${brand.name} — ${safeName} (content uploading soon)`}
                  className="relative overflow-hidden cursor-default"
                  style={{ aspectRatio: "4 / 5", background: "#0d0d11", border: `1px solid rgba(250,248,245,.08)`, borderRadius: RADIUS }}
                >
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
                    style={{ background: "rgba(12,12,16,0.55)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
                  >
                    {/* Hard rule 2 — the real logo file, dimmed. Never a substitute. */}
                    {brandLogo ? (
                      <img
                        src={brandLogo}
                        alt={brand.name}
                        className="block"
                        style={{ height: 40, width: "auto", maxWidth: 130, objectFit: "contain", flex: "0 0 auto", opacity: 0.45 }}
                      />
                    ) : null}
                    <div style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: "rgba(250,248,245,.40)" }}>
                      Campaign content uploading soon
                    </div>
                  </div>
                  <div className="absolute left-5 right-5 bottom-5">
                    <div className="uppercase" style={{ ...BEBAS, fontSize: 26, lineHeight: 1.02, letterSpacing: ".012em", color: "rgba(250,248,245,0.5)" }}>
                      {safeName}
                    </div>
                  </div>
                </div>
              );
            }

            const hero = r.hero_image_url || r.thumbnail_url || null;
            return (
              <Link
                key={r.id}
                href={`/recap/${r.slug}`}
                aria-label={`${brand.name} — ${safeName}`}
                className="group relative block overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                style={{ aspectRatio: "4 / 5", background: "#101014", border: `1px solid ${CARD_B}`, borderRadius: RADIUS }}
              >
                {hero ? (
                  <img
                    src={hero}
                    alt={`${brand.name} ${safeName}`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ objectPosition: "center 25%" }}
                  />
                ) : null}
                {/* edge blend — hard rule 4 */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(0deg,rgba(7,7,10,.94) 0%,rgba(7,7,10,.38) 26%,rgba(7,7,10,0) 56%),linear-gradient(90deg,rgba(7,7,10,.38) 0%,rgba(7,7,10,0) 20%,rgba(7,7,10,0) 80%,rgba(7,7,10,.38) 100%)",
                  }}
                />
                <div className="absolute top-3.5 right-3.5 z-[2]">
                  <span
                    className="inline-block rounded-[3px] px-2 py-[5px]"
                    style={{ ...MONO, fontSize: 10, background: "rgba(250,248,245,.07)", border: `1px solid ${CARD_B}`, color: "rgba(250,248,245,.60)" }}
                  >
                    {r.published ? "Published" : "Archived"}
                  </span>
                </div>
                <div className="absolute left-[18px] right-[18px] bottom-4 z-[2]">
                  <div className="pv2-card-name uppercase" style={{ ...BEBAS, fontSize: 26, lineHeight: 1.02, letterSpacing: ".012em" }}>
                    {safeName}
                  </div>
                  {/* Resting state on touch — never hover-only content. */}
                  <div
                    className="flex items-center gap-[7px] mt-3 opacity-100 md:opacity-0 md:translate-y-[6px] md:transition-all md:duration-[400ms] md:group-hover:opacity-100 md:group-hover:translate-y-0"
                    style={{ ...MONO, fontSize: 10, letterSpacing: ".14em" }}
                  >
                    View recap <span style={{ color: ORANGE }}>&rarr;</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Who to actually contact. Same component the internal campaign
          page renders, so the client and the team see one answer. */}
      <div className="mt-10 max-w-md">
        <PostgameTeamBlock tone="dark" members={await loadPostgameTeam({ brandId: brand.id })} />
      </div>
    </main>
  );
}
