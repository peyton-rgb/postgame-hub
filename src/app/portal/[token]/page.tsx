import { createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brandSafe } from "@/lib/brand-safe";
import { ORANGE, OFFWHITE, BEBAS, pickBrandLogo } from "@/lib/portal";

// Client-facing brand portal home page. The brand logo + tab nav live in the
// shared portal layout (layout.tsx); this page renders the hero, stats, and
// campaign grid.
//
// The brand's `portal_token` is the ONLY gate: we look up exactly one brand by
// that token and never surface data for any other brand. Because we must show
// the brand's DRAFT recaps too (published = false), the anon client is no good
// here — RLS only returns published recaps to anon (see the
// "Allow public read access to published recaps" policy). So we use the
// service-role client, exactly like the public recap page does for its preview
// mode (src/app/recap/[slug]/page.tsx). This runs server-side only and we scope
// every query to this one brand's id, so the token stays the gate.

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceSupabase();
  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("portal_token", token)
    .single();

  // Private surface — keep it out of search indexes regardless of token validity.
  const robots = { index: false, follow: false } as const;
  if (!brand) return { title: "Not Found", robots };
  return {
    title: `${brand.name} — Brand Portal`,
    description: `Everything we've made with ${brand.name}`,
    robots,
  };
}

export default async function BrandPortalPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceSupabase();

  // 1. The token is the gate — one brand or 404.
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("portal_token", token)
    .single();

  if (!brand) notFound();

  // 2. All of this brand's recaps, newest first. Drafts included.
  const { data: recapsRaw } = await supabase
    .from("campaign_recaps")
    .select("*")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const recaps = (recapsRaw || []) as any[];
  const recapIds = recaps.map((r) => r.id);

  // 3. Which recaps have any media at all (media.campaign_id). Recaps with media
  //    render the normal campaign card; recaps with none render a "coming soon"
  //    card. We show EVERY recap either way.
  const { data: mediaRaw } = recapIds.length
    ? await supabase.from("media").select("campaign_id").in("campaign_id", recapIds)
    : { data: [] };

  const populated = new Set<string>();
  for (const m of (mediaRaw || []) as any[]) populated.add(m.campaign_id);

  // The only rollup we still show is the campaign count — across ALL of the
  // brand's campaigns (populated + coming-soon), so it reflects the full scope.
  const campaignCount = recaps.length;

  const brandLogo = pickBrandLogo(brand);

  return (
    <>
      {/* Hero welcome */}
      <section className="mx-auto max-w-[1200px] px-6 pt-8 pb-10">
        <p
          className="text-[11px] font-bold uppercase tracking-[3px] mb-3"
          style={{ color: ORANGE }}
        >
          Brand Portal
        </p>
        <h1
          className="uppercase leading-[0.92] tracking-[0.5px]"
          style={{ ...BEBAS, fontSize: "clamp(48px, 7vw, 92px)" }}
        >
          Everything we&rsquo;ve made
          <br />
          with {brand.name}
        </h1>
      </section>

      {/* Stats — campaign count only */}
      <section className="mx-auto max-w-[1200px] px-6 pb-14">
        <div
          className="inline-block rounded-[18px] px-7 py-6 text-center"
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.11)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <div
            className="leading-none"
            style={{ ...BEBAS, fontSize: "clamp(36px, 5vw, 56px)", color: OFFWHITE }}
          >
            {campaignCount.toLocaleString()}
          </div>
          <div
            className="mt-2 text-[10px] font-bold uppercase tracking-[2px]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {campaignCount === 1 ? "Campaign" : "Campaigns"}
          </div>
        </div>
      </section>

      {/* Campaign grid — every recap; coming-soon card for unpopulated ones */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        {recaps.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.45)" }} className="text-sm">
            No campaigns to show yet.
          </p>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {recaps.map((r) => {
              const safeName = brandSafe(r.name);

              // Unpopulated → inactive "coming soon" card, not clickable.
              if (!populated.has(r.id)) {
                return (
                  <div
                    key={r.id}
                    aria-label={`${brand.name} — ${safeName} (coming soon)`}
                    className="relative overflow-hidden rounded-[22px] cursor-default"
                    style={{
                      aspectRatio: "3 / 4",
                      background: "#0d0d11",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {/* Frosted / greyed glass panel — reads as inactive */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
                      style={{
                        background: "rgba(12,12,16,0.55)",
                        backdropFilter: "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                      }}
                    >
                      {brandLogo ? (
                        <img
                          src={brandLogo}
                          alt={brand.name}
                          className="h-10 w-auto max-w-[130px] object-contain"
                          style={{ opacity: 0.45 }}
                        />
                      ) : null}
                      <div
                        className="text-[10px] font-bold uppercase tracking-[2px]"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        Campaign content uploading soon
                      </div>
                    </div>
                    {/* Campaign name, dimmed to match the inactive state */}
                    <div className="absolute left-5 right-5 bottom-5">
                      <div
                        className="uppercase leading-[.9] tracking-[.5px] text-[30px]"
                        style={{ ...BEBAS, color: "rgba(250,248,245,0.5)" }}
                      >
                        {safeName}
                      </div>
                    </div>
                  </div>
                );
              }

              // Populated → normal campaign card (unchanged).
              const hero = r.hero_image_url || r.thumbnail_url || null;
              return (
                <a
                  key={r.id}
                  href={`/recap/${r.slug}`}
                  aria-label={`${brand.name} — ${safeName}`}
                  className="group relative block overflow-hidden rounded-[22px] will-change-transform transition-transform duration-300 hover:-translate-y-1"
                  style={{
                    aspectRatio: "3 / 4",
                    background: "#000",
                    border: "1px solid rgba(255,255,255,0.11)",
                  }}
                >
                  {hero ? (
                    <img
                      src={hero}
                      alt={`${brand.name} ${safeName}`}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ background: "#15151a" }} />
                  )}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(8,8,11,.35), transparent 38%, rgba(8,8,11,.92))",
                    }}
                  />
                  {/* Brand logo chip */}
                  {brandLogo ? (
                    <div className="absolute top-[18px] left-[18px]">
                      <span className="inline-flex items-center h-[30px] max-w-[140px] px-2 rounded-full bg-white/90">
                        <img
                          src={brandLogo}
                          alt={brand.name}
                          className="h-[18px] w-auto max-w-full object-contain"
                        />
                      </span>
                    </div>
                  ) : null}
                  {/* At rest: hero + name + logo only. The "View recap" CTA
                      appears on hover. */}
                  <div className="absolute left-5 right-5 bottom-5">
                    <div
                      className="uppercase leading-[.9] tracking-[.5px] text-[30px]"
                      style={{ ...BEBAS, color: OFFWHITE }}
                    >
                      {safeName}
                    </div>
                    <div className="flex items-center gap-[7px] mt-3 text-[10px] uppercase tracking-[2px] opacity-0 translate-y-[6px] transition-all duration-[400ms] group-hover:opacity-100 group-hover:translate-y-0">
                      View recap <span style={{ color: ORANGE }}>&rarr;</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
