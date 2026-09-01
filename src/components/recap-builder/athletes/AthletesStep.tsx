// ============================================================
// Recap Builder — Athletes step (builder-01-athletes.html)
//
// Tracker link row, Drive folder scan, roster health strip, the
// five platform tabs, and the editable athlete grid — ported
// from the prototype with real Ghost Amp data behind it.
//
// TWO THINGS DELIBERATELY NOT PERSISTED IN THIS PHASE:
//
//  1. Grid metric edits are session-local, and stay that way by
//     decision: the tracker sheet plus Resync is the source of
//     truth for metrics, and persisting hand-edits here would
//     alter published output (published recaps read
//     athletes.metrics, which is outside the brief's allowed
//     write set anyway).
//
//     OPEN DESIGN QUESTION — "draft metrics overlay": if hand
//     edits ever need to survive a reload, they should land in
//     a draft overlay (campaign_recaps.settings / recap_config)
//     that the builder reads over the top of athletes.metrics,
//     never as a write back into athletes.metrics itself. Not
//     designed yet; revisit before anyone asks for it.
//  2. The Scan folders button is READ-ONLY. It lists the Drive
//     folder and matches subfolder names to roster names in
//     memory to report counts. It creates nothing: no athlete
//     upserts, no imports. Importing stays in the existing
//     editor for now.
//
// The tracker sheet link and Drive folder link DO persist, into
// campaign_recaps.settings — allowed draft state, revertible.
//
// Totals: the prototype showed 12 of 76 rows and kept campaign
// totals in a constant, applying edit deltas on top. Here every
// athlete is loaded, so Σ is summed from the rows directly —
// the same number, honestly derived.
// ============================================================

'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import {
  campaignTotals,
  feedEng,
  feedRate,
  fmt,
  pct,
  reelEng,
  reelRate,
  ttEng,
  ttRate,
  type BuilderAthlete,
} from './metrics';

const DASH = <span className="dash">—</span>;

type TabId = 'identity' | 'feed' | 'story' | 'reel' | 'tt';

