'use client';

// ============================================================
// Posting instructions roster for one campaign (mockup boards 1 + 4).
//
// One row per ATHLETE, grouped by their Reel date. Every number on the page
// — the count strip, alert counts, filter counts — is computed from the rows
// the API returned, never typed in (rules in src/lib/posting-packages.ts).
//
// "Their link": each post has its own private link, so the link column,
// Copy links and Mark as sent act on the athlete's NEXT post that's due
// (the earliest-dated one not yet posted — the Reel, for everyone today).
//
// The Hub sends nothing itself (decided 2026-09-23). "Copy links" puts a
// plain-text block on the clipboard for staff to text out; "Mark as sent"
// only records that they did.
//
// ?pkg=<id> opens the edit drawer on that post (deep link).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  addDays,
  deliverUrl,
  formatPostDate,
  formatShortDay,
  groupAthletes,
  isPastDraft,
  isPosted,
  isSent,
  localToday,
  matchesFilter,
  missingFiles,
  pillsFor,
  postsOf,
  rosterCounts,
  type AthleteRow,
  type FilterKey,
  type StaffPackage,
} from '@/lib/posting-packages';
import PackageDrawer from './PackageDrawer';

type Campaign = {
  id: string;
  title: string | null;
  seasonLabel: string | null;
  brandName: string | null;
  logos: { postgame: string | null; brand: string | null };
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_caption', label: 'Needs caption' },
  { key: 'awaiting_files', label: 'Awaiting files' },
  { key: 'ready', label: 'Ready to send' },
  { key: 'sent', label: 'Sent' },
  { key: 'posted', label: 'Posted' },
];

const PILL_WORD = { ok: 'Approved', pending: 'Awaiting brand', rev: 'In revision', none: 'Not added yet' } as const;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall back */
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
    /* nothing else */
  }
  document.body.removeChild(ta);
}

function Pills({ p }: { p: StaffPackage | null }) {
  if (!p) return <span className="hint">No post</span>;
  return (
    <div className="cell-pills">
      {pillsFor(p).map((pill) => (
        <span key={pill.label} className={`st ${pill.state}`} title={`${pill.label}: ${PILL_WORD[pill.state]}`}>
          <i />
          {pill.label}
        </span>
      ))}
    </div>
  );
}

function PostCell({ p }: { p: StaffPackage | null }) {
  return (
    <div>
      <span className="lab">{p ? formatPostDate(p.intended_post_date) ?? 'No date' : '—'}</span>
      <Pills p={p} />
    </div>
  );
}

function LinkState({ a }: { a: AthleteRow }) {
  const p = a.next;
  if (isPosted(p) && p.live_url) {
    return (
      <a href={p.live_url} target="_blank" rel="noopener noreferrer">
        Posted ↗
      </a>
    );
  }
  if (isPosted(p)) return <span>Posted</span>;
  if (isSent(p)) return <span>Sent {formatShortDay(p.sent_at) ?? ''}</span>;
  return <span style={{ color: 'var(--ink-4)' }}>Not sent</span>;
}

function linkLine(a: AthleteRow) {
  return `${a.name} — ${deliverUrl(a.next.delivery_token)}`;
}

