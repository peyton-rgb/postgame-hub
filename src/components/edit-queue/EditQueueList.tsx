// ============================================================
// Edit queue — the list of open jobs.
//
// Sibling screen to the review hub and used alongside it, so it borrows that
// screen's tokens and shell wholesale (.eqx mirrors .rvx). Two screens that
// are worked in the same sitting should not look like two products.
//
// Sorted by longest waiting by default, because age is the failure mode here:
// the oldest submission sat 13 days before anyone opened it. Volume is a
// number on a chip; age is the thing that goes wrong quietly.
// ============================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { waitingLabel, JOB_STATUS } from '@/lib/edit-queue';
import type { EditQueueJob } from '@/app/api/edit-queue/route';

interface Orphan {
  id: string;
  athleteName: string | null;
  campaignName: string | null;
  fileName: string | null;
  thumbnailUrl: string | null;
  reviewedAt: string | null;
}

type Sort = 'waiting' | 'campaign';

export default function EditQueueList() {
  const [jobs, setJobs] = useState<EditQueueJob[] | null>(null);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('waiting');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/edit-queue');
        const json = await res.json();
        if (!live) return;
        if (!res.ok) {
          setErr(json?.error || 'Could not load the edit queue.');
          return;
        }
        setJobs(json.jobs ?? []);
        setOrphans(json.orphans ?? []);
        setCampaigns(json.campaigns ?? []);
      } catch {
        if (live) setErr('Could not load the edit queue.');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    if (!jobs) return [];
    const filtered =
      campaign === 'all' ? jobs : jobs.filter((j) => j.submission?.campaignId === campaign);
    const out = [...filtered];
    if (sort === 'waiting') {
      // Oldest first — the API already returns this order, but the client
      // re-sorts so the toggle is honest rather than trusting the server.
      out.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    } else {
      out.sort((a, b) => {
        const an = a.submission?.campaignName ?? '';
        const bn = b.submission?.campaignName ?? '';
        return an.localeCompare(bn) || +new Date(a.createdAt) - +new Date(b.createdAt);
      });
    }
    return out;
  }, [jobs, campaign, sort]);

  const waitingCount = shown.filter((j) => j.status === JOB_STATUS.queued).length;
  const approvalCount = shown.filter((j) => j.status === JOB_STATUS.awaitingApproval).length;

  if (err) return <div className="eqx"><div className="eqx-msg bad">{err}</div><Style /></div>;
  if (!jobs) return <div className="eqx"><div className="eqx-msg">Loading the queue…</div><Style /></div>;

  return (
    <div className="eqx">
      <div className="top">
        <div className="ttl">
          <h1>Edit queue</h1>
          <div className="sub">
            {shown.length === 0
              ? 'Nothing waiting'
              : `${waitingCount} to edit · ${approvalCount} to approve`}
          </div>
        </div>
        <div className="ctrls">
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)} aria-label="Filter by campaign">
            <option value="all">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="waiting">Longest waiting</option>
            <option value="campaign">By campaign</option>
          </select>
        </div>
      </div>

      {/* An orphan is a file the reviewer sent to edit that no job knows
          about — the exact failure this lane was built to end. It is shown
          loudly rather than filtered out. */}
      {orphans.length > 0 && (
        <div className="orphan">
          <strong>{orphans.length} file{orphans.length === 1 ? '' : 's'} queued for edit with no open job.</strong>
          <span>
            {orphans.map((o) => o.fileName || o.athleteName || o.id).join(', ')}
          </span>
          <span className="hint">Re-send them from the review hub to open a job.</span>
        </div>
      )}

      <div className="page">
        {shown.length === 0 ? (
          <div className="eqx-msg">
            Nothing in the queue. Files sent to edit from the review hub land here.
          </div>
        ) : (
          <ul className="rows">
            {shown.map((j) => (
              <li key={j.id}>
                <Link href={`/dashboard/edit-queue/${j.id}`} className="row">
                  <div className="thumb">
                    {j.submission?.thumbnailUrl ? (
                      // Drive rejects requests that carry a referrer; without
                      // this every thumbnail renders blank.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={j.submission.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : (
                      <span className="ph" aria-hidden="true" />
                    )}
                  </div>

                  <div className="meta">
                    <div className="who">
                      <span className="ath">{j.submission?.athleteName || 'Unknown athlete'}</span>
                      {j.submission?.campaignName && <span className="camp">{j.submission.campaignName}</span>}
                    </div>
                    <div className="instr">{j.instruction}</div>
                    <div className="prov">
                      {j.queuedBy ? `Queued by ${j.queuedBy}` : 'Queued'}
                      {' · '}
                      {new Date(j.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {j.parentJobId ? ' · follow-up' : ''}
                    </div>
                  </div>

                  <div className="right">
                    <span className={`st ${j.status === JOB_STATUS.awaitingApproval ? 'review' : 'queued'}`}>
                      {j.status === JOB_STATUS.awaitingApproval ? 'To approve' : 'To edit'}
                    </span>
                    <span className="age" title={new Date(j.createdAt).toLocaleString()}>
                      {waitingLabel(j.createdAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Style />
    </div>
  );
}

function Style() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

// Tokens and shell match ReviewHub's .rvx so the two screens read as one
// product. Breakpoint at 860px mirrors the review hub's, and the dashboard
// shell hands over the full viewport below 900px (#219, #222).
const CSS = `
.eqx{--bg:#0B0B0F;--surface:#131319;--surface2:#1A1A22;
 --line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.16);
 --text:#F2F1EE;--muted:#9A9AA4;--faint:#6B6B75;
 --orange:#D73F09;--good:#4FB88A;--mid:#D99A2B;--bad:#CF5049;
 background:var(--bg);color:var(--text);min-height:100vh;
 font-family:Arimo,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
 font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
.eqx *{box-sizing:border-box}
.eqx button,.eqx select{font-family:inherit;font-size:inherit;cursor:pointer}
.eqx-msg{padding:64px 24px;text-align:center;color:var(--muted);font-size:14px}
.eqx-msg.bad{color:var(--bad)}

.eqx .top{display:flex;align-items:center;gap:14px;padding:16px 24px;
 border-bottom:1px solid var(--line);background:var(--surface);flex-wrap:wrap}
.eqx .ttl h1{margin:0;font-size:19px;font-weight:700;letter-spacing:.2px}
.eqx .ttl .sub{font-size:12px;color:var(--muted);margin-top:2px}
.eqx .ctrls{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
.eqx .ctrls select{background:var(--surface2);color:var(--text);
 border:1px solid var(--line2);border-radius:9px;padding:7px 10px;font-size:13px}

.eqx .orphan{margin:16px 24px 0;padding:12px 14px;border-radius:10px;
 background:rgba(207,80,73,.12);border:1px solid rgba(207,80,73,.45);
 display:flex;flex-direction:column;gap:3px;font-size:13px}
.eqx .orphan strong{color:#F0A184;font-weight:700}
.eqx .orphan .hint{color:var(--muted);font-size:12px}

.eqx .page{padding:16px 24px 60px;max-width:1080px}
.eqx .rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}

.eqx .row{display:flex;gap:14px;align-items:flex-start;text-decoration:none;color:inherit;
 background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.eqx .row:hover{border-color:var(--line2);background:var(--surface2)}

.eqx .thumb{flex:none;width:76px;height:76px;border-radius:9px;overflow:hidden;
 background:var(--surface2);border:1px solid var(--line)}
.eqx .thumb img{width:100%;height:100%;object-fit:cover;display:block}
.eqx .thumb .ph{display:block;width:100%;height:100%}

.eqx .meta{flex:1;min-width:0}
.eqx .who{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.eqx .who .ath{font-weight:700}
.eqx .who .camp{font-size:12px;color:var(--muted)}
.eqx .instr{margin-top:4px;font-size:13px;color:var(--text);
 white-space:pre-wrap;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.eqx .prov{margin-top:5px;font-size:12px;color:var(--faint)}

.eqx .right{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.eqx .st{font-size:11px;font-weight:700;border-radius:20px;padding:3px 9px;border:1px solid}
.eqx .st.queued{border-color:rgba(215,63,9,.5);color:#F0A184;background:rgba(215,63,9,.14)}
.eqx .st.review{border-color:rgba(217,154,43,.5);color:#E7C078;background:rgba(217,154,43,.14)}
.eqx .age{font-size:16px;font-weight:700;color:var(--muted)}

@media(max-width:860px){
 .eqx .top{padding:12px 14px}
 .eqx .ctrls{margin-left:0;width:100%}
 .eqx .ctrls select{flex:1 1 140px;min-width:0}
 .eqx .orphan{margin:12px 14px 0}
 .eqx .page{padding:12px 14px 40px}
 /* The row keeps the thumbnail beside the text but lets the status drop
    under it — stacking everything would push the age off the first screen,
    and the age is the column that matters. */
 .eqx .row{flex-wrap:wrap}
 .eqx .thumb{width:60px;height:60px}
 .eqx .right{flex-direction:row;align-items:center;width:100%;
  justify-content:space-between;border-top:1px solid var(--line);padding-top:8px}
 .eqx .age{font-size:14px}
}
`;
