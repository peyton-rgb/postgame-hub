// ============================================================
// Case Study Detail Page — /case-studies/[slug]
//
// Public-facing detail page for individual case studies.
// Premium dark design matching /clients.
//
// Features:
//   - Full-bleed hero with brand color gradient + hero stat
//   - Inline campaign media embeds (images + videos from campaign_recaps)
//   - Structured metrics grid with brand-colored accents
//   - Quote callout with brand styling
//   - Campaign gallery pulled from real media assets
//   - Related case studies carousel
//   - Athlete name badges
//   - Numbered content sections with brand-colored labels
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import { createBrowserSupabase } from '@/lib/supabase';

// ---- Types ----

interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  brand_name: string;
  brand_logo_url: string | null;
  category: string | null;
  hero_stat: string | null;
  hero_stat_label: string | null;
  overview: string | null;
  challenge: string | null;
  solution: string | null;
  results: string | null;
  body_html: string | null;
  metrics: Record<string, any>;
  highlights: string[];
  image_url: string | null;
  video_url: string | null;
  gallery_urls: string[] | null;
  tags: string[] | null;
  quote_text: string | null;
  quote_attribution: string | null;
  athlete_names: string[] | null;
  published_date: string | null;
  brand: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
}

interface CampaignMedia {
  file_url: string;
  type: 'image' | 'video';
  campaign_name: string;
  campaign_id: string;
}

interface RelatedStudy {
  slug: string;
  title: string;
  brand_name: string;
  category: string | null;
  hero_stat: string | null;
  hero_stat_label: string | null;
  brand: {
    logo_url: string | null;
    primary_color: string | null;
  } | null;
}

// ---- Hero Montage ----
// Auto-playing, silent, looping montage that crossfades between
// video clips and Ken Burns-style photo moments behind the hero text.

interface MontageItem {
  url: string;
  type: 'image' | 'video';
}

function HeroMontage({
  items,
  brandColor,
}: {
  items: MontageItem[];
  brandColor: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Duration per slide: videos play for up to 5s, photos show for 4s
  const PHOTO_DURATION = 4000;
  const VIDEO_MAX_DURATION = 5000;

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;

    const current = items[activeIndex];
    let duration = PHOTO_DURATION;

    if (current.type === 'video') {
      // Let the video play a bit, then advance
      const vid = videoRefs.current[activeIndex];
      if (vid) {
        vid.currentTime = 0;
        vid.play().catch(() => {});
      }
      duration = VIDEO_MAX_DURATION;
    }

    timerRef.current = setTimeout(advance, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex, items, advance]);

  if (items.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {items.map((item, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{ opacity: i === activeIndex ? 1 : 0 }}
        >
          {item.type === 'video' ? (
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              src={item.url}
              muted
              playsInline
              loop
              preload={i <= 1 ? 'auto' : 'none'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${item.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 20%',
                animation: i === activeIndex ? 'kenBurns 6s ease-in-out forwards' : 'none',
              }}
            />
          )}
        </div>
      ))}

      {/* Dark overlay so text is readable */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.5) 40%, rgba(10,10,10,0.85) 100%)`,
        }}
      />

      {/* Brand color tint */}
      <div
        className="absolute inset-0 opacity-20 mix-blend-overlay"
        style={{ backgroundColor: brandColor }}
      />

      {/* Ken Burns keyframes injected via style tag */}
      <style>{`
        @keyframes kenBurns {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.08) translate(-1%, -1%); }
        }
      `}</style>
    </div>
  );
}

// ---- Metric Card ----

function MetricCard({
  label,
  value,
  brandColor,
}: {
  label: string;
  value: string;
  brandColor: string;
}) {
  return (
    <div className="relative group bg-[#111] border border-white/[0.06] rounded-xl p-5 text-center overflow-hidden hover:border-white/10 transition-all duration-500">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at center, ${brandColor}08 0%, transparent 70%)`,
        }}
      />
      <div className="relative">
        <div
          className="text-2xl sm:text-3xl font-black mb-1"
          style={{ color: brandColor }}
        >
          {value}
        </div>
        <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-semibold">
          {label.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
}

