// ============================================================
// Public Creator Brief — /creator-brief/[slug]
// No auth required. Renders a published creator_briefs row as a
// numbered mood-board. Server component (force-dynamic so we always
// serve the latest published content without manual revalidation).
// ============================================================

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createPlainSupabase } from '@/lib/supabase';
import type { CreatorBrief, CreatorBriefSection } from '@/lib/types/briefs';
import BriefSections from './sections';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { slug: string };
}

async function loadBrief(slug: string): Promise<CreatorBrief | null> {
  const supabase = createPlainSupabase();
  const { data } = await supabase
    .from('creator_briefs')
    .select('*, brand:brands(id, name)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();
  return (data as CreatorBrief) || null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brief = await loadBrief(params.slug);
  if (!brief) {
    return { title: 'Brief Not Found' };
  }
  return {
    title: `${brief.title} — Creator Brief`,
    description: brief.athlete_name
      ? `Postgame creator brief for ${brief.athlete_name}.`
      : 'Postgame creator brief.',
  };
}

export default async function PublicCreatorBriefPage({ params }: Props) {
  const brief = await loadBrief(params.slug);
  if (!brief) {
    notFound();
  }

  const brandColor = brief.brand_color || '#D73F09';
  const brandName = brief.brand?.name || 'Brand';

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#f5f5f0', color: '#1a1a1a' }}
    >
      {/* Hero */}
      <header className="px-6 sm:px-10 pt-12 pb-10 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            {brief.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brief.brand_logo_url}
                alt={brandName}
                className="h-10 w-auto object-contain"
              />
            )}
            <div className="text-sm font-bold tracking-widest text-gray-500">
              POSTGAME
            </div>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white"
            style={{ backgroundColor: brandColor }}
          >
            CREATOR BRIEF
          </span>
        </div>

        <h1
          className="text-4xl sm:text-5xl font-black leading-tight tracking-tight"
          style={{ color: '#0c0c0c' }}
        >
          {brief.title}
        </h1>
        {brief.athlete_name && (
          <p className="mt-4 text-lg text-gray-600">
            Featuring <span className="font-semibold" style={{ color: brandColor }}>{brief.athlete_name}</span>
          </p>
        )}
      </header>

      {/* Sections */}
      <main className="px-6 sm:px-10 pb-20 max-w-4xl mx-auto space-y-6">
        <BriefSections
          sections={(brief.sections as CreatorBriefSection[]) || []}
          brandColor={brandColor}
        />
      </main>

      {/* Footer */}
      <footer
        className="px-6 sm:px-10 py-8 text-center text-xs text-gray-500 border-t"
        style={{ borderColor: 'rgba(0,0,0,0.08)' }}
      >
        Postgame — {brandName} {brief.campaign_brief?.name || ''} Creative Brief — Confidential
      </footer>
    </div>
  );
}
