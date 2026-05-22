// ============================================================
// Brand Campaign Gallery — /clients/[slug]
//
// Shows every campaign a brand has run with Postgame.
// Each campaign is a card with the hero image / video.
//
// Data flow:
//   1. The [slug] from the URL maps to a brand in brands.ts
//   2. We query the Supabase "campaigns" table for that brand
//   3. We also pull any .mp4 video files from storage for each
//      campaign so they can play on hover
//
// This is a public page — no auth required.
// ============================================================

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import { getBrandBySlug, type Brand } from '@/lib/data/brands';
import { createBrowserSupabase } from '@/lib/supabase';

// ---- Types ----

// A campaign object from the Supabase "campaigns" table.
// Think of it like one project or shoot the brand did with Postgame.
interface Campaign {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  tags: string[];
  media_type: string | null;
  created_at: string;
}

// A media file (photo or video) inside a campaign's storage folder.
interface CampaignMedia {
  name: string;        // file path inside the bucket
  url: string;         // full public URL
  isVideo: boolean;    // true if .mp4
}

// ---- Campaign Card ----
// Shows one campaign as a large card with the hero image.
// If there's a video, it plays faintly on hover behind the image.

function CampaignCard({
  campaign,
  videos,
  brandColor,
}: {
  campaign: Campaign;
  videos: CampaignMedia[];
  brandColor: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  // The first video for this campaign (if any)
  const heroVideo = videos.length > 0 ? videos[0] : null;

  // The image to show — either the hero_image_url or thumbnail_url
  const heroImage = campaign.hero_image_url || campaign.thumbnail_url;

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.02]"
      style={{ aspectRatio: '16 / 10' }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (videoRef.current) videoRef.current.play().catch(() => {});
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (videoRef.current) videoRef.current.pause();
      }}
    >
      {/* Base gradient background using brand color */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${brandColor}22 0%, #0a0a0a 40%, ${brandColor}15 70%, #0a0a0a 100%)`,
        }}
      />

      {/* Hero image */}
      {heroImage && !imgError && (
        <img
          src={heroImage}
          alt={campaign.name}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      )}

      {/* Video overlay — plays on hover */}
      {heroVideo && (
        <video
          ref={videoRef}
          src={heroVideo.url}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-[2]"
        />
      )}

      {/* Dark gradient at the bottom so text is readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-[3]" />

      {/* Campaign info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-[4]">
        <h3 className="text-lg font-bold text-white mb-1">{campaign.name}</h3>
        {campaign.description && (
          <p className="text-sm text-white/60 line-clamp-2">{campaign.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3">
          {campaign.status === 'published' && (
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full bg-white/10 text-white/70">
              Published
            </span>
          )}
          {heroVideo && (
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full bg-white/10 text-white/70 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Video
            </span>
          )}
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/40">
            {new Date(campaign.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Hover border glow */}
      <div
        className="absolute inset-0 rounded-2xl border border-white/[0.06] group-hover:border-opacity-100 transition-all duration-500 z-[5] pointer-events-none"
        style={{
          borderColor: isHovered ? `${brandColor}40` : 'rgba(255,255,255,0.06)',
        }}
      />
    </div>
  );
}

// ---- Empty State ----
// Shown when a brand has no campaigns yet.

function EmptyState({ brandName }: { brandName: string }) {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-white/40 text-sm">
        Campaign content for {brandName} is coming soon.
      </p>
    </div>
  );
}

// ---- Main Page ----

