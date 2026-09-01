// ============================================================
// Recap Builder — recap page render for the Overview step
//
// The published page as the Overview step drives it: hero, the
// Rundown, campaign timeline, The Numbers (hero figure, stat
// band with sparklines, KPI glass cards, platform donut,
// post-type breakdown cards).
//
// Markup and class names are the prototype's; styling lives in
// overview-step.css, generated from the prototype's own CSS.
//
// NOT INCLUDED: the National Footprint map. It is present in
// -v6 but the handoff explicitly SKIPs it ("map (no state
// column)"), and there is genuinely no state/region column on
// athletes — the prototype hard-codes a 29-entry state list
// with the note "recompute in real build". Needs a decision
// before it can be driven by data.
// ============================================================

'use client';

import type { MetricTile, PlatformBox } from './derive';

export type Moment = { mo: string; sd: string; lb: string; nt: string };

/** Sparkline under each stat-band figure — the prototype's fixed bar heights. */
const SPARK = (
  <span className="rp-spark">
    {[4, 7, 5, 10, 8, 14].map((h, i) => (
      <i key={i} style={{ height: h }} />
    ))}
  </span>
);

const DONUT_COLORS: Record<PlatformBox['k'], string> = {
  feed: 'rgba(250,248,245,.35)',
  reels: '#D73F09',
  story: 'rgba(215,63,9,.45)',
  tt: 'rgba(250,248,245,.15)',
};
const DONUT_LABEL: Record<PlatformBox['k'], string> = {
  feed: 'IG Feed',
  reels: 'IG Reels',
  story: 'IG Stories',
  tt: 'TikTok',
};

