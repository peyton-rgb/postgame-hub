// ============================================================
// Hero Editor — /dashboard/website/campaigns/[id]/hero
//
// Visual editor for choosing which photos/videos appear in the
// campaign hero banner on the live website and how they're
// positioned & scaled.
//
// Left panel: all campaign media thumbnails — click to toggle
// Right panel: preview of selected hero with drag-to-reposition
// and scale slider controls.
//
// Note: This is the WEBSITE campaign page hero editor, NOT the
// internal recaps/metrics system.
// ============================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardContent from '@/components/DashboardContent';

// ---- Types ----

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  file_url: string;
  thumbnail_url: string | null;
  focal_x: number | null;
  focal_y: number | null;
  hero_scale: number | null;
  is_hero: boolean;
  hero_order: number;
  resolution: string | null;
}

interface HeroSelection {
  id: string;
  focal_x: number;
  focal_y: number;
  hero_scale: number;
  hero_order: number;
}

// ---- Position Editor ----
// Lets you drag the image inside a preview frame to set focal point,
// and a slider to control zoom/scale.

function PositionEditor({
  item,
  selection,
  onChange,
}: {
  item: MediaItem;
  selection: HeroSelection;
  onChange: (updates: Partial<HeroSelection>) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      // Convert pointer position to 0..1 focal point
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onChange({ focal_x: Math.round(x * 100) / 100, focal_y: Math.round(y * 100) / 100 });
    },
    [dragging, onChange]
  );

  const handlePointerUp = useCallback(() => setDragging(false), []);

  const src = item.type === 'video' ? (item.thumbnail_url || item.file_url) : item.file_url;

  return (
    <div className="space-y-3">
      {/* Preview frame — shows how the image will look in the hero */}
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-lg border-2 border-white/20 cursor-crosshair select-none"
        style={{ aspectRatio: '16/7' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Hero preview"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{
            objectPosition: `${(selection.focal_x * 100).toFixed(0)}% ${(selection.focal_y * 100).toFixed(0)}%`,
            transform: `scale(${selection.hero_scale})`,
          }}
          draggable={false}
        />

        {/* Focal point crosshair */}
        <div
          className="absolute w-6 h-6 border-2 border-[#D73F09] rounded-full pointer-events-none"
          style={{
            left: `${selection.focal_x * 100}%`,
            top: `${selection.focal_y * 100}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 2px rgba(0,0,0,0.5), 0 0 12px rgba(215,63,9,0.6)',
          }}
        >
          <div className="absolute inset-[6px] bg-[#D73F09] rounded-full" />
        </div>

        {/* Crosshair lines */}
        <div
          className="absolute h-px w-full bg-[#D73F09]/30 pointer-events-none"
          style={{ top: `${selection.focal_y * 100}%` }}
        />
        <div
          className="absolute w-px h-full bg-[#D73F09]/30 pointer-events-none"
          style={{ left: `${selection.focal_x * 100}%` }}
        />

        {/* Instructions overlay */}
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <span
            className="inline-block px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 rounded"
            style={{ background: 'rgba(0,0,0,0.6)', fontFamily: 'var(--font-mono)' }}
          >
            Click or drag to set focal point
          </span>
        </div>

        {item.type === 'video' && (
          <span
            className="absolute top-2 left-2 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white rounded"
            style={{ background: 'rgba(215,63,9,0.85)', fontFamily: 'var(--font-mono)' }}
          >
            ▶ Video
          </span>
        )}
      </div>

      {/* Scale slider */}
      <div className="flex items-center gap-3">
        <label
          className="text-[10px] uppercase tracking-wider text-white/50 whitespace-nowrap"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Scale
        </label>
        <input
          type="range"
          min="1"
          max="2"
          step="0.05"
          value={selection.hero_scale}
          onChange={(e) => onChange({ hero_scale: parseFloat(e.target.value) })}
          className="flex-1 accent-[#D73F09]"
        />
        <span className="text-xs text-white/60 w-10 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
          {(selection.hero_scale * 100).toFixed(0)}%
        </span>
      </div>

      {/* Position readout */}
      <div className="flex gap-4 text-[10px] text-white/40 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
        <span>X: {(selection.focal_x * 100).toFixed(0)}%</span>
        <span>Y: {(selection.focal_y * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function HeroEditorPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selections, setSelections] = useState<Map<string, HeroSelection>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaignName, setCampaignName] = useState('');

  // Fetch media and campaign name on mount
  useEffect(() => {
    async function load() {
      // Fetch campaign media via the campaigns API
      const res = await fetch(`/api/campaigns/${campaignId}/hero`);
      const data = await res.json();
      const mediaItems: MediaItem[] = data.media || [];
      setMedia(mediaItems);

      // Build selection map from existing hero items
      const map = new Map<string, HeroSelection>();
      mediaItems
        .filter((m) => m.is_hero)
        .sort((a, b) => a.hero_order - b.hero_order)
        .forEach((m, i) => {
          map.set(m.id, {
            id: m.id,
            focal_x: m.focal_x ?? 0.5,
            focal_y: m.focal_y ?? 0.5,
            hero_scale: m.hero_scale ?? 1.0,
            hero_order: i,
          });
        });
      setSelections(map);

      // Auto-select the first hero item for editing
      const firstHero = mediaItems.find((m) => m.is_hero);
      if (firstHero) setActiveId(firstHero.id);

      setLoading(false);
    }

    // Fetch campaign name from the campaign_recaps table
    import('@/lib/supabase').then(({ createBrowserSupabase }) => {
      const sb = createBrowserSupabase();
      sb.from('campaign_recaps')
        .select('name')
        .eq('id', campaignId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.name) setCampaignName(data.name);
        });
    });

    load();
  }, [campaignId]);

  // Toggle a media item as hero
  const toggleHero = useCallback((id: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
        if (activeId === id) setActiveId(null);
      } else {
        const item = media.find((m) => m.id === id);
        next.set(id, {
          id,
          focal_x: item?.focal_x ?? 0.5,
          focal_y: item?.focal_y ?? 0.5,
          hero_scale: item?.hero_scale ?? 1.0,
          hero_order: next.size,
        });
        setActiveId(id);
      }
      return next;
    });
  }, [activeId, media]);

  // Update a hero selection's position/scale
  const updateSelection = useCallback((id: string, updates: Partial<HeroSelection>) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, ...updates });
      }
      return next;
    });
  }, []);

  // Save to API
  const save = useCallback(async () => {
    setSaving(true);
    const items = Array.from(selections.values()).map((s, i) => ({
      id: s.id,
      is_hero: true,
      hero_order: i,
      focal_x: s.focal_x,
      focal_y: s.focal_y,
      hero_scale: s.hero_scale,
    }));

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/hero`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Save failed: ${err.error}`);
      }
    } catch (e) {
      alert('Save failed — check your connection');
    }
    setSaving(false);
  }, [campaignId, selections]);

  // Sorted hero selections for display
  const heroItems = Array.from(selections.entries())
    .sort((a, b) => a[1].hero_order - b[1].hero_order)
    .map(([id]) => media.find((m) => m.id === id))
    .filter(Boolean) as MediaItem[];

  const activeItem = media.find((m) => m.id === activeId);
  const activeSelection = activeId ? selections.get(activeId) : undefined;

  if (loading) {
    return (
      <DashboardContent>
        <div className="flex items-center justify-center h-64 text-white/40">
          Loading campaign media...
        </div>
      </DashboardContent>
    );
  }

  return (
    <DashboardContent>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard/recaps"
                className="text-[11px] uppercase tracking-wider text-white/40 hover:text-white"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                ← Campaign Pages
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Hero Editor{campaignName ? ` — ${campaignName}` : ''}
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Select photos and videos for the campaign page hero banner. Click to select, then adjust position and scale.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40" style={{ fontFamily: 'var(--font-mono)' }}>
              {selections.size} selected
            </span>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider rounded"
              style={{
                fontFamily: 'var(--font-mono)',
                background: saving ? '#555' : '#D73F09',
                color: '#fff',
              }}
            >
              {saving ? 'Saving...' : 'Save Hero'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_420px] gap-6 max-[1100px]:grid-cols-1">
          {/* Left: Media grid — click to select/deselect for hero */}
          <div>
            <div
              className="text-[10px] uppercase tracking-wider text-white/40 mb-3"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              All Campaign Media · click to select for hero
            </div>
            <div className="grid grid-cols-4 gap-2 max-[900px]:grid-cols-3">
              {media.map((m) => {
                const isSelected = selections.has(m.id);
                const isActive = m.id === activeId;
                const thumbSrc = m.type === 'video'
                  ? (m.thumbnail_url || m.file_url)
                  : m.file_url;

                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (isSelected) {
                        // If already selected, clicking just activates it for editing
                        // Hold shift to deselect
                        setActiveId(m.id);
                      } else {
                        toggleHero(m.id);
                      }
                    }}
                    onDoubleClick={() => {
                      // Double-click to deselect
                      if (isSelected) {
                        toggleHero(m.id);
                      }
                    }}
                    className="relative aspect-[4/3] overflow-hidden rounded border-2 transition-all"
                    style={{
                      borderColor: isActive
                        ? '#D73F09'
                        : isSelected
                        ? 'rgba(215,63,9,0.5)'
                        : 'rgba(255,255,255,0.08)',
                      opacity: isSelected ? 1 : 0.6,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbSrc}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />

                    {isSelected && (
                      <div
                        className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: '#D73F09' }}
                      >
                        {(selections.get(m.id)?.hero_order ?? 0) + 1}
                      </div>
                    )}

                    {m.type === 'video' && (
                      <span className="absolute bottom-1 right-1 text-[8px] uppercase tracking-wider text-white px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)' }}>
                        ▶
                      </span>
                    )}

                    {!isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">+ Add</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Position & scale editor for the active hero image */}
          <div className="space-y-4">
            <div
              className="text-[10px] uppercase tracking-wider text-white/40 mb-3"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Position & Scale
            </div>

            {activeItem && activeSelection ? (
              <PositionEditor
                item={activeItem}
                selection={activeSelection}
                onChange={(updates) => updateSelection(activeId!, updates)}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-white/30 text-sm"
                style={{ aspectRatio: '16/7' }}
              >
                Select an image to edit position
              </div>
            )}

            {/* Hero order list */}
            {heroItems.length > 0 && (
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider text-white/40 mb-2 mt-4"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Hero order · double-click thumbnail to remove
                </div>
                <div className="flex gap-2 flex-wrap">
                  {heroItems.map((item, i) => {
                    const thumbSrc = item.type === 'video'
                      ? (item.thumbnail_url || item.file_url)
                      : item.file_url;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveId(item.id)}
                        onDoubleClick={() => toggleHero(item.id)}
                        className="relative w-16 h-12 rounded overflow-hidden border-2 transition-colors"
                        style={{
                          borderColor: item.id === activeId ? '#D73F09' : 'rgba(255,255,255,0.15)',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <span
                          className="absolute top-0 left-0 text-[9px] font-bold text-white px-1"
                          style={{ background: '#D73F09' }}
                        >
                          {i + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardContent>
  );
}
