import type { Metadata } from "next";
import { createServiceSupabase } from "@/lib/supabase";
import { getPortalBrand } from "@/lib/portal-data";
import { brandSafe } from "@/lib/brand-safe";
import {
  ORANGE,
  OFFWHITE,
  CARD,
  CARD_B,
  HAIR,
  RADIUS,
  BLUR,
  BEBAS,
  ANTON,
  MONO,
  INK_BODY,
  INK_LABEL,
  pickBrandLogo,
} from "@/lib/portal";
import HeroStage, { HeroFallback, type HeroSlide } from "./HeroStage";
import StageMatrix, { type MatrixCampaign } from "./StageMatrix";
import RosterGrid from "./RosterGrid";
import Link from "next/link";

// Brand portal DASHBOARD. The campaign grid now lives on the Campaigns tab;
// this page carries the hero, the stat bar, the in-flight matrix, a campaign
// card strip, the notable roster, and the assets two-up.
//
// Token gate + service-role rationale: see src/lib/portal-data.ts.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Brand Portal`,
    description: `Everything we've made with ${brand.name}`,
    // Private surface — keep it out of search indexes.
    robots: { index: false, follow: false },
  };
}

const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export default async function BrandPortalDashboard({ params }: Props) {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  const supabase = createServiceSupabase();

  // Every campaign for this brand, newest first. Drafts included.
  const { data: recapsRaw } = await supabase
    .from("campaign_recaps")
    .select("id, name, slug, published, created_at, hero_image_url, thumbnail_url")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const recaps = (recapsRaw || []) as any[];
  const recapIds = recaps.map((r) => r.id);

  // All media for those campaigns. media.campaign_id is the authoritative link
  // (the media_campaigns join table is only partially populated and finds
  // fewer campaigns), so we deliberately do NOT route through it.
  const { data: mediaRaw } = recapIds.length
    ? await supabase
        .from("media")
        .select("id, campaign_id, athlete_id, type, file_url, thumbnail_url, is_hero, hero_order, is_video_thumbnail, created_at")
        .in("campaign_id", recapIds)
    : { data: [] as any[] };

  const media = ((mediaRaw || []) as any[]).filter((m) => !m.is_video_thumbnail);

  // Athlete rows referenced by this brand's media, for credits + roster.
  const athleteIds = Array.from(
    new Set(media.map((m) => m.athlete_id).filter(Boolean)),
  ) as string[];

  const { data: athletesRaw } = athleteIds.length
    ? await supabase
        .from("athletes")
        .select("id, name, school, sport, ig_followers")
        .in("id", athleteIds)
    : { data: [] as any[] };

  const athletes = (athletesRaw || []) as any[];
  const athleteById: Record<string, any> = {};
  for (const a of athletes) athleteById[a.id] = a;

  const publishedIds = new Set(recaps.filter((r) => r.published).map((r) => r.id));
  const campaignName: Record<string, string> = {};
  for (const r of recaps) campaignName[r.id] = brandSafe(r.name || "");

  // ---- Stats -------------------------------------------------------------
  const campaignCount = recaps.length;
  const publishedCount = recaps.filter((r) => r.published).length;
  const archivedCount = campaignCount - publishedCount;

  // Athlete rows are per-campaign (and can repeat per post), so the same
  // person appears more than once. Count DISTINCT PEOPLE by name — a row count
  // would overstate a client-facing headcount.
  const distinctPeople = new Set(
    athletes.map((a) => String(a.name || "").trim().toLowerCase()).filter(Boolean),
  ).size;

  const assetCount = media.length;

  // ---- Hero slides (brief 5.1) -------------------------------------------
  const images = media.filter((m) => m.type === "image" && m.file_url);

  const flagged = images
    .filter((m) => m.is_hero)
    .sort((a, b) => (a.hero_order ?? 1e9) - (b.hero_order ?? 1e9));

  const newestPublished = images
    .filter((m) => !m.is_hero && publishedIds.has(m.campaign_id))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

  const creditFor = (m: any): string | null => {
    const a = m.athlete_id ? athleteById[m.athlete_id] : null;
    if (!a) return null;
    const bits = [a.name, a.school, a.sport].filter(Boolean).map((x: string) => brandSafe(String(x)));
    return bits.length ? bits.join(" · ") : null;
  };

  const heroSlides: HeroSlide[] = [...flagged, ...newestPublished]
    .slice(0, 6)
    .map((m) => ({
      id: m.id,
      src: m.file_url,
      alt: campaignName[m.campaign_id] || brand.name,
      campaignName: campaignName[m.campaign_id] || "",
      credit: creditFor(m),
    }));

  // ---- Per-campaign rollups ---------------------------------------------
  const perCampaign: Record<string, { assets: number; athletes: Set<string>; cover: string | null }> = {};
  for (const m of media) {
    const c = (perCampaign[m.campaign_id] ||= { assets: 0, athletes: new Set(), cover: null });
    c.assets += 1;
    if (m.athlete_id) {
      const a = athleteById[m.athlete_id];
      if (a?.name) c.athletes.add(String(a.name).trim().toLowerCase());
    }
    if (!c.cover && m.type === "image" && m.file_url) c.cover = m.file_url;
  }

  const cards = recaps
    .filter((r) => r.published && perCampaign[r.id])
    .slice(0, 9)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: campaignName[r.id],
      when: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", MONTH_YEAR) : null,
      athletes: perCampaign[r.id]?.athletes.size ?? 0,
      assets: perCampaign[r.id]?.assets ?? 0,
      cover: r.hero_image_url || r.thumbnail_url || perCampaign[r.id]?.cover || null,
    }));

  // ---- In flight: unpublished campaigns, newest first --------------------
  const inFlight: MatrixCampaign[] = recaps
    .filter((r) => !r.published)
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      name: campaignName[r.id],
      opened: r.created_at
        ? `Opened ${new Date(r.created_at).toLocaleDateString("en-GB", DAY_MONTH_YEAR)}`
        : "Opened date not recorded",
    }));

  // ---- Notable roster: top 8 by reach ------------------------------------
  // ig_followers is verified for these athletes, so this IS a real ranking —
  // unlike the Assets tab's "Top performing" sort, which has no data behind it.
  // Rows with 0 followers are treated as untracked (repo convention), so they
  // are excluded from the ranking rather than ranked last as if they were zero.
  const firstImageFor: Record<string, string> = {};
  for (const m of media) {
    if (m.type !== "image" || !m.file_url || !m.athlete_id) continue;
    const a = athleteById[m.athlete_id];
    if (!a?.name) continue;
    const k = String(a.name).trim().toLowerCase();
    if (!firstImageFor[k]) firstImageFor[k] = m.file_url;
  }

  const byPerson: Record<string, { name: string; school: string | null; sport: string | null; followers: number }> = {};
  for (const a of athletes) {
    const k = String(a.name || "").trim().toLowerCase();
    if (!k) continue;
    const f = typeof a.ig_followers === "number" && a.ig_followers > 0 ? a.ig_followers : 0;
    const cur = byPerson[k];
    if (!cur || f > cur.followers) {
      byPerson[k] = { name: a.name, school: a.school || null, sport: a.sport || null, followers: f };
    }
  }

  // Full ranked roster. Desktop renders the top 8; <=750px collapses to 4 and
  // expands the rest in place, so the whole ranking ships to the client.
  const roster = Object.entries(byPerson)
    .filter(([, v]) => v.followers > 0)
    .sort((x, y) => y[1].followers - x[1].followers)
    .map(([k, v]) => ({ ...v, key: k, image: firstImageFor[k] || null }));

  const rosterShown = Math.min(8, roster.length);

  const brandLogo = pickBrandLogo(brand);

  // ---- Shared bits -------------------------------------------------------
  const lockup = (
    <div className="flex flex-col items-start min-w-0">
      <div style={{ ...MONO, fontSize: 11, letterSpacing: ".18em", color: ORANGE }}>
        Brand Portal
      </div>
      {/* Hard rule 2 — client logo from the database, or a labelled empty
          slot. Never an approximation. */}
      {brandLogo ? (
        <img
          src={brandLogo}
          alt={brand.name}
          className="block my-4"
          style={{ height: "clamp(42px,6vw,80px)", width: "auto", flex: "0 0 auto", objectFit: "contain", maxWidth: "100%" }}
        />
      ) : (
        <div
          className="my-4 inline-flex items-center rounded-[3px] px-3 py-2"
          style={{ border: "1px dashed rgba(250,248,245,.22)", ...MONO, fontSize: 10, color: INK_LABEL }}
        >
          {brand.name} &middot; no logo on file
        </div>
      )}
      <p className="pv2-hero-lead" style={{ fontSize: 21, lineHeight: 1.45, color: "rgba(250,248,245,.92)", maxWidth: 430 }}>
        {campaignCount.toLocaleString()} {campaignCount === 1 ? "campaign" : "campaigns"} together.
      </p>
    </div>
  );

  const Stat = ({
    label,
    figure,
    sub,
    placeholder,
  }: {
    label: string;
    figure: string;
    sub?: string;
    placeholder?: boolean;
  }) => (
    <div className="pv2-stat px-6 py-[22px]" style={{ borderRight: `1px solid ${HAIR}` }}>
      <div className="pv2-statlabel" style={{ ...MONO, fontSize: 10, letterSpacing: ".13em", color: INK_LABEL }}>{label}</div>
      <div
        className="pv2-fig mt-3.5"
        style={{ ...ANTON, fontSize: "clamp(38px,4vw,44px)", lineHeight: .92, color: placeholder ? "rgba(250,248,245,.30)" : OFFWHITE }}
      >
        {figure}
      </div>
      {placeholder ? (
        <div className="mt-[11px]">
          <span
            className="inline-block rounded-[3px] px-2 py-[5px]"
            style={{ ...MONO, fontSize: 10, background: "rgba(250,248,245,.07)", border: `1px solid ${CARD_B}`, color: "rgba(250,248,245,.60)" }}
          >
            Awaiting verified data
          </span>
        </div>
      ) : (
        <div className="mt-2" style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: "rgba(250,248,245,.36)" }}>
          {sub}
        </div>
      )}
    </div>
  );

  const statbar = (
    <div
      className="pv2-statbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden"
      style={{ border: `1px solid ${CARD_B}`, borderRadius: RADIUS, background: CARD, backdropFilter: BLUR, WebkitBackdropFilter: BLUR }}
    >
      <Stat label="Campaigns" figure={campaignCount.toLocaleString()} sub={`${publishedCount} published · ${archivedCount} archived`} />
      <Stat label="Athletes worked with" figure={distinctPeople.toLocaleString()} sub="Across all campaigns" />
      <Stat label="Assets delivered" figure={assetCount.toLocaleString()} sub="Photo and video" />
      {/* asset_metrics is empty — no invented number, not even greyed. */}
      <Stat label="Total impressions" figure="—" placeholder />
    </div>
  );

  const SectionHead = ({ num, title, right }: { num: string; title: string; right?: React.ReactNode }) => (
    <div
      className="flex items-baseline justify-between gap-5 pt-[18px] mb-6"
      style={{ borderTop: "1px solid rgba(250,248,245,.14)" }}
    >
      <div className="flex items-baseline gap-4 min-w-0">
        <span style={{ ...MONO, fontSize: 11, letterSpacing: ".18em", color: ORANGE }}>{num}</span>
        <h2 className="uppercase truncate" style={{ ...BEBAS, fontSize: "clamp(28px,3.6vw,38px)", lineHeight: 1 }}>{title}</h2>
      </div>
      {right ? <div style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: INK_LABEL }}>{right}</div> : null}
    </div>
  );

  return (
    <main>
      {heroSlides.length ? (
        <HeroStage slides={heroSlides} lockup={lockup} statbar={statbar} />
      ) : (
        <HeroFallback lockup={lockup} statbar={statbar} />
      )}

      <div className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24">
        {/* 02 IN FLIGHT */}
        <section className="pt-14 md:pt-[72px]">
          <SectionHead num="02" title="In flight" />
          <StageMatrix campaigns={inFlight} />
        </section>

        {/* 03 CAMPAIGNS */}
        <section className="pt-14 md:pt-[72px]">
          <SectionHead num="03" title="Campaigns" right={`${publishedCount} published · ${archivedCount} archived`} />
          {cards.length === 0 ? (
            <p style={{ fontSize: 16, color: INK_BODY }}>No published campaigns with media yet.</p>
          ) : (
            <div className="pv2-campaign-grid pv2-summary grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={`/recap/${c.slug}`}
                  className="group relative block overflow-hidden"
                  style={{ border: `1px solid ${CARD_B}`, borderRadius: RADIUS, aspectRatio: "4 / 5", background: "#101014" }}
                >
                  {c.cover ? (
                    <img
                      src={c.cover}
                      alt={`${brand.name} ${c.name}`}
                      className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-[1.03]"
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
                      Published
                    </span>
                  </div>
                  <div className="absolute left-[18px] right-[18px] bottom-4 z-[2]">
                    <div className="pv2-card-name uppercase" style={{ ...BEBAS, fontSize: 26, lineHeight: 1.02, letterSpacing: ".012em" }}>
                      {c.name}
                    </div>
                    <div className="pv2-card-meta flex items-center gap-2.5 mt-[7px] flex-wrap">
                      {[c.when, `${c.athletes} ${c.athletes === 1 ? "athlete" : "athletes"}`, `${c.assets} ${c.assets === 1 ? "asset" : "assets"}`]
                        .filter(Boolean)
                        .map((bit, i, arr) => (
                          <span key={i} className="flex items-center gap-2.5">
                            <span style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: "rgba(250,248,245,.72)" }}>{bit}</span>
                            {i < arr.length - 1 ? (
                              <i className="not-italic block rounded-full" style={{ width: 3, height: 3, background: "rgba(250,248,245,.40)" }} />
                            ) : null}
                          </span>
                        ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {/* Counts stay live — never hardcoded. At <=750px the grid shows the
              first four and this becomes the full-width route to the rest. */}
          <div className="pv2-cards-foot flex items-center justify-between gap-3.5 mt-4 flex-wrap">
            <span className="pv2-foot-count" style={{ ...MONO, fontSize: 10, color: INK_LABEL }}>
              Showing {cards.length} of {publishedCount} published
            </span>
            <span className="pv2-foot-count-mobile" style={{ ...MONO, fontSize: 10, color: INK_LABEL }}>
              Showing {Math.min(4, cards.length)} of {publishedCount} published
            </span>
            <Link
              href={`/portal/${token}/campaigns`}
              className="pv2-btn pv2-seeall-link inline-flex items-center justify-center rounded-[4px] px-4 py-2.5"
              style={{ ...MONO, fontSize: 10, letterSpacing: ".13em", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.15)", color: OFFWHITE, textDecoration: "none", minHeight: 34 }}
            >
              All {campaignCount} campaigns &rarr;
            </Link>
          </div>
        </section>

        {/* 04 NOTABLE ROSTER — verified ranking on ig_followers */}
        <section className="pt-14 md:pt-[72px]">
          <SectionHead
            num="04"
            title="Notable roster"
            right={`Top ${rosterShown} by reach · ${distinctPeople} total`}
          />
          {roster.length === 0 ? (
            <p className="pv2-body" style={{ fontSize: 16, color: INK_BODY }}>
              No follower data on file for this roster yet.
            </p>
          ) : (
            <RosterGrid people={roster} />
          )}
        </section>

        {/* 05 ASSETS & REPORTING */}
        <section className="pt-14 md:pt-[72px] pb-24">
          <SectionHead num="05" title="Assets & reporting" right="Yours to use" />
          <div className="pv2-twoup grid gap-4 grid-cols-1 lg:grid-cols-2">
            <div
              className="p-6 flex flex-col justify-between"
              style={{ border: `1px solid ${CARD_B}`, borderRadius: RADIUS, background: CARD, backdropFilter: BLUR, WebkitBackdropFilter: BLUR, minHeight: 180 }}
            >
              <div>
                <div style={{ ...MONO, fontSize: 10, color: INK_LABEL }}>Asset library</div>
                <h3 className="uppercase my-2" style={{ ...BEBAS, fontSize: 24, letterSpacing: ".012em" }}>
                  {assetCount.toLocaleString()} files across {campaignCount} campaigns
                </h3>
                <p className="pv2-body" style={{ fontSize: 16, lineHeight: 1.7, color: INK_BODY }}>
                  Every delivered photo and video, filtered by campaign or athlete.
                </p>
              </div>
              <div className="mt-[18px] flex gap-2 flex-wrap">
                <Link
                  href={`/portal/${token}/library`}
                  className="pv2-btn inline-flex items-center justify-center rounded-[4px] px-4 py-2.5"
                  style={{ ...MONO, fontSize: 10, letterSpacing: ".13em", background: ORANGE, color: "#fff", textDecoration: "none", minHeight: 34 }}
                >
                  Open library
                </Link>
              </div>
            </div>

            <div
              className="p-6 flex flex-col justify-between"
              style={{ border: `1px solid ${CARD_B}`, borderRadius: RADIUS, background: CARD, backdropFilter: BLUR, WebkitBackdropFilter: BLUR, minHeight: 180 }}
            >
              <div>
                <div style={{ ...MONO, fontSize: 10, color: INK_LABEL }}>Performance</div>
                <h3 className="uppercase my-2" style={{ ...BEBAS, fontSize: 24, letterSpacing: ".012em" }}>
                  Campaign reporting
                </h3>
                <p className="pv2-body" style={{ fontSize: 16, lineHeight: 1.7, color: INK_BODY }}>
                  Impressions, engagement and post counts per campaign.
                </p>
              </div>
              <div className="mt-[18px]">
                <span
                  className="inline-block rounded-[3px] px-2 py-[5px]"
                  style={{ ...MONO, fontSize: 10, background: "rgba(250,248,245,.07)", border: `1px solid ${CARD_B}`, color: "rgba(250,248,245,.60)" }}
                >
                  Awaiting verified data
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