// ---- Inline Media Embed ----

function InlineMediaEmbed({
  media,
  brandColor,
}: {
  media: CampaignMedia[];
  brandColor: string;
}) {
  if (media.length === 0) return null;

  // Group by campaign
  const campaignGroups = media.reduce(
    (acc, m) => {
      const key = m.campaign_name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    },
    {} as Record<string, CampaignMedia[]>
  );

  return (
    <div className="mb-16">
      <div
        className="text-[10px] font-bold tracking-[0.2em] uppercase mb-6"
        style={{ color: brandColor }}
      >
        Campaign Content
      </div>

      {Object.entries(campaignGroups).map(([campaignName, items]) => (
        <div key={campaignName} className="mb-8">
          <div className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">
            {campaignName}
          </div>

          {/* Featured video */}
          {items.filter((i) => i.type === 'video').length > 0 && (
            <div className="mb-4">
              {items
                .filter((i) => i.type === 'video')
                .slice(0, 1)
                .map((v, i) => (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden border border-white/[0.06]"
                  >
                    <video
                      src={v.file_url}
                      controls
                      className="w-full"
                      preload="metadata"
                    />
                  </div>
                ))}
            </div>
          )}

          {/* Image grid */}
          {items.filter((i) => i.type === 'image').length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items
                .filter((i) => i.type === 'image')
                .slice(0, 6)
                .map((img, i) => (
                  <div
                    key={i}
                    className="rounded-lg overflow-hidden border border-white/[0.06] aspect-square group cursor-pointer"
                  >
                    <img
                      src={img.file_url}
                      alt={`${campaignName} content ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Related Case Study Card ----

function RelatedCard({ study }: { study: RelatedStudy }) {
  const color = study.brand?.primary_color || '#D73F09';
  return (
    <Link
      href={`/case-studies/${study.slug}`}
      className="group block bg-[#111] border border-white/[0.06] rounded-xl p-5 hover:border-white/15 transition-all duration-300"
    >
      <div className="flex items-center gap-2 mb-3">
        {study.brand?.logo_url ? (
          <img
            src={study.brand.logo_url}
            alt={study.brand_name}
            className="w-8 h-8 object-contain rounded bg-white/5 p-1"
          />
        ) : (
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {study.brand_name.charAt(0)}
          </div>
        )}
        <span className="text-xs text-white/40">{study.brand_name}</span>
      </div>
      <h3 className="text-sm font-bold text-white mb-2 group-hover:text-white/80 transition-colors line-clamp-2">
        {study.title}
      </h3>
      {study.hero_stat && (
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-black" style={{ color }}>
            {study.hero_stat}
          </span>
          <span className="text-[10px] text-white/25 uppercase tracking-wider">
            {study.hero_stat_label}
          </span>
        </div>
      )}
    </Link>
  );
}

// ---- Main Page ----

export default function CaseStudyDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [study, setStudy] = useState<CaseStudy | null>(null);
  const [campaignMedia, setCampaignMedia] = useState<CampaignMedia[]>([]);
  const [heroMedia, setHeroMedia] = useState<MontageItem[]>([]);
  const [relatedStudies, setRelatedStudies] = useState<RelatedStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchStudy() {
      if (!slug) return;
      const supabase = createBrowserSupabase();

      // Fetch case study with brand
      const { data, error } = await supabase
        .from('case_studies')
        .select(`
          *,
          brand:brands!case_studies_brand_id_fkey ( id, name, logo_url, primary_color )
        `)
        .eq('slug', slug)
        .eq('published', true)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const studyData = data as CaseStudy;
      setStudy(studyData);

      // Fetch campaign media for inline embeds
      if (studyData.brand?.id) {
        const { data: mediaData } = await supabase
          .from('media')
          .select(`
            file_url,
            type,
            campaign:campaign_recaps!inner ( id, name, brand_id )
          `)
          .eq('campaign.brand_id', studyData.brand.id)
          .not('file_url', 'is', null)
          .limit(30);

        if (mediaData) {
          const mapped: CampaignMedia[] = mediaData
            .filter((m: any) => m.campaign)
            .map((m: any) => ({
              file_url: m.file_url,
              type: m.type,
              campaign_name: m.campaign.name,
              campaign_id: m.campaign.id,
            }));
          setCampaignMedia(mapped);

          // Build hero montage: pick best videos + photos, interleaved
          const videos = mapped.filter((m) => m.type === 'video').slice(0, 4);
          const images = mapped.filter((m) => m.type === 'image').slice(0, 4);
          const montage: MontageItem[] = [];
          const maxLen = Math.max(videos.length, images.length);
          for (let idx = 0; idx < maxLen; idx++) {
            if (idx < videos.length) montage.push({ url: videos[idx].file_url, type: 'video' });
            if (idx < images.length) montage.push({ url: images[idx].file_url, type: 'image' });
          }
          // Also add gallery images if available
          if (studyData.gallery_urls) {
            studyData.gallery_urls.slice(0, 3).forEach((url) => {
              montage.push({ url, type: 'image' });
            });
          }
          setHeroMedia(montage.slice(0, 8));
        }
      }

      // Fetch related case studies
      const { data: related } = await supabase
        .from('case_studies')
        .select(`
          slug, title, brand_name, category, hero_stat, hero_stat_label,
          brand:brands!case_studies_brand_id_fkey ( logo_url, primary_color )
        `)
        .eq('published', true)
        .neq('slug', slug)
        .limit(3);

      if (related) {
        setRelatedStudies(related as RelatedStudy[]);
      }

      setLoading(false);
    }
    fetchStudy();
  }, [slug]);

  const brandColor = study?.brand?.primary_color || '#D73F09';
  const brandLogo = study?.brand?.logo_url || study?.brand_logo_url;

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <PublicNav variant="dark" />
        <div className="pt-28 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-transparent animate-spin" />
            <div className="text-white/20 text-sm">Loading case study...</div>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (notFound || !study) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <PublicNav variant="dark" />
        <div className="pt-28 text-center px-6">
          <h1 className="text-2xl font-bold text-white mb-4">
            Case Study Not Found
          </h1>
          <p className="text-sm text-white/40 mb-8">
            This case study may not be published yet.
          </p>
          <Link
            href="/case-studies"
            className="text-[#D73F09] text-sm font-semibold hover:underline"
          >
            &larr; Back to all case studies
          </Link>
        </div>
      </div>
    );
  }

  const initials = study.brand_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicNav variant="dark" />

      {/* ====== HERO ====== */}
      <section className="relative pt-20 pb-20 px-6 overflow-hidden" style={{ minHeight: heroMedia.length > 0 ? '70vh' : undefined }}>
        {/* Background — montage if we have media, gradient fallback otherwise */}
        {heroMedia.length > 0 ? (
          <HeroMontage items={heroMedia} brandColor={brandColor} />
        ) : (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-0 left-0 right-0 h-[500px]"
              style={{
                background: `linear-gradient(180deg, ${brandColor}12 0%, ${brandColor}06 40%, transparent 100%)`,
              }}
            />
            <div
              className="absolute top-16 left-[8%] w-80 h-80 rounded-full blur-[150px] opacity-15"
              style={{ backgroundColor: brandColor }}
            />
            <div
              className="absolute top-32 right-[12%] w-48 h-48 rounded-full blur-[100px] opacity-10"
              style={{ backgroundColor: brandColor }}
            />
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '80px 80px',
              }}
            />
          </div>
        )}

        <div className="relative max-w-5xl mx-auto">
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-2 text-[11px] text-white/25 hover:text-white/50 transition-colors mb-10 tracking-wider uppercase font-semibold"
          >
            &larr; All Case Studies
          </Link>

          {/* Brand badge + category */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-full pl-1.5 pr-4 py-1.5">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={study.brand_name}
                  className="w-9 h-9 object-contain rounded-full bg-white/5 p-1"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}15` }}
                >
                  <span className="text-sm font-bold" style={{ color: brandColor }}>
                    {initials}
                  </span>
                </div>
              )}
              <span className="text-sm font-semibold text-white">
                {study.brand_name}
              </span>
            </div>

            {study.category && (
              <span
                className="text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full border"
                style={{
                  color: `${brandColor}90`,
                  borderColor: `${brandColor}25`,
                  backgroundColor: `${brandColor}08`,
                }}
              >
                {study.category}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-8 leading-[1.05] max-w-4xl">
            {study.title}
          </h1>

          {/* Hero stat */}
          {study.hero_stat && (
            <div className="flex items-end gap-4 mb-10">
              <span
                className="text-7xl sm:text-8xl lg:text-9xl font-black leading-none"
                style={{ color: brandColor }}
              >
                {study.hero_stat}
              </span>
              <span className="text-sm text-white/35 uppercase tracking-[0.15em] font-bold pb-3">
                {study.hero_stat_label}
              </span>
            </div>
          )}

          {/* Tags */}
          {study.tags && study.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {study.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/[0.08] text-white/25 hover:text-white/40 hover:border-white/15 transition-all duration-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ====== HERO IMAGE (fallback when no montage) ====== */}
      {heroMedia.length === 0 && study.image_url && (
        <section className="max-w-6xl mx-auto px-6 mb-20">
          <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-black/50">
            <img
              src={study.image_url}
              alt={study.title}
              className="w-full object-cover max-h-[500px]"
            />
          </div>
        </section>
      )}

      {/* ====== OVERVIEW ====== */}
      {study.overview && (
        <section className="max-w-4xl mx-auto px-6 mb-16">
          <div className="relative">
            <div
              className="absolute -left-4 top-0 bottom-0 w-1 rounded-full"
              style={{ backgroundColor: `${brandColor}30` }}
            />
            <p className="text-lg sm:text-xl text-white/60 leading-relaxed pl-6 font-light">
              {study.overview}
            </p>
          </div>
        </section>
      )}

      {/* ====== METRICS GRID ====== */}
      {study.metrics && Object.keys(study.metrics).length > 0 && (
        <section className="max-w-5xl mx-auto px-6 mb-20">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(study.metrics).map(([key, value]) => (
              <MetricCard
                key={key}
                label={key}
                value={String(value)}
                brandColor={brandColor}
              />
            ))}
          </div>
        </section>
      )}

      {/* ====== CONTENT SECTIONS ====== */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        {/* Challenge */}
        {study.challenge && (
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
              >
                01
              </div>
              <div
                className="text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ color: brandColor }}
              >
                The Challenge
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              What they needed
            </h2>
            <div className="text-sm sm:text-base text-white/45 leading-relaxed">
              {study.challenge}
            </div>
          </div>
        )}

        {/* Solution */}
        {study.solution && (
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
              >
                02
              </div>
              <div
                className="text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ color: brandColor }}
              >
                The Solution
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              How we delivered
            </h2>
            <div className="text-sm sm:text-base text-white/45 leading-relaxed">
              {study.solution}
            </div>
          </div>
        )}

        {/* Inline Campaign Media — between solution and results */}
        {campaignMedia.length > 0 && (
          <InlineMediaEmbed media={campaignMedia} brandColor={brandColor} />
        )}

        {/* Results */}
        {study.results && (
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
              >
                03
              </div>
              <div
                className="text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ color: brandColor }}
              >
                The Results
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              What happened
            </h2>
            <div className="text-sm sm:text-base text-white/45 leading-relaxed">
              {study.results}
            </div>
          </div>
        )}

        {/* Body HTML */}
        {study.body_html && (
          <div
            className="prose prose-invert prose-sm max-w-none mb-12 text-white/45"
            dangerouslySetInnerHTML={{ __html: study.body_html }}
          />
        )}
      </section>

      {/* ====== QUOTE ====== */}
      {study.quote_text && (
        <section className="max-w-4xl mx-auto px-6 mb-20">
          <div
            className="relative rounded-2xl p-8 sm:p-10 overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${brandColor}08 0%, ${brandColor}04 100%)`,
              border: `1px solid ${brandColor}15`,
            }}
          >
            <div
              className="absolute top-4 left-6 text-6xl font-black opacity-10 leading-none"
              style={{ color: brandColor }}
            >
              &ldquo;
            </div>
            <div className="relative">
              <p className="text-lg sm:text-xl text-white/60 italic leading-relaxed mb-4 pl-2">
                {study.quote_text}
              </p>
              {study.quote_attribution && (
                <div className="flex items-center gap-2 pl-2">
                  <div
                    className="w-6 h-[2px] rounded-full"
                    style={{ backgroundColor: brandColor }}
                  />
                  <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                    {study.quote_attribution}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ====== HIGHLIGHTS ====== */}
      {study.highlights && study.highlights.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 mb-20">
          <div
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-6"
            style={{ color: brandColor }}
          >
            Key Highlights
          </div>
          <div className="space-y-3">
            {study.highlights.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-4 bg-[#111] border border-white/[0.06] rounded-xl p-4 hover:border-white/10 transition-colors duration-300"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                  style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
                >
                  {i + 1}
                </div>
                <span className="text-sm text-white/50 leading-relaxed pt-1">
                  {h}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====== ATHLETES ====== */}
      {study.athlete_names && study.athlete_names.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 mb-20">
          <div
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-6"
            style={{ color: brandColor }}
          >
            Athletes Featured
          </div>
          <div className="flex flex-wrap gap-2">
            {study.athlete_names.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-[#111] border border-white/[0.06] rounded-full pl-1.5 pr-4 py-1.5 hover:border-white/15 transition-colors duration-300"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
                >
                  {name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-xs text-white/50 font-medium">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====== VIDEO ====== */}
      {study.video_url && (
        <section className="max-w-5xl mx-auto px-6 mb-20">
          <div
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
            style={{ color: brandColor }}
          >
            Campaign Video
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-black/50">
            <video
              src={study.video_url}
              controls
              className="w-full"
              poster={study.image_url || undefined}
            />
          </div>
        </section>
      )}

      {/* ====== GALLERY ====== */}
      {study.gallery_urls && study.gallery_urls.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 mb-20">
          <div
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-6"
            style={{ color: brandColor }}
          >
            Gallery
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {study.gallery_urls.map((url, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden border border-white/[0.06] aspect-[4/5] group"
              >
                <img
                  src={url}
                  alt={`${study.title} gallery ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====== RELATED CASE STUDIES ====== */}
      {relatedStudies.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 mb-20">
          <div className="flex items-center justify-between mb-6">
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{ color: brandColor }}
            >
              More Case Studies
            </div>
            <Link
              href="/case-studies"
              className="text-[11px] text-white/25 hover:text-white/50 transition-colors font-semibold uppercase tracking-wider"
            >
              View All &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {relatedStudies.map((s) => (
              <RelatedCard key={s.slug} study={s} />
            ))}
          </div>
        </section>
      )}

      {/* ====== CTA ====== */}
      <section className="relative overflow-hidden py-24 px-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D73F09] via-[#C53508] to-[#A52D07]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative max-w-lg mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Want results like {study.brand_name}?
          </h2>
          <p className="text-sm text-white/80 mb-10 leading-relaxed">
            Let&apos;s build your next athlete influencer campaign together.
          </p>
          <a
            href="https://www.home.pstgm.com/contactus"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-[#D73F09] font-bold text-sm px-10 py-4 rounded-xl hover:bg-white/90 hover:scale-105 transition-all duration-300 shadow-lg shadow-black/20"
          >
            Get Started &rarr;
          </a>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="bg-black py-12 px-6 text-center border-t border-white/5">
        <div className="text-sm font-medium tracking-[0.15em] mb-3">
          P<span className="text-[#D73F09]">+</span>STGAME
        </div>
        <div className="text-[11px] text-white/25 max-w-md mx-auto leading-relaxed">
          Postgame&trade; manages the largest sports marketing and influencer
          campaigns in college sports. Headquartered in Sarasota, FL with
          offices in Philadelphia and Tampa.
        </div>
        <div className="text-[10px] text-white/15 mt-4">
          &copy; {new Date().getFullYear()} Postgame, LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
