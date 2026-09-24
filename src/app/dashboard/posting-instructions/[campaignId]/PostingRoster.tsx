'use client';

// ============================================================
// Posting instructions roster for one campaign — redesigned.
//
// Six PIPELINE CARDS replace the old stat strip and filter tabs, which used to
// disagree: the stats counted posts, the tabs counted athletes, and the tab
// filters overlapped so the numbers never summed to the roster. Now every post
// sits in exactly one stage (stageOf in src/lib/posting-packages.ts) and a card
// both shows a count and applies that filter.
//
// One NEEDS ATTENTION card replaces the two alert boxes, and only appears when
// it has something to say.
//
// Every number on the page is computed from the rows the API returned, never
// typed in. A missing caption or file can only ever read as missing.
//
// "Their link" is ONE link per athlete, always the same one — both of an
// athlete's tokens open the same page, so the link never has to change.
// Copying is all this page does: the Hub never texts anyone.
//
// ?pkg=<id> opens the edit drawer on that post (deep link).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  STAGES,
  addDays,
  athleteInStage,
  deliverUrl,
  filesDone,
  formatPostDate,
  formatShortDay,
  groupAthletes,
  isPastDraft,
  isPosted,
  isSent,
  localToday,
  nextPostDate,
  partsFor,
  postsOf,
  stageOf,
  statusPill,
  type AthleteRow,
  type PostStage,
  type PostingPhoto,
  type StaffPackage,
} from '@/lib/posting-packages';
import PackageDrawer from './PackageDrawer';

type Deliverable = { key: string; label: string; order?: number };

type Campaign = {
  id: string;
  title: string | null;
  seasonLabel: string | null;
  brandName: string | null;
  tagHandle: string | null;
  hashtag: string | null;
  ftcNote: string | null;
  deliverables: Deliverable[];
  logos: { postgame: string | null; brand: string | null };
};

type StageKey = PostStage | 'all';

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* nothing else to try */
  }
  document.body.removeChild(ta);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Athlete name block: initials, name, and school · handle (red when absent). */
function AthleteCell({ a }: { a: AthleteRow }) {
  const meta = [a.school, a.handle ? `@${a.handle}` : null].filter(Boolean).join(' · ');
  return (
    <div className="ath">
      <span className="avatar" aria-hidden="true">{initials(a.name)}</span>
      <span className="who">
        <span className="aname">{a.name}</span>
        {meta ? (
          <span className="ameta">{meta}</span>
        ) : (
          <span className="ameta bad">No school or handle on file</span>
        )}
      </span>
    </div>
  );
}

