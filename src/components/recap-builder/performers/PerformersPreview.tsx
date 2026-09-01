// ============================================================
// Recap Builder — Top Performers section (public render)
//
// Cards are photo-first: rank numeral with an orange bar
// top-left, IG glass icon bottom-right linking to the handle,
// and a SINGLE toggled metric with source attribution
// ("13.3K ENGAGEMENTS · VIA IG FEED").
//
// The basis toggle appears here AND in the builder toolbar,
// driving one shared state — flipping either flips both, and
// the ranking recomputes.
//
// No staged photo -> initials card, never a broken image.
// ============================================================

'use client';

import type { BuilderAthlete } from '../athletes/metrics';
import { basisValue, cardUrl, fmt, initials, sourceLabel, type Basis } from './ranking';

const IgGlyph = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="1.1" fill="#FAF8F5" stroke="none" />
  </svg>
);

export default function PerformersPreview({
  top,
  basis,
  onBasisChange,
  thumbUrlFor,
}: {
  top: BuilderAthlete[];
  basis: Basis;
  onBasisChange: (b: Basis) => void;
  /** Chosen thumbnail for an athlete, else their first staged photo, else null. */
  thumbUrlFor: (a: BuilderAthlete) => string | null;
}) {
  return (
    <div className="rp-sec">
      <div className="rp-shead">
        <div>
          <div className="rp-skick">Who moved the needle</div>
          <div className="rp-sh">Top Performers</div>
        </div>
        {/* Second handle on the one basis state. */}
        <div className="rp-toggle">
          <span className={basis === 'eng' ? 'on' : undefined} onClick={() => onBasisChange('eng')}>
            Engagements
          </span>
          <span className={basis === 'impr' ? 'on' : undefined} onClick={() => onBasisChange('impr')}>
            Impressions
          </span>
        </div>
      </div>

      <div className="rp-cards">
        {top.map((a, i) => {
          const url = thumbUrlFor(a);
          const src = sourceLabel(a, basis);
          return (
            <div className={'rp-card' + (i === 0 ? ' lead' : '')} key={a.id}>
              <div className="rp-photo">
                {url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img loading="lazy" src={cardUrl(url)} alt="" />
                ) : (
                  <span className="initials">{initials(a.name ?? '')}</span>
                )}
                <span className="rp-rk">{i + 1}</span>
                {a.ig_handle && (
                  <a
                    className="rp-ig"
                    href={`https://instagram.com/${a.ig_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`@${a.ig_handle}`}
                  >
                    <IgGlyph />
                  </a>
                )}
                <div className="rp-id">
                  <div className="nm">{a.name}</div>
                  <div className="sc">
                    {[a.school, a.sport].filter(Boolean).join(' · ')}
                  </div>
                  <div className="rp-metric">
                    <div className="v">{fmt(basisValue(a, basis))}</div>
                    <div className="ml">
                      {basis === 'eng' ? 'Engagements' : 'Impressions'}
                      {src && <em> · via {src}</em>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
