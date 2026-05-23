// ============================================================
// Campaign Content Gallery — /clients/[slug]/[campaign]
//
// Shows all photos and videos from a single campaign.
// The [campaign] param is the campaign's slug from Supabase.
//
// Data flow:
//   1. Look up the campaign by slug in "campaign_recaps" table
//   2. Query the "media" table for that campaign_id (uses file_url)
//   3. Fall back to Supabase Storage listing if no media rows exist
//   4. Display hero slideshow + responsive grid — videos playable
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

// One media file (photo or video) from the campaign
interface MediaItem {
  url: string;
  filename: string;    // human-readable label
  isVideo: boolean;
  sizeBytes: number;
}

// ---- Hero Slideshow ----
// Shows up to 6 rotating campaign photos above the gallery grid.

function HeroSlideshow({ images }: { images: MediaItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.06]" style={{ aspectRatio: '21 / 9' }}>
      {images.map((img, i) => (
        <img
          key={img.url}
          src={img.url}
          alt={img.filename}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === activeIndex ? 1 : 0 }}
          loading={i <= 1 ? 'eager' : 'lazy'}
          onError={(e) => {
            // Hide broken images so the slideshow skips them visually
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}

      {/* Gradient overlay for polish */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? 'bg-white w-4' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  const [imgFailed, setImgFailed] = useState(false);

  // Don't render anything if the image failed to load
  if (!item.isVideo && imgFailed) return null;

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
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Download button — appears in top-right corner on hover */}
      <a
        href={item.url}
        download
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10 hover:bg-black/70"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </a>
    </div>
  );
}

// ---- Helper: extract a display name from a filename ----

function extractDisplayName(filename: string): string {
  let name = filename.replace(/^\d+-/, ''); // strip leading timestamp
  name = name.replace(/\.[^.]+$/, '');      // strip extension

  // If there's a " - " separator, name is after it
  if (name.includes(' - ')) {
    name = name.split(' - ').pop() || name;
  }

  return name
    .replace(/_/g, ' ')
    .replace(/\s+\d+$/, '')
    .replace(/^\d+\s*/, '')
    .replace(/^(thumb|IMG|DSC|FX)\S*\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'Campaign content';
}

// ---- Main Page ----

export default function CampaignGalleryPage() {
  const params = useParams();
  const brandSlug = params.slug as string;
  const campaignSlug = params.campaign as string;

  const brand = getBrandBySlug(brandSlug);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [heroImages, setHeroImages] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all');

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabase();

      // ── Strategy A: Look up in campaign_recaps table + media table ──
      // This is the modern path that works for Drive-imported campaigns.
      // campaign_recaps holds the campaign metadata, media table holds
      // the actual files with file_url populated.
      const { data: recapData } = await supabase
        .from('campaign_recaps')
        .select('id, name, slug, description, hero_image_url, client_name, brand_id')
        .eq('slug', campaignSlug)
        .single();

      if (recapData) {
        setCampaign(recapData);

        // Query media table for this campaign — uses file_url (the original file)
        const { data: mediaRows } = await supabase
          .from('media')
          .select('id, file_url, thumbnail_url, type, original_filename, is_video_thumbnail')
          .eq('campaign_id', recapData.id)
          .not('file_url', 'is', null)
          .order('sort_order')
          .limit(200);

        if (mediaRows && mediaRows.length > 0) {
          const items: MediaItem[] = mediaRows
            .filter((m: any) => !m.is_video_thumbnail)
            .map((m: any) => ({
              url: m.file_url,
              filename: m.original_filename
                ? extractDisplayName(m.original_filename)
                : (m.type === 'video' ? 'Video' : 'Photo'),
              isVideo: m.type === 'video',
              sizeBytes: 0,
            }));

          // Sort: videos first, then photos
          items.sort((a, b) => {
            if (a.isVideo !== b.isVideo) return a.isVideo ? -1 : 1;
            return a.filename.localeCompare(b.filename);
          });

          setMedia(items);

          // Pick hero images: up to 6 photos for the slideshow
          const photos = items.filter(i => !i.isVideo);
          setHeroImages(photos.slice(0, 6));

          setLoading(false);
          return;
        }
      }

      // ── Strategy B: Fall back to campaigns table + storage listing ──
      // This is the legacy path for campaigns that were uploaded directly
      // to Supabase Storage (not via Drive import / media table).
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('slug', campaignSlug)
        .single();

      if (!campaignData) {
        // Neither table has this slug — not found
        if (recapData) {
          // We found the recap but it had 0 media — still show the page
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }
      setCampaign(campaignData);

      // List all files in the campaign's storage folder
      const { data: folders } = await supabase
        .storage
        .from('campaign-media')
        .list(campaignData.id, { limit: 200 });

      if (!folders) { setLoading(false); return; }

      const CM = 'https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media';
      const allMedia: MediaItem[] = [];
      const seen = new Set<string>();

      for (const folder of folders) {
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

          const cleanName = f.name.replace(/^\d+-/, '');
          if (seen.has(cleanName)) continue;
          seen.add(cleanName);

          allMedia.push({
            url: `${CM}/${campaignData.id}/${folder.name}/${f.name}`,
            filename: extractDisplayName(f.name),
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

      // Hero images from storage path
      const storagePhotos = allMedia.filter(i => !i.isVideo);
      setHeroImages(storagePhotos.slice(0, 6));

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

      {/* ---- Hero Slideshow ---- */}
      {!loading && heroImages.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-6">
          <HeroSlideshow images={heroImages} />
        </div>
      )}

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
