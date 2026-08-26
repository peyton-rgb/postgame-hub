// ============================================================
// Reviews index — the list above the review hub.
//
// Deliberately plain. One row per campaign with a form; columns are
// campaign and brand · athletes submitted · to review · oldest waiting ·
// action, and nothing else. No stat cards, no charts, no thumbnails: the
// page has one real row today and anything more looks wrong at n=1.
//
// in_edit and approved appear only when non-zero — a column of zeros is
// noise, and today they are all zero.
//
// Tokens and shell match the review hub (.rvx) it links into, so moving
// between the two does not feel like moving between two products.
// ============================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { daysWaiting, ageTone, type ReviewsIndexRow } from '@/lib/reviews-index';

type Tab = 'needs-us' | 'all';

export default function ReviewsIndex() {
  const [rows, setRows] = useState<ReviewsIndexRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('needs-us');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/reviews-index');
        const json = await res.json();
        if (!live) return;
        if (!res.ok) {
          setErr(json?.error || 'Could not load reviews.');
          return;
        }
        setRows(json.rows ?? []);
      } catch {
        if (live) setErr('Could not load reviews.');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const needsUs = useMemo(() => (rows ?? []).filter((r) => r.needsUs), [rows]);
  const shown = tab === 'needs-us' ? needsUs : (rows ?? []);

  if (err) return <div className="rix"><div className="rix-msg bad">{err}</div><Style /></div>;
  if (!rows) return <div className="rix"><div className="rix-msg">Loading…</div><Style /></div>;

  return (
    <div className="rix">
      <div className="top">
        <div className="ttl">
          <h1>Reviews</h1>
          <div className="sub">
            {needsUs.length === 0
              ? 'Nothing waiting on us'
              : `${needsUs.length} campaign${needsUs.length === 1 ? '' : 's'} waiting on us`}
          </div>
        </div>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'needs-us'}
            className={tab === 'needs-us' ? 'on' : ''}
            onClick={() => setTab('needs-us')}
          >
            Needs us <span className="n">{needsUs.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={tab === 'all' ? 'on' : ''}
            onClick={() => setTab('all')}
          >
            All <span className="n">{rows.length}</span>
          </button>
        </div>
      </div>

      <div className="page">
        {shown.length === 0 ? (
          <div className="rix-msg">
            {tab === 'needs-us'
              ? 'Nothing is waiting on Postgame right now.'
              : 'No campaigns have a submission form yet.'}
          </div>
        ) : (
          <ul className="rows">
            {shown.map((r) => (
              <Row key={r.campaignId} r={r} />
            ))}
          </ul>
        )}
      </div>
      <Style />
    </div>
  );
}

function Row({ r }: { r: ReviewsIndexRow }) {
  const days = daysWaiting(r.oldest);
  const tone = ageTone(days);
  // The review hub is keyed by the form's TOKEN, not the campaign id — the
  // same convention as the route itself. Without a token there is nothing to
  // open, so the row stays a row.
  //
  // A campaign waiting on athletes goes to the form instead of the hub: the
  // hub would open empty, and the useful thing to do with a campaign nobody
  // has submitted to is look at the form you would re-send. It is also the
  // quieter action in the literal sense — it leaves the review queue.
  const href = !r.token
    ? null
    : r.waitingOnAthletes
      ? `/submit/${r.token}`
      : `/dashboard/submission-forms/${r.token}/review`;

  return (
    <li className={`row ${r.waitingOnAthletes ? 'quiet' : ''}`}>
      <div className="c camp">
        <div className="nm">{r.name}</div>
        {r.brand && <div className="br">{r.brand}</div>}
      </div>

      <div className="c num">
        <span className="v">{r.submissions}</span>
        <span className="k">athletes</span>
      </div>

      <div className="c num">
        {r.waitingOnAthletes ? (
          <span className="waiting">Waiting on athletes</span>
        ) : (
          <>
            <span className="v">{r.toReview}</span>
            <span className="k">to review</span>
            {/* Only when non-zero: today these are all zero and a column of
                zeros is noise. */}
            {r.inEdit > 0 && <span className="extra">{r.inEdit} in edit</span>}
            {r.approved > 0 && <span className="extra">{r.approved} approved</span>}
          </>
        )}
      </div>

      <div className={`c age ${tone}`}>
        {days === null ? (
          <span className="none">—</span>
        ) : (
          <>
            <span className="v">{days}d</span>
            <span className="k">oldest</span>
          </>
        )}
      </div>

      <div className="c act">
        {href ? (
          <Link href={href} className={`btn ${r.waitingOnAthletes ? 'ghost' : ''}`}>
            {r.waitingOnAthletes ? 'View form' : 'Review'}
          </Link>
        ) : (
          <span className="nolink">No form link</span>
        )}
      </div>
    </li>
  );
}

