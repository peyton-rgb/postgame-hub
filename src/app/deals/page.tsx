// ============================================================
// /deals — the NIL deal ledger.
//
// Audience is the public, the press and search. Everything on this page is
// rendered on the server, including the filters and the pagination, so that:
//
//   - a crawler receives all 395 deals as text, not an empty shell that
//     fetches them later;
//   - every filtered view (?brand=cvs&sport=football) is a real URL a
//     reporter can paste into a story and a search engine can index;
//   - the page works with JavaScript off. There is no client component on
//     this route at all any more — the filters are links and a <details>
//     disclosure, the pager is links.
//
// WHAT WAS HERE BEFORE: a client component that fetched in the browser, with
// an auto-advancing hero carousel over a full-bleed photo, a second
// "Headliner Deals" carousel that showed the same deals as the grid below it,
// its own fixed nav stacked on top of the layout's fixed nav, its own copy of
// the footer, and every line of type set with inline font-family strings —
// including 'Bebas Neue', which next/font renames to a hash, so those lines
// were rendering in Arial. All of that is gone.
//
// `featured` survives as a sort tiebreak only, per the brief.
// ============================================================

import "./deals.css";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteFooter from "@/components/SiteFooter";
import {
  BRAND_LOGO_COLUMNS,
  groupLogosByBrand,
  resolveBrandLogo,
  type BrandLogoRow,
} from "@/lib/brand-logo";
import {
  brandTint,
  dealDate,
  dealDateISO,
  dealDateShort,
  dealYear,
  facetSlug,
  initialsOf,
  thumbUrl,
} from "@/lib/deal-format";

// The ledger changes when a deal is added, not per request.
export const revalidate = 300;

const PER_PAGE = 50;
const LATEST_COUNT = 10;

/* ── Data ─────────────────────────────────────────────────────── */

type DealRow = {
  id: string;
  slug: string;
  athlete_name: string | null;
  athlete_school: string | null;
  athlete_sport: string | null;
  brand_name: string;
  brand_id: string | null;
  image_url: string | null;
  date_announced: string | null;
  featured: boolean;
  sort_order: number;
  focal_point: string | null;
};

type Ledger = {
  deals: DealRow[];
  /** brand_id -> on_black logo url. Resolved once here, not per row. */
  logoByBrand: Record<string, string>;
  /** brand_id -> the brand's own colour, dimmed, for placeholder tiles. */
  tintByBrand: Record<string, string>;
};

// Two layers of caching, doing two different jobs.
//
// unstable_cache holds the query result across REQUESTS for 300s. Reading
// searchParams makes this route dynamic, so `export const revalidate` cannot
// cache the rendered page — without this every single request, filtered or
// not, would pull all 395 rows plus the brand tables.
//
// react's cache() then dedupes within ONE render, so generateMetadata and the
// page body share a single call instead of asking twice.
const loadLedgerUncached = unstable_cache(
  async (): Promise<Ledger> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    // Archived deals are published:true but retired. They are excluded here
    // for the same reason they are excluded from the sitemap: listing one is a
    // claim that it is current.
    const { data } = await supabase
      .from("deals")
      .select(
        "id, slug, athlete_name, athlete_school, athlete_sport, brand_name, brand_id, image_url, date_announced, featured, sort_order, focal_point"
      )
      .eq("published", true)
      .neq("status", "archived");

    const deals = ((data ?? []) as DealRow[]).sort(compareDeals);

    const brandIds = Array.from(
      new Set(deals.map((d) => d.brand_id).filter(Boolean) as string[])
    );

    const logoByBrand: Record<string, string> = {};
    const tintByBrand: Record<string, string> = {};

    if (brandIds.length) {
      const [{ data: logoRows }, { data: brandRows }] = await Promise.all([
        supabase.from("brand_logos").select(BRAND_LOGO_COLUMNS).in("brand_id", brandIds),
        supabase.from("brands").select("id, primary_color").in("id", brandIds),
      ]);

      // The rows sit on the black ground, so this asks for on_black. Asking
      // for the wrong variant is not a cosmetic slip: an on_white file carries
      // dark ink and disappears entirely here.
      const byBrand = groupLogosByBrand((logoRows ?? []) as BrandLogoRow[]);
      for (const id of brandIds) {
        const hit = resolveBrandLogo(byBrand.get(id), { surface: "dark", prefer: "mark" });
        if (hit) logoByBrand[id] = hit.url;
      }

      for (const b of (brandRows ?? []) as { id: string; primary_color: string | null }[]) {
        tintByBrand[b.id] = brandTint(b.primary_color);
      }
    }

    return { deals, logoByBrand, tintByBrand };
  },
  ["deals-ledger"],
  { revalidate, tags: ["deals"] }
);