/** One post cell: date line, one pill, then the part dots. */
function PostCell({
  p,
  photoCount,
  brandName,
  today,
}: {
  p: StaffPackage | null;
  photoCount: number;
  brandName: string | null;
  today: string;
}) {
  if (!p) return <span className="hint">No post</span>;
  const pill = statusPill(p, photoCount, brandName);
  const late = isPastDraft(p, today);
  const date = formatPostDate(p.intended_post_date) ?? 'No date';
  return (
    <div className="pcell">
      <div className="pdate">
        {date}
        {p.date_conditional && <span className="cond"> · if they win</span>}
        {late && <span className="late"> · date passed</span>}
      </div>
      <span className={`pill ${pill.tone}`}>{pill.label}</span>
      <div className="parts">
        {partsFor(p, photoCount).map((part) => (
          <span className={`part ${part.state}`} key={part.label}>
            <i />
            {part.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function LinkState({ a }: { a: AthleteRow }) {
  const posts = postsOf(a);
  if (posts.every(isPosted)) return <span className="lstate posted">Posted</span>;
  const sent = posts.find(isSent);
  if (sent) return <span className="lstate sent">Sent {formatShortDay(sent.sent_at) ?? ''}</span>;
  return <span className="lstate">Not sent</span>;
}

export default function PostingRoster({ campaignId }: { campaignId: string }) {
  const search = useSearchParams();
  // The open drawer lives in local state, seeded from ?pkg= so a deep link
  // opens it. history.replaceState rather than router.replace: on this
  // force-dynamic route a router navigation waits on a server round trip,
  // which made opening and closing the drawer lag.
  const [openPkg, setOpenPkg] = useState<string | null>(() => search.get('pkg'));

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [packages, setPackages] = useState<StaffPackage[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, PostingPhoto[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<StageKey>('all');
  const [lateOnly, setLateOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [rowCopied, setRowCopied] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // today is read on the client so "past" matches the viewer's calendar.
  const [today, setToday] = useState<string>('');
  useEffect(() => setToday(localToday()), []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch(`/api/posting-campaigns/${campaignId}`, { cache: 'no-store' }),
          fetch(`/api/posting-packages?posting_campaign_id=${encodeURIComponent(campaignId)}`, { cache: 'no-store' }),
        ]);
        const c = await cRes.json().catch(() => ({}));
        const p = await pRes.json().catch(() => ({}));
        if (!cRes.ok) throw new Error(c.error || 'Could not load the campaign.');
        if (!pRes.ok) throw new Error(p.error || 'Could not load the posts.');
        if (!live) return;
        setCampaign(c);
        setPackages(p.packages ?? []);
        setPhotos(p.photos ?? {});
      } catch (e: any) {
        if (live) setLoadError(e?.message || 'Could not load this campaign.');
      }
    })();
    return () => {
      live = false;
    };
  }, [campaignId]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);
  useEffect(() => {
    if (!rowCopied) return;
    const t = setTimeout(() => setRowCopied(null), 1400);
    return () => clearTimeout(t);
  }, [rowCopied]);
  useEffect(() => {
    if (!copiedAll) return;
    const t = setTimeout(() => setCopiedAll(false), 1800);
    return () => clearTimeout(t);
  }, [copiedAll]);

  const athletes = useMemo(() => groupAthletes(packages ?? []), [packages]);
  const photoCountOf = useCallback(
    (p: StaffPackage | null) => (p ? (photos[p.id] ?? []).length : 0),
    [photos]
  );
  const countPhotos = useCallback((p: StaffPackage) => photoCountOf(p), [photoCountOf]);

  // ---- the six pipeline cards ----
  const stageCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of STAGES) out[s.key] = athletes.filter((a) => athleteInStage(a, s.key, countPhotos)).length;
    return out;
  }, [athletes, countPhotos]);

  // ---- needs attention ----
  const allPosts = packages ?? [];
  const pastDrafts = today ? allPosts.filter((p) => isPastDraft(p, today) && !isSent(p)) : [];
  const soonNoFiles = today
    ? allPosts.filter(
        (p) =>
          p.intended_post_date &&
          p.intended_post_date >= today &&
          p.intended_post_date <= addDays(today, 7) &&
          !isPosted(p) &&
          !filesDone(p, photoCountOf(p))
      )
    : [];
  const missingDetails = athletes.filter((a) => !a.school || !a.handle);

  // ---- visible list ----
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return athletes.filter((a) => {
      if (!athleteInStage(a, stage, countPhotos)) return false;
      if (lateOnly && !(today && postsOf(a).some((p) => isPastDraft(p, today) && !isSent(p)))) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.school ?? '').toLowerCase().includes(q) ||
        (a.handle ?? '').toLowerCase().includes(q)
      );
    });
  }, [athletes, stage, lateOnly, query, today, countPhotos]);

  // Grouped by each athlete's next post date: soonest first, dates already
  // gone last, undated after those.
  const groups = useMemo(() => {
    const byDate = new Map<string, AthleteRow[]>();
    for (const a of visible) {
      const d = nextPostDate(a) ?? '';
      const list = byDate.get(d);
      if (list) list.push(a);
      else byDate.set(d, [a]);
    }
    const keys = Array.from(byDate.keys());
    const upcoming = keys.filter((k) => k && (!today || k >= today)).sort();
    const past = keys.filter((k) => k && today && k < today).sort();
    const ordered = [...upcoming, ...past, ...(byDate.has('') ? [''] : [])];
    return ordered.map((d) => {
      const rows = byDate.get(d)!.sort((x, y) => x.name.localeCompare(y.name));
      const isPast = !!d && !!today && d < today;
      const days = d && today ? Math.round((Date.parse(d) - Date.parse(today)) / 86400000) : null;
      const when = isPast
        ? 'date passed, still not sent'
        : days === 0
          ? 'today'
          : days === 1
            ? 'tomorrow'
            : days !== null
              ? `in ${days} days`
              : '';
      return {
        date: d,
        label: d ? formatPostDate(d) ?? d : 'No date set',
        count: `${rows.length} athlete${rows.length === 1 ? '' : 's'}`,
        when,
        isPast,
        rows,
      };
    });
  }, [visible, today]);

  // ---- drawer ----
  const drawerAthlete = openPkg ? athletes.find((a) => postsOf(a).some((p) => p.id === openPkg)) ?? null : null;
  const setPkgParam = useCallback((id: string | null) => {
    setOpenPkg(id);
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('pkg', id);
      else url.searchParams.delete('pkg');
      window.history.replaceState(window.history.state, '', url.pathname + url.search);
    } catch {
      /* URL sync is a convenience; the drawer state is what matters */
    }
  }, []);
  const applyUpdates = useCallback((updated: StaffPackage[]) => {
    setPackages((prev) => {
      if (!prev) return prev;
      const byId = new Map(updated.map((u) => [u.id, u]));
      return prev.map((p) => byId.get(p.id) ?? p);
    });
  }, []);

  // ---- selection ----
  const selectedAthletes = athletes.filter((a) => selected.has(a.key));
  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.has(a.key));
  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allVisibleSelected) visible.forEach((a) => n.delete(a.key));
      else visible.forEach((a) => n.add(a.key));
      return n;
    });

  // ---- copy ----
  const readyAthletes = useMemo(
    () => athletes.filter((a) => athleteInStage(a, 'ready', countPhotos)),
    [athletes, countPhotos]
  );
  const linkLine = (a: AthleteRow) => `${a.name} — ${deliverUrl(a.link.delivery_token)}`;

  async function copyReady() {
    if (!readyAthletes.length) return;
    await copyText(readyAthletes.map(linkLine).join('\n'));
    setCopiedAll(true);
  }
  async function bulkCopy() {
    await copyText(selectedAthletes.map(linkLine).join('\n'));
    setFlash(`Copied ${selectedAthletes.length} link${selectedAthletes.length === 1 ? '' : 's'}. Paste them into your texts.`);
  }

  // ---- mark as sent (confirmed) ----
  async function doMarkSent() {
    setConfirmSend(false);
    // One text carries every post, so sending marks all of an athlete's
    // drafts — not just the post whose token is in the link.
    const targets = selectedAthletes.flatMap(postsOf).filter((p) => p.status === 'draft' && !isSent(p));
    if (!targets.length) {
      setFlash('Nothing to mark: those links are already sent.');
      return;
    }
    setBulkBusy(true);
    const updated: StaffPackage[] = [];
    let failed = 0;
    for (const p of targets) {
      try {
        const res = await fetch(`/api/posting-packages/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent' }),
        });
        if (!res.ok) throw new Error();
        updated.push(await res.json());
      } catch {
        failed++;
      }
    }
    applyUpdates(updated);
    setBulkBusy(false);
    setFlash(
      failed
        ? `Marked ${updated.length} post${updated.length === 1 ? '' : 's'} as sent. ${failed} failed — try those again.`
        : `Marked ${updated.length} post${updated.length === 1 ? '' : 's'} as sent for ${selectedAthletes.length} athlete${selectedAthletes.length === 1 ? '' : 's'}.`
    );
  }

  // ---- render ----
  if (loadError) {
    return (
      <div className="pi">
        <p className="err" role="alert">{loadError}</p>
        <p><Link href="/dashboard/posting-instructions">Back to posting instructions</Link></p>
      </div>
    );
  }
  if (!campaign || !packages) {
    return (
      <div className="pi">
        <p className="lab">Loading…</p>
      </div>
    );
  }

  const title = [campaign.title, campaign.seasonLabel].filter(Boolean).join(' · ') || 'Posting campaign';
  const deliverableWords = (campaign.deliverables ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((d) => (d.key === 'reel' ? 'Reel + cover' : d.label));
  const summary = [
    `${athletes.length} athlete${athletes.length === 1 ? '' : 's'}`,
    `${packages.length} posts${deliverableWords.length ? ` (${deliverableWords.join(', then a ')})` : ''}`,
    campaign.tagHandle ? `tag @${campaign.tagHandle}` : null,
    campaign.hashtag ? `#${campaign.hashtag}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const stageLabel = STAGES.find((s) => s.key === stage)?.label ?? 'All athletes';

  return (
    <div className="pi">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/dashboard/posting-instructions" className="lab">Posting instructions</Link>
        <span className="lab">/</span>
        <span className="lab" style={{ color: 'var(--ink-2)' }}>{campaign.brandName ?? 'Campaign'}</span>
      </nav>

      <header className="head">
        <div className="who">
          {campaign.logos.brand && (
            <div className="plate">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={campaign.logos.brand} alt={campaign.brandName ?? ''} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p className="eye">Posting instructions</p>
            <h1 className="title">{title}</h1>
            <p className="summary">{summary}</p>
          </div>
        </div>
        <div className="headacts">
          <button type="button" className="btn g" onClick={() => setShowRules(true)}>
            Campaign rules
          </button>
          <button
            type="button"
            className="btn p"
            onClick={copyReady}
            disabled={readyAthletes.length === 0}
            title={readyAthletes.length ? 'Copies name + link for each ready athlete' : undefined}
          >
            {copiedAll
              ? 'Copied'
              : readyAthletes.length
                ? `Copy ${readyAthletes.length} ready link${readyAthletes.length === 1 ? '' : 's'}`
                : 'No links ready yet'}
          </button>
        </div>
      </header>

      {/* ---- pipeline ---- */}
      <div className="pipeline" role="group" aria-label="Filter by stage">
        {STAGES.map((s) => {
          const n = stageCounts[s.key] ?? 0;
          const on = stage === s.key && !lateOnly;
          return (
            <button
              key={s.key}
              type="button"
              className={`pcard${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => {
                setStage(s.key);
                setLateOnly(false);
              }}
            >
              <span className={`n${s.key === 'needs_caption' && n > 0 ? ' bad' : ''}`}>{n}</span>
              <span className="lab">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---- needs attention ---- */}
      {(pastDrafts.length > 0 || soonNoFiles.length > 0 || missingDetails.length > 0) && (
        <section className="attention" aria-label="Needs attention">
          <p className="lab">Needs attention</p>
          {pastDrafts.length > 0 && (
            <div className="arow">
              <div>
                <div className="t">
                  {pastDrafts.length} post{pastDrafts.length === 1 ? '' : 's'} {pastDrafts.length === 1 ? 'is' : 'are'} past {pastDrafts.length === 1 ? 'its' : 'their'} date and {pastDrafts.length === 1 ? 'was' : 'were'} never marked sent.
                </div>
                <p>Mark the ones that went out, or move them to a new date.</p>
              </div>
              <button
                type="button"
                className="btn g sm"
                onClick={() => {
                  setStage('all');
                  setLateOnly(true);
                }}
              >
                Review {pastDrafts.length}
              </button>
            </div>
          )}
          {soonNoFiles.length > 0 && (
            <div className="arow">
              <div>
                <div className="t">
                  {soonNoFiles.length} post{soonNoFiles.length === 1 ? '' : 's'} go{soonNoFiles.length === 1 ? 'es' : ''} live in the next 7 days without {soonNoFiles.length === 1 ? 'its' : 'their'} files.
                </div>
                <p>Athletes see an “on its way” slot until the files are attached.</p>
              </div>
              <button
                type="button"
                className="btn g sm"
                onClick={() => {
                  setStage('awaiting_files');
                  setLateOnly(false);
                }}
              >
                Show them
              </button>
            </div>
          )}
          {missingDetails.length > 0 && (
            <div className="arow">
              <div>
                <div className="t">
                  {missingDetails.length} athlete{missingDetails.length === 1 ? '' : 's'} {missingDetails.length === 1 ? 'is' : 'are'} missing a school or handle
                </div>
                <p>{missingDetails.map((a) => a.name).join(', ')}</p>
              </div>
              <button
                type="button"
                className="btn g sm"
                onClick={() => {
                  setStage('all');
                  setLateOnly(false);
                  setQuery(missingDetails.length === 1 ? missingDetails[0].name : '');
                }}
              >
                Show them
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---- list heading ---- */}
      <div className="listhead">
        <h2>
          {lateOnly ? 'Past date, still not sent' : stageLabel}
          <span className="c">{visible.length}</span>
        </h2>
        <label className="search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search athlete or school"
            aria-label="Search athlete or school"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {/* ---- desktop table ---- */}
      <div className="roster" role="table" aria-label="Athletes">
        <div className="trow th" role="row">
          <span role="columnheader">
            <input type="checkbox" aria-label="Select all shown" checked={allVisibleSelected} onChange={toggleAll} />
          </span>
          <span className="lab" role="columnheader">Athlete</span>
          <span className="lab" role="columnheader">1 · Reel + cover</span>
          <span className="lab" role="columnheader">2 · Feed post</span>
          <span className="lab" role="columnheader">Their link</span>
          <span role="columnheader" />
        </div>
        {groups.length === 0 && <div className="empty">No athletes match.</div>}
        {groups.map((g) => (
          <div key={g.date || 'none'} role="rowgroup">
            <div className={`group${g.isPast ? ' past' : ''}`}>
              <span className="d">{g.label}</span>
              <span className="lab">· {g.count}</span>
              {g.when && <span className={`lab${g.isPast ? ' late' : ''}`}>· {g.when}</span>}
            </div>
            {g.rows.map((a) => (
              <div
                className="trow row"
                role="row"
                key={a.key}
                onClick={() => setPkgParam(a.link.id)}
              >
                <span role="cell" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${a.name}`} checked={selected.has(a.key)} onChange={() => toggle(a.key)} />
                </span>
                <div role="cell" style={{ minWidth: 0 }}><AthleteCell a={a} /></div>
                <div role="cell">
                  <PostCell p={a.reel} photoCount={photoCountOf(a.reel)} brandName={campaign.brandName} today={today} />
                </div>
                <div role="cell">
                  <PostCell p={a.feed} photoCount={photoCountOf(a.feed)} brandName={campaign.brandName} today={today} />
                </div>
                <div role="cell" className="linkcell" onClick={(e) => e.stopPropagation()}>
                  <LinkState a={a} />
                  <button
                    type="button"
                    className="link-btn lab"
                    onClick={async () => {
                      await copyText(deliverUrl(a.link.delivery_token));
                      setRowCopied(a.key);
                    }}
                  >
                    {rowCopied === a.key ? 'Copied' : 'Copy link'}
                  </button>
                </div>
                <span role="cell">
                  <span className="open" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ---- phone cards ---- */}
      <div className="cards">
        {groups.length === 0 && <div className="empty">No athletes match.</div>}
        {groups.map((g) => (
          <div key={g.date || 'none'}>
            <div className={`group${g.isPast ? ' past' : ''}`}>
              <span className="d">{g.label}</span>
              <span className="lab">· {g.count}</span>
              {g.when && <span className={`lab${g.isPast ? ' late' : ''}`}>· {g.when}</span>}
            </div>
            {g.rows.map((a) => (
              <div className="card" key={a.key}>
                <div className="top">
                  <input
                    type="checkbox"
                    aria-label={`Select ${a.name}`}
                    checked={selected.has(a.key)}
                    onChange={() => toggle(a.key)}
                    style={{ marginTop: 6 }}
                  />
                  <button type="button" className="grow" onClick={() => setPkgParam(a.link.id)} aria-label={`Open ${a.name}`}>
                    <AthleteCell a={a} />
                  </button>
                </div>
                <div className="sub">
                  <div>
                    <span className="lab">1 · Reel + cover</span>
                    <PostCell p={a.reel} photoCount={photoCountOf(a.reel)} brandName={campaign.brandName} today={today} />
                  </div>
                  <div>
                    <span className="lab">2 · Feed post</span>
                    <PostCell p={a.feed} photoCount={photoCountOf(a.feed)} brandName={campaign.brandName} today={today} />
                  </div>
                  <div className="linkcell row">
                    <LinkState a={a} />
                    <button
                      type="button"
                      className="link-btn lab"
                      onClick={async () => {
                        await copyText(deliverUrl(a.link.delivery_token));
                        setRowCopied(a.key);
                      }}
                    >
                      {rowCopied === a.key ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ---- bulk bar ---- */}
      {(selectedAthletes.length > 0 || flash) && (
        <div className="bulk" role="region" aria-label="Selected athletes">
          <span role="status">
            {flash ?? `${selectedAthletes.length} selected`}
          </span>
          {selectedAthletes.length > 0 && (
            <div className="acts">
              <button type="button" className="btn g sm" onClick={bulkCopy}>Copy their links</button>
              <button type="button" className="btn p sm" onClick={() => setConfirmSend(true)} disabled={bulkBusy}>
                {bulkBusy ? 'Marking…' : 'Mark as sent'}
              </button>
              <button type="button" className="btn g sm" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
        </div>
      )}

      {/* ---- confirm mark as sent ---- */}
      {confirmSend && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm mark as sent">
          <div className="box sm">
            <div className="mhead">
              <div>
                <p className="lab">Mark as sent</p>
                <div style={{ color: 'var(--ink-1)', fontWeight: 700, marginTop: 4 }}>
                  {selectedAthletes.length} athlete{selectedAthletes.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="mbody">
              <p className="hint">
                This records that you texted their link. It marks every post of{' '}
                {selectedAthletes.length === 1 ? 'this athlete' : 'these athletes'} that is still a draft.
                It does not send anything — the Hub never texts athletes.
              </p>
            </div>
            <div className="dfoot">
              <button type="button" className="btn g" onClick={() => setConfirmSend(false)}>Cancel</button>
              <button type="button" className="btn p" onClick={doMarkSent}>Yes, mark as sent</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- campaign rules (read-only) ---- */}
      {showRules && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Campaign rules">
          <div className="box sm">
            <div className="mhead">
              <div>
                <p className="lab">Campaign rules</p>
                <div style={{ color: 'var(--ink-1)', fontWeight: 700, marginTop: 4 }}>{title}</div>
              </div>
              <button type="button" className="close" onClick={() => setShowRules(false)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mbody rules">
              <div className="rule">
                <span className="lab">Tag</span>
                <div>{campaign.tagHandle ? `@${campaign.tagHandle}` : 'Not set'}</div>
              </div>
              <div className="rule">
                <span className="lab">Hashtag</span>
                <div>{campaign.hashtag ? `#${campaign.hashtag}` : 'Not set'}</div>
              </div>
              <div className="rule">
                <span className="lab">Posts each athlete makes</span>
                <div>{deliverableWords.join(', then a ') || 'Not set'}</div>
              </div>
              <div className="rule">
                <span className="lab">FTC note athletes see</span>
                <div>{campaign.ftcNote ?? 'Not set'}</div>
              </div>
              <p className="hint">
                These come from the campaign and apply to every athlete. Editing them
                is campaign setup, which isn&apos;t built yet.
              </p>
            </div>
            <div className="dfoot">
              <button type="button" className="btn g" onClick={() => setShowRules(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {drawerAthlete && openPkg && (
        <PackageDrawer
          key={drawerAthlete.key}
          athlete={drawerAthlete}
          activeId={openPkg}
          campaignId={campaignId}
          brandName={campaign.brandName}
          onSelect={(id) => setPkgParam(id)}
          onClose={() => setPkgParam(null)}
          onUpdated={applyUpdates}
          photos={photos}
          onPhotosChanged={(packageId, next) => setPhotos((prev) => ({ ...prev, [packageId]: next }))}
        />
      )}
    </div>
  );
}