function Style() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
.rix{--bg:#0B0B0F;--surface:#131319;--surface2:#1A1A22;
 --line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.16);
 --text:#F2F1EE;--muted:#9A9AA4;--faint:#6B6B75;
 --orange:#D73F09;--good:#4FB88A;--mid:#D99A2B;--bad:#CF5049;
 background:var(--bg);color:var(--text);min-height:100vh;
 font-family:Arimo,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
 font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
.rix *{box-sizing:border-box}
.rix button{font-family:inherit;font-size:inherit;cursor:pointer}
.rix-msg{padding:64px 24px;text-align:center;color:var(--muted);font-size:14px}
.rix-msg.bad{color:var(--bad)}

.rix .top{display:flex;align-items:center;gap:14px;padding:16px 24px;
 border-bottom:1px solid var(--line);background:var(--surface);flex-wrap:wrap}
.rix .ttl h1{margin:0;font-size:19px;font-weight:700;letter-spacing:.2px}
.rix .ttl .sub{font-size:12px;color:var(--muted);margin-top:2px}
.rix .tabs{margin-left:auto;display:flex;gap:6px}
.rix .tabs button{background:transparent;color:var(--muted);
 border:1px solid var(--line2);border-radius:20px;padding:5px 12px;font-size:13px}
.rix .tabs button.on{background:var(--surface2);color:var(--text);border-color:var(--line2)}
.rix .tabs .n{color:var(--faint);margin-left:5px;font-size:12px}

.rix .page{padding:16px 24px 60px;max-width:1080px}
.rix .rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}

.rix .row{display:grid;grid-template-columns:minmax(0,1fr) 90px 150px 90px 110px;
 gap:12px;align-items:center;background:var(--surface);border:1px solid var(--line);
 border-radius:12px;padding:12px 14px}
.rix .row.quiet{background:transparent;border-style:dashed}

.rix .c{min-width:0}
.rix .camp .nm{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rix .camp .br{font-size:12px;color:var(--muted);margin-top:1px}

.rix .num,.rix .age{display:flex;flex-direction:column;gap:0}
.rix .num .v,.rix .age .v{font-size:19px;font-weight:700;line-height:1.15}
.rix .num .k,.rix .age .k{font-size:11px;color:var(--faint);
 text-transform:uppercase;letter-spacing:.06em}
.rix .num .extra{font-size:11px;color:var(--muted);margin-top:2px}
.rix .num .waiting{font-size:12px;color:var(--muted)}
.rix .age .none{font-size:19px;color:var(--faint)}

/* Age is the only thing that changes colour, because age is the point. */
.rix .age.quiet .v{color:var(--muted)}
.rix .age.warn .v{color:#E7C078}
.rix .age.bad .v{color:#F0A184}
.rix .age.bad .k{color:#F0A184;opacity:.75}

.rix .act{display:flex;justify-content:flex-end}
.rix .btn{display:inline-block;text-align:center;background:var(--orange);color:#fff;
 border:1px solid transparent;border-radius:9px;padding:7px 14px;font-size:13px;
 font-weight:700;text-decoration:none;white-space:nowrap}
.rix .btn.ghost{background:transparent;border-color:var(--line2);
 color:var(--muted);font-weight:400}
.rix .nolink{font-size:12px;color:var(--faint)}

@media(max-width:860px){
 .rix .top{padding:12px 14px}
 .rix .tabs{margin-left:0;width:100%}
 .rix .tabs button{flex:1}
 .rix .page{padding:12px 14px 40px}
 /* The five columns become two: the campaign spans the top, the numbers sit
    in a row beneath it, and the action goes full width under those. A bare
    1fr would floor at the campaign name's min-content width and push the
    page into a horizontal scroll. */
 .rix .row{grid-template-columns:minmax(0,1fr) auto;gap:10px}
 .rix .camp{grid-column:1/-1}
 .rix .num,.rix .age{flex-direction:row;align-items:baseline;gap:6px;flex-wrap:wrap}
 .rix .num .v,.rix .age .v{font-size:16px}
 .rix .act{grid-column:1/-1;justify-content:stretch}
 .rix .btn{width:100%}
}
`;