const loadLedger = cache(loadLedgerUncached);

/** Reverse-chronological. Undated deals sink; `featured` only breaks ties. */
function compareDeals(a: DealRow, b: DealRow): number {
  const ad = a.date_announced ?? "";
  const bd = b.date_announced ?? "";
  if (ad !== bd) return bd.localeCompare(ad);
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  return a.sort_order - b.sort_order;
}

/* ── Facets ───────────────────────────────────────────────────── */

const FACETS = ["sport", "school", "brand", "year"] as const;
type Facet = (typeof FACETS)[number];

const FACET_LABEL: Record<Facet, string> = {
  sport: "Sport",
  school: "School",
  brand: "Brand",
  year: "Year",
};

type Active = Partial<Record<Facet, string>>;

function valueOf(d: DealRow, f: Facet): string | null {
  if (f === "sport") return d.athlete_sport;
  if (f === "school") return d.athlete_school;
  if (f === "brand") return d.brand_name;
  const y = dealYear(d.date_announced);
  return y === null ? null : String(y);
}

/**
 * Does this deal survive the active filters?
 *
 * `except` skips one facet, which is what makes the option counts honest: the
 * Brand list is counted against everything EXCEPT the brand filter, so the
 * numbers next to each brand are what you would actually get by clicking it.
 * Counting against the fully filtered set would show 0 beside every brand but
 * the selected one.
 */
function matches(d: DealRow, active: Active, except?: Facet): boolean {
  for (const f of FACETS) {
    if (f === except) continue;
    const want = active[f];
    if (!want) continue;
    const v = valueOf(d, f);
    if (!v || facetSlug(v) !== want) return false;
  }
  return true;
}

type Option = { slug: string; label: string; count: number };