export default function AthletesStep({
  recapId,
  onTouch,
}: {
  recapId: string;
  /** Marks the autosave status line dirty. */
  onTouch: () => void;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [rows, setRows] = useState<BuilderAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TabId>('identity');

  const [sheetLink, setSheetLink] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);

  // ── load roster + staged file counts ──────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ data: aths }, { data: recap }] = await Promise.all([
        supabase
          .from('athletes')
          .select('id, name, ig_handle, ig_followers, school, sport, metrics')
          .eq('campaign_id', recapId)
          .order('sort_order', { ascending: true }),
        supabase.from('campaign_recaps').select('settings').eq('id', recapId).single(),
      ]);

      const { data: media } = await supabase
        .from('media')
        .select('athlete_id, file_type')
        .eq('campaign_id', recapId);

      if (cancelled) return;

      const files = new Map<string, { files: number; videos: number }>();
      (media ?? []).forEach((m: { athlete_id: string | null; file_type: string | null }) => {
        if (!m.athlete_id) return;
        const e = files.get(m.athlete_id) ?? { files: 0, videos: 0 };
        e.files += 1;
        if ((m.file_type ?? '').startsWith('video')) e.videos += 1;
        files.set(m.athlete_id, e);
      });

      setRows(
        (aths ?? []).map((a: Omit<BuilderAthlete, 'fileCount' | 'videoCount'>) => ({
          ...a,
          fileCount: files.get(a.id)?.files ?? 0,
          videoCount: files.get(a.id)?.videos ?? 0,
        })),
      );

      const settings = (recap?.settings ?? {}) as Record<string, unknown>;
      setSheetLink(String(settings.tracker_sheet_url ?? ''));
      setDriveLink(String(settings.drive_folder_url ?? ''));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, recapId]);

  // ── draft-state writes (settings jsonb only) ──────────────
  const saveSetting = useCallback(
    async (key: string, value: string) => {
      // SELECT before write, per the brief, so we merge rather than clobber.
      const { data } = await supabase
        .from('campaign_recaps')
        .select('settings')
        .eq('id', recapId)
        .single();

      const next = { ...((data?.settings as Record<string, unknown>) ?? {}), [key]: value };
      await supabase.from('campaign_recaps').update({ settings: next }).eq('id', recapId);
    },
    [supabase, recapId],
  );

  const T = useMemo(() => campaignTotals(rows), [rows]);
  const count = rows.length;

  // ── roster health, computed from the real roster ──────────
  const health = useMemo(() => {
    const schools = new Set(rows.map((a) => a.school).filter(Boolean)).size;
    const missingReel = rows.filter((a) => !a.metrics?.ig_reel?.views).length;
    const noContent = rows.filter((a) => a.fileCount === 0).length;
    const seen = new Map<string, number>();
    rows.forEach((a) => {
      const k = (a.name ?? '').trim().toLowerCase();
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    });
    // Array.from, not spread: the repo's tsconfig target predates
    // downlevelIteration, so spreading a Map iterator is a type error.
    const dupes = Array.from(seen.values()).filter((v) => v > 1).length;
    return { schools, missingReel, noContent, dupes };
  }, [rows]);

  // ── grid edits: session-local, see header note ────────────
  const editCell = useCallback(
    (id: string, path: string, raw: string) => {
      const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10);
      const v = Number.isNaN(parsed) ? null : parsed;

      setRows((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          const [head, tail] = path.split('.');
          if (!tail) return { ...a, [head]: v } as BuilderAthlete;
          const metrics = { ...(a.metrics ?? {}) } as Record<string, Record<string, unknown>>;
          metrics[head] = { ...(metrics[head] ?? {}), [tail]: v };
          return { ...a, metrics: metrics as BuilderAthlete['metrics'] };
        }),
      );
      onTouch();
    },
    [onTouch],
  );

  // A plain function, not a component: defining a component inside render
  // gives it a new identity every pass, which remounts the cell and drops
  // the caret mid-edit. Returning the element directly keeps it stable.
  const numCell = (a: BuilderAthlete, path: string, value: number | null | undefined) => (
    <td
      className="num"
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => editCell(a.id, path, e.currentTarget.textContent ?? '')}
    >
      {fmt(value)}
    </td>
  );

  const TABS: { id: TabId; label: string; total: string; unit: string }[] = [
    { id: 'identity', label: 'Identity', total: fmt(T.followers), unit: 'followers' },
    { id: 'feed', label: 'IG Feed', total: fmt(T.feed.eng), unit: 'engagements' },
    { id: 'story', label: 'IG Story', total: fmt(T.story.impressions), unit: 'impressions' },
    { id: 'reel', label: 'IG Reel', total: fmt(T.reel.views), unit: 'views' },
    { id: 'tt', label: 'TikTok', total: fmt(T.tt.views), unit: 'views' },
  ];

  const AUTO = <span className="auto">auto</span>;
  const heads: Record<TabId, React.ReactNode[]> = {
    identity: ['Athlete', 'Handle', 'Followers', 'School', 'Sport', 'Content'],
    feed: ['Athlete', 'Post', 'Likes', 'Comments', 'Reposts', <>Total eng {AUTO}</>, <>Eng rate {AUTO}</>],
    story: ['Athlete', 'Stories', 'Impressions'],
    reel: ['Athlete', 'Reel', 'Views', 'Likes', 'Comments', <>Total eng {AUTO}</>, <>Eng rate {AUTO}</>],
    tt: ['Athlete', 'Post', 'TT followers', 'Views', 'Likes', <>Total eng {AUTO}</>, <>Eng rate {AUTO}</>],
  };

  const sigma = `Σ · ${count}`;
  const totalsRow: Record<TabId, React.ReactNode[]> = {
    identity: [sigma, '', fmt(T.followers), '', '', `${T.files} files`],
    feed: [sigma, '', fmt(T.feed.likes), fmt(T.feed.comments), fmt(T.feed.reposts), fmt(T.feed.eng), ''],
    story: [sigma, fmt(T.story.count), fmt(T.story.impressions)],
    reel: [sigma, '', fmt(T.reel.views), fmt(T.reel.likes), fmt(T.reel.comments), fmt(T.reel.eng), ''],
    tt: [sigma, '', '', fmt(T.tt.views), fmt(T.tt.likes), fmt(T.tt.eng), ''],
  };

  function bodyRow(a: BuilderAthlete): React.ReactNode[] {
    const m = a.metrics;
    switch (active) {
      case 'identity':
        return [
          <td className="name">{a.name}</td>,
          <td>
            {a.ig_handle ? (
              <a href={`https://instagram.com/${a.ig_handle}`} target="_blank" rel="noreferrer">
                @{a.ig_handle}
              </a>
            ) : (
              DASH
            )}
          </td>,
          numCell(a, 'ig_followers', a.ig_followers),
          <td className="dim">{a.school}</td>,
          <td>{a.sport}</td>,
          a.fileCount > 0 ? (
            <td>
              <a href="#" title="Open Drive folder">
                {a.fileCount} file{a.fileCount > 1 ? 's' : ''}
                {a.videoCount ? ` · ${a.videoCount} video` : ''} ↗
              </a>
            </td>
          ) : (
            <td>
              <span className="nofolder">no folder</span>
            </td>
          ),
        ];
      case 'feed':
        return [
          <td className="name">{a.name}</td>,
          <td>{m?.ig_feed?.post_url ? <a href={m.ig_feed.post_url}>Post ↗</a> : DASH}</td>,
          numCell(a, 'ig_feed.likes', m?.ig_feed?.likes),
          numCell(a, 'ig_feed.comments', m?.ig_feed?.comments),
          numCell(a, 'ig_feed.reposts', m?.ig_feed?.reposts),
          <td className="num calc">{fmt(feedEng(a))}</td>,
          <td className="num calc">{pct(feedRate(a)) ?? DASH}</td>,
        ];
      case 'story':
        return [
          <td className="name">{a.name}</td>,
          numCell(a, 'ig_story.count', m?.ig_story?.count),
          numCell(a, 'ig_story.total_impressions', m?.ig_story?.total_impressions),
        ];
      case 'reel':
        return [
          <td className="name">{a.name}</td>,
          <td>{m?.ig_reel?.post_url ? <a href={m.ig_reel.post_url}>Reel ↗</a> : DASH}</td>,
          numCell(a, 'ig_reel.views', m?.ig_reel?.views),
          numCell(a, 'ig_reel.likes', m?.ig_reel?.likes),
          numCell(a, 'ig_reel.comments', m?.ig_reel?.comments),
          <td className="num calc">
            {m?.ig_reel?.likes == null && m?.ig_reel?.comments == null ? DASH : fmt(reelEng(a))}
          </td>,
          <td className="num calc">{pct(reelRate(a)) ?? DASH}</td>,
        ];
      case 'tt':
        if (!m?.tiktok)
          return [
            <td className="name">{a.name}</td>,
            <td>{DASH}</td>,
            <td className="num">{DASH}</td>,
            numCell(a, 'tiktok.views', null),
            numCell(a, 'tiktok.likes', null),
            <td className="num calc">{DASH}</td>,
            <td className="num calc">{DASH}</td>,
          ];
        return [
          <td className="name">{a.name}</td>,
          <td>{m.tiktok.post_url ? <a href={m.tiktok.post_url}>Post ↗</a> : DASH}</td>,
          numCell(a, 'tiktok.followers', m.tiktok.followers),
          numCell(a, 'tiktok.views', m.tiktok.views),
          numCell(a, 'tiktok.likes', m.tiktok.likes),
          <td className="num calc">{fmt(ttEng(a) ?? undefined)}</td>,
          <td className="num calc">{pct(ttRate(a)) ?? DASH}</td>,
        ];
    }
  }

  const numCols: Record<TabId, number[]> = {
    identity: [2],
    feed: [2, 3, 4, 5, 6],
    story: [1, 2],
    reel: [2, 3, 4, 5, 6],
    tt: [2, 3, 4, 5, 6],
  };

  return (
    <>
      <section className="lead">
        {/* tracker sheet */}
        <div className="connect">
          <div className="gsheet">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="M14.5 2H6.8C5.8 2 5 2.8 5 3.8v16.4c0 1 .8 1.8 1.8 1.8h10.4c1 0 1.8-.8 1.8-1.8V6.5L14.5 2z"
                fill="#0F9D58"
              />
              <path d="M14.5 2v3.7c0 .4.4.8.8.8H19L14.5 2z" fill="#87CEAC" />
              <path
                d="M8.5 11h7v6.5h-7V11zm1.2 1.2v1h1.9v-1H9.7zm3.1 0v1h1.9v-1h-1.9zm-3.1 2.1v1h1.9v-1H9.7zm3.1 0v1h1.9v-1h-1.9z"
                fill="#fff"
              />
            </svg>
          </div>
          <input
            type="text"
            value={sheetLink}
            placeholder="Paste the tracker sheet link…"
            spellCheck={false}
            onChange={(e) => {
              setSheetLink(e.target.value);
              onTouch();
            }}
            onBlur={() => saveSetting('tracker_sheet_url', sheetLink)}
          />
          {sheetLink.trim() ? (
            <>
              <button className="btn ghost" onClick={() => window.open(sheetLink, '_blank')}>
                Open ↗
              </button>
              <button
                className="btn primary"
                disabled={syncing}
                onClick={() => {
                  setSyncing(true);
                  window.setTimeout(() => setSyncing(false), 900);
                }}
              >
                {syncing ? 'Syncing…' : 'Resync'}
              </button>
            </>
          ) : (
            <button className="btn primary" disabled>
              New from template
            </button>
          )}
        </div>

        {/* drive folder */}
        <div className="connect" style={{ marginTop: 12 }}>
          <div className="gsheet">
            <svg width="26" height="26" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
            </svg>
          </div>
          <input
            type="text"
            value={driveLink}
            placeholder="Paste the campaign Drive folder link…"
            spellCheck={false}
            onChange={(e) => {
              setDriveLink(e.target.value);
              onTouch();
            }}
            onBlur={() => saveSetting('drive_folder_url', driveLink)}
          />
          <button className="btn ghost" disabled={!driveLink.trim()} onClick={() => window.open(driveLink, '_blank')}>
            Open ↗
          </button>
          <button
            className="btn primary"
            disabled={scanning || !driveLink.trim()}
            onClick={async () => {
              setScanning(true);
              try {
                // READ-ONLY by design. /api/drive/list-folder-files performs no
                // writes (unlike /api/drive/discover-folder, which upserts
                // athlete rows) — it just lists media and tags each file with
                // the subfolder it sits in. Matching happens here, in memory.
                const res = await fetch('/api/drive/list-folder-files', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ folderUrl: driveLink, recapId, recursive: true }),
                });
                const body = await res.json().catch(() => ({}));

                if (!res.ok) {
                  setDriveMsg(String(body?.error ?? `Scan failed (HTTP ${res.status})`));
                  return;
                }

                const files: { folderName?: string | null }[] = Array.isArray(body?.files)
                  ? body.files
                  : [];

                // Fold Drive subfolder names onto roster names. Loose match:
                // case- and punctuation-insensitive, since folders are named by
                // hand and rarely match the roster spelling exactly.
                const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
                const rosterByKey = new Map(rows.map((a) => [key(a.name ?? ''), a.id]));

                const filesPerFolder = new Map<string, number>();
                files.forEach((f) => {
                  const fn = (f.folderName ?? '').trim();
                  if (fn) filesPerFolder.set(fn, (filesPerFolder.get(fn) ?? 0) + 1);
                });

                const matchedAthletes = new Set<string>();
                let matchedFiles = 0;
                filesPerFolder.forEach((n, folderName) => {
                  const id = rosterByKey.get(key(folderName));
                  if (id) {
                    matchedAthletes.add(id);
                    matchedFiles += n;
                  }
                });

                const unmatchedAthletes = count - matchedAthletes.size;
                setDriveMsg(
                  `Scanned just now · ${matchedAthletes.size} of ${count} athlete folders matched · ` +
                    `${matchedFiles} files found · ${unmatchedAthletes} athletes have no folder yet ` +
                    `· nothing imported (scan is read-only)`,
                );
              } catch (e) {
                setDriveMsg(String((e as Error)?.message ?? e));
              } finally {
                setScanning(false);
              }
            }}
          >
            {scanning ? 'Scanning…' : 'Scan folders'}
          </button>
        </div>

        <div className="synced">
          <span className="dot" />
          <span>
            {driveMsg ??
              `${count - health.noContent} of ${count} athlete folders matched · ${T.files} files staged · ${health.noContent} athletes have no folder yet`}
          </span>
        </div>
        <div className="synced" style={{ marginTop: 6 }}>
          <span>
            {sheetLink.trim()
              ? 'Linked · not synced yet — hit Resync to pull the roster'
              : 'No tracker yet — paste a sheet link to connect this campaign to its performance tracker.'}
          </span>
        </div>
      </section>

      <section>
        <div className="health">
          <span>
            <b>{count}</b> athletes
          </span>
          <span>
            <b>{health.schools}</b> schools
          </span>
          {health.missingReel > 0 && <span className="warn">{health.missingReel} missing reel metrics</span>}
          {health.dupes > 0 && <span className="warn">{health.dupes} possible duplicates</span>}
          {health.noContent > 0 && <span className="warn">{health.noContent} without content</span>}
        </div>

        <div className="ptabs">
          {TABS.map((t) => (
            <div
              key={t.id}
              className={'ptab' + (t.id === active ? ' active' : '')}
              onClick={() => setActive(t.id)}
            >
              <div className="pl">{t.label}</div>
              <div className="pv">
                {t.total}
                <span className="pu">{t.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {heads[active].map((c, i) => (
                  <th key={i} className={numCols[active].includes(i) ? 'num' : undefined}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="totals">
                {totalsRow[active].map((c, i) => (
                  <td key={i} className={numCols[active].includes(i) ? 'num' : undefined}>
                    {c}
                  </td>
                ))}
              </tr>
              {rows.map((a) => (
                <tr key={a.id}>
                  {bodyRow(a).map((cell, i) => (
                    <Fragment key={i}>{cell}</Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p style={{ padding: '18px 0', color: 'rgba(250,248,245,.45)' }}>Loading roster…</p>}
        </div>

        <div className="tfoot">
          <button className="btn ghost" disabled>
            + Add athlete
          </button>
          <span className="morerows">
            {count} of {count} shown · Σ covers all {count}
          </span>
        </div>
      </section>
    </>
  );
}
