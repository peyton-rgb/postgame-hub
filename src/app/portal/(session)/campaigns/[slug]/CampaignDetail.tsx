"use client";

import { useMemo, useState } from "react";
import MediaGrid from "@/components/portal/pages/MediaGrid";
import { TileEmpty } from "@/components/portal/PortalShell";
import { compact, initials } from "@/lib/portal/format";
import type { loadCampaignDetail } from "@/lib/portal/pages-data";

type Campaign = NonNullable<Awaited<ReturnType<typeof loadCampaignDetail>>>;

export default function CampaignDetail({
  campaign: c,
  initialTab,
}: {
  campaign: Campaign;
  /** From ?tab= on the URL. Anything unrecognised falls back to overview. */
  initialTab?: string;
}) {
  // Tab set depends on state: live gets Approvals, wrapped gets Results.
  const tabs = c.live
    ? (["overview", "athletes", "content", "approvals"] as const)
    : (["overview", "athletes", "content", "results"] as const);
  // ?tab= is honoured on load, so /portal/campaigns/spf-cvs-2026?tab=results
  // opens on Results. It is validated against THIS campaign's tab set — a
  // live campaign has no results tab, and ?tab=results on one would otherwise
  // select a tab with no button to get back from.
  const [tab, setTab] = useState<(typeof tabs)[number]>(() => {
    const want = (initialTab ?? "").toLowerCase();
    return (tabs as readonly string[]).includes(want)
      ? (want as (typeof tabs)[number])
      : "overview";
  });
  const [school, setSchool] = useState("");

  const schools = useMemo(
    () =>
      Array.from(new Set(c.athletes.map((a) => a.school).filter((s): s is string => !!s))).sort(),
    [c.athletes]
  );
  const roster = school ? c.athletes.filter((a) => a.school === school) : c.athletes;

  const label = (t: string) => t[0].toUpperCase() + t.slice(1);

  return (
    <div className="pgd-page">
      {/* Hero. Edge-blended into the ground per hard rule 4. No hero image
          means no image — never a stock photo. */}
      <div className="pgd-hero">
        {c.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.heroUrl} alt="" />
        ) : null}
        {/* NAME ONLY. The quarter · type · platform line that used to sit
            under it is in the page header 40px above, so it was printed
            twice on every campaign. */}
        <div className="pgd-hero-in">
          <h2>{c.name}</h2>
        </div>
      </div>

      <div className="pgd-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "on" : undefined}
            onClick={() => setTab(t)}
          >
            {label(t)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        /* Explicit two-column split, not a stack. Three of these four panels
           are one short line each on a CVS campaign; stacked full-width they
           read as four empty bars down an otherwise blank page. At a glance
           goes across the top because it holds the only real figures; the
           short panels share the narrow right-hand column. */
        <div className="pgd-overview">
          {(c.athleteCount > 0 || c.schoolCount > 0 || c.media.length > 0) && (
            <section className="pgd-panel">
              <h3>At a glance</h3>
              <div className="pgd-figs">
                {c.athleteCount > 0 && (
                  <span className="pgd-stat">
                    <b>{c.athleteCount}</b>
                    <span>Athletes</span>
                  </span>
                )}
                {c.schoolCount > 0 && (
                  <span className="pgd-stat">
                    <b>{c.schoolCount}</b>
                    <span>Schools</span>
                  </span>
                )}
                {c.media.length > 0 && (
                  <span className="pgd-stat">
                    <b>{c.media.length}</b>
                    <span>Files</span>
                  </span>
                )}
              </div>
            </section>
          )}

          <div className="pgd-overview-split">
            <section className="pgd-panel">
              <h3>Objective</h3>
              {c.descriptionHtml ? (
                <div
                  className="pgd-prose"
                  dangerouslySetInnerHTML={{ __html: c.descriptionHtml }}
                />
              ) : (
                <TileEmpty
                  line="No brief on file"
                  note="Your Postgame contact adds the campaign objective here."
                />
              )}
            </section>

            <div className="pgd-overview-side">
              <section className="pgd-panel">
                <h3>Your Postgame contact</h3>
                {c.managerName || c.managerEmail ? (
                  <div className="pgd-row" style={{ borderBottom: 0, padding: 0 }}>
                    <span className="pgd-row-main">
                      <b>{c.managerName || c.managerEmail}</b>
                      <span>Campaign lead</span>
                    </span>
                    {c.managerEmail ? (
                      <a className="pgd-btn" href={`mailto:${c.managerEmail}`}>
                        Email
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <TileEmpty line="No contact assigned yet" note="Ask your Postgame contact who is leading this." />
                )}
              </section>

              {/* Drive link only when the folder id exists. The folder's TITLE is
                  never displayed — spec §4.2. */}
              {c.driveFolderId ? (
                <section className="pgd-panel">
                  <h3>Download content</h3>
                  <a
                    className="pgd-btn"
                    href={`https://drive.google.com/drive/folders/${c.driveFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open the campaign folder
                  </a>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {tab === "athletes" && (
        <>
          {c.athletes.length === 0 ? (
            <div className="pgd-panel">
              <TileEmpty
                line="No athletes on this campaign yet"
                note="The roster appears here once athletes opt in."
              />
            </div>
          ) : (
            <>
              {schools.length > 1 && (
                <div className="pgd-filters">
                  <button
                    className={`pgd-pill${school === "" ? " on" : ""}`}
                    onClick={() => setSchool("")}
                  >
                    All schools
                  </button>
                  {schools.slice(0, 8).map((s) => (
                    <button
                      key={s}
                      className={`pgd-pill${school === s ? " on" : ""}`}
                      onClick={() => setSchool(s)}
                    >
                      {s}
                    </button>
                  ))}
                  <span className="pgd-count">
                    {roster.length} of {c.athletes.length}
                  </span>
                </div>
              )}
              <div className="pgd-people">
                {roster.map((a) => (
                  <div className="pgd-person" key={a.id} id={`athlete-${a.id}`}>
                    {a.headshotUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.headshotUrl} alt="" />
                    ) : (
                      <span className="pgd-noface" aria-hidden="true">
                        {initials(a.name)}
                      </span>
                    )}
                    {/* TWO LINES: name, then school · sport. Neither is
                        ellipsised any more — they wrap. The numbers moved to
                        their own right-hand column rather than being a third
                        line squeezed into the same width. */}
                    <span className="pgd-person-body">
                      <span className="pgd-person-name">{a.name}</span>
                      {[a.school, a.sport].filter(Boolean).length > 0 && (
                        <span className="pgd-person-meta">
                          {[a.school, a.sport].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {(a.followers !== null || a.views !== null) && (
                      <span className="pgd-person-nums">
                        {a.followers !== null && (
                          <span>
                            <b>{compact(a.followers)}</b>
                            followers
                          </span>
                        )}
                        {a.views !== null && <span>{compact(a.views)} views</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "content" && (
        <>
          {c.driveFolderId ? (
            <div className="pgd-filters" style={{ marginBottom: 10 }}>
              <a
                className="pgd-btn"
                href={`https://drive.google.com/drive/folders/${c.driveFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download all from Drive
              </a>
            </div>
          ) : null}
          {c.media.length === 0 ? (
            <div className="pgd-panel">
              <TileEmpty line="No content yet" note="Content lands here as it's delivered." />
            </div>
          ) : (
            <MediaGrid items={c.media} columns="wide" />
          )}
        </>
      )}

      {tab === "approvals" && (
        <div className="pgd-panel">
          {/* review_sessions is empty database-wide, so this is the honest
              state rather than a table with no rows. */}
          <TileEmpty
            line="Nothing waiting on you"
            note="We'll flag content here when it's ready for your review."
          />
        </div>
      )}

      {tab === "results" && (
        <>
          {c.figures.length === 0 && !c.takeawaysHtml && c.topContent.length === 0 ? (
            <div className="pgd-panel">
              {/* Spec: if the recap has no structured content, say results are
                  being prepared and show the hero and athlete count. Never
                  fabricate a result. */}
              <TileEmpty
                line="Results are being prepared"
                note={
                  c.athleteCount > 0
                    ? `${c.athleteCount} athletes took part. Figures appear once the recap is built.`
                    : "Figures appear once the recap is built."
                }
              />
            </div>
          ) : (
            <>
              {c.figures.length > 0 && (
                <section className="pgd-panel">
                  <h3>Results</h3>
                  <div className="pgd-figs pgd-figs-lg">
                    {c.figures.map((f) => (
                      <span className="pgd-stat" key={f.label}>
                        <b>{f.value}</b>
                        <span>{f.label}</span>
                      </span>
                    ))}
                  </div>
                  {/* ONE footnote for the row, where it used to be a marker in
                      the heading: these numbers were summed from what the
                      athletes posted rather than set as recap targets, and a
                      brand should not read a derived total as an agreed one. */}
                  {c.figuresSource && (
                    <span className="pgd-figs-note">{c.figuresSource}</span>
                  )}
                </section>
              )}
              {/* Top content: the six highest-viewed posts on this campaign,
                  directly under the figures those posts add up to. Same rows
                  as the dashboard's Top posts tile. */}
              {c.topContent.length > 0 && (
                <section className="pgd-panel">
                  <h3>Top content</h3>
                  {c.topContent.map((p, i) => {
                    const Row = (
                      <>
                        <span className="pgd-r" aria-hidden="true">
                          {i + 1}
                        </span>
                        {p.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbUrl} alt="" />
                        ) : (
                          <span className="pgd-nothumb">{initials(p.name)}</span>
                        )}
                        <div>
                          <b>{p.name}</b>
                          <small>IG Reel{p.school ? ` · ${p.school}` : ""}</small>
                        </div>
                        {/* Inline, not stacked like the dashboard tile's:
                            this panel is the full content width, and a label
                            on its own line under the number left the two
                            stranded at the far right. */}
                        <div className="pgd-v pgd-v-inline">
                          <b>{compact(p.views ?? 0)}</b> views
                        </div>
                      </>
                    );
                    // Prefer the live post — it is the thing the figure
                    // describes. Without one the row still stands; it just
                    // isn't a link.
                    return p.postUrl ? (
                      <a
                        className="pgd-post"
                        key={p.id}
                        href={p.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {Row}
                      </a>
                    ) : (
                      <div className="pgd-post" key={p.id}>
                        {Row}
                      </div>
                    );
                  })}
                </section>
              )}
              {c.takeawaysHtml && (
                <section className="pgd-panel">
                  <h3>Key takeaways</h3>
                  {/* Sanitized upstream by richText(): strict tag allowlist,
                      every attribute dropped except a validated href. */}
                  <div
                    className="pgd-prose"
                    dangerouslySetInnerHTML={{ __html: c.takeawaysHtml }}
                  />
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