function optionsFor(deals: DealRow[], active: Active, f: Facet): Option[] {
  const byslug = new Map<string, Option>();
  for (const d of deals) {
    if (!matches(d, active, f)) continue;
    const v = valueOf(d, f);
    if (!v) continue;
    const slug = facetSlug(v);
    const hit = byslug.get(slug);
    if (hit) hit.count += 1;
    else byslug.set(slug, { slug, label: v, count: 1 });
  }
  const list = Array.from(byslug.values());
  // Years read newest-first; everything else reads by weight, then name.
  if (f === "year") return list.sort((a, b) => b.label.localeCompare(a.label));
  return list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** The human label for an active slug, or the slug itself if nothing matches. */
function labelFor(deals: DealRow[], f: Facet, slug: string): string {
  for (const d of deals) {
    const v = valueOf(d, f);
    if (v && facetSlug(v) === slug) return v;
  }
  return slug;
}

/* ── URLs ─────────────────────────────────────────────────────── */

type Search = { [K in Facet]?: string | string[] } & { page?: string | string[] };

function readActive(sp: Search): Active {
  const active: Active = {};
  for (const f of FACETS) {
    const raw = sp[f];
    const v = Array.isArray(raw) ? raw[0] : raw;
    // Normalised on the way in, so ?brand=CVS and ?brand=Raising%20Cane's
    // resolve the same as the links this page generates.
    if (v) active[f] = facetSlug(v);
  }
  return active;
}

/**
 * A URL with one facet changed. `page` is deliberately dropped: page 7 of an
 * unfiltered ledger is not page 7 of a filtered one, and silently landing on
 * an out-of-range page is worse than starting over.
 */
function hrefWith(active: Active, f: Facet, value: string | null): string {
  const p = new URLSearchParams();
  for (const g of FACETS) {
    const v = g === f ? value : active[g];
    if (v) p.set(g, v);
  }
  const qs = p.toString();
  return qs ? `/deals?${qs}` : "/deals";
}

function hrefPage(active: Active, page: number): string {
  const p = new URLSearchParams();
  for (const g of FACETS) if (active[g]) p.set(g, active[g]!);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/deals?${qs}` : "/deals";
}

/* ── Metadata ─────────────────────────────────────────────────── */

/**
 * A filtered view describes itself. "?brand=cvs" is a page about CVS's NIL
 * deals and its title should say so, otherwise every filter combination
 * competes for the same query with the same title.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const { deals } = await loadLedger();
  const active = readActive(searchParams);

  const bits: string[] = [];
  for (const f of FACETS) {
    const slug = active[f];
    if (slug) bits.push(labelFor(deals, f, slug));
  }

  // Clamped the same way the page body clamps it, so an out-of-range ?page
  // does not declare itself canonical at a URL that shows something else.
  const total = deals.filter((d) => matches(d, active)).length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(readPage(searchParams), pages);
  const canonical = hrefPage(active, page);

  if (!bits.length) {
    return {
      title: "NIL Deal Tracker — every Postgame athlete partnership | Postgame",
      description:
        "Every NIL partnership Postgame has run, by athlete, brand and year. The deal ledger for the #1 NIL agency in college sports.",
      alternates: { canonical },
      openGraph: {
        title: "NIL Deal Tracker | Postgame",
        description: "Every NIL partnership Postgame has run, by athlete, brand and year.",
        type: "website",
      },
    };
  }

  const subject = bits.join(" · ");
  const count = total;
  return {
    title: `${subject} NIL deals | Postgame Deal Tracker`,
    description: `${count} NIL ${count === 1 ? "deal" : "deals"} Postgame has run — ${subject}. Athlete, brand and date for every partnership.`,
    alternates: { canonical },
    // A filter that matches nothing is still a valid URL — ?brand=nope
    // renders an empty ledger rather than a 404, which is right for a human
    // who mistyped. It is not worth indexing, though, and without this any
    // junk query string would become a thin page offering itself to search.
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: `${subject} NIL deals | Postgame`,
      description: `${count} Postgame NIL ${count === 1 ? "deal" : "deals"} — ${subject}.`,
      type: "website",
    },
  };
}

function readPage(sp: Search): number {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/* ── Page ─────────────────────────────────────────────────────── */

export default async function DealsPage({ searchParams }: { searchParams: Search }) {
  const { deals, logoByBrand, tintByBrand } = await loadLedger();

  const active = readActive(searchParams);
  const hasFilters = FACETS.some((f) => active[f]);
  const filtered = deals.filter((d) => matches(d, active));

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(readPage(searchParams), pages);
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // The hero counts the whole ledger, not the filtered view — it is the
  // headline claim about the agency, and it should not move when a reader
  // narrows to one brand.
  const athletes = new Set(deals.map((d) => d.athlete_name).filter(Boolean)).size;
  const brands = new Set(deals.map((d) => d.brand_name).filter(Boolean)).size;

  // Only on the unfiltered ledger. On a filtered view the strip would show
  // deals that contradict the filter directly above rows that obey it — and
  // the ledger is already reverse-chronological, so its first rows are the
  // latest matching deals anyway.
  const latest = hasFilters ? [] : deals.filter((d) => d.date_announced).slice(0, LATEST_COUNT);

  return (
    <div className="dl-page">
      {/* ── Hero ───────────────────────────────────────────── */}
      <header className="dl-wrap dl-hero">
        <div className="pg-eyebrow dl-hero-eyebrow">NIL Deal Tracker</div>
        <h1 className="pg-h1">Every deal we&rsquo;ve done</h1>
        <p className="pg-lead dl-hero-lead">
          Every NIL partnership Postgame has run, on the record — athlete, brand and
          date. Newest first.
        </p>

        <div className="dl-counters">
          {[
            { n: deals.length, label: "Deals on file" },
            { n: athletes, label: "Athletes" },
            { n: brands, label: "Brands" },
          ].map((c) => (
            <div key={c.label}>
              <div className="pg-stat">{c.n.toLocaleString("en-US")}</div>
              <div className="pg-label dl-counter-label">{c.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── Latest ─────────────────────────────────────────── */}
      {latest.length > 0 && (
        <section className="dl-wrap dl-section">
          <div className="dl-section-head">
            <h2 className="pg-h2">Latest</h2>
            <span className="pg-label">The {latest.length} most recent</span>
          </div>
          <ol className="dl-latest">
            {latest.map((d) => (
              <li key={d.id}>
                <Link href={`/deals/${d.slug}`}>
                  <time className="pg-label dl-latest-date" dateTime={dealDateISO(d.date_announced)}>
                    {dealDateShort(d.date_announced)}
                  </time>
                  <span className="dl-latest-sep">·</span>
                  <span className="pg-h3">{d.athlete_name || "Team campaign"}</span>
                  <span className="dl-latest-sep">×</span>
                  <span className="pg-h3 dl-latest-brand">{d.brand_name}</span>
                  {d.athlete_school && (
                    <>
                      <span className="dl-latest-sep dl-latest-sep-school">·</span>
                      <span className="pg-label dl-latest-meta">{d.athlete_school}</span>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Ledger ─────────────────────────────────────────── */}
      <section className="dl-wrap dl-section" id="ledger">
        <div className="dl-section-head">
          <h2 className="pg-h2">The ledger</h2>
          <span className="pg-label dl-result-count">
            {filtered.length.toLocaleString("en-US")}
            {hasFilters ? ` of ${deals.length.toLocaleString("en-US")}` : ""} deals
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </span>
        </div>

        <Filters deals={deals} active={active} hasFilters={hasFilters} />

        {rows.length === 0 ? (
          <div className="dl-empty">
            <p className="pg-lead">No deals match that combination.</p>
            <p style={{ marginTop: 16 }}>
              <Link href="/deals" className="pg-btn dl-chip-clear">
                Clear filters
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="dl-cols dl-head" aria-hidden="true">
              <span className="pg-label" />
              <span className="pg-label">Athlete</span>
              <span className="pg-label">School</span>
              <span className="pg-label">Sport</span>
              <span className="pg-label">Brand</span>
              <span className="pg-label">Announced</span>
            </div>

            <ol className="dl-ledger">
              {rows.map((d) => (
                <LedgerRow
                  key={d.id}
                  deal={d}
                  logo={d.brand_id ? logoByBrand[d.brand_id] : undefined}
                  tint={d.brand_id ? tintByBrand[d.brand_id] : undefined}
                />
              ))}
            </ol>
          </>
        )}

        {pages > 1 && <Pager active={active} page={page} pages={pages} />}
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── Row ──────────────────────────────────────────────────────── */

function LedgerRow({
  deal,
  logo,
  tint,
}: {
  deal: DealRow;
  logo?: string;
  tint?: string;
}) {
  const thumb = thumbUrl(deal.image_url);
  const name = deal.athlete_name || "Team campaign";
  // On mobile the school/sport/date columns collapse into one line, so the
  // same facts are assembled here rather than duplicated in the markup.
  const mobileMeta = [deal.athlete_school, deal.athlete_sport, dealDate(deal.date_announced)]
    .filter((s) => s && s !== "—")
    .join(" · ");

  return (
    <li className="dl-row">
      <Link href={`/deals/${deal.slug}`} className="dl-cols">
        <div className="dl-thumb">
          {thumb ? (
            <img
              src={thumb}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ objectPosition: deal.focal_point || "50% 25%" }}
            />
          ) : (
            <div
              className="dl-thumb-empty"
              style={{ background: tint ?? "rgba(250,248,245,0.05)" }}
              aria-hidden="true"
            >
              <span className="pg-h3">{initialsOf(deal.athlete_name)}</span>
            </div>
          )}
        </div>

        <div className="dl-row-lines">
          <div className="pg-h3 dl-athlete">{name}</div>
          {/* Line two on mobile only — on desktop the brand has its own
              column and these facts have their own cells. */}
          <div className="dl-brand dl-brand-in-lines">
            {logo && <img src={logo} alt="" loading="lazy" decoding="async" />}
            <span className="pg-label dl-brand-name">{deal.brand_name}</span>
          </div>
          <div className="pg-label dl-mobile-line">{mobileMeta || "Date not on file"}</div>
        </div>

        <span className="pg-body dl-cell-muted dl-cell-school">{deal.athlete_school || "—"}</span>
        <span className="pg-body dl-cell-muted dl-cell-sport">{deal.athlete_sport || "—"}</span>
        <span className="dl-brand dl-cell-brand">
          {logo && <img src={logo} alt="" loading="lazy" decoding="async" />}
          <span className="pg-label dl-brand-name">{deal.brand_name}</span>
        </span>
        <time
          className="pg-label dl-cell-muted dl-cell-date"
          dateTime={dealDateISO(deal.date_announced)}
        >
          {dealDate(deal.date_announced)}
        </time>
      </Link>
    </li>
  );
}

/* ── Filters ──────────────────────────────────────────────────── */

function Filters({
  deals,
  active,
  hasFilters,
}: {
  deals: DealRow[];
  active: Active;
  hasFilters: boolean;
}) {
  return (
    <div className="dl-filters">
      <div className="dl-facets">
        {FACETS.map((f) => {
          const options = optionsFor(deals, active, f);
          if (!options.length) return null;
          const current = active[f];
          return (
            <details key={f} className="dl-facet">
              <summary className="pg-btn">
                {FACET_LABEL[f]}
                <span className="dl-facet-caret" aria-hidden="true">
                  ▾
                </span>
              </summary>
              <div className="dl-facet-menu">
                {options.map((o) => (
                  <Link
                    key={o.slug}
                    href={hrefWith(active, f, o.slug === current ? null : o.slug)}
                    aria-current={o.slug === current ? "true" : undefined}
                    className="pg-body"
                  >
                    <span>{o.label}</span>
                    <span className="pg-label dl-facet-count">{o.count}</span>
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {hasFilters && (
        <div className="dl-chips">
          {FACETS.map((f) => {
            const slug = active[f];
            if (!slug) return null;
            return (
              <span key={f} className="dl-chip pg-btn">
                {labelFor(deals, f, slug)}
                <Link
                  href={hrefWith(active, f, null)}
                  className="dl-chip-x"
                  aria-label={`Remove the ${FACET_LABEL[f].toLowerCase()} filter`}
                >
                  ×
                </Link>
              </span>
            );
          })}
          <Link href="/deals" className="pg-btn dl-chip-clear">
            Clear all
          </Link>
        </div>
      )}
    </div>
  );
}

/* ── Pager ────────────────────────────────────────────────────── */

/** First, last, and a window around the current page. */
function pageWindow(page: number, pages: number): (number | "gap")[] {
  const want = new Set<number>([1, pages, page - 1, page, page + 1]);
  const list = Array.from(want)
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of list) {
    if (prev && n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

function Pager({ active, page, pages }: { active: Active; page: number; pages: number }) {
  return (
    <nav className="dl-pager" aria-label="Ledger pages">
      {page > 1 ? (
        <Link href={hrefPage(active, page - 1)} className="pg-btn" rel="prev">
          Previous
        </Link>
      ) : (
        <span className="pg-btn" style={{ opacity: 0.35 }}>
          Previous
        </span>
      )}

      {pageWindow(page, pages).map((n, i) =>
        n === "gap" ? (
          <span key={`gap-${i}`} className="pg-btn dl-pager-gap">
            …
          </span>
        ) : n === page ? (
          <span key={n} className="pg-btn dl-pager-now" aria-current="page">
            {n}
          </span>
        ) : (
          <Link key={n} href={hrefPage(active, n)} className="pg-btn">
            {n}
          </Link>
        )
      )}

      {page < pages ? (
        <Link href={hrefPage(active, page + 1)} className="pg-btn" rel="next">
          Next
        </Link>
      ) : (
        <span className="pg-btn" style={{ opacity: 0.35 }}>
          Next
        </span>
      )}
    </nav>
  );
}
