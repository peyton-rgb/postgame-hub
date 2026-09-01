// ============================================================
// Recap Builder — Performers step (builder-04-performers-v2)
//
// Auto top 5, no manual selection. The basis segment here and
// the toggle inside the section preview drive ONE state.
//
// Per performer: a thumbnail chosen from their own staged
// photos via a modal picker. An amber banner counts how many of
// the five still need one — advisory in this phase; it joins
// the publish checklist later.
//
// Thumbnail choices save as a thumb_media_id-style map inside
// recap_config.builder.performers.thumbs — jsonb, no migration,
// as the brief prefers.
// ============================================================

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { BuilderAthlete } from '../athletes/metrics';
import PerformersPreview from './PerformersPreview';
import { basisValue, fmt, modalUrl, rowThumbUrl, sourceLabel, topFive, type Basis } from './ranking';

type Shot = { id: string; url: string };

export default function PerformersStep({
  recapId,
  onTouch,
  onPreviewChange,
}: {
  recapId: string;
  onTouch: () => void;
  onPreviewChange: (node: React.ReactNode) => void;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [rows, setRows] = useState<BuilderAthlete[]>([]);
  const [shots, setShots] = useState<Record<string, Shot[]>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [basis, setBasis] = useState<Basis>('eng');
  const [picking, setPicking] = useState<BuilderAthlete | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // TODO-dedupe: same roster query as the Athletes and Overview steps.
      const [{ data: aths }, { data: media }, { data: recap }] = await Promise.all([
        supabase
          .from('athletes')
          .select('id, name, ig_handle, ig_followers, school, sport, metrics')
          .eq('campaign_id', recapId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('media')
          .select('id, file_url, file_type, athlete_id, sort_order')
          .eq('campaign_id', recapId),
        supabase.from('campaign_recaps').select('recap_config').eq('id', recapId).single(),
      ]);
      if (cancelled) return;

      setRows(
        (aths ?? []).map((a: Omit<BuilderAthlete, 'fileCount' | 'videoCount'>) => ({
          ...a,
          fileCount: 0,
          videoCount: 0,
        })),
      );

      const byAthlete: Record<string, Shot[]> = {};
      (media ?? [])
        .filter((m: { file_type: string | null }) => !(m.file_type ?? '').startsWith('video'))
        .forEach((m: Record<string, unknown>) => {
          const aid = m.athlete_id ? String(m.athlete_id) : null;
          if (!aid) return;
          (byAthlete[aid] ??= []).push({ id: String(m.id), url: String(m.file_url) });
        });
      setShots(byAthlete);

      const rc = (recap?.recap_config ?? {}) as Record<string, unknown>;
      const b = (rc.builder ?? {}) as Record<string, unknown>;
      const perf = (b.performers ?? {}) as Record<string, unknown>;
      setThumbs((perf.thumbs as Record<string, string>) ?? {});
      if (perf.basis === 'impr' || perf.basis === 'eng') setBasis(perf.basis);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, recapId]);

  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      const { data } = await supabase
        .from('campaign_recaps')
        .select('recap_config')
        .eq('id', recapId)
        .single();
      const rc = (data?.recap_config as Record<string, unknown>) ?? {};
      const builder = (rc.builder as Record<string, unknown>) ?? {};
      const performers = (builder.performers as Record<string, unknown>) ?? {};
      await supabase
        .from('campaign_recaps')
        .update({
          recap_config: {
            ...rc,
            builder: { ...builder, performers: { ...performers, ...patch } },
          },
        })
        .eq('id', recapId);
    },
    [supabase, recapId],
  );

  const top = useMemo(() => topFive(rows, basis), [rows, basis]);

  const thumbUrlFor = useCallback(
    (a: BuilderAthlete): string | null => {
      const own = shots[a.id] ?? [];
      const chosen = thumbs[a.id];
      const hit = chosen ? own.find((s) => s.id === chosen) : undefined;
      return hit?.url ?? own[0]?.url ?? null;
    },
    [shots, thumbs],
  );

  const changeBasis = (b: Basis) => {
    setBasis(b);
    persist({ basis: b });
    onTouch();
  };

  useEffect(() => {
    onPreviewChange(
      <PerformersPreview
        top={top}
        basis={basis}
        onBasisChange={changeBasis}
        thumbUrlFor={thumbUrlFor}
      />,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, basis, thumbUrlFor]);

  // Escape closes the picker.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicking(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [picking]);

  if (!loaded) return <p style={{ color: 'rgba(250,248,245,.45)', fontSize: 13 }}>Loading performers…</p>;

  // Only performers who HAVE photos can need a thumbnail; the rest show initials.
  const missing = top.filter((a) => (shots[a.id]?.length ?? 0) > 0 && !thumbs[a.id]);

  return (
    <>
      <div className={'flagline ' + (missing.length ? 'warn' : 'ok')}>
        <span className="fdot" />
        {missing.length ? (
          <span>
            <b>{missing.length} of {top.length}</b> top performers need a thumbnail —{' '}
            {missing.map((a) => (a.name ?? '').split(' ')[0]).join(', ')}
          </span>
        ) : (
          <span>All card thumbnails set.</span>
        )}
      </div>

      <div className="ptop">
        <span className="ptitle">Top Performers — auto top 5</span>
        <span className="seg">
          <span className={basis === 'eng' ? 'on' : undefined} onClick={() => changeBasis('eng')}>
            Engagements
          </span>
          <span className={basis === 'impr' ? 'on' : undefined} onClick={() => changeBasis('impr')}>
            Impressions
          </span>
        </span>
      </div>

      <div className="list">
        {top.map((a, i) => {
          const own = shots[a.id] ?? [];
          const chosen = thumbs[a.id];
          const hit = chosen ? own.find((s) => s.id === chosen) : undefined;
          const src = sourceLabel(a, basis);
          return (
            <div className="row" key={a.id}>
              <span className="rk">{i + 1}</span>
              {own.length === 0 ? (
                <span className="tmb none" />
              ) : hit ? (
                <span className="tmb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={rowThumbUrl(hit.url)} alt="" />
                </span>
              ) : (
                <span className="tmb unset" />
              )}

              <span className="who">
                <span className="nm">{a.name}</span>
                <span className="sub">
                  {[a.school, a.sport].filter(Boolean).join(' · ')}
                  {a.ig_handle ? ` · @${a.ig_handle}` : ''}
                </span>
              </span>

              <span className="num">
                <b>{fmt(basisValue(a, basis))}</b>
                <span className="l">
                  {basis === 'eng' ? 'Eng' : 'Impr'}
                  {src && (
                    <>
                      {' · '}
                      <em>{src}</em>
                    </>
                  )}
                </span>
              </span>

              {own.length === 0 ? (
                <span className="tno">Shows initials</span>
              ) : (
                <button
                  className={'tbtn ' + (hit ? 'set' : 'need')}
                  onClick={() => setPicking(a)}
                >
                  {hit ? 'Change' : 'Select thumbnail'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {picking && (
        <div className="tmodal open" onClick={(e) => e.target === e.currentTarget && setPicking(null)}>
          <div className="mbox">
            <div className="mhead">
              <span className="mtitle">Select thumbnail — {picking.name}</span>
              <button className="mclose" onClick={() => setPicking(null)}>
                ✕
              </button>
            </div>
            <div className="mgrid">
              {(shots[picking.id] ?? []).map((s) => (
                <span
                  key={s.id}
                  className={'mt' + (thumbs[picking.id] === s.id ? ' sel' : '')}
                  onClick={() => {
                    const next = { ...thumbs, [picking.id]: s.id };
                    setThumbs(next);
                    persist({ thumbs: next });
                    onTouch();
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" src={modalUrl(s.url)} alt="" />
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
