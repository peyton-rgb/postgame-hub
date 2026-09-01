// ============================================================
// Recap Builder — Overview step (builder-02-overview.html, -v6)
//
// The Rundown revision: header fields, the campaign overview
// rich text, the campaign timeline, metric tiles, platform
// breakdown with the donut toggle, and KPI targets — all bound
// to the live preview.
//
// WHERE THINGS ARE WRITTEN
//   settings      description, quarter, campaign_type,
//                 kpi_targets, hidden_platform_cards
//                 — keys the recap editor already owns, merged
//                 after a SELECT so nothing else is clobbered.
//   recap_config  builder-only state with no existing home:
//                 timeline dates, hidden metric tiles, and the
//                 timeline/donut section switches. This column
//                 is unused on Ghost Amp, so writing it cannot
//                 move published output.
//
// The brief says the builder owns the description now; the live
// editor's copy field goes read-only LATER, not in this phase,
// so both still write the same settings.description key.
//
// Zero rule and focus-follow come from the shared helpers.
// ============================================================

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { isZero } from '../zeroRule';
import { useFocusFollow } from '../useFocusFollow';
import type { BuilderAthlete } from '../athletes/metrics';
import { deriveMetrics, derivePlatforms, deriveShares, type PlatformBox } from './derive';
import RecapPreview, { type Moment } from './RecapPreview';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DATE_IDS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'] as const;
type DateId = (typeof DATE_IDS)[number];

const money = (s: string): number | null => {
  const v = parseFloat((s || '').replace(/[^0-9.]/g, ''));
  return Number.isNaN(v) ? null : v;
};

/** Month + day-range label for one timeline moment. Verbatim from the prototype. */
function moFmt(a: Date | null, b: Date | null): { mo: string; sd: string } | null {
  if (!a) return null;
  const mo = MONTHS[a.getMonth()];
  const d1 = String(a.getDate()).padStart(2, '0');
  if (!b || a.getTime() === b.getTime()) return { mo, sd: d1 };
  const d2 = String(b.getDate()).padStart(2, '0');
  return a.getMonth() === b.getMonth()
    ? { mo, sd: `${d1} — ${d2}` }
    : { mo, sd: `${d1} — ${MONTHS[b.getMonth()]} ${d2}` };
}

