// ============================================================
// Recap Builder — Hero step (builder-03-hero-v11 + the spec)
//
// Left column: athlete filter chips and the bento picker —
// CSS columns, tiles at ORIGINAL aspect ratio, ratio badge per
// tile measured client-side on image load (media.aspect_ratio
// is null in this data, spec §2). Max 4 selections; the orange
// badge is rotation order.
//
// Right column: the framing card sits UNDER the page preview
// (spec §5). Each selected slot keeps its own Across / Up·down
// / Scale / Zoom / Edge blend; carousel dots switch slots.
// Touching a slider highlights the hero (focus-follow).
//
// Nothing selected -> derived fallback order, stated on the
// page: is_hero -> sort_order -> upload date.
//
// All geometry and gradients live in fades.ts, which is a
// literal port of the frozen prototype and was diffed against
// it across the whole slider range before use.
//
// Writes: selections and per-slot framing go to
// recap_config.builder.hero — draft state, revertible, and not
// read by the published page.
// ============================================================

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import HeroPreview from './HeroPreview';
import { DEFAULT_FRAME, FALLBACK_FRAME, ratioLabel, thumbUrl, type Frame } from './fades';

type Photo = {
  id: string;
  url: string;
  athlete: string;
  /** Measured client-side; null until the probe loads. */
  r: number | null;
};

const SLIDERS: { id: keyof Frame; label: string; min: number; max: number }[] = [
  { id: 'x', label: 'Across', min: 0, max: 100 },
  { id: 'y', label: 'Up · down', min: 0, max: 100 },
  { id: 's', label: 'Scale', min: 80, max: 140 },
  { id: 'z', label: 'Zoom', min: 100, max: 160 },
  { id: 'f', label: 'Edge blend', min: 0, max: 100 },
];

