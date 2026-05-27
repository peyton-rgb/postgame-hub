// ============================================================
// /clients/[slug]/[campaign]
//
// Editorial campaign page modeled on the approved Dick's "Diamond
// Sports" prototype: full-bleed rotating hero, kicker + bebas title,
// stat strip, then a masonry "Work" gallery with hover-to-play
// videos.
//
// All data is fetched server-side from Supabase using `media` (with
// the focal_x/focal_y/quality_score columns populated at import).
// `?preview=1` bypasses `published=true` in non-production.
// ============================================================

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBrandBySlug } from '@/lib/data/brands';
import { createPlainSupabase, createServiceSupabase } from '@/lib/supabase';
import HeroStills, { type HeroStill } from './HeroStills';
import WorkGallery, { type GalleryItem } from './WorkGallery';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Props = {
  params: Promise<{ slug: string; campaign: string }>;
  searchParams?: Promise<{ preview?: string }>;
};

function allowPreviewBypass(sp: { preview?: string } | undefined) {
  return sp?.preview === '1' && process.env.NODE_ENV !== 'production';
}

// Derive a variant URL from an original image URL. Backfill writes
// `<basename>.<suffix>.webp` next to each original.
function variantUrl(originalUrl: string, suffix: 'w400' | 'w800' | 'w1600'): string {
  return originalUrl.replace(/\.(jpe?g|png|webp)$/i, `.${suffix}.webp`);
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}


