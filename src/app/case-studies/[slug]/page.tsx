// ============================================================
// Case Study Detail Page — /case-studies/[slug]
//
// Public-facing detail page for individual case studies.
// Shows: hero with brand logo + stat, overview, challenge,
// solution, results, metrics grid, gallery, and CTA.
//
// Matches the dark premium design of /clients.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
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

// ---- Section Component ----
// Reusable block for Challenge / Solution / Results sections.

function ContentSection({
  label,
  title,
  content,
  brandColor,
}: {
  label: string;
  title: string;
  content: string;
  brandColor: string;
}) {
  return (
    <div className="mb-12">
      <div
        className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
        style={{ color: brandColor }}
      >
        {label}
      </div>
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="text-sm text-white/50 leading-relaxed whitespace-pre-line">
        {content}
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function CaseStudyDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [study, setStudy] = useState<CaseStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchStudy() {
      if (!slug) return;
      const supabase = createBrowserSupabase();
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
      } else {
        setStudy(data as CaseStudy);
      }
      setLoading(false);
    }
    fetchStudy();
  }, [slug]);

  const brandColor = study?.brand?.primary_color || '#D73F09';
  const brandLogo = study?.brand?.logo_url || study?.brand_logo_url;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <PublicNav variant="dark" />
        <div className="pt-28 flex items-center justify-center">
          <div className="text-white/20 text-sm">Loading...</div>
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
            ← Back to all case studies
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
      <section className="relative pt-24 pb-16 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-0 right-0 h-[400px]"
            style={{
              background: `linear-gradient(180deg, ${brandColor}10 0%, transparent 100%)`,
            }}
          />
          <div
            className="absolute top-20 left-[10%] w-64 h-64 rounded-full blur-[120px] opacity-20"
            style={{ backgroundColor: brandColor }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Back link */}
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-2 text-[11px] text-white/30 hover:text-white/60 transition-colors mb-8"
          >
            ← Back to case studies
          </Link>

          {/* Brand row */}
          <div className="flex items-center gap-3 mb-6">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={study.brand_name}
                className="w-12 h-12 object-contain rounded-lg bg-white/5 p-1.5"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${brandColor}15` }}
              >
                <span
                  className="text-lg font-bold"
                  style={{ color: brandColor }}
                >
                  {initials}
                </span>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-white">
                {study.brand_name}
              </div>
              {study.category && (
                <div className="text-[10px] text-white/30 uppercase tracking-wider">
                  {study.category}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-6 leading-tight">
            {study.title}
          </h1>

          {/* Hero stat */}
          {study.hero_stat && (
            <div className="flex items-baseline gap-3 mb-8">
              <span
                className="text-5xl sm:text-6xl font-black"
                style={{ color: brandColor }}
              >
                {study.hero_stat}
              </span>
              <span className="text-sm text-white/40 uppercase tracking-wider font-semibold">
                {study.hero_stat_label}
              </span>
            </div>
          )}

          {/* Tags */}
          {study.tags && study.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {study.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-semibold px-3 py-1 rounded-full border border-white/10 text-white/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ====== HERO IMAGE ====== */}
      {study.image_url && (
        <section className="max-w-5xl mx-auto px-6 mb-16">
          <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
            <img
              src={study.image_url}
              alt={study.title}
              className="w-full object-cover"
            />
          </div>
        </section>
      )}

      {/* ====== CONTENT ====== */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        {/* Overview */}
        {study.overview && (
          <div className="mb-12 pb-12 border-b border-white/[0.06]">
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
              style={{ color: brandColor }}
            >
              Overview
            </div>
            <p className="text-base text-white/60 leading-relaxed">
              {study.overview}
            </p>
          </div>
        )}

        {/* Challenge */}
        {study.challenge && (
          <ContentSection
            label="The Challenge"
            title="What they needed"
            content={study.challenge}
            brandColor={brandColor}
          />
        )}

        {/* Solution */}
        {study.solution && (
          <ContentSection
            label="The Solution"
            title="How we delivered"
            content={study.solution}
            brandColor={brandColor}
          />
        )}

        {/* Results */}
        {study.results && (
          <ContentSection
            label="The Results"
            title="What happened"
            content={study.results}
            brandColor={brandColor}
          />
        )}

        {/* Body HTML (if any extra content) */}
        {study.body_html && (
          <div
            className="prose prose-invert prose-sm max-w-none mb-12 text-white/50"
            dangerouslySetInnerHTML={{ __html: study.body_html }}
          />
        )}

        {/* Quote */}
        {study.quote_text && (
          <div className="mb-12 py-8 px-6 border-l-4 rounded-r-xl bg-white/[0.02]" style={{ borderColor: brandColor }}>
            <p className="text-base text-white/60 italic leading-relaxed mb-3">
              &ldquo;{study.quote_text}&rdquo;
            </p>
            {study.quote_attribution && (
              <div className="text-[11px] text-white/30 font-semibold">
                — {study.quote_attribution}
              </div>
            )}
          </div>
        )}

        {/* Metrics grid */}
        {study.metrics && Object.keys(study.metrics).length > 0 && (
          <div className="mb-12">
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
              style={{ color: brandColor }}
            >
              Key Metrics
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(study.metrics).map(([key, value]) => (
                <div
                  key={key}
                  className="bg-[#111] border border-white/[0.06] rounded-xl p-4 text-center"
                >
                  <div className="text-xl font-black text-white mb-1">
                    {String(value)}
                  </div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wider">
                    {key.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {study.highlights && study.highlights.length > 0 && (
          <div className="mb-12">
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
              style={{ color: brandColor }}
            >
              Highlights
            </div>
            <div className="space-y-2">
              {study.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm text-white/50"
                >
                  <span style={{ color: brandColor }} className="mt-0.5">
                    ✦
                  </span>
                  {h}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Athletes */}
        {study.athlete_names && study.athlete_names.length > 0 && (
          <div className="mb-12">
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
              style={{ color: brandColor }}
            >
              Athletes Featured
            </div>
            <div className="flex flex-wrap gap-2">
              {study.athlete_names.map((name) => (
                <span
                  key={name}
                  className="text-[11px] text-white/40 bg-white/5 px-3 py-1.5 rounded-full"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Video */}
        {study.video_url && (
          <div className="mb-12">
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
              style={{ color: brandColor }}
            >
              Campaign Video
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
              <video
                src={study.video_url}
                controls
                className="w-full"
                poster={study.image_url || undefined}
              />
            </div>
          </div>
        )}

        {/* Gallery */}
        {study.gallery_urls && study.gallery_urls.length > 0 && (
          <div className="mb-12">
            <div
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
              style={{ color: brandColor }}
            >
              Gallery
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {study.gallery_urls.map((url, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden border border-white/[0.06] aspect-square"
                >
                  <img
                    src={url}
                    alt={`${study.title} gallery ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ====== CTA ====== */}
      <section className="relative overflow-hidden py-20 px-6 text-center">
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
        <div className="relative">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Want results like {study.brand_name}?
          </h2>
          <p className="text-sm text-white/80 mb-8 max-w-md mx-auto">
            Let&apos;s build your next athlete influencer campaign together.
          </p>
          <a
            href="https://www.home.pstgm.com/contactus"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-[#D73F09] font-bold text-sm px-8 py-3.5 rounded-lg hover:bg-white/90 hover:scale-105 transition-all duration-300"
          >
            Get Started →
          </a>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="bg-black py-10 px-6 text-center border-t border-white/5">
        <div className="text-sm font-medium tracking-[0.15em] mb-3">
          P<span className="text-[#D73F09]">+</span>STGAME
        </div>
        <div className="text-[11px] text-white/25 max-w-md mx-auto leading-relaxed">
          Postgame™ manages the largest sports marketing and influencer
          campaigns in college sports. Headquartered in Sarasota, FL with
          offices in Philadelphia and Tampa.
        </div>
        <div className="text-[10px] text-white/15 mt-4">
          © {new Date().getFullYear()} Postgame, LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