export default function RecapPreview({
  name,
  lede,
  descHtml,
  moments,
  timelineMeta,
  showTimeline,
  metrics,
  platforms,
  shares,
  showDonut,
  kpi,
  targetRef,
}: {
  name: string;
  lede: string;
  descHtml: string;
  moments: Moment[];
  timelineMeta: string;
  showTimeline: boolean;
  metrics: MetricTile[];
  platforms: PlatformBox[];
  shares: Record<PlatformBox['k'], number>;
  showDonut: boolean;
  kpi: { cpm: string; cpe: string; sub: string; visible: boolean; posts: string };
  /** Focus-follow target registrar from useFocusFollow(). */
  targetRef: (key: string) => (el: HTMLElement | null) => void;
}) {
  const on = metrics.filter((m) => m.on);
  // Hero figure: impressions if on, else engagements, else followers.
  const heroPick = (['impr', 'eng', 'followers'] as const)
    .map((k) => on.find((m) => m.k === k))
    .find(Boolean);

  const visibleForDonut = showDonut ? platforms.filter((p) => p.on && shares[p.k] > 0) : [];
  const donutTotal = visibleForDonut.reduce((s, p) => s + shares[p.k], 0);

  let acc = 0;
  const stops: string[] = [];
  const legend: { k: PlatformBox['k']; disp: string; share: number }[] = [];
  if (donutTotal > 0) {
    visibleForDonut.forEach((p) => {
      const share = (shares[p.k] / donutTotal) * 100;
      stops.push(`${DONUT_COLORS[p.k]} ${acc}% ${acc + share}%`);
      acc += share;
      const v = shares[p.k];
      legend.push({
        k: p.k,
        disp: v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'K' : String(v),
        share,
      });
    });
  }

  return (
    <>
      <div className="rp-nav">
        <img
          src="https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/render/image/public/campaign-media/brand-kits/1774632094358-hv0c0rmo.png?width=400&quality=90&resize=contain"
          alt="Postgame"
        />
        <div className="rp-links">
          <span>Overview</span>
          <span>Numbers</span>
          <span>Performers</span>
          <span>Content</span>
          <span>Roster</span>
        </div>
      </div>

      <div className="rp-hero">
        <div className="rp-kick" ref={targetRef('lede')}>
          {lede.replace('—', '·')}
        </div>
        <div className="rp-name" ref={targetRef('name')}>
          {(name || 'Campaign name').toUpperCase()}
        </div>
      </div>

      {/* #2 THE RUNDOWN */}
      <div className="rp-sec">
        <div className="rp-skick">What we ran</div>
        <div className="rp-sh">Overview</div>
        <div className="rp-run">
          <div
            className="rp-prose"
            ref={targetRef('desc')}
            dangerouslySetInnerHTML={{ __html: descHtml }}
          />
        </div>
      </div>

      {/* #3 CAMPAIGN TIMELINE — hidden entirely when no dates are set */}
      {showTimeline && moments.length > 0 && (
        <div className="rp-sec" ref={targetRef('timeline')}>
          <div className="rp-tlhead">
            <span className="a">Campaign timeline</span>
            <span className="b">{timelineMeta}</span>
          </div>
          <div
            className="rp-tl"
            style={{ ['--tlcols' as string]: Math.max(moments.length, 2) } as React.CSSProperties}
          >
            {moments.map((m, i) => (
              <div className="rp-tm" key={m.lb}>
                <div className="ix">0{i + 1}</div>
                <div className="mo">{m.mo}</div>
                <div className="sd">{m.sd}</div>
                <div className="hl2" />
                <div className="lb">{m.lb}</div>
                <div className="nt">{m.nt}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THE NUMBERS */}
      <div className="rp-sec">
        <div className="rp-skick">The results</div>
        <div className="rp-sh">The Numbers</div>

        {heroPick && (
          <div>
            <div className="rp-fig">{heroPick.v}</div>
            <div className="rp-figl">{heroPick.l}</div>
            <div className="rp-figrule" />
          </div>
        )}

        <div className="rp-band">
          {on
            .filter((m) => m !== heroPick)
            .map((m) => (
              <div className="rp-kpi" key={m.k}>
                <div className="v">{m.v}</div>
                <div className="l">{m.l}</div>
                {SPARK}
                {m.c ? <div className="c">{m.c}</div> : null}
              </div>
            ))}
        </div>

        {kpi.visible && (
          <>
            <div className="rp-kpilab">Campaign KPIs</div>
            <div className="rp-gcards">
              <div className="rp-g">
                <div className="v">{kpi.cpm}</div>
                <div className="l">CPM</div>
                <div className="s">{kpi.sub}</div>
              </div>
              <div className="rp-g">
                <div className="v">{kpi.cpe}</div>
                <div className="l">Cost per engagement</div>
                <div className="s">{kpi.sub}</div>
              </div>
              <div className="rp-g">
                <div className="v">$—</div>
                <div className="l">Earned media value</div>
                <div className="s">Not yet modeled</div>
              </div>
              <div className="rp-g">
                <div className="v">{kpi.posts}</div>
                <div className="l">Total posts</div>
                <div className="s">Feed · Reels · Stories · TT</div>
              </div>
            </div>
          </>
        )}

        <div className="rp-split">
          {donutTotal > 0 && legend.length > 0 && (
            <>
              <div className="rp-donut" style={{ background: `conic-gradient(${stops.join(',')})` }} />
              <div className="rp-leg">
                {legend.map((l) => (
                  <div className="rp-lrow" key={l.k}>
                    <span className="sw" style={{ background: DONUT_COLORS[l.k] }} />
                    <span className="pl">{DONUT_LABEL[l.k]}</span>
                    <span className="pv2">{l.disp}</span>
                    <span className="pp">
                      {l.share < 1 && l.share > 0 ? '<1' : Math.round(l.share)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* #9 post-type breakdown cards */}
        <div className="rp-cards">
          {platforms
            .filter((p) => p.on)
            .map((p) => (
              <div className="rp-card" key={p.k}>
                <div className="ch">{p.t}</div>
                <div className="big">
                  <span className="n">{p.hero[0]}</span>
                  <span className="u">{p.hero[1]}</span>
                </div>
                {p.rows
                  .filter((r) => r[2])
                  .map((r) => (
                    <div className="cr" key={r[0]}>
                      <span>{r[0]}</span>
                      <b>{r[1]}</b>
                    </div>
                  ))}
                {p.er && (
                  <div className="cr er">
                    <span>Avg eng. rate</span>
                    <b>{p.er}</b>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