export default async function CampaignPage({ params, searchParams }: Props) {
  const { slug: brandSlug, campaign: campaignSlug } = await params;
  const sp = (await searchParams) ?? {};
  const preview = allowPreviewBypass(sp);

  const brand = getBrandBySlug(brandSlug);
  if (!brand) notFound();

  const supabase = preview ? createServiceSupabase() : createPlainSupabase();

  // ---- Campaign ----
  let recapQ = supabase
    .from('campaign_recaps')
    .select('id, slug, name, description, client_name, brand_id, published')
    .eq('slug', campaignSlug);
  if (!preview) recapQ = recapQ.eq('published', true);
  const { data: campaign } = await recapQ.maybeSingle();
  if (!campaign) notFound();

  // ---- Athletes (stat strip) ----
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, school, sport')
    .eq('campaign_id', campaign.id);
  const athletesArr = athletes || [];
  const schoolsCount = new Set(athletesArr.map((a: any) => a.school).filter(Boolean)).size;
  const sportsList = Array.from(
    new Set(athletesArr.map((a: any) => a.sport).filter(Boolean))
  ) as string[];

  // ---- Media ----
  const { data: media } = await supabase
    .from('media')
    .select(
      'id, type, file_url, thumbnail_url, athlete_id, focal_x, focal_y, quality_score, resolution, is_hero, hero_order, hero_scale'
    )
    .eq('campaign_id', campaign.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  const mediaArr = media || [];
  const allImages = mediaArr.filter((m: any) => m.type === 'image');
  const allVideos = mediaArr.filter((m: any) => m.type === 'video');

  // Phase 4 — optional slot overrides (hero carousel, gallery). Empty = today's auto behavior.
  const { data: campSlots } = await supabase
    .from("slot_assignments")
    .select("slot_key, file_url, focal_x, focal_y, scale, position")
    .in("slot_key", [`campaign.${campaign.id}.hero_carousel`, `campaign.${campaign.id}.gallery`])
    .order("position", { ascending: true });
  const cs = (campSlots || []) as any[];
  const heroSlot = cs.filter(s => s.slot_key === `campaign.${campaign.id}.hero_carousel` && s.file_url);
  const gallerySlot = cs.filter(s => s.slot_key === `campaign.${campaign.id}.gallery` && s.file_url);
  const isVid = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);

  // Hero selection: if the editor has manually picked hero images (is_hero=true),
  // use those. Otherwise fall back to auto-pick for campaigns that haven't been
  // curated yet.
  const manualHeroes = mediaArr
    .filter((m: any) => m.is_hero)
    .sort((a: any, b: any) => (a.hero_order || 0) - (b.hero_order || 0));

  let heroCandidates: any[];
  if (manualHeroes.length > 0) {
    // Manual picks from the hero editor — these include videos too
    heroCandidates = manualHeroes;
  } else {
    // Auto-pick fallback: prefer landscape images, fall back to first 6
    const isLandscape = (m: any) => {
      if (typeof m.resolution !== 'string') return false;
      const [w, h] = m.resolution.split('x').map((n: string) => parseInt(n, 10));
      return Number.isFinite(w) && Number.isFinite(h) && w > h;
    };
    heroCandidates = allImages
      .filter(isLandscape)
      .sort((a: any, b: any) => (b.quality_score || 0) - (a.quality_score || 0))
      .slice(0, 6);
    if (heroCandidates.length < 3) {
      heroCandidates = allImages.slice(0, 6);
    }
  }

  const heroStills: HeroStill[] = heroSlot.length > 0
    ? heroSlot.map((s: any) => ({ src: s.file_url, alt: campaign.name, focalX: s.focal_x ?? 0.5, focalY: s.focal_y ?? 0.5, scale: s.scale ?? 1 }))
    : heroCandidates.map((m: any) => ({ src: m.file_url, alt: campaign.name, focalX: typeof m.focal_x === "number" ? m.focal_x : 0.5, focalY: typeof m.focal_y === "number" ? m.focal_y : 0.5, scale: typeof m.hero_scale === "number" ? m.hero_scale : 1.0 }));

  const images: GalleryItem[] = allImages.map((m: any) => ({
    id: m.id,
    src: m.file_url,
    thumb: variantUrl(m.file_url, 'w400'),
    isVideo: false,
    poster: null,
    alt: campaign.name,
    focalX: typeof m.focal_x === 'number' ? m.focal_x : 0.5,
    focalY: typeof m.focal_y === 'number' ? m.focal_y : 0.5,
  }));
  const videos: GalleryItem[] = allVideos.map((m: any) => ({
    id: m.id,
    src: m.file_url,
    thumb: m.thumbnail_url || m.file_url,
    isVideo: true,
    poster: m.thumbnail_url || null,
    alt: campaign.name,
    focalX: 0.5,
    focalY: 0.5,
  }));

  // Gallery slot override — use curated slot rows if present, else today's full media list.
  const galleryImages = gallerySlot.length > 0
    ? gallerySlot.filter((s: any) => !isVid(s.file_url)).map((s: any, i: number) => ({ id: `slot-img-${i}`, src: s.file_url, thumb: variantUrl(s.file_url, "w400"), isVideo: false, poster: null, alt: campaign.name, focalX: s.focal_x ?? 0.5, focalY: s.focal_y ?? 0.5 }))
    : images;
  const galleryVideos = gallerySlot.length > 0
    ? gallerySlot.filter((s: any) => isVid(s.file_url)).map((s: any, i: number) => ({ id: `slot-vid-${i}`, src: s.file_url, thumb: s.file_url, isVideo: true, poster: null, alt: campaign.name, focalX: 0.5, focalY: 0.5 }))
    : videos;

  // Title split: render the last word in orange italic, like the prototype.
  const titleWords = campaign.name.split(/\s+/);
  const titleLast = titleWords.length > 1 ? titleWords[titleWords.length - 1] : null;
  const titleRest = titleWords.length > 1 ? titleWords.slice(0, -1).join(' ') : campaign.name;

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: 'var(--font-inter), Arial, system-ui, sans-serif' }}
    >
      {!campaign.published && (
        <div
          className="text-center py-3 text-[11px] tracking-[0.16em] uppercase border-b border-white/[0.08]"
          style={{ fontFamily: 'var(--font-mono)', color: '#555550', background: '#080808' }}
        >
          Draft — preview mode · not public until{' '}
          <span className="text-[#D73F09] font-bold">published</span>
        </div>
      )}

      {/* ---- HERO ---- */}
      <header
        className="relative w-full overflow-hidden flex items-center border-b border-white/[0.08]"
        style={{ minHeight: 'min(65vh, 700px)' }}
      >
        <div className="absolute inset-0 z-[1] bg-[#0c0c0e]">
          <HeroStills stills={heroStills} />
        </div>
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg,#000 0%,rgba(0,0,0,.96) 26%,rgba(0,0,0,.6) 52%,rgba(0,0,0,.25) 78%,rgba(0,0,0,.4) 100%)',
          }}
        />
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{ background: 'linear-gradient(0deg,rgba(0,0,0,.6) 0%,transparent 30%)' }}
        />

        <span
          className="absolute top-6 right-7 z-[4] uppercase tracking-[0.14em] text-[10px] flex items-center gap-2 px-[10px] py-[6px] max-[820px]:hidden"
          style={{
            fontFamily: 'var(--font-mono)',
            color: '#8a8a85',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <span
            className="inline-block w-[7px] h-[7px] rounded-full"
            style={{ background: '#D73F09', boxShadow: '0 0 8px #D73F09' }}
          />
          Hero · {heroStills.length} stills
        </span>

        <div className="relative z-[3] max-w-[1200px] w-full mx-auto px-10 py-[60px] max-[820px]:px-5 max-[820px]:py-12">
          <div className="max-w-[680px]">
            <div
              className="uppercase text-[11px] tracking-[0.25em] mb-7 flex items-center gap-[14px]"
              style={{ fontFamily: 'var(--font-mono)', color: '#D73F09' }}
            >
              <span className="inline-block w-[46px] h-px" style={{ background: '#D73F09' }} />
              {brand.name} · NIL Campaign
            </div>

            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-[50px] w-auto object-contain mb-6"
              />
            )}

            <h1
              className="font-normal uppercase leading-[0.88] tracking-[0.005em]"
              style={{
                fontFamily: 'var(--font-bebas), Impact, sans-serif',
                fontSize: 'clamp(64px, 9vw, 128px)',
              }}
            >
              {titleLast ? (
                <>
                  {titleRest}
                  <br />
                  <span style={{ color: '#D73F09', fontStyle: 'italic' }}>{titleLast}.</span>
                </>
              ) : (
                titleRest
              )}
            </h1>

            {campaign.description && (
              <p className="max-w-[540px] mt-[34px] text-[17px] leading-[1.7] text-[#cfcfca]">
                {campaign.description}
              </p>
            )}

            <div className="mt-[38px] flex gap-[14px] flex-wrap">
              <a
                href="#work"
                className="uppercase tracking-[0.14em] text-[11px] font-bold px-6 py-[14px] inline-flex items-center gap-[9px]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: '#D73F09',
                  color: '#fff',
                  border: '1.5px solid #D73F09',
                }}
              >
                ▶ Watch the work
              </a>
              <Link
                href="/clients"
                className="uppercase tracking-[0.14em] text-[11px] font-bold px-6 py-[14px] inline-flex items-center gap-[9px]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: '#D73F09',
                  border: '1.5px solid #D73F09',
                  background: 'transparent',
                }}
              >
                More campaigns
              </Link>
            </div>
          </div>

          {/* Stat strip — first three accented orange, last two white (prototype convention). */}
          <div className="mt-[60px] grid gap-6 max-w-[920px] pt-[30px] border-t border-white/[0.08] grid-cols-5 max-[820px]:grid-cols-3 max-[820px]:gap-[18px]">
            <Stat n={athletesArr.length} label="Athletes" accent />
            <Stat n={schoolsCount} label="Universities" accent />
            <Stat n={sportsList.length} label="Sports" accent />
            <Stat n={allVideos.length} label="Video Clips" />
            <Stat n={allImages.length} label="Photos" />
          </div>
        </div>
      </header>

      {/* ---- THE WORK ---- */}
      <section
        id="work"
        className="max-w-[1200px] mx-auto px-10 py-20 max-[820px]:px-5 max-[820px]:py-[60px]"
      >
        <div
          className="uppercase text-[11px] tracking-[0.2em] mb-[18px] flex items-center gap-[14px]"
          style={{ fontFamily: 'var(--font-mono)', color: '#D73F09' }}
        >
          <span className="inline-block w-[34px] h-px" style={{ background: '#D73F09' }} />
          The Work
        </div>
        <h2
          className="font-normal uppercase leading-[0.92]"
          style={{
            fontFamily: 'var(--font-bebas), Impact, sans-serif',
            fontSize: 'clamp(40px, 6vw, 76px)',
          }}
        >
          Campaign Content
        </h2>
        <p className="max-w-[560px] mt-[18px] text-base leading-[1.7] text-[#8a8a85]">
          Athlete-driven {sportsList.join(' & ').toLowerCase() || 'NIL'} content across{' '}
          {fmt(schoolsCount)} universities — the curated set: the strongest video and photo from
          each athlete and team shoot, near-duplicates and softer frames already removed.
        </p>

        <WorkGallery images={galleryImages} videos={galleryVideos} />
      </section>

      {/* ---- FOOTER ---- */}
      <footer
        className="border-t border-white/[0.08] py-[50px] px-10 max-[820px]:px-5 text-center uppercase text-[11px] tracking-[0.1em]"
        style={{ fontFamily: 'var(--font-mono)', color: '#555550' }}
      >
        © {new Date().getFullYear()} Postgame · {campaign.name} × {brand.name}
      </footer>
    </div>
  );
}

function Stat({ n, label, accent = false }: { n: number; label: string; accent?: boolean }) {
  return (
    <div>
      <div
        className="leading-[0.9]"
        style={{
          fontFamily: 'var(--font-bebas), Impact, sans-serif',
          fontSize: 'clamp(34px, 4vw, 54px)',
          color: accent ? '#D73F09' : '#fff',
        }}
      >
        {fmt(n)}
      </div>
      <div
        className="uppercase tracking-[0.13em] mt-3 text-[10px] leading-[1.5]"
        style={{ fontFamily: 'var(--font-mono)', color: '#8a8a85' }}
      >
        {label}
      </div>
    </div>
  );
}
