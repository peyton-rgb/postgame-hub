import "@/components/portal/dashboard/dashboard.css";
import { anton, arimo } from "@/components/portal/fonts";
import { compactNumber, type DashboardData } from "@/lib/portal/dashboard-data";
import type { PortalBrand } from "@/lib/portal-data";
import type { PortalPreviewChrome } from "@/components/portal/PortalFrame";

// ============================================================
// The brand dashboard (Phase 3a) — /portal.
//
// Built to docs/briefs/reference/brand-dashboard-desktop-1440x900.html, tile
// for tile. Layout, spacing, type and colour match the reference; CONTENT does
// not, because the reference's figures are illustrative by its own admission
// and this page shows only what a query returned. Six tiles carry real data,
// one shows a photo without figures, and four render a designed empty state.
//
// WHY THIS PAGE HAS ITS OWN CHROME. The reference specifies a 72px icon rail
// and a pill nav; PortalFrame provides a utility strip and a sticky lockup
// header instead. Rendering this inside PortalFrame would show two navigations
// stacked. So the dashboard carries its own frame, and SessionPortalShell is
// left untouched for the other session routes that still use it — which is
// what the brief asked for when it said keep that shell and the Phase 1
// gating intact. Brand resolution, the admin preview banner and the
// entitlement decision all still come from resolveSessionPortal().
//
// BRAND-NEUTRAL CHROME. The brand's name appears only where data puts it
// there — campaign names, the roster subline. The greeting is "Welcome back",
// never "Welcome back, CVS".
// ============================================================

/* ---- icons ---------------------------------------------------
   Inline, from the reference. Every icon-only control carries an
   aria-label; decorative icons are aria-hidden so a screen reader reads the
   label once and not twice.
   ------------------------------------------------------------- */
const ICON = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  list: "M4 6h16M4 12h16M4 18h10",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  bars: "M4 20V10M10 20V4M16 20v-7",
  check: "M20 6 9 17l-5-5",
  trend: "M3 17l6-6 4 4 8-8",
} as const;

