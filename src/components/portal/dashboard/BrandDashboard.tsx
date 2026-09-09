import "@/components/portal/dashboard/dashboard.css";
import { anton, arimo } from "@/components/portal/fonts";
import { compactNumber, type DashboardData } from "@/lib/portal/dashboard-data";
import type { PortalBrand } from "@/lib/portal-data";
import type { PortalPreviewChrome } from "@/components/portal/PortalFrame";
import PortalShell, {
  TileEmpty,
  Stroke,
  ImageIcon,
  PeopleIcon,
} from "@/components/portal/PortalShell";
import { initials } from "@/lib/portal/format";

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

/* CalendarIcon and AlertIcon stay local: they are tile-header icons for This
   week and Waiting on you, not rail icons, so the shell has no use for them.
   Stroke, ImageIcon, PeopleIcon and TileEmpty are imported from the shell —
   one definition each, shared with the six Phase 3b pages. */
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
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
    <PortalShell
      active="home"
      postgameIcon={postgameIcon}
      preview={preview}
      title="Welcome back"
      subtitle={today}
      aside={
        <div className="pgd-kpis">
          {data.kpis.map((k) => (
            <div className="pgd-kpi" key={k.label}>
              <b>{k.value}</b>
              <span>{k.label}</span>
              {k.sub ? <small>{k.sub}</small> : null}
            </div>
          ))}
        </div>
      }
    >
      <div className="pgd-grid">

          {/* 1 · Waiting on you. Stays orange when empty, per the brief. */}
          {/* The orange surface is conditional, and that is deliberate on two
              counts. Brand rule: orange is an accent, never a background fill —
              it earns a full panel only when it is genuinely calling for
              attention. And semantically, a card that shouts in alarm orange
              while reading "nothing waiting on you" contradicts itself. With an
              empty queue the tile is glass like its three neighbours; the
              moment a review lands it lights up and carries a count. */}
          <section
            className={`pgd-tile pgd-alert${data.waitingCount > 0 ? " pgd-alert-on" : ""}`}
            aria-labelledby="pgd-waiting"
          >
            <h3 id="pgd-waiting">
              <span className="pgd-ic">
                <AlertIcon />
              </span>
              Waiting on you
            </h3>
            {data.waitingCount > 0 ? (
              <>
                <span className="pgd-count">{data.waitingCount}</span>
                <p className="pgd-empty-body">
                  {data.waitingCount === 1
                    ? "1 review is ready for your decision."
                    : `${data.waitingCount} reviews are ready for your decision.`}
                </p>
              </>
            ) : (
              <TileEmpty
                line="Nothing waiting on you"
                note="We'll flag reviews here when content is ready."
              />
            )}
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
            <TileEmpty
              line="No posts scheduled this week"
              note="Scheduled and posted content will chart here."
            />
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
            <TileEmpty
              line="Nothing delivered yet"
              note="Progress appears as athletes upload and you approve."
            />
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
                <a className="pgd-more" href="/portal/athletes">
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
                                <span className="pgd-noface">{initials(r.name)}</span>
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
            <TileEmpty
              line="Nothing scheduled"
              note="Post dates, review deadlines and recap deliveries land here."
            />
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
                      <span className="pgd-nothumb">{initials(p.name)}</span>
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
                // Prefer the live post; it is the thing the figure describes.
                // Without one, fall back to the athlete's row on the campaign
                // roster rather than a dead card.
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
          {/* Not a .pgd-tile: the strip is a labelled row of cards, and
              wrapping it in a card put a border around a group of borders.
              The heading sits above the row as plain text. */}
          <section className="pgd-camps" aria-labelledby="pgd-camps-h">
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
                    href={c.slug ? `/portal/campaigns/${c.slug}` : "/portal/campaigns"}
                  >
                    <div className="pgd-cn" title={c.name}>
                      {c.name}
                    </div>
                    {/* One line, ellipsised. The reference's meta strings were
                        short ("IG + TikTok"); ours come from settings and run to
                        "Instagram (Feed + Reels + Stories) + TikTok", which
                        wrapped to three lines and pushed the card past its grid
                        row. Platform is dropped here — it is on the roster
                        subline already — leaving quarter and roster size. */}
                    {/* No meta line at all when there is nothing to put in it.
                        A live campaign with no quarter and an empty roster used
                        to render an em dash, which looks like a value that
                        failed to load rather than a campaign that has not
                        started. Absent says it better than a placeholder. */}
                    {(() => {
                      const meta = [
                        c.quarter,
                        c.athletes > 0 ? `${c.athletes} athletes` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return meta ? (
                        <div className="pgd-cm" title={c.platform ?? undefined}>
                          {meta}
                        </div>
                      ) : null;
                    })()}
                    {/* Chip only. The footer used to carry a label AND a chip
                        that said the same thing — "Recap delivered / Wrapped",
                        "Live / Live" — and in a card this narrow the label
                        ellipsised to "Recap deliv…". The reference's label was a
                        posted count, which we have no source for, so the
                        duplicate goes rather than being padded out. */}
                    <div className="pgd-cf">
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
    </PortalShell>
  );
}
