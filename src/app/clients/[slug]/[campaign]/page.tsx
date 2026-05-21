// ============================================================
// Campaign Content Gallery — /clients/[slug]/[campaign]
//
// Shows all photos and videos from a single campaign.
// The [campaign] param is the campaign's slug from Supabase.
//
// Data flow:
//   1. Look up the campaign by slug in the "campaigns" table
//   2. List all files in the campaign's storage folder
//   3. Deduplicate (same file often uploaded multiple times)
//   4. Display in a responsive grid — videos are playable
//
// This is a public page — no auth required.
// ============================================================

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import { getBrandBySlug } from '@/lib/data/brands';
import { createBrowserSupabase } from '@/lib/supabase';

// ---- Types ----

interface Campaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hero_image_url: string | null;
  client_name: string;
  brand_id: string;
}

// One media file (photo or video) from the campaign's storage folder
interface MediaItem {
  url: string;
  filename: string;    // the human-readable part after the timestamp
  isVideo: boolean;
  sizeBytes: number;
}

// ---- Lightbox ----
// Full-screen overlay to view a photo or play a video large.

function Lightbox({
  item,
  onClose,
  onPrev,
  onNext,
}: {
  item: MediaItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Close on Escape key, navigate with arrow keys
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors z-10"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Prev button */}
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors z-10 p-2"
      >
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Next button */}
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors z-10 p-2"
      >
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Media content */}
      <div
        className="max-w-5xl max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {item.isVideo ? (
          <video
            src={item.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg"
          />
        ) : (
          <img
            src={item.url}
            alt={item.filename}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        )}
      </div>

      {/* Filename */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-wide">
        {item.filename}
      </div>
    </div>
  );
}

// ---- Gallery Tile ----
// A single photo or video in the grid.

