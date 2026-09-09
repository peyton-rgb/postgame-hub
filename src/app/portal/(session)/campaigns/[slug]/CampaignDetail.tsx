"use client";

import { useMemo, useState } from "react";
import MediaGrid from "@/components/portal/pages/MediaGrid";
import { TileEmpty } from "@/components/portal/PortalShell";
import type { loadCampaignDetail } from "@/lib/portal/pages-data";

type Campaign = NonNullable<Awaited<ReturnType<typeof loadCampaignDetail>>>;

function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function CampaignDetail({ campaign: c }: { campaign: Campaign }) {
  // Tab set depends on state: live gets Approvals, wrapped gets Results.
  const tabs = c.live
    ? (["overview", "athletes", "content", "approvals"] as const)
    : (["overview", "athletes", "content", "results"] as const);
  const [tab, setTab] = useState<(typeof tabs)[number]>("overview");
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
        <div className="pgd-hero-in">
          <h2>{c.name}</h2>
          {[c.quarter, c.campaignType, c.platform].filter(Boolean).length > 0 && (
            <p className="pgd-card-meta">
              {[c.quarter, c.campaignType, c.platform].filter(Boolean).join(" · ")}
            </p>
          )}
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
              <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
                {c.athleteCount > 0 && (
                  <span className="pgd-stat">
                    <b style={{ fontSize: 24 }}>{c.athleteCount}</b>
                    <span>Athletes</span>
                  </span>
                )}
                {c.schoolCount > 0 && (
                  <span className="pgd-stat">
                    <b style={{ fontSize: 24 }}>{c.schoolCount}</b>
                    <span>Schools</span>
                  </span>
                )}
                {c.media.length > 0 && (
                  <span className="pgd-stat">
                    <b style={{ fontSize: 24 }}>{c.media.length}</b>
                    <span>Files</span>
                  </span>
                )}
              </div>
            </section>
          )}

          <div className="pgd-overview-split">
            <section className="pgd-panel">
              <h3>Objective</h3>
              {c.description ? (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(250,248,245,.68)" }}>
                  {c.description}
                </p>
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
                    <span className="pgd-person-body">
                      <span className="pgd-person-name">{a.name}</span>
                      {[a.school, a.sport].filter(Boolean).length > 0 && (
                        <span className="pgd-person-meta">
                          {[a.school, a.sport].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {(a.followers !== null || a.views !== null) && (
                        <span className="pgd-person-num">
                          {[
                            a.followers !== null ? `${compact(a.followers)} followers` : null,
                            a.views !== null ? `${compact(a.views)} views` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
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
          {c.figures.length === 0 && c.takeaways.length === 0 ? (
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
                  <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
                    {c.figures.map((f) => (
                      <span className="pgd-stat" key={f.label}>
                        <b style={{ fontSize: 28 }}>{f.value}</b>
                        <span>{f.label}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {c.takeaways.length > 0 && (
                <section className="pgd-panel">
                  <h3>Key takeaways</h3>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "rgba(250,248,245,.68)" }}>
                    {c.takeaways.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