export default function PostingRoster({ campaignId }: { campaignId: string }) {
  const search = useSearchParams();
  // The open drawer lives in local state, seeded from ?pkg= so a deep link
  // opens it. The URL is kept in step with history.replaceState rather than
  // router.replace: on this force-dynamic route a router navigation waits on
  // a server round trip, which made opening and closing the drawer lag.
  const [openPkg, setOpenPkg] = useState<string | null>(() => search.get('pkg'));

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [packages, setPackages] = useState<StaffPackage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowCopied, setRowCopied] = useState<string | null>(null);

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

  const athletes = useMemo(() => groupAthletes(packages ?? []), [packages]);
  const counts = useMemo(() => rosterCounts(packages ?? []), [packages]);

  const filterCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of [...FILTERS.map((x) => x.key), 'past_draft' as const]) {
      out[f] = today ? athletes.filter((a) => matchesFilter(a, f, today)).length : 0;
    }
    return out;
  }, [athletes, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return athletes.filter(
      (a) =>
        (today ? matchesFilter(a, filter, today) : true) &&
        (!q || a.name.toLowerCase().includes(q) || (a.school ?? '').toLowerCase().includes(q) || (a.handle ?? '').toLowerCase().includes(q))
    );
  }, [athletes, filter, query, today]);

  // Groups by Reel date: upcoming first (soonest first), then past (most
  // recent first), then undated.
  const groups = useMemo(() => {
    const byDate = new Map<string, AthleteRow[]>();
    for (const a of visible) {
      const d = (a.reel ?? a.next).intended_post_date ?? '';
      const list = byDate.get(d);
      if (list) list.push(a);
      else byDate.set(d, [a]);
    }
    const keys = Array.from(byDate.keys());
    const upcoming = keys.filter((k) => k && (!today || k >= today)).sort();
    const past = keys.filter((k) => k && today && k < today).sort().reverse();
    const ordered = [...upcoming, ...past, ...(byDate.has('') ? [''] : [])];
    return ordered.map((d) => {
      const rows = byDate.get(d)!.sort((x, y) => x.name.localeCompare(y.name));
      const isPast = !!d && !!today && d < today;
      const lateDrafts = rows.filter((a) => a.reel && isPastDraft(a.reel, today)).length;
      const days = d && today ? Math.round((Date.parse(d) - Date.parse(today)) / 86400000) : null;
      return {
        date: d,
        label: d ? formatPostDate(d) ?? d : 'No Reel date',
        sub: isPast
          ? lateDrafts
            ? `${lateDrafts} · date passed, still draft`
            : 'Date passed'
          : days === 0
            ? `${rows.length} · today`
            : days !== null
              ? `${rows.length} · in ${days} day${days === 1 ? '' : 's'}`
              : `${rows.length}`,
        late: isPast && lateDrafts > 0,
        isPast,
        rows,
      };
    });
  }, [visible, today]);

  // ---- alerts ----
  const pastDrafts = today ? (packages ?? []).filter((p) => isPastDraft(p, today)) : [];
  const soon = today
    ? (packages ?? []).filter((p) => p.intended_post_date && p.intended_post_date >= today && p.intended_post_date <= addDays(today, 7) && !isPosted(p))
    : [];
  const soonMissingFiles = soon.filter(missingFiles).length;
  const soonMissingCaption = soon.filter((p) => !p.caption_medium?.trim()).length;

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

  // ---- selection + bulk ----
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
      if (allVisibleSelected) {
        const n = new Set(s);
        visible.forEach((a) => n.delete(a.key));
        return n;
      }
      return new Set([...Array.from(s), ...visible.map((a) => a.key)]);
    });

  async function bulkCopy() {
    await copyText(selectedAthletes.map(linkLine).join('\n'));
    setFlash(`Copied ${selectedAthletes.length} link${selectedAthletes.length === 1 ? '' : 's'}. Paste them into your texts.`);
  }

  async function bulkMarkSent() {
    const targets = selectedAthletes.map((a) => a.next).filter((p) => p.status === 'draft' && !isSent(p));
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
        ? `Marked ${updated.length} as sent. ${failed} failed — try those again.`
        : `Marked ${updated.length} link${updated.length === 1 ? '' : 's'} as sent.`
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
          </div>
        </div>
      </header>

      <div className="counts">
        <div><div className="n">{counts.athletes}</div><span className="lab">Athletes</span></div>
        <div><div className="n">{counts.posts}</div><span className="lab">Posts</span></div>
        <div><div className="n">{counts.linksSent}</div><span className="lab">Links sent</span></div>
        <div><div className="n">{counts.posted}</div><span className="lab">Posted</span></div>
        <div><div className="n">{counts.captionsMissing}</div><span className="lab">Captions missing</span></div>
      </div>

      {(pastDrafts.length > 0 || soon.length > 0) && (
        <div className={`alerts${pastDrafts.length > 0 && soon.length > 0 ? ' two' : ''}`}>
          {pastDrafts.length > 0 && (
            <div className="alert warn" role="status">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.8l6.5 11.4H1.5z" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M8 6.2v3.3" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="8" cy="11.4" r=".9" fill="var(--accent)" />
              </svg>
              <div>
                <div className="t">
                  {pastDrafts.length} post{pastDrafts.length === 1 ? '' : 's'} dated before today {pastDrafts.length === 1 ? 'is' : 'are'} still Draft
                </div>
                <p>Their links were never marked sent. Mark the ones that went out, or move them to a new date.</p>
                <button type="button" className="btn g sm" style={{ marginTop: 10 }} onClick={() => setFilter('past_draft')}>
                  Review these {filterCounts.past_draft}
                </button>
              </div>
            </div>
          )}
          {soon.length > 0 && (
            <div className="alert" role="status">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.2" stroke="var(--ink-1)" strokeWidth="1.5" />
                <path d="M8 4.8V8l2.2 1.4" stroke="var(--ink-1)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div>
                <div className="t">
                  {soon.length} post{soon.length === 1 ? '' : 's'} go{soon.length === 1 ? 'es' : ''} live in the next 7 days
                </div>
                <p>
                  {soonMissingFiles
                    ? `${soonMissingFiles} still ${soonMissingFiles === 1 ? 'lacks' : 'lack'} files`
                    : 'All have their files'}
                  {soonMissingCaption ? `, ${soonMissingCaption} ${soonMissingCaption === 1 ? 'has' : 'have'} no caption` : ''}.
                  {' '}Athletes see a labelled “awaiting” slot until a file is attached.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="filters">
        <div className="pills" role="group" aria-label="Filter athletes">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="pillnav" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} <b>{filterCounts[f.key] ?? 0}</b>
            </button>
          ))}
          {filter === 'past_draft' && (
            <button type="button" className="pillnav" aria-pressed onClick={() => setFilter('all')}>
              Past date, still draft <b>{filterCounts.past_draft}</b> ✕
            </button>
          )}
        </div>
        <label className="search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input type="search" placeholder="Search athlete or school" aria-label="Search athlete or school" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="key" aria-label="Key">
        <span className="lab">Key</span>
        <span className="st ok"><i />Approved</span>
        <span className="st pending"><i />Awaiting {campaign.brandName ?? 'brand'}</span>
        <span className="st rev"><i />In revision</span>
        <span className="st none"><i />Not added yet</span>
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
              <span className={`lab${g.late ? ' late' : ''}`}>{g.sub}</span>
            </div>
            {g.rows.map((a) => (
              <div className="trow" role="row" key={a.key}>
                <span role="cell">
                  <input type="checkbox" aria-label={`Select ${a.name}`} checked={selected.has(a.key)} onChange={() => toggle(a.key)} />
                </span>
                <div role="cell" style={{ minWidth: 0 }}>
                  <div className="aname">{a.name}</div>
                  <AthleteMeta a={a} />
                </div>
                <div role="cell"><PostCell p={a.reel} /></div>
                <div role="cell"><PostCell p={a.feed} /></div>
                <div role="cell" className="linkcell">
                  <LinkState a={a} />
                  <button
                    type="button"
                    className="link-btn lab"
                    onClick={async () => {
                      await copyText(deliverUrl(a.next.delivery_token));
                      setRowCopied(a.key);
                    }}
                  >
                    {rowCopied === a.key ? 'Copied' : 'Copy link'}
                  </button>
                </div>
                <span role="cell">
                  <button type="button" className="open" aria-label={`Open ${a.name}`} onClick={() => setPkgParam(a.next.id)}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
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
              <span className={`lab${g.late ? ' late' : ''}`}>{g.sub}</span>
            </div>
            {g.rows.map((a) => (
              <div className="card" key={a.key}>
                <div className="top">
                  <input type="checkbox" aria-label={`Select ${a.name}`} checked={selected.has(a.key)} onChange={() => toggle(a.key)} style={{ marginTop: 4 }} />
                  <button type="button" className="grow" onClick={() => setPkgParam(a.next.id)} aria-label={`Open ${a.name}`}>
                    <div className="aname">{a.name}</div>
                    <AthleteMeta a={a} />
                  </button>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--ink-1)', marginTop: 6 }}>
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="sub">
                  <div><span className="lab">1 · Reel</span> <PostCell p={a.reel} /></div>
                  <div><span className="lab">2 · Feed</span> <PostCell p={a.feed} /></div>
                  <div className="linkcell" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <LinkState a={a} />
                    <button
                      type="button"
                      className="link-btn lab"
                      onClick={async () => {
                        await copyText(deliverUrl(a.next.delivery_token));
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

      {(selectedAthletes.length > 0 || flash) && (
        <div className="bulk" role="region" aria-label="Selected athletes">
          <span style={{ color: 'var(--ink-1)' }} role="status">
            {flash ?? `${selectedAthletes.length} selected · links for each athlete's next post`}
          </span>
          {selectedAthletes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn g sm" onClick={() => setSelected(new Set())}>Clear</button>
              <button type="button" className="btn g sm" onClick={bulkCopy}>Copy links</button>
              <button type="button" className="btn p sm" onClick={bulkMarkSent} disabled={bulkBusy}>
                {bulkBusy ? 'Marking…' : 'Mark as sent'}
              </button>
            </div>
          )}
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
        />
      )}
    </div>
  );
}

function AthleteMeta({ a }: { a: AthleteRow }) {
  const meta = [a.school, a.handle ? `@${a.handle}` : null].filter(Boolean).join(' · ');
  return meta ? <div className="ameta">{meta}</div> : <div className="ameta blank">No school or handle on file</div>;
}
