// ============================================================
// People (Athlete browse) API — GET /api/people
//
// Backs the /dashboard/athletes browse surface. Read-only: this
// route never writes to `people`.
//
// Everything is server-side — filtering, sorting, counting and
// pagination all happen in Postgres. The client never receives
// more than one page of rows. `people` holds 52,809 rows and the
// browsable athlete set alone is ~31k, so a full fetch is not an
// option.
//
// COLUMN ALLOW-LIST: `people` also carries email, phone and the
// shipping_* address block. A browse list has no need for contact
// or address data, so the select below is an explicit allow-list
// rather than '*'. Do not widen it without a reason.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getStaffUser } from '@/lib/staff-auth';
import { createServiceSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// The browsable set: typed athletes who are active and not archived.
// is_active alone is not enough — it leaves ~11,800 archived people in.
const PERSON_TYPE = 'Athlete';

// Columns safe to put on a browse list. See the PII note in the header.
const SELECT_COLUMNS =
  'id, first_name, last_name, sport, college_raw, college_state, instagram_handle, instagram_followers, gender';

// Follower tiers. Keys are what the client sends; bounds are inclusive
// lower / exclusive upper, with null meaning "unbounded on that side".
const FOLLOWER_TIERS: Record<string, { min: number | null; max: number | null }> = {
  '1m': { min: 1_000_000, max: null },
  '100k': { min: 100_000, max: 1_000_000 },
  '10k': { min: 10_000, max: 100_000 },
  '1k': { min: 1_000, max: 10_000 },
  'under1k': { min: 0, max: 1_000 },
};

/**
 * Strip characters that carry meaning inside a PostgREST filter string.
 * Commas separate .or() terms, parens group them, and % is the ilike
 * wildcard — a raw user string containing any of these changes the shape
 * of the query rather than the value being matched.
 */
function sanitizeFilterValue(raw: string): string {
  return raw.replace(/[%,()\\*]/g, '').trim();
}

/**
 * Apply every filter to a query builder. Shared by the row query and the
 * count query so the two can never drift out of sync — if they did, the
 * displayed total would not describe the rows on screen.
 */
function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: {
    q: string | null;
    school: string | null;
    sport: string | null;
    gender: string | null;
    tier: string | null;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // is_archived is null on 48 athlete rows, so `eq false` would silently drop
  // them. `not.is.true` keeps false AND null, matching coalesce(is_archived,
  // false) = false exactly (verified: both yield 31,374).
  let q = query
    .eq('person_type', PERSON_TYPE)
    .eq('is_active', true)
    .not('is_archived', 'is', true);

  // Name / handle search. Matches the three identity columns the brief
  // names; school is a separate input because it is free text over 1,094
  // distinct spellings and mixing it in makes results confusing.
  if (filters.q) {
    const safe = sanitizeFilterValue(filters.q);
    if (safe) {
      q = q.or(
        `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,instagram_handle.ilike.%${safe}%`,
      );
    }
  }

  // School is free-text only. people.college_id is populated on 0 of the
  // browsable rows, so there is no dropdown to build yet — college_raw is
  // all we have. Revisit once `colleges` is backfilled.
  if (filters.school) {
    const safe = sanitizeFilterValue(filters.school);
    if (safe) q = q.ilike('college_raw', `%${safe}%`);
  }

  if (filters.sport) q = q.eq('sport', filters.sport);
  if (filters.gender) q = q.eq('gender', filters.gender);

  const tier = filters.tier ? FOLLOWER_TIERS[filters.tier] : null;
  if (tier) {
    if (tier.min !== null) q = q.gte('instagram_followers', tier.min);
    if (tier.max !== null) q = q.lt('instagram_followers', tier.max);
  }

  return q;
}

// ---- Sport facet list ----
// This project caps PostgREST responses at 1000 rows and has aggregate
// functions disabled, so there is no single request that returns the distinct
// sports: a plain `select('sport')` silently comes back truncated and yields
// 18 of the 35 real values. Instead we read the `sport` column across the
// whole browsable set in parallel 1000-row chunks (~1.1s) and dedupe here.
//
// The result is cached in module scope because the value changes about as
// often as the roster import runs, and the page is fully usable before it
// arrives — the dropdown just starts as "All sports".
const FACET_CHUNK = 1000;
const FACET_MAX_CHUNKS = 80; // runaway guard; 32 chunks covers today's data
const FACET_TTL_MS = 10 * 60 * 1000;

let facetCache: { at: number; sports: string[] } | null = null;

async function loadSports(
  svc: ReturnType<typeof createServiceSupabase>,
): Promise<string[]> {
  if (facetCache && Date.now() - facetCache.at < FACET_TTL_MS) {
    return facetCache.sports;
  }

  const NO_FILTERS = { q: null, school: null, sport: null, gender: null, tier: null };

  const { count, error: countError } = await applyFilters(
    svc.from('people').select('id', { count: 'exact', head: true }),
    NO_FILTERS,
  ).not('sport', 'is', null);

  if (countError) throw new Error(countError.message);

  const chunks = Math.min(Math.ceil((count ?? 0) / FACET_CHUNK), FACET_MAX_CHUNKS);

  const responses = await Promise.all(
    Array.from({ length: chunks }, (_, i) =>
      applyFilters(svc.from('people').select('sport'), NO_FILTERS)
        .not('sport', 'is', null)
        // Ordered so the chunks partition the set rather than overlap.
        .order('id', { ascending: true })
        .range(i * FACET_CHUNK, i * FACET_CHUNK + FACET_CHUNK - 1),
    ),
  );

  const seen = new Set<string>();
  for (const res of responses) {
    if (res.error) throw new Error(res.error.message);
    for (const row of (res.data ?? []) as { sport: string | null }[]) {
      const value = (row.sport ?? '').trim();
      if (value) seen.add(value);
    }
  }

  const sports = Array.from(seen).sort((a, b) => a.localeCompare(b));
  facetCache = { at: Date.now(), sports };
  return sports;
}

export async function GET(request: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
  }

  const svc = createServiceSupabase();
  const { searchParams } = new URL(request.url);

  // ---- Facets: the sport list for the filter dropdown ----
  // Returned on its own so the client fetches it once on mount rather than
  // on every page change. Sports come from the browsable set, not the whole
  // table, so the dropdown can never offer a value that yields zero rows.
  if (searchParams.get('facets') === '1') {
    try {
      return NextResponse.json({ sports: await loadSports(svc) });
    } catch (e) {
      console.error('[api/people] facet query failed:', (e as Error).message);
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  // ---- Params ----
  const filters = {
    q: searchParams.get('q')?.trim() || null,
    school: searchParams.get('school')?.trim() || null,
    sport: searchParams.get('sport')?.trim() || null,
    gender: searchParams.get('gender')?.trim() || null,
    tier: searchParams.get('tier')?.trim() || null,
  };

  const sort = searchParams.get('sort') === 'name' ? 'name' : 'followers';
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const offset = (page - 1) * pageSize;

  // ---- Rows ----
  let rowQuery = applyFilters(svc.from('people').select(SELECT_COLUMNS), filters);

  if (sort === 'name') {
    rowQuery = rowQuery
      .order('last_name', { ascending: true, nullsFirst: false })
      .order('first_name', { ascending: true, nullsFirst: false });
  } else {
    rowQuery = rowQuery.order('instagram_followers', { ascending: false, nullsFirst: false });
  }

  // Tiebreak on the primary key. Without a unique final sort key, rows that
  // tie on the sort column can be ordered differently between requests, which
  // makes offset pagination silently skip or repeat athletes across pages.
  rowQuery = rowQuery.order('id', { ascending: true }).range(offset, offset + pageSize - 1);

  // ---- Count, same filters ----
  const countQuery = applyFilters(
    svc.from('people').select('id', { count: 'exact', head: true }),
    filters,
  );

  const [rowRes, countRes] = await Promise.all([rowQuery, countQuery]);

  if (rowRes.error) {
    console.error('[api/people] row query failed:', rowRes.error.message);
    return NextResponse.json({ error: rowRes.error.message }, { status: 500 });
  }
  if (countRes.error) {
    console.error('[api/people] count query failed:', countRes.error.message);
    return NextResponse.json({ error: countRes.error.message }, { status: 500 });
  }

  const total = countRes.count ?? 0;

  return NextResponse.json({
    rows: rowRes.data ?? [],
    total,
    page,
    pageSize,
    pageCount: Math.max(Math.ceil(total / pageSize), 1),
  });
}