export default function HeroStep({
  recapId,
  onTouch,
  onPreviewChange,
  device,
  pageRef,
}: {
  recapId: string;
  onTouch: () => void;
  onPreviewChange: (node: React.ReactNode) => void;
  device: 'desktop' | 'mobile';
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState('All');
  const [sel, setSel] = useState<string[]>([]);
  const [heroSlot, setHeroSlot] = useState(0);
  const [frames, setFrames] = useState<Record<string, Frame>>({});
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [kicker, setKicker] = useState('Campaign Recap · 2026');
  const [name, setName] = useState('');
  const [descHtml, setDescHtml] = useState('');
  const [loaded, setLoaded] = useState(false);

  // ── load photos, copy and saved hero state ────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: recap } = await supabase
        .from('campaign_recaps')
        .select('name, brand_id, settings, recap_config')
        .eq('id', recapId)
        .single();

      const { data: media } = await supabase
        .from('media')
        .select('id, file_url, file_type, athlete_id, is_hero, hero_order, sort_order, created_at')
        .eq('campaign_id', recapId);

      const { data: aths } = await supabase
        .from('athletes')
        .select('id, name')
        .eq('campaign_id', recapId);

      if (cancelled) return;

      const nameById = new Map((aths ?? []).map((a: { id: string; name: string | null }) => [a.id, a.name ?? '—']));

      // Photos only — the hero is a still frame (spec §2).
      const rows = (media ?? []).filter(
        (m: { file_type: string | null }) => !(m.file_type ?? '').startsWith('video'),
      );

      // Derived fallback order: is_hero -> sort_order -> upload date.
      rows.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const ha = a.is_hero ? 0 : 1;
        const hb = b.is_hero ? 0 : 1;
        if (ha !== hb) return ha - hb;
        const sa = (a.sort_order as number) ?? 1e9;
        const sb = (b.sort_order as number) ?? 1e9;
        if (sa !== sb) return sa - sb;
        return String(a.created_at).localeCompare(String(b.created_at));
      });

      setPhotos(
        rows.map((m: Record<string, unknown>) => ({
          id: String(m.id),
          url: String(m.file_url),
          athlete: nameById.get(String(m.athlete_id)) ?? 'Unassigned',
          r: null,
        })),
      );

      const s = (recap?.settings ?? {}) as Record<string, unknown>;
      const rc = (recap?.recap_config ?? {}) as Record<string, unknown>;
      const b = (rc.builder ?? {}) as Record<string, unknown>;
      const hero = (b.hero ?? {}) as Record<string, unknown>;

      setName(String(recap?.name ?? ''));
      setDescHtml(String(s.description ?? ''));
      if (b.hero_lede) setKicker(String(b.hero_lede));
      setSel((hero.selection as string[]) ?? []);
      setFrames((hero.frames as Record<string, Frame>) ?? {});

      if (recap?.brand_id) {
        const { data: logos } = await supabase
          .from('brand_logos')
          .select('url, variant')
          .eq('brand_id', recap.brand_id);
        const white = (logos ?? []).find((l: { variant: string | null }) => (l.variant ?? '').includes('white'));
        setBrandLogo(String((white ?? (logos ?? [])[0])?.url ?? '') || null);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, recapId]);

  // ── ratio probe: measured client-side, DB aspect_ratio is null ──
  useEffect(() => {
    photos.forEach((p) => {
      if (p.r != null) return;
      const probe = new Image();
      probe.onload = () => {
        const r = probe.naturalWidth / probe.naturalHeight;
        setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, r } : x)));
      };
      probe.src = thumbUrl(p.url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  const persist = useCallback(
    async (selection: string[], fr: Record<string, Frame>) => {
      const { data } = await supabase
        .from('campaign_recaps')
        .select('recap_config')
        .eq('id', recapId)
        .single();
      const rc = (data?.recap_config as Record<string, unknown>) ?? {};
      const builder = (rc.builder as Record<string, unknown>) ?? {};
      await supabase
        .from('campaign_recaps')
        .update({
          recap_config: { ...rc, builder: { ...builder, hero: { selection, frames: fr } } },
        })
        .eq('id', recapId);
    },
    [supabase, recapId],
  );

  const activeId = sel.length ? sel[heroSlot] : null;
  const activePhoto = activeId
    ? (photos.find((p) => p.id === activeId) ?? null)
    : (photos[0] ?? null);
  const frame: Frame = activeId ? (frames[activeId] ?? DEFAULT_FRAME) : FALLBACK_FRAME;
  // Until measured, assume landscape — the prototype's fallback.
  const ratio = activePhoto?.r ?? 1.5;

  const toggle = (id: string) => {
    const at = sel.indexOf(id);
    let next: string[];
    let nextFrames = frames;
    if (at > -1) {
      next = sel.filter((x) => x !== id);
      if (heroSlot >= next.length) setHeroSlot(Math.max(0, next.length - 1));
    } else if (sel.length < 4) {
      next = [...sel, id];
      if (!frames[id]) nextFrames = { ...frames, [id]: { ...DEFAULT_FRAME } };
      setHeroSlot(next.length - 1);
    } else {
      return;
    }
    setSel(next);
    setFrames(nextFrames);
    persist(next, nextFrames);
    onTouch();
  };

  const setSlider = (key: keyof Frame, v: number) => {
    if (!activeId) return;
    const nextFrames = { ...frames, [activeId]: { ...frame, [key]: v } };
    setFrames(nextFrames);
    onTouch();
  };

  const highlight = (on: boolean) => {
    const el = document.querySelector('.rb-root .rp-hero');
    if (!el) return;
    if (on) el.classList.add('pv-hl');
    else setTimeout(() => el.classList.remove('pv-hl'), 400);
  };

  // ── hand the bound hero up to the preview panel ───────────
  useEffect(() => {
    onPreviewChange(
      <HeroPreview
        photoUrl={activePhoto?.url ?? null}
        ratio={ratio}
        frame={frame}
        device={device}
        brandLogoUrl={brandLogo}
        brandLogoNudge={{ desktop: -30, mobile: -17 }}
        kicker={kicker}
        name={name}
        slots={sel.length}
        activeSlot={heroSlot}
        onSlotChange={setHeroSlot}
        descHtml={descHtml}
        pageRef={pageRef}
      />,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhoto?.url, ratio, frame, device, brandLogo, kicker, name, sel.length, heroSlot, descHtml]);

  if (!loaded) return <p style={{ color: 'rgba(250,248,245,.45)', fontSize: 13 }}>Loading photos…</p>;

  const names = ['All', ...Array.from(new Set(photos.map((p) => p.athlete)))];
  const shown = photos.filter((p) => filter === 'All' || p.athlete === filter);

  return (
    <>
      <div className="sec">
        <div className="slabel">
          Hero photo <span>up to 4 — the badge is rotation order</span>
        </div>

        <div className="fchips">
          {names.map((n) => (
            <span
              key={n}
              className={'fchip' + (n === filter ? ' on' : '')}
              onClick={() => setFilter(n)}
            >
              {n}
            </span>
          ))}
        </div>

        {sel.length === 0 && (
          <div className="hint" style={{ marginBottom: 12 }}>
            Nothing selected — the hero falls back to the first staged photo, ordered by
            is_hero, then sort order, then upload date.
          </div>
        )}

        <div className="pgrid">
          {shown.map((p) => {
            const ord = sel.indexOf(p.id);
            return (
              <div
                key={p.id}
                className={'ptile' + (ord > -1 ? ' sel' : '')}
                onClick={() => toggle(p.id)}
              >
                {/* Tiles show the full photo at its original ratio — no crop. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" src={thumbUrl(p.url)} alt="" />
                <span className="ord">{ord + 1}</span>
                <span className="nm">{p.athlete}</span>
                <span className="ar">{p.r ? ratioLabel(p.r) : '…'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Framing card — spec §5 places it under the page preview. */}
      <div className="frames">
        <div className="slabel">Framing — slot {sel.length ? heroSlot + 1 : 1}</div>
        <div className="fsub">
          {activeId
            ? 'Each selected photo keeps its own framing.'
            : 'Select a photo to enable framing.'}
        </div>
        {SLIDERS.map((s) => (
          <div className="srow" key={s.id}>
            <label>{s.label}</label>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={frame[s.id]}
              disabled={!activeId}
              onChange={(e) => setSlider(s.id, +e.target.value)}
              onPointerDown={() => highlight(true)}
              onPointerUp={() => {
                highlight(false);
                if (activeId) persist(sel, frames);
              }}
            />
            <span className="v">
              {s.id === 'z' ? (frame.z / 100).toFixed(2) + '×' : frame[s.id] + '%'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
