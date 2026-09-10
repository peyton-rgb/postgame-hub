import "@/components/portal/dashboard/dashboard.css";
import { anton, arimo } from "@/components/portal/fonts";
import { compactNumber, type DashboardData } from "@/lib/portal/dashboard-data";
import type { PortalBrand } from "@/lib/portal-data";
import type { PortalPreviewChrome } from "@/components/portal/PortalFrame";
import PortalShell from "@/components/portal/PortalShell";
import { initials } from "@/lib/portal/format";

// ============================================================
// The brand dashboard (Phase 3a) — /portal.
//
// FIVE MODULES, and every one of them has something in it: the latest
// wrapped recap, the roster, top posts, the campaigns row, and one Activity
// strip. It was nine tiles, four of which said "nothing yet" — those four
// are now four lines in the strip, because four cards saying nothing is four
// times the furniture for the same nothing.
//
// Built from docs/briefs/reference/brand-dashboard-desktop-1440x900.html, but
// CONTENT never follows the reference: its figures are illustrative by its own
// admission and this page shows only what a query returned.
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

export default function BrandDashboard({
  brand,
  postgameIcon,
  data,
  preview,
  accountLabel,
}: {
  brand: PortalBrand;
  postgameIcon: string | null;
  data: DashboardData;
  preview?: PortalPreviewChrome | null;
  accountLabel?: string | null;
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
      brand={brand}
      accountLabel={accountLabel}
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

          {/* 1 · Latest wrapped. Photo from the campaign's hero media; figures
                 from that recap's structured fields, or — when it has none —
                 summed from what its athletes posted, and then labelled as
                 such. An absent figure is omitted, never zero-filled. */}
          <section className="pgd-tile pgd-photo" aria-labelledby="pgd-wrapped">
            {data.latestWrapped?.heroUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.latestWrapped.heroUrl} alt="" />
                {/* No "Latest wrapped" chip and no "Recap delivered" line.
                    Both were captions on a tile whose title is the campaign
                    name — the Campaigns row two modules down says which
                    campaigns are wrapped, and this one is the newest. */}
                <div className="pgd-over">
                  <h2 id="pgd-wrapped">{data.latestWrapped.name}</h2>
                  {data.latestWrapped.figures.length > 0 && (
                    <>
                      <div className="pgd-stats">
                        {data.latestWrapped.figures.map((f) => (
                          <div key={f.label}>
                            <b>{f.value}</b>
                            {f.label}
                          </div>
                        ))}
                      </div>
                      {/* One footnote for the whole row, not a caption on
                          each figure. */}
                      {data.latestWrapped.figuresSource && (
                        <span className="pgd-figs-note">
                          {data.latestWrapped.figuresSource}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%" }}>
                <h3 id="pgd-wrapped">Latest wrapped</h3>
                <p className="pgd-empty-body">
                  Your first recap will appear here once a campaign wraps.
                </p>
              </div>
            )}
          </section>

          {/* 2 · Roster.
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
                  {data.roster.title} · {data.roster.campaignName}
                  <span className="pgd-muted" style={{ fontWeight: 400 }}>
                    {data.roster.subline}
                  </span>
                </h3>
                {/* THIS CAMPAIGN'S roster, not the 1,501-person directory.
                    The tile is showing 12 of one campaign's athletes, so
                    "All athletes" meant "the rest of these" — and it was
                    landing people in a filterless list of everyone the brand
                    has ever worked with. Falls back to the directory only
                    when the campaign has no slug to link to. */}
                <a
                  className="pgd-more"
                  href={
                    data.roster.campaignSlug
                      ? `/portal/campaigns/${data.roster.campaignSlug}?tab=athletes`
                      : "/portal/athletes"
                  }
                >
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
                <h3 id="pgd-roster-h">Live campaign</h3>
                <p className="pgd-empty-body">
                  No live campaign yet. <a href="/portal/campaigns" style={{ color: "#FF6A3D" }}>See all campaigns</a>
                </p>
              </>
            )}
          </section>

          {/* 3 · Top posts. No period in the title on purpose: `athletes` has
                 no post date, so a "30 days" window cannot be computed and
                 claiming one would assert something the data can't support. */}
          <section className="pgd-tile pgd-top" aria-labelledby="pgd-top-h">
            <h3 id="pgd-top-h">Top posts</h3>
            {data.topPosts.length > 0 ? (
              <div className="pgd-scroll">
              {data.topPosts.map((p, i) => {
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
              })}
              </div>
            ) : (
              <p className="pgd-empty-body">Results appear here once posts are verified.</p>
            )}
          </section>

          {/* 4 · Campaigns. Live first, then wrapped. Fewer cards when there
                 are fewer campaigns — never padded.

                 NOT a tile: a plain heading with the row of cards under it.
                 Wrapped in a card it was a box holding boxes, and the outer
                 one carried nothing the heading didn't already say. */}
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
                      // A LIVE card says what kind of campaign it is; a
                      // wrapped one says how big the roster was. Both are the
                      // fact that matters at that stage: nothing has been
                      // delivered on a live campaign yet, so a roster count
                      // is the least interesting thing about it, and a
                      // wrapped campaign's type is already in its recap.
                      const meta = c.live
                        ? [c.quarter, c.campaignType].filter(Boolean).join(" · ")
                        : [c.quarter, c.athletes > 0 ? `${c.athletes} athletes` : null]
                            .filter(Boolean)
                            .join(" · ");
                      return meta ? (
                        <div className="pgd-cm" title={c.platform ?? undefined}>
                          {meta}
                        </div>
                      ) : null;
                    })()}
                    {/* State as a coloured word — orange live, quiet ink
                        wrapped. It was a pill, which is a box drawn around one
                        word that the colour already says. */}
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

          {/* 5 · Activity. One strip carrying the four workflow states that
                 used to be four tiles: Waiting on you, Posts going live,
                 Deliverables, This week. All four are empty for every brand
                 today — review_sessions is empty database-wide and
                 athlete_deliverables carries no dates — so they are four
                 lines rather than four cards.

                 Waiting on you is the one that can change today, and when it
                 does it says so in orange in the same place. No fake figures
                 in any of them: each line states the absence plainly. */}
          <section className="pgd-tile pgd-activity" aria-labelledby="pgd-activity-h">
            <h3 id="pgd-activity-h">Activity</h3>
            <div className="pgd-acts">
              <span className={`pgd-act${data.waitingCount > 0 ? " pgd-act-on" : ""}`}>
                <b>Waiting on you</b>
                {data.waitingCount > 0
                  ? data.waitingCount === 1
                    ? "1 review ready for your decision"
                    : `${data.waitingCount} reviews ready for your decision`
                  : "Nothing waiting"}
              </span>
              <span className="pgd-act">
                <b>Posts going live</b>
                Nothing scheduled this week
              </span>
              <span className="pgd-act">
                <b>Deliverables</b>
                Nothing delivered yet
              </span>
              <span className="pgd-act">
                <b>This week</b>
                Nothing scheduled
              </span>
            </div>
          </section>
        </div>
    </PortalShell>
  );
}