export default function OverviewStep({
  recapId,
  onTouch,
  onPreviewChange,
}: {
  recapId: string;
  onTouch: () => void;
  /** Hands the bound preview render up to the route's PreviewPanel. */
  onPreviewChange: (node: React.ReactNode) => void;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const follow = useFocusFollow();

  // TODO-dedupe: AthletesStep runs the same roster query. Both steps are
  // self-contained for now; lift this to the route when a third step needs it.
  const [rows, setRows] = useState<BuilderAthlete[]>([]);
  const [name, setName] = useState('');
  const [lede, setLede] = useState('');
  const [quarter, setQuarter] = useState('');
  const [type, setType] = useState('');
  const [descHtml, setDescHtml] = useState('');
  const [dates, setDates] = useState<Record<DateId, string>>({
    d0: '', d1: '', d2: '', d3: '', d4: '', d5: '',
  });
  const [hiddenTiles, setHiddenTiles] = useState<string[]>([]);
  const [hiddenPlatforms, setHiddenPlatforms] = useState<string[]>([]);
  const [hiddenRows, setHiddenRows] = useState<Record<string, number[]>>({});
  const [showTimeline, setShowTimeline] = useState(true);
  const [showDonut, setShowDonut] = useState(true);
  const [budget, setBudget] = useState('');
  const [imprIn, setImprIn] = useState('');
  const [loaded, setLoaded] = useState(false);

  // ── load draft state ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, { data: aths }] = await Promise.all([
        supabase
          .from('campaign_recaps')
          .select('name, settings, recap_config')
          .eq('id', recapId)
          .single(),
        supabase
          .from('athletes')
          .select('id, name, ig_handle, ig_followers, school, sport, metrics')
          .eq('campaign_id', recapId)
          .order('sort_order', { ascending: true }),
      ]);
      if (cancelled || !data) return;

      setRows(
        (aths ?? []).map((a: Omit<BuilderAthlete, 'fileCount' | 'videoCount'>) => ({
          ...a,
          fileCount: 0,
          videoCount: 0,
        })),
      );

      const s = (data.settings ?? {}) as Record<string, unknown>;
      const rc = (data.recap_config ?? {}) as Record<string, unknown>;
      const b = (rc.builder ?? {}) as Record<string, unknown>;

      setName(String(data.name ?? ''));
      setQuarter(String(s.quarter ?? ''));
      setType(String(s.campaign_type ?? ''));
      setDescHtml(String(s.description ?? ''));
      setLede(String(b.hero_lede ?? ''));
      setHiddenPlatforms((s.hidden_platform_cards as string[]) ?? []);
      setHiddenTiles((b.hidden_metric_tiles as string[]) ?? []);
      setHiddenRows((b.hidden_platform_rows as Record<string, number[]>) ?? {});
      setShowTimeline(b.show_timeline !== false);
      setShowDonut(b.show_donut !== false);
      if (b.timeline) setDates((d) => ({ ...d, ...(b.timeline as Record<DateId, string>) }));
      const kpi = (s.kpi_targets ?? {}) as Record<string, unknown>;
      setBudget(kpi.budget == null ? '' : String(kpi.budget));
      setImprIn(kpi.impressions == null ? '' : String(kpi.impressions));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, recapId]);

  // ── persistence: merge after SELECT, never clobber ────────
  const persist = useCallback(
    async (settingsPatch: Record<string, unknown>, builderPatch: Record<string, unknown>) => {
      const { data } = await supabase
        .from('campaign_recaps')
        .select('settings, recap_config')
        .eq('id', recapId)
        .single();

      const settings = { ...((data?.settings as Record<string, unknown>) ?? {}), ...settingsPatch };
      const rc = (data?.recap_config as Record<string, unknown>) ?? {};
      const recap_config = {
        ...rc,
        builder: { ...((rc.builder as Record<string, unknown>) ?? {}), ...builderPatch },
      };
      await supabase.from('campaign_recaps').update({ settings, recap_config }).eq('id', recapId);
    },
    [supabase, recapId],
  );

  // ── derived figures ───────────────────────────────────────
  const metrics = useMemo(() => deriveMetrics(rows, hiddenTiles), [rows, hiddenTiles]);
  const shares = useMemo(() => deriveShares(rows), [rows]);
  const platforms = useMemo(() => {
    const base = derivePlatforms(rows, hiddenPlatforms);
    // Apply per-row hiding, then the zero rule: a row at zero is forced off
    // and a box whose every row is zero switches itself off entirely.
    return base.map((p) => {
      const hidden = hiddenRows[p.k] ?? [];
      const rowsOut = p.rows.map((r, i) => {
        const z = isZero(r[1]);
        return [r[0], r[1], z ? false : !hidden.includes(i)] as [string, string, boolean];
      });
      const allZero = rowsOut.every((r) => isZero(r[1]));
      return { ...p, rows: rowsOut, on: allZero ? false : p.on };
    });
  }, [rows, hiddenPlatforms, hiddenRows]);

  // ── timeline ──────────────────────────────────────────────
  const dval = (id: DateId): Date | null => (dates[id] ? new Date(dates[id] + 'T12:00:00') : null);
  const moments: Moment[] = [];
  const k = dval('d0');
  if (k) moments.push({ ...moFmt(k, null)!, lb: 'Kickoff', nt: 'Brief approved, roster locked, product in the mail.' });
  const lf = moFmt(dval('d1'), dval('d2'));
  if (lf) moments.push({ ...lf, lb: 'Content live', nt: 'Feed posts, Reels and TikTok going up across the roster.' });
  const rf = moFmt(dval('d3'), dval('d4'));
  if (rf) moments.push({ ...rf, lb: 'Reporting window', nt: 'Every post tracked, metrics and assets collected.' });
  const dv = dval('d5');
  if (dv) moments.push({ ...moFmt(dv, null)!, lb: 'Recap delivered', nt: 'This page — every athlete, asset and number at one link.' });

  const timelineMeta =
    k && dv ? `${Math.round((dv.getTime() - k.getTime()) / 86400000)} days · kickoff to delivery` : '';

  // ── KPI glass cards ───────────────────────────────────────
  const b = money(budget);
  const imp = money(imprIn);
  const engTile = metrics.find((m) => m.k === 'eng');
  const engRaw = rows.length
    ? rows.reduce(
        (s, a) =>
          s +
          (a.metrics?.ig_feed?.likes ?? 0) +
          (a.metrics?.ig_feed?.comments ?? 0) +
          (a.metrics?.ig_feed?.reposts ?? 0),
        0,
      )
    : 0;
  const kpi = {
    cpm: b && imp ? '$' + (b / (imp / 1000)).toFixed(2) : '$—',
    cpe: b && engRaw ? '$' + (b / engRaw).toFixed(2) : '$—',
    sub: b ? 'From your campaign spend' : 'Add budget to calculate',
    visible: !!b,
    posts: metrics.find((m) => m.k === 'posts')?.v ?? '0',
  };
  void engTile;

  // ── hand the bound preview up to the panel ────────────────
  useEffect(() => {
    onPreviewChange(
      <RecapPreview
        name={name}
        lede={lede.trim() || 'Campaign Recap — 2026'}
        descHtml={descHtml}
        moments={moments}
        timelineMeta={timelineMeta}
        showTimeline={showTimeline}
        metrics={metrics}
        platforms={platforms}
        shares={shares}
        showDonut={showDonut}
        kpi={kpi}
        targetRef={follow.target}
      />,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, lede, descHtml, JSON.stringify(dates), showTimeline, showDonut, metrics, platforms, budget, imprIn]);

  const bump = () => onTouch();

  const toggleTile = (kk: string) => {
    setHiddenTiles((prev) => {
      const next = prev.includes(kk) ? prev.filter((x) => x !== kk) : [...prev, kk];
      persist({}, { hidden_metric_tiles: next });
      return next;
    });
    bump();
  };

  const togglePlatform = (kk: PlatformBox['k']) => {
    setHiddenPlatforms((prev) => {
      const next = prev.includes(kk) ? prev.filter((x) => x !== kk) : [...prev, kk];
      persist({ hidden_platform_cards: next }, {});
      return next;
    });
    bump();
  };

  const toggleRow = (pk: string, i: number) => {
    setHiddenRows((prev) => {
      const cur = prev[pk] ?? [];
      const next = { ...prev, [pk]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
      persist({}, { hidden_platform_rows: next });
      return next;
    });
    bump();
  };

  if (!loaded) return <p style={{ color: 'rgba(250,248,245,.45)', fontSize: 13 }}>Loading overview…</p>;

  return (
    <>
      <div className="sec">
        <div className="grid2">
          <div className="field">
            <label>Campaign name</label>
            <input
              type="text"
              value={name}
              spellCheck={false}
              {...follow.field('name')}
              onChange={(e) => { setName(e.target.value); bump(); }}
            />
          </div>
          <div className="field">
            <label>Hero lede</label>
            <input
              type="text"
              value={lede}
              placeholder="Campaign Recap — 2026"
              {...follow.field('lede')}
              onChange={(e) => { setLede(e.target.value); bump(); }}
              onBlur={() => persist({}, { hero_lede: lede })}
            />
          </div>
          <div className="field">
            <label>Quarter</label>
            <input
              type="text"
              value={quarter}
              placeholder="Q3 2026"
              onChange={(e) => { setQuarter(e.target.value); bump(); }}
              onBlur={() => persist({ quarter }, {})}
            />
          </div>
          <div className="field">
            <label>Campaign type</label>
            <input
              type="text"
              value={type}
              onChange={(e) => { setType(e.target.value); bump(); }}
              onBlur={() => persist({ campaign_type: type }, {})}
            />
          </div>
        </div>
      </div>

      <div className="sec">
        <div className="slabel">Campaign overview</div>
        <div
          className="rich"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          {...follow.field('desc')}
          onInput={(e) => { setDescHtml(e.currentTarget.innerHTML); bump(); }}
          onBlur={(e) => persist({ description: e.currentTarget.innerHTML }, {})}
          dangerouslySetInnerHTML={{ __html: descHtml }}
        />
      </div>

      <div className="sec">
        <div className="slabel">
          Campaign timeline <span>empty dates hide their moment — no dates hides the strip</span>
          <span className="tglwrap">
            {moments.length === 0 ? (
              <>
                <span className="tstate">Auto-hidden · no dates</span>
                <span className="tgl dis" />
              </>
            ) : (
              <span
                className={'tgl' + (showTimeline ? ' on' : '')}
                onClick={() => {
                  setShowTimeline((v) => { persist({}, { show_timeline: !v }); return !v; });
                  bump();
                }}
              />
            )}
          </span>
        </div>
        <div className="grid3">
          {(
            [
              ['d0', 'Kickoff'],
              ['d1', 'Content live — start'],
              ['d2', 'Content live — end'],
              ['d3', 'Reporting — start'],
              ['d4', 'Reporting — end'],
              ['d5', 'Recap delivered'],
            ] as [DateId, string][]
          ).map(([id, label]) => (
            <div className="field" key={id}>
              <label>{label}</label>
              <input
                type="date"
                value={dates[id]}
                {...follow.field('timeline')}
                onChange={(e) => {
                  const next = { ...dates, [id]: e.target.value };
                  setDates(next);
                  persist({}, { timeline: next });
                  bump();
                }}
              />
            </div>
          ))}
        </div>
        <div className="hint">
          &quot;N days · kickoff to delivery&quot; appears once both Kickoff and Recap delivered are set.
        </div>
      </div>

      <div className="sec">
        <div className="slabel">
          Campaign metrics <span>toggle a tile — anything at 0 hides itself</span>
        </div>
        <div className="ttiles">
          {metrics.map((m) => {
            const zero = isZero(m.v);
            return (
              <div
                key={m.k}
                className={'ttile ' + (m.on && !zero ? 'on' : 'off') + (zero ? ' zero' : '')}
                onClick={zero ? undefined : () => toggleTile(m.k)}
              >
                {zero ? <span className="az">0 · auto-hidden</span> : <span className="sw" />}
                <div className="v">{m.v}</div>
                <div className="l">{m.l}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec">
        <div className="slabel">
          Platform breakdown <span>toggle a box, click a row to hide a line — zeros hide themselves</span>
          <span className="tglwrap">
            <span className="tstate">Donut</span>
            <span
              className={'tgl' + (showDonut ? ' on' : '')}
              onClick={() => {
                setShowDonut((v) => { persist({}, { show_donut: !v }); return !v; });
                bump();
              }}
            />
          </span>
        </div>
        <div className="pboxes">
          {platforms.map((p) => {
            const allZero = p.rows.every((r) => isZero(r[1]));
            return (
              <div className={'pbox ' + (p.on ? 'onn' : 'off')} key={p.k}>
                <div className="pbh">
                  <span className="t">{p.t}</span>
                  <span className="tglwrap">
                    {allZero && <span className="tstate">Auto-hidden</span>}
                    <span
                      className={'tgl ' + (allZero ? 'dis' : p.on ? 'on' : '')}
                      onClick={allZero ? undefined : (e) => { e.stopPropagation(); togglePlatform(p.k); }}
                    />
                  </span>
                </div>
                {p.rows.map((r, i) => {
                  const z = isZero(r[1]);
                  return (
                    <div
                      key={r[0]}
                      className={'row ' + (r[2] ? '' : 'hid') + (z ? ' zrow' : '')}
                      onClick={z ? undefined : () => toggleRow(p.k, i)}
                    >
                      <span>
                        {r[0]}
                        {z && <em className="az2"> 0 · auto-hidden</em>}
                      </span>
                      <b>{r[1]}</b>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec">
        <div className="slabel">
          Campaign KPIs <span>CPM and cost per engagement compute from spend</span>
        </div>
        <div className="grid2">
          <div className="field">
            <label>Budget</label>
            <input
              type="text"
              value={budget}
              placeholder="$0"
              onChange={(e) => { setBudget(e.target.value); bump(); }}
              onBlur={() => persist({ kpi_targets: { budget, impressions: imprIn } }, {})}
            />
          </div>
          <div className="field">
            <label>Impressions (for CPM)</label>
            <input
              type="text"
              value={imprIn}
              placeholder="0"
              onChange={(e) => { setImprIn(e.target.value); bump(); }}
              onBlur={() => persist({ kpi_targets: { budget, impressions: imprIn } }, {})}
            />
          </div>
        </div>
        <div className="hint">
          {kpi.visible ? `CPM ${kpi.cpm} · CPE ${kpi.cpe}` : 'Add budget to calculate — the KPI cards stay hidden until then.'}
        </div>
      </div>
    </>
  );
}