function GalleryTile({
  item,
  onClick,
}: {
  item: MediaItem;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div
      className="group relative rounded-xl overflow-hidden cursor-pointer bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all duration-300"
      style={{ aspectRatio: item.isVideo ? '9 / 16' : '4 / 5' }}
      onClick={onClick}
      onMouseEnter={() => {
        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.play().catch(() => {});
        }
      }}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      {item.isVideo ? (
        <>
          <video
            ref={videoRef}
            src={item.url}
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Play icon — visible by default, fades out on hover when video plays */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent opacity-100 group-hover:opacity-0 transition-all duration-500">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </div>
        </>
      ) : (
        <img
          src={item.url}
          alt={item.filename}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      )}

      {/* Athlete name banner — drops down from top on hover */}
      <div className="absolute top-0 left-0 right-0 px-3 py-2 bg-gradient-to-b from-black/70 to-transparent -translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10">
        <p className="text-xs font-semibold text-white tracking-wide">{item.filename}</p>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function CampaignGalleryPage() {
  const params = useParams();
  const brandSlug = params.slug as string;
  const campaignSlug = params.campaign as string;

  const brand = getBrandBySlug(brandSlug);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all');

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabase();

      // Step 1: Find the campaign by slug
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('slug', campaignSlug)
        .single();

      if (!campaignData) {
        setLoading(false);
        return;
      }
      setCampaign(campaignData);

      // Step 2: List all files in the campaign's storage folder
      // Structure: campaign-id / creator-id / timestamp-filename.ext
      const { data: folders } = await supabase
        .storage
        .from('campaign-media')
        .list(campaignData.id, { limit: 200 });

      if (!folders) { setLoading(false); return; }

      const CM = 'https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media';
      const allMedia: MediaItem[] = [];
      const seen = new Set<string>(); // for deduplication

      for (const folder of folders) {
        // Skip non-folder entries (files at root level)
        if (folder.metadata && folder.metadata.size) continue;

        const { data: files } = await supabase
          .storage
          .from('campaign-media')
          .list(`${campaignData.id}/${folder.name}`, { limit: 100 });

        if (!files) continue;

        for (const f of files) {
          if (!f.name || !f.metadata) continue;
          const mime = f.metadata.mimetype as string || '';
          if (!mime.startsWith('image/') && !mime.startsWith('video/')) continue;

          // Extract athlete name from filename
          // Files look like: 1774484911966-Jonathan_Ward_2.mp4
          // We strip the timestamp, file extension, underscores, and trailing numbers
          const cleanName = f.name.replace(/^\d+-/, '');

          // Deduplicate by clean filename
          if (seen.has(cleanName)) continue;
          seen.add(cleanName);

          // Turn "Jonathan_Ward_2.mp4" into "Jonathan Ward"
          const athleteName = cleanName
            .replace(/\.[^.]+$/, '')   // remove extension
            .replace(/_/g, ' ')        // underscores to spaces
            .replace(/\s+\d+$/, '')    // remove trailing number like " 2"
            .replace(/\s+/g, ' ')      // clean up extra spaces
            .trim();

          allMedia.push({
            url: `${CM}/${campaignData.id}/${folder.name}/${f.name}`,
            filename: athleteName,
            isVideo: mime.startsWith('video/'),
            sizeBytes: (f.metadata.size as number) || 0,
          });
        }
      }

      // Sort: videos first, then photos, both by filename
      allMedia.sort((a, b) => {
        if (a.isVideo !== b.isVideo) return a.isVideo ? -1 : 1;
        return a.filename.localeCompare(b.filename);
      });

      setMedia(allMedia);
      setLoading(false);
    }

    load();
  }, [campaignSlug]);

  // Filtered media based on toggle
  const filteredMedia = media.filter((m) => {
    if (filter === 'photos') return !m.isVideo;
    if (filter === 'videos') return m.isVideo;
    return true;
  });

  const videoCount = media.filter((m) => m.isVideo).length;
  const photoCount = media.filter((m) => !m.isVideo).length;

  // Lightbox navigation
  const openLightbox = useCallback((i: number) => setLightboxIndex(i), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevItem = useCallback(() => {
    setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : (filteredMedia.length - 1)));
  }, [filteredMedia.length]);
  const nextItem = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i + 1) % filteredMedia.length : 0));
  }, [filteredMedia.length]);

  // ---- 404 states ----
  if (!brand) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <PublicNav variant="dark" />
        <div className="pt-32 text-center">
          <h1 className="text-3xl font-bold mb-4">Brand not found</h1>
          <Link href="/clients" className="text-[#D73F09] hover:underline text-sm">← Back to all clients</Link>
        </div>
      </div>
    );
  }

  if (!loading && !campaign) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <PublicNav variant="dark" />
        <div className="pt-32 text-center">
          <h1 className="text-3xl font-bold mb-4">Campaign not found</h1>
          <Link href={`/clients/${brandSlug}`} className="text-[#D73F09] hover:underline text-sm">
            ← Back to {brand.name}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicNav variant="dark" />

      {/* ---- Header ---- */}
      <div className="relative pt-28 pb-8 px-6 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{ background: `${brand.primaryColor}06`, filter: 'blur(120px)' }}
        />

        <div className="relative max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/40 mb-8">
            <Link href="/clients" className="hover:text-white/70 transition-colors">Clients</Link>
            <span>/</span>
            <Link href={`/clients/${brandSlug}`} className="hover:text-white/70 transition-colors">{brand.name}</Link>
            <span>/</span>
            <span className="text-white/60">{campaign?.name || '...'}</span>
          </div>

          {/* Campaign title */}
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            {campaign?.name || 'Loading...'}
          </h1>

          {campaign?.description && (
            <p className="text-sm text-white/50 max-w-2xl leading-relaxed mb-4">
              {campaign.description}
            </p>
          )}

          {/* Stats + filter */}
          {!loading && (
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={() => setFilter('all')}
                className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all ${
                  filter === 'all'
                    ? 'bg-[#D73F09] border-[#D73F09] text-white'
                    : 'bg-transparent border-white/20 text-white/50 hover:border-white/40'
                }`}
              >
                All ({media.length})
              </button>
              {photoCount > 0 && (
                <button
                  onClick={() => setFilter('photos')}
                  className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all ${
                    filter === 'photos'
                      ? 'bg-[#D73F09] border-[#D73F09] text-white'
                      : 'bg-transparent border-white/20 text-white/50 hover:border-white/40'
                  }`}
                >
                  Photos ({photoCount})
                </button>
              )}
              {videoCount > 0 && (
                <button
                  onClick={() => setFilter('videos')}
                  className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all ${
                    filter === 'videos'
                      ? 'bg-[#D73F09] border-[#D73F09] text-white'
                      : 'bg-transparent border-white/20 text-white/50 hover:border-white/40'
                  }`}
                >
                  Videos ({videoCount})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ---- Gallery Grid ---- */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-24">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#D73F09] rounded-full animate-spin mx-auto" />
            <p className="text-white/30 text-sm mt-4">Loading campaign media…</p>
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/40 text-sm">No media files found for this campaign yet.</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {filteredMedia.map((item, i) => (
              <div key={item.url} className="break-inside-avoid">
                <GalleryTile item={item} onClick={() => openLightbox(i)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="h-px bg-white/[0.06] mb-8" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/20">© {new Date().getFullYear()} Postgame</p>
          <Link href={`/clients/${brandSlug}`} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            ← Back to {brand.name}
          </Link>
        </div>
      </div>

      {/* ---- Lightbox ---- */}
      {lightboxIndex !== null && filteredMedia[lightboxIndex] && (
        <Lightbox
          item={filteredMedia[lightboxIndex]}
          onClose={closeLightbox}
          onPrev={prevItem}
          onNext={nextItem}
        />
      )}
    </div>
  );
}