export default function BrandGalleryPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Look up the brand from our local data file
  const brand = getBrandBySlug(slug);

  // State for campaigns fetched from Supabase
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignVideos, setCampaignVideos] = useState<Record<string, CampaignMedia[]>>({});
  const [loading, setLoading] = useState(true);

  // Fetch campaigns from Supabase when the page loads
  useEffect(() => {
    if (!brand) {
      setLoading(false);
      return;
    }

    async function fetchCampaigns() {
      const supabase = createBrowserSupabase();

      // Step 1: Find the brand in the Supabase "brands" table by matching name
      // (our brands.ts names should match the client_name in campaigns)
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .ilike('client_name', brand!.name)
        .order('created_at', { ascending: false });

      if (!campaignData || campaignData.length === 0) {
        // Try matching via the brands table slug
        const { data: dbBrand } = await supabase
          .from('brands')
          .select('id')
          .ilike('slug', slug)
          .single();

        if (dbBrand) {
          const { data: brandCampaigns } = await supabase
            .from('campaigns')
            .select('*')
            .eq('brand_id', dbBrand.id)
            .order('created_at', { ascending: false });

          if (brandCampaigns) {
            setCampaigns(brandCampaigns);
            await fetchVideosForCampaigns(brandCampaigns, supabase);
          }
        }
        setLoading(false);
        return;
      }

      setCampaigns(campaignData);
      await fetchVideosForCampaigns(campaignData, supabase);
      setLoading(false);
    }

    // Step 2: For each campaign, check if there are .mp4 video files in storage
    async function fetchVideosForCampaigns(campaigns: Campaign[], supabase: any) {
      const CM = 'https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media';
      const videoMap: Record<string, CampaignMedia[]> = {};

      for (const c of campaigns) {
        const { data: files } = await supabase
          .storage
          .from('campaign-media')
          .list(c.id, { limit: 100 });

        if (!files) continue;

        // Check subfolders for video files
        const videos: CampaignMedia[] = [];
        for (const folder of files) {
          if (folder.id === null) {
            // It's a subfolder — check inside it
            const { data: subFiles } = await supabase
              .storage
              .from('campaign-media')
              .list(`${c.id}/${folder.name}`, { limit: 50 });

            if (subFiles) {
              for (const f of subFiles) {
                if (f.name?.endsWith('.mp4')) {
                  videos.push({
                    name: f.name,
                    url: `${CM}/${c.id}/${folder.name}/${f.name}`,
                    isVideo: true,
                  });
                }
              }
            }
          }
        }

        if (videos.length > 0) {
          videoMap[c.id] = videos;
        }
      }

      setCampaignVideos(videoMap);
    }

    fetchCampaigns();
  }, [brand, slug]);

  // ---- 404 — brand not found ----
  if (!brand) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <PublicNav variant="dark" />
        <div className="pt-32 text-center">
          <h1 className="text-3xl font-bold mb-4">Brand not found</h1>
          <p className="text-white/40 mb-8">We couldn&apos;t find a brand with that name.</p>
          <Link href="/clients" className="text-[#D73F09] hover:underline text-sm">
            ← Back to all clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicNav variant="dark" />

      {/* ---- Brand Header ---- */}
      <div className="relative pt-28 pb-12 px-6 overflow-hidden">
        {/* Subtle glow behind the header */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: `${brand.primaryColor}08`, filter: 'blur(120px)' }}
        />

        <div className="relative max-w-5xl mx-auto">
          {/* Back link */}
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Clients
          </Link>

          {/* Brand logo + name */}
          <div className="flex items-center gap-6">
            {brand.logoUrl ? (
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="max-w-full max-h-full object-contain drop-shadow-lg"
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black tracking-wider"
                style={{ color: `${brand.primaryColor}60`, background: `${brand.primaryColor}10` }}
              >
                {brand.initials}
              </div>
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">{brand.name}</h1>
              <p className="text-sm text-white/40 mt-1 tracking-wide uppercase">{brand.category}</p>
            </div>
          </div>

          {/* Campaign count */}
          {!loading && campaigns.length > 0 && (
            <p className="mt-6 text-sm text-white/30">
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} with Postgame
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ---- Campaign Grid ---- */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        {loading ? (
          <div className="text-center py-24">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#D73F09] rounded-full animate-spin mx-auto" />
            <p className="text-white/30 text-sm mt-4">Loading campaigns…</p>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState brandName={brand.name} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/clients/${slug}/${campaign.slug}`}>
                <CampaignCard
                  campaign={campaign}
                  videos={campaignVideos[campaign.id] || []}
                  brandColor={brand.primaryColor}
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="h-px bg-white/[0.06] mb-8" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} Postgame
          </p>
          <Link href="/clients" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            ← Back to all clients
          </Link>
        </div>
      </div>
    </div>
  );
}