function Stroke({ d, label }: { d: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={d} />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 15l5-5 4 4 3-3 6 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0 0-6M21.5 20a5.5 5.5 0 0 0-4-5.3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9v4M12 17h0" />
      <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

/* Routes that exist today. Phase 3b adds the rest; until then an item with no
   route renders as plain text rather than a link to a 404. */
const RAIL = [
  { key: "home", href: "/portal", label: "Home", icon: <Stroke d={ICON.home} /> },
  { key: "campaigns", href: "/portal/campaigns", label: "Campaigns", icon: <Stroke d={ICON.list} /> },
  { key: "content", href: "/portal/library", label: "Content", icon: <ImageIcon /> },
  { key: "reports", href: "/portal/reports", label: "Reports", icon: <Stroke d={ICON.chart} /> },
  { key: "calendar", href: null, label: "Calendar", icon: <CalendarIcon /> },
] as const;

const PILLS = [
  { label: "Home", href: "/portal", on: true },
  { label: "Campaigns", href: "/portal/campaigns", on: false },
  { label: "Athletes", href: null, on: false },
  { label: "Content", href: "/portal/library", on: false },
  { label: "Reports", href: "/portal/reports", on: false },
] as const;

export default function BrandDashboard({
  brand,
  postgameIcon,
  data,
  preview,
}: {
  brand: PortalBrand;
  postgameIcon: string | null;
  data: DashboardData;
  preview?: PortalPreviewChrome | null;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className={`pgd ${anton.variable} ${arimo.variable}`} style={{ fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif" }}>
      {/* ---- left rail ---------------------------------------- */}
      <nav className="pgd-rail" aria-label="Portal sections">
        {/* Hard rule 1: the Postgame mark is a FILE. This slot is square, so it
            takes the ICON, not the ~5:1 wordmark. No file, nothing rendered. */}
        {postgameIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={postgameIcon} alt="Postgame" />
        ) : null}

        {RAIL.map((item) =>
          item.href ? (
            <a
              key={item.key}
              href={item.href}
              className={item.key === "home" ? "on" : undefined}
              aria-label={item.label}
              aria-current={item.key === "home" ? "page" : undefined}
              title={item.label}
            >
              {item.icon}
            </a>
          ) : (
            <span key={item.key} className="pgd-icon" aria-hidden="true" title={`${item.label} — coming soon`}>
              {item.icon}
            </span>
          )
        )}

        <span className="pgd-spacer" />
        <span className="pgd-ava" aria-hidden="true" />
      </nav>

      <div className="pgd-main">
        {/* ---- admin preview banner --------------------------
            Same banner as every other portal surface. Rendered only when
            resolveSessionPortal() populated `preview`, which the brand branch
            never does. */}
        {preview && (
          <div
            style={{
              borderTop: "2px solid #D73F09",
              background: "rgba(250,248,245,.07)",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 13,
            }}
          >
            <strong style={{ color: "#D73F09", fontWeight: 700 }}>Admin preview</strong>
            <span style={{ color: "rgba(250,248,245,.24)" }} aria-hidden="true">
              ·
            </span>
            <span style={{ color: "rgba(250,248,245,.9)" }}>Viewing as {preview.brandName}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
              <a href={preview.switchHref} style={{ color: "rgba(250,248,245,.68)" }}>
                Switch brand
              </a>
              <a href={preview.exitHref} style={{ color: "rgba(250,248,245,.68)" }}>
                Exit preview
              </a>
            </span>
          </div>
        )}

        {/* ---- top bar ---------------------------------------
            Search and Notifications are VISUAL ONLY this phase. Rendered as
            plain spans, not buttons — announcing a control that does nothing
            is worse than not announcing it. */}
        <div className="pgd-topbar">
          <div className="pgd-pills">
            {PILLS.map((p) =>
              p.href ? (
                <a key={p.label} href={p.href} className={p.on ? "on" : undefined} aria-current={p.on ? "page" : undefined}>
                  {p.label}
                </a>
              ) : (
                <span key={p.label}>{p.label}</span>
              )
            )}
          </div>
          <div className="pgd-tools">
            <span className="pgd-t pgd-search" aria-hidden="true">
              Search campaigns, athletes, posts
            </span>
            <span className="pgd-t" aria-hidden="true">
              Notifications
            </span>
            <span className="pgd-av" role="img" aria-label="Your account">
              <PersonIcon />
            </span>
          </div>
        </div>

        {/* ---- header + KPIs --------------------------------- */}
        <header className="pgd-head">
          <div>
            <h1 className="pgd-h1">Welcome back</h1>
            <p className="pgd-sub">{today}</p>
          </div>
          <div className="pgd-kpis">
            {data.kpis.map((k) => (
              <div className="pgd-kpi" key={k.label}>
                <b>{k.value}</b>
                <span>{k.label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ---- tiles ----------------------------------------- */}
        <div className="pgd-grid">
          {/* 1 · Waiting on you. Stays orange when empty, per the brief. */}
          <section className="pgd-tile pgd-alert" aria-labelledby="pgd-waiting">
            <h3 id="pgd-waiting">
              <span className="pgd-ic">
                <AlertIcon />
              </span>
              Waiting on you
            </h3>
            <p className="pgd-empty">
              Nothing waiting on you — we&rsquo;ll flag reviews here when content is ready.
            </p>
          </section>

          {/* 2 · Posts going live. No source: athlete_deliverables carries no
                 posted date on any row. Axis with an explanation, not a chart
                 of zeroes. */}
          <section className="pgd-tile pgd-chart" aria-labelledby="pgd-going-live">
            <h3 id="pgd-going-live">
              <span className="pgd-ic">
                <Stroke d={ICON.bars} />
              </span>
              Posts going live
            </h3>
            <div className="pgd-axis" aria-hidden="true" />
            <p className="pgd-muted" style={{ marginTop: 8 }}>
              No posts scheduled this week.
            </p>
          </section>

          {/* 3 · Deliverables. Ring at 0%, platform split hidden — there is no
                 platform field on the deliverable to split by. */}
          <section className="pgd-tile pgd-ring" aria-labelledby="pgd-deliverables">
            <h3 id="pgd-deliverables">
              <span className="pgd-ic">
                <Stroke d={ICON.check} />
              </span>
              Deliverables
            </h3>
            <div className="pgd-ringwrap">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(250,248,245,.1)" strokeWidth="10" />
              </svg>
              <div>
                <div className="pgd-num pgd-n">0%</div>
                <div className="pgd-muted" style={{ marginTop: 3 }}>
                  Nothing delivered yet
                </div>
              </div>
            </div>
          </section>

          {/* 4 · Latest wrapped. Photo from the campaign's hero media; figures
                 ONLY from that recap's structured fields. An absent figure is
                 omitted, never zero-filled — which is why most wrapped
                 campaigns show a name and no numbers. */}
          <section className="pgd-tile pgd-photo" aria-labelledby="pgd-wrapped">
            {data.latestWrapped?.heroUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.latestWrapped.heroUrl} alt="" />
                <span className="pgd-tag">Latest wrapped</span>
                <div className="pgd-over">
                  <small>Recap delivered</small>
                  <h2 id="pgd-wrapped">{data.latestWrapped.name}</h2>
                  {data.latestWrapped.figures.length > 0 && (
                    <div className="pgd-stats">
                      {data.latestWrapped.figures.map((f) => (
                        <div key={f.label}>
                          <b>{f.value}</b>
                          {f.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", height: "100%" }}>
                <h3 id="pgd-wrapped">
                  <span className="pgd-ic">
                    <ImageIcon />
                  </span>
                  Latest wrapped
                </h3>
                <p className="pgd-empty-body">
                  Your first recap will appear here once a campaign wraps.
                </p>
              </div>
            )}
          </section>

          {/* 5 · Roster.
                 Columns are only the ones with data behind them. Deliverables,
                 Progress, Status and Next all read athlete_deliverables, which
                 is empty — four blank columns would look broken and assert
                 nothing, so they are omitted rather than rendered hollow.
                 Reach appears per row ONLY where a verified per-post metric
                 exists; no dash stands in for a measurement we don't have. */}
          <section className="pgd-tile pgd-roster" aria-labelledby="pgd-roster-h">
            {data.roster ? (
              <>
                <h3 id="pgd-roster-h">
                  <span className="pgd-ic">
                    <PeopleIcon />
                  </span>
                  {data.roster.title} · {data.roster.campaignName}
                  <span className="pgd-muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                    {data.roster.subline}
                  </span>
                </h3>
                <a className="pgd-more" href="/portal/campaigns">
                  All athletes &rsaquo;
                </a>
                <div className="pgd-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Athlete</th>
                        <th scope="col">School</th>
                        <th scope="col">Followers</th>
                        <th scope="col">Top reel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.roster.rows.map((r) => (
                        <tr key={r.athleteId}>
                          <td>
                            <div className="pgd-who">
                              {r.headshotUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.headshotUrl} alt="" />
                              ) : (
                                // No photo on file -> empty circle. Never a stock image.
                                <span className="pgd-noface" aria-hidden="true" />
                              )}
                              <div>
                                {r.name}
                                {r.sport ? <small>{r.sport}</small> : null}
                              </div>
                            </div>
                          </td>
                          <td>{r.school ?? ""}</td>
                          <td>{r.followers !== null ? compactNumber(r.followers) : ""}</td>
                          <td>{r.views !== null ? `${compactNumber(r.views)} views` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <h3 id="pgd-roster-h">
                  <span className="pgd-ic">
                    <PeopleIcon />
                  </span>
                  Live campaign
                </h3>
                <p className="pgd-empty-body">
                  No live campaign yet. <a href="/portal/campaigns" style={{ color: "#FF6A3D" }}>See all campaigns</a>
                </p>
              </>
            )}
          </section>

          {/* 6 · This week. No source: no scheduled-date column exists. */}
          <section className="pgd-tile pgd-sched" aria-labelledby="pgd-week">
            <h3 id="pgd-week">
              <span className="pgd-ic">
                <CalendarIcon />
              </span>
              This week
            </h3>
            <p className="pgd-empty-body">Nothing scheduled.</p>
          </section>

          {/* 7 · Top posts. No period in the title on purpose: `athletes` has
                 no post date, so a "30 days" window cannot be computed and
                 claiming one would assert something the data can't support. */}
          <section className="pgd-tile pgd-top" aria-labelledby="pgd-top-h">
            <h3 id="pgd-top-h">
              <span className="pgd-ic">
                <Stroke d={ICON.trend} />
              </span>
              Top posts
            </h3>
            {data.topPosts.length > 0 ? (
              data.topPosts.map((p, i) => {
                const Row = (
                  <>
                    <span className="pgd-r" aria-hidden="true">
                      {i + 1}
                    </span>
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt="" />
                    ) : (
                      <span className="pgd-nothumb" aria-hidden="true" />
                    )}
                    <div>
                      <b>{p.name}</b>
                      <small>
                        IG Reel{p.school ? ` · ${p.school}` : ""}
                      </small>
                    </div>
                    <div className="pgd-v">
                      <b>{compactNumber(p.views)}</b>
                      <br />
                      views
                    </div>
                  </>
                );
                return p.postUrl ? (
                  <a
                    className="pgd-post"
                    key={p.athleteId}
                    href={p.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {Row}
                  </a>
                ) : (
                  <div className="pgd-post" key={p.athleteId}>
                    {Row}
                  </div>
                );
              })
            ) : (
              <p className="pgd-empty-body">Results appear here once posts are verified.</p>
            )}
          </section>

          {/* 8 · Campaigns. Live first, then wrapped. Fewer cards when there
                 are fewer campaigns — never padded. */}
          <section className="pgd-tile pgd-camps" aria-labelledby="pgd-camps-h">
            <h3 id="pgd-camps-h">
              Campaigns
              <small>
                {data.liveCount} live · {data.wrappedCount} wrapped
              </small>
            </h3>
            {data.campaigns.length > 0 ? (
              <div className="pgd-campgrid">
                {data.campaigns.map((c) => (
                  <a
                    className={`pgd-camp${c.live ? " pgd-live" : ""}`}
                    key={c.id}
                    href="/portal/campaigns"
                  >
                    <div className="pgd-cn" title={c.name}>
                      {c.name}
                    </div>
                    <div className="pgd-cm">
                      {[c.quarter, c.platform, c.athletes > 0 ? `${c.athletes} athletes` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="pgd-cf">
                      <span>{c.live ? "Live" : "Recap delivered"}</span>
                      <b>{c.live ? "Live" : "Wrapped"}</b>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="pgd-empty-body">
                Your Postgame contact will add your first campaign here.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ---- phone bottom tab bar -----------------------------
          Design system: mobile nav is a bottom tab bar, never a hamburger,
          never a top nav. */}
      <nav className="pgd-tabbar" aria-label="Portal sections">
        <a href="/portal" className="on" aria-current="page">
          <Stroke d={ICON.home} />
          Home
        </a>
        <a href="/portal/campaigns">
          <Stroke d={ICON.list} />
          Campaigns
        </a>
        <a href="/portal/library">
          <ImageIcon />
          Content
        </a>
        <a href="/portal/reports">
          <Stroke d={ICON.chart} />
          Reports
        </a>
      </nav>
    </div>
  );
}
