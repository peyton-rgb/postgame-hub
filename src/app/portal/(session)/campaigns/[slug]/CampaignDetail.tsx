"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MediaGrid from "@/components/portal/pages/MediaGrid";
import { TileEmpty } from "@/components/portal/PortalShell";
import { compact, initials } from "@/lib/portal/format";
import type { loadCampaignDetail } from "@/lib/portal/pages-data";

type Campaign = NonNullable<Awaited<ReturnType<typeof loadCampaignDetail>>>;

type TabKey = "overview" | "athletes" | "content" | "approvals" | "results";

export default function CampaignDetail({
  campaign: c,
  initialTab,
}: {
  campaign: Campaign;
  /** From ?tab= on the URL. Anything unrecognised falls back to overview. */
  initialTab?: string;
}) {
  // TABS ARE ONLY THE ONES WITH SOMETHING BEHIND THEM. A live campaign that
  // has not started yet — no roster, no content, no recap, and
  // review_sessions empty database-wide — used to render four tabs, three of
  // which said "nothing yet". Overview always shows; the rest have to earn
  // their place.
  const hasResults = c.figures.length > 0 || !!c.takeawaysHtml || c.topContent.length > 0;
  const tabs = useMemo(() => {
    const t: TabKey[] = ["overview"];
    if (c.athletes.length > 0) t.push("athletes");
    if (c.media.length > 0) t.push("content");
    // NO APPROVALS TAB. It is not "empty pending data" — it cannot be
    // sourced at all: review_sessions.campaign_id is a foreign key to
    // brand_campaigns, not campaign_recaps (CLAUDE.md's name twins), so no
    // review session can ever match a campaign on this page even once the
    // table has rows in it. A tab structurally incapable of showing anything
    // is worse than no tab. Logged in the run log as the blocker for
    // per-campaign approvals.
    if (!c.live && hasResults) t.push("results");
    return t;
  }, [c.athletes.length, c.media.length, c.live, hasResults]);

  const pick = useCallback(
    (want: string | undefined | null): TabKey => {
      const w = (want ?? "").toLowerCase();
      return (tabs as readonly string[]).includes(w) ? (w as TabKey) : "overview";
    },
    [tabs]
  );

  // ?tab= is honoured on load, validated against THIS campaign's tab set —
  // ?tab=results on a live campaign would otherwise select a tab with no
  // button to get back from.
  const [tab, setTab] = useState<TabKey>(() => pick(initialTab));
  const [school, setSchool] = useState("");

  // TAB SWITCHES PUSH HISTORY, so the back button returns to the tab you were
  // on rather than leaving the page.
  //
  // history.pushState directly, not router.push: the tab lives entirely in
  // this client component, and a router push would round-trip the whole server
  // component — a fresh query for 132 athletes and 89 media rows — to change
  // which div is displayed. The URL still ends up shareable and ?tab= still
  // works on a cold load, which is what the round trip would have bought.
  const go = useCallback(
    (next: TabKey) => {
      setTab(next);
      const url = next === "overview" ? window.location.pathname : `?tab=${next}`;
      window.history.pushState({ tab: next }, "", url);
    },
    []
  );

  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      setTab(pick(q.get("tab")));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pick]);

  // A tab can disappear under a filter change only in theory today, but if the
  // selected tab is not in the set the page must not render a blank body.
  const active: TabKey = (tabs as readonly string[]).includes(tab) ? tab : "overview";

  // A live campaign with nothing in it yet. Not the same as "wrapped with no
  // recap": this one has not happened, so the page says so instead of showing
  // an At a glance panel with no figures in it.
  const inProgress = c.live && c.athletes.length === 0 && c.media.length === 0;

  const schools = useMemo(
    () =>
      Array.from(new Set(c.athletes.map((a) => a.school).filter((s): s is string => !!s))).sort(),
    [c.athletes]
  );
  const roster = school ? c.athletes.filter((a) => a.school === school) : c.athletes;

  const label = (t: string) => t[0].toUpperCase() + t.slice(1);

  return (
    <div className="pgd-page">
      {/* THE HERO CARRIES EVERYTHING THE HEADER USED TO. Full-bleed photo
          with a left-to-right scrim: the name and quarter · type sit on the
          solid end, the three At-a-glance figures on the right, and the
          separate At-a-glance panel that used to sit under the tabs is gone
          along with the small subtitle above the hero.

          The scrim is heavy at the left and light at the right on purpose.
          The geometry from pass 3 has not changed — a 220px full-bleed band
          shows about 12.5% of a portrait hero's height, so no crop point can
          contain a face — but with the copy on the dark end, the part of the
          photograph that stays legible is the part that carries no text.
          focal_y is honoured where the row has one. */}
      {/* The figures are a SIBLING of the hero, not a child. The hero is a
          fixed-height box with overflow: hidden for its rounded corners, so a
          child could never sit outside it — and on a phone the figures have to,
          because three Anton numbers and a 30px name cannot share 350px. The
          wrapper gives desktop somewhere to absolutely position them into. */}
      <div className="pgd-hero-block">
      <div className="pgd-hero">
        {c.heroUrl ? (
          <div
            className="pgd-hero-photo"
            style={
              c.heroFocalY !== null
                ? ({ "--hero-focal": `${c.heroFocalY}%` } as React.CSSProperties)
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.heroUrl} alt="" />
          </div>
        ) : null}

        <div className="pgd-hero-in">
          <h1>{c.name}</h1>
          {[c.quarter, c.campaignType].filter(Boolean).length > 0 && (
            <p className="pgd-hero-meta">
              {[c.quarter, c.campaignType].filter(Boolean).join(" · ")}
            </p>
          )}
          {inProgress ? (
            <p className="pgd-hero-note">
              This campaign is in progress — athletes and content will appear
              as they&rsquo;re confirmed.
            </p>
          ) : null}
        </div>

      </div>

        {/* At a glance. Only figures that exist. */}
        {(c.athleteCount > 0 || c.schoolCount > 0 || c.media.length > 0) && (
          <div className="pgd-hero-figs">
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
        )}
      </div>

      {/* One tab is not a tab row — it is a heading for the only thing here. */}
      {tabs.length > 1 && (
      <div className="pgd-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={active === t}
            className={active === t ? "on" : undefined}
            onClick={() => go(t)}
          >
            {label(t)}
          </button>
        ))}
      </div>
      )}

      {active === "overview" && inProgress && (
        /* Contact card only. At a glance would be three absent figures and
           Objective an empty brief, so neither is rendered. */
        <div className="pgd-overview">
          <section className="pgd-panel" style={{ maxWidth: 520 }}>
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
              <TileEmpty
                line="No contact assigned yet"
                note="Ask your Postgame contact who is leading this."
              />
            )}
          </section>
        </div>
      )}

      {active === "overview" && !inProgress && (
        /* Explicit two-column split, not a stack. Three of these four panels
           are one short line each on a CVS campaign; stacked full-width they
           read as four empty bars down an otherwise blank page. At a glance
           goes across the top because it holds the only real figures; the
           short panels share the narrow right-hand column. */
        <div className="pgd-overview">
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

      {active === "athletes" && (
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
              {/* A DROPDOWN, not a row of pills. SPF has 102 schools; the
                  pill row showed the first eight and silently dropped 94,
                  which is a filter that lies about its own options. A select
                  holds all of them and costs one line. */}
              {schools.length > 1 && (
                <div className="pgd-filters">
                  <select
                    className="pgd-select"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    aria-label="Filter by school"
                  >
                    <option value="">All schools ({schools.length})</option>
                    {schools.map((sch) => (
                      <option key={sch} value={sch}>
                        {sch}
                      </option>
                    ))}
                  </select>
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

      {active === "content" && (
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

      {active === "approvals" && (
        <div className="pgd-panel">
          {/* review_sessions is empty database-wide, so this is the honest
              state rather than a table with no rows. */}
          <TileEmpty
            line="Nothing waiting on you"
            note="We'll flag content here when it's ready for your review."
          />
        </div>
      )}

      {active === "results" && (
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
