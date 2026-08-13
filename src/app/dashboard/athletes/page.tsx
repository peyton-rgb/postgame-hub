// ============================================================
// Athlete Browse — /dashboard/athletes
//
// The first surface in the Hub that reads `people`. Read-only:
// nothing here writes, and there are no row actions.
//
// All filtering, sorting, counting and paging happen in Postgres
// via /api/people. This page holds at most one page of rows in
// state — never the full ~31k browsable set.
// ============================================================

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardContent from '@/components/DashboardContent';

const PAGE_SIZE = 50;

type Athlete = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport: string | null;
  college_raw: string | null;
  college_state: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  gender: string | null;
};

type ApiResponse = {
  rows: Athlete[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

// `people.gender` stores single-letter codes. M and W read as the athlete's
// division; N is undocumented in the source and covers 727 of 31,374 rows.
// Labels are display-only — the filter still sends the raw code.
const GENDERS = [
  { code: 'M', label: 'Men' },
  { code: 'W', label: 'Women' },
  { code: 'N', label: 'Other / unspecified' },
];

const TIERS = [
  { code: '1m', label: '1M+' },
  { code: '100k', label: '100K – 1M' },
  { code: '10k', label: '10K – 100K' },
  { code: '1k', label: '1K – 10K' },
  { code: 'under1k', label: 'Under 1K' },
];

function formatFollowers(n: number | null): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function fullName(a: Athlete): string {
  const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unnamed';
}

const inputClass =
  'bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#D73F09]/50 transition-colors';

const selectClass = `${inputClass} appearance-none cursor-pointer`;

export default function AthletesPage() {
  // Text inputs are debounced, so they get their own immediate state and a
  // settled copy that actually drives fetching.
  const [qInput, setQInput] = useState('');
  const [schoolInput, setSchoolInput] = useState('');
  const [q, setQ] = useState('');
  const [school, setSchool] = useState('');

  const [sport, setSport] = useState('');
  const [gender, setGender] = useState('');
  const [tier, setTier] = useState('');
  const [sort, setSort] = useState<'followers' | 'name'>('followers');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow early request overwriting a newer one.
  const requestSeq = useRef(0);

  // ---- Debounce the two text inputs ----
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    const t = setTimeout(() => setSchool(schoolInput.trim()), 300);
    return () => clearTimeout(t);
  }, [schoolInput]);

  // Any filter change invalidates the current offset — page 3 of the old
  // result set is meaningless against the new one.
  useEffect(() => {
    setPage(1);
  }, [q, school, sport, gender, tier, sort]);

  // ---- Sport list for the dropdown, fetched once ----
  useEffect(() => {
    let cancelled = false;
    fetch('/api/people?facets=1')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        if (!cancelled) setSports(json.sports ?? []);
      })
      .catch(() => {
        // A missing sport list degrades the filter, not the page.
        if (!cancelled) setSports([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (school) p.set('school', school);
    if (sport) p.set('sport', sport);
    if (gender) p.set('gender', gender);
    if (tier) p.set('tier', tier);
    if (sort !== 'followers') p.set('sort', sort);
    p.set('page', String(page));
    p.set('pageSize', String(PAGE_SIZE));
    return p.toString();
  }, [q, school, sport, gender, tier, sort, page]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    fetch(`/api/people?${queryString}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((json: ApiResponse) => {
        if (seq !== requestSeq.current) return; // a newer request already won
        setData(json);
      })
      .catch((e: Error) => {
        if (seq !== requestSeq.current) return;
        setError(e.message);
        setData(null);
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [queryString]);

  const clearAll = useCallback(() => {
    setQInput('');
    setSchoolInput('');
    setSport('');
    setGender('');
    setTier('');
  }, []);

  const hasFilters = Boolean(q || school || sport || gender || tier);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = data?.pageCount ?? 1;
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  return (
    <DashboardContent>
      {/* Page header */}
      <div className="mb-8">
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#D73F09] uppercase mb-1">
          Athlete Database
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Athletes</h1>
        <p className="text-sm text-white/40">
          Active, non-archived athletes in the Postgame network
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            inputMode="search"
            placeholder="Search name or @handle..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className={inputClass}
            aria-label="Search by name or Instagram handle"
          />
          {/* School is a text input, not a dropdown: college_id is unpopulated
              and college_raw holds 1,094 distinct free-text spellings. */}
          <input
            type="text"
            inputMode="search"
            placeholder="Search school..."
            value={schoolInput}
            onChange={(e) => setSchoolInput(e.target.value)}
            className={inputClass}
            aria-label="Search by school"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className={selectClass}
            aria-label="Filter by sport"
          >
            <option value="">All sports</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={selectClass}
            aria-label="Filter by gender"
          >
            <option value="">All genders</option>
            {GENDERS.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>

          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className={selectClass}
            aria-label="Filter by follower count"
          >
            <option value="">All followers</option>
            {TIERS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'followers' | 'name')}
            className={selectClass}
            aria-label="Sort order"
          >
            <option value="followers">Most followers</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Result count — the number is the point of this page, so it stays
          visible and checkable even while a new page is loading. */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-[11px] text-white/30" aria-live="polite">
          {error ? (
            <span className="text-[#D73F09]">Could not load athletes</span>
          ) : loading && !data ? (
            'Loading...'
          ) : total === 0 ? (
            'No matching athletes'
          ) : (
            <>
              Showing{' '}
              <span className="text-white/60 font-medium">
                {firstRow.toLocaleString()}–{lastRow.toLocaleString()}
              </span>{' '}
              of <span className="text-white/60 font-medium">{total.toLocaleString()}</span>{' '}
              athletes
            </>
          )}
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-[11px] text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-[#111] border border-[#D73F09]/30 rounded-lg p-4 text-sm text-white/60">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && !error && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#111] border border-white/[0.06] rounded-lg h-14 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Results */}
      {!error && data && rows.length > 0 && (
        <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          {/* Mobile: stacked cards. A 5-column table does not survive 390px. */}
          <div className="md:hidden space-y-2">
            {rows.map((a) => (
              <div
                key={a.id}
                className="bg-[#111] border border-white/[0.06] rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {fullName(a)}
                    </div>
                    <div className="text-[11px] text-white/40 truncate">
                      {a.sport || '—'}
                      {a.college_raw ? ` · ${a.college_raw}` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-white tabular-nums">
                      {formatFollowers(a.instagram_followers)}
                    </div>
                    <div className="text-[10px] text-white/25 uppercase tracking-wider">
                      followers
                    </div>
                  </div>
                </div>
                {a.instagram_handle && (
                  <div className="text-[11px] text-white/30 mt-1.5 truncate">
                    @{a.instagram_handle.replace(/^@/, '')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-[#111] border border-white/[0.06] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  {['Name', 'Sport', 'School', 'Instagram', 'Followers'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/30 font-medium ${
                        i === 4 ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-white/90 whitespace-nowrap">
                      {fullName(a)}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 whitespace-nowrap">
                      {a.sport || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 max-w-[260px] truncate">
                      {a.college_raw || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 whitespace-nowrap">
                      {a.instagram_handle ? `@${a.instagram_handle.replace(/^@/, '')}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-white/80 text-right tabular-nums whitespace-nowrap">
                      {formatFollowers(a.instagram_followers)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!error && data && rows.length === 0 && (
        <div className="text-center py-16">
          <div className="text-white/20 text-lg font-semibold mb-2">No matching athletes</div>
          <p className="text-sm text-white/15">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Pagination — offsets are sent to the server; no client-side slicing. */}
      {!error && data && pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1 || loading}
            className="px-4 py-2 text-sm rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 disabled:opacity-25 disabled:pointer-events-none transition-colors"
          >
            Previous
          </button>
          <div className="text-[11px] text-white/30 tabular-nums">
            Page {page.toLocaleString()} of {pageCount.toLocaleString()}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, pageCount))}
            disabled={page >= pageCount || loading}
            className="px-4 py-2 text-sm rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 disabled:opacity-25 disabled:pointer-events-none transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </DashboardContent>
  );
}
