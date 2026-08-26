// ============================================================
// Working one edit job: the source, the instruction, the result.
//
// NOTHING HERE PERFORMS AN EDIT. Someone opens the source in Photoshop, After
// Effects or Frame.io, does the work, and drops the finished file back. The
// upload follows the same two-step the rest of the app uses (athlete
// deliverables, videographer register): the browser puts the bytes in the
// bucket, then the server is handed the path and owns every database write.
//
// The approve button is the gate `approved_by` exists for. A result is not
// done because it was uploaded; it is done because a person said so.
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { formatTimecode, waitingLabel, JOB_STATUS, type EditInstruction } from '@/lib/edit-queue';

const BUCKET = 'campaign-media';

interface Job {
  id: string;
  status: string;
  instruction: string;
  instructions: EditInstruction[];
  contentType: string;
  sourceUrl: string;
  outputUrl: string | null;
  outputThumbnailUrl: string | null;
  createdAt: string;
  queuedBy: string | null;
  approvedBy: string | null;
  parentJobId: string | null;
  submission: {
    id: string;
    athleteName: string | null;
    school: string | null;
    campaignName: string | null;
    fileName: string | null;
    thumbnailUrl: string | null;
    status: string | null;
    driveFileUrl: string | null;
  } | null;
}

export default function EditJobWorkspace({ jobId }: { jobId: string }) {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  async function load() {
    const res = await fetch(`/api/edit-queue/${jobId}`);
    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error || 'Could not load this job.');
      return;
    }
    setJob(json.job);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleFile(file: File) {
    if (!job) return;
    setErr(null);
    setBusy('upload');
    try {
      const ext = file.name.split('.').pop() || 'bin';
      // Path is scoped to the job; the API rejects anything outside it, so one
      // job cannot claim another's upload.
      const path = `edit-output/${job.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const res = await fetch(`/api/edit-queue/${job.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attach-output', storagePath: path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not attach the file.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Could not upload the file.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function act(action: 'approve' | 'reject') {
    if (!job) return;
    setErr(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/edit-queue/${job.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: action === 'reject' ? note : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'That did not go through.');
      if (action === 'approve') {
        router.push('/dashboard/edit-queue');
        return;
      }
      if (json.nextJobId) {
        router.push(`/dashboard/edit-queue/${json.nextJobId}`);
        return;
      }
      await load();
    } catch (e: any) {
      setErr(e?.message || 'That did not go through.');
    } finally {
      setBusy(null);
    }
  }

  if (err && !job) return <div className="eqw"><div className="eqw-msg bad">{err}</div><Style /></div>;
  if (!job) return <div className="eqw"><div className="eqw-msg">Loading…</div><Style /></div>;

  const closed = job.status !== JOB_STATUS.queued && job.status !== JOB_STATUS.awaitingApproval;
  const sub = job.submission;

  return (
    <div className="eqw">
      <div className="top">
        <Link href="/dashboard/edit-queue" className="back">← Queue</Link>
        <div className="ttl">
          <h1>{sub?.athleteName || 'Edit job'}</h1>
          <div className="sub">
            {[sub?.campaignName, sub?.fileName].filter(Boolean).join(' · ') || 'No campaign recorded'}
          </div>
        </div>
        <span className={`st ${job.status === JOB_STATUS.awaitingApproval ? 'review' : closed ? 'done' : 'queued'}`}>
          {job.status === JOB_STATUS.awaitingApproval
            ? 'Awaiting approval'
            : closed
              ? job.status === JOB_STATUS.complete ? 'Approved' : 'Closed'
              : `Waiting ${waitingLabel(job.createdAt)}`}
        </span>
      </div>

      <div className="work">
        {/* source */}
        <section className="pane">
          <h2>Source</h2>
          <div className="frame">
            {job.contentType === 'image' ? (
              // Drive rejects requests carrying a referrer — without this the
              // frame is blank.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sub?.thumbnailUrl || job.sourceUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="vid">
                <span>Video</span>
                <p>Playback is not stored yet — open the original to work on it.</p>
              </div>
            )}
          </div>
          <a className="btn ghost" href={job.sourceUrl} target="_blank" rel="noreferrer">
            Open original
          </a>
        </section>

        {/* instruction */}
        <section className="pane">
          <h2>What was asked for</h2>
          {job.instructions.length > 0 ? (
            <ul className="instr">
              {job.instructions.map((i, n) => (
                <li key={n}>
                  <span className={`src ${i.source}`}>{i.source === 'flag' ? 'Flagged' : 'Reviewer'}</span>
                  {typeof i.timecode === 'number' && <span className="tc">{formatTimecode(i.timecode)}</span>}
                  <span className="txt">{i.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <pre className="prose">{job.instruction}</pre>
          )}
          <div className="prov">
            {job.queuedBy ? `Queued by ${job.queuedBy}` : 'Queued'} ·{' '}
            {new Date(job.createdAt).toLocaleString()}
            {job.parentJobId && (
              <>
                {' · '}
                <Link href={`/dashboard/edit-queue/${job.parentJobId}`}>previous attempt</Link>
              </>
            )}
          </div>
        </section>

        {/* result */}
        <section className="pane">
          <h2>Result</h2>
          {job.outputUrl ? (
            <>
              <div className="frame">
                {job.contentType === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={job.outputUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <video src={job.outputUrl} controls preload="metadata" />
                )}
              </div>
              <a className="btn ghost" href={job.outputUrl} target="_blank" rel="noreferrer">
                Open result
              </a>
            </>
          ) : (
            <div className="drop">
              <p>Edit in Photoshop, After Effects or Frame.io, then drop the finished file here.</p>
            </div>
          )}

          {!closed && (
            <>
              <input
                ref={fileRef}
                type="file"
                className="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                disabled={!!busy}
              />
              <button
                type="button"
                className="btn"
                onClick={() => fileRef.current?.click()}
                disabled={!!busy}
              >
                {busy === 'upload' ? 'Uploading…' : job.outputUrl ? 'Replace file' : 'Attach edited file'}
              </button>
            </>
          )}

          {job.outputUrl && !closed && (
            <div className="gate">
              <button type="button" className="btn good" onClick={() => act('approve')} disabled={!!busy}>
                {busy === 'approve' ? 'Approving…' : 'Approve'}
              </button>
              <button type="button" className="btn bad" onClick={() => setRejecting((v) => !v)} disabled={!!busy}>
                Not right yet
              </button>
            </div>
          )}

          {rejecting && !closed && (
            <div className="reject">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What still needs doing? This opens a follow-up job carrying the original ask plus this note."
                rows={3}
              />
              <button
                type="button"
                className="btn bad"
                onClick={() => act('reject')}
                disabled={!!busy || !note.trim()}
              >
                {busy === 'reject' ? 'Sending…' : 'Send back'}
              </button>
            </div>
          )}

          {closed && (
            <p className="closed">
              {job.status === JOB_STATUS.complete
                ? `Approved${job.approvedBy ? ` by ${job.approvedBy}` : ''}. The file is back with the reviewer.`
                : 'This job was closed.'}
            </p>
          )}
        </section>
      </div>

      {err && <div className="err">{err}</div>}
      <Style />
    </div>
  );
}

function Style() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

// Three columns on a desk, one on a phone — the same shape and the same 860px
// breakpoint as the review hub, so moving between the two screens does not
// feel like moving between two apps.
const CSS = `
.eqw{--bg:#0B0B0F;--surface:#131319;--surface2:#1A1A22;
 --line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.16);
 --text:#F2F1EE;--muted:#9A9AA4;--faint:#6B6B75;
 --orange:#D73F09;--good:#4FB88A;--mid:#D99A2B;--bad:#CF5049;
 background:var(--bg);color:var(--text);min-height:100vh;
 font-family:Arimo,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
 font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
.eqw *{box-sizing:border-box}
.eqw button,.eqw textarea{font-family:inherit;font-size:inherit}
.eqw button{cursor:pointer}
.eqw-msg{padding:64px 24px;text-align:center;color:var(--muted);font-size:14px}
.eqw-msg.bad{color:var(--bad)}

.eqw .top{display:flex;align-items:center;gap:14px;padding:16px 24px;
 border-bottom:1px solid var(--line);background:var(--surface);flex-wrap:wrap}
.eqw .back{color:var(--muted);text-decoration:none;font-size:13px}
.eqw .back:hover{color:var(--text)}
.eqw .ttl h1{margin:0;font-size:18px;font-weight:700}
.eqw .ttl .sub{font-size:12px;color:var(--muted);margin-top:2px}
.eqw .top .st{margin-left:auto;font-size:11px;font-weight:700;border-radius:20px;
 padding:4px 10px;border:1px solid}
.eqw .st.queued{border-color:rgba(215,63,9,.5);color:#F0A184;background:rgba(215,63,9,.14)}
.eqw .st.review{border-color:rgba(217,154,43,.5);color:#E7C078;background:rgba(217,154,43,.14)}
.eqw .st.done{border-color:rgba(79,184,138,.5);color:#7FD3AE;background:rgba(79,184,138,.14)}

.eqw .work{display:grid;grid-template-columns:1fr 320px 360px;gap:14px;padding:16px 24px 60px;
 align-items:start;max-width:1400px}
.eqw .pane{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px}
.eqw .pane h2{margin:0 0 10px;font-size:12px;text-transform:uppercase;
 letter-spacing:.08em;color:var(--muted);font-weight:700}

.eqw .frame{background:var(--surface2);border:1px solid var(--line);border-radius:10px;
 overflow:hidden;margin-bottom:10px}
.eqw .frame img,.eqw .frame video{display:block;width:100%;height:auto;max-height:60vh;object-fit:contain}
.eqw .vid{padding:32px 16px;text-align:center;color:var(--muted)}
.eqw .vid span{display:block;font-weight:700;color:var(--text)}
.eqw .vid p{margin:6px 0 0;font-size:13px}

.eqw .instr{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.eqw .instr li{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:14px}
.eqw .instr .src{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
 border-radius:20px;padding:2px 8px;border:1px solid;flex:none}
.eqw .instr .src.flag{border-color:rgba(215,63,9,.5);color:#F0A184}
.eqw .instr .src.note{border-color:rgba(154,154,164,.5);color:var(--muted)}
.eqw .instr .tc{font-size:11px;color:var(--faint);flex:none}
.eqw .instr .txt{flex:1;min-width:0}
.eqw .prose{margin:0;white-space:pre-wrap;font-family:inherit;font-size:14px}
.eqw .prov{margin-top:12px;font-size:12px;color:var(--faint)}
.eqw .prov a{color:var(--muted)}

.eqw .drop{border:1px dashed var(--line2);border-radius:10px;padding:22px 14px;
 text-align:center;color:var(--muted);font-size:13px;margin-bottom:10px}
.eqw .drop p{margin:0}
.eqw .file{display:none}

.eqw .btn{display:inline-block;width:100%;text-align:center;background:var(--orange);
 color:#fff;border:1px solid transparent;border-radius:9px;padding:9px 12px;
 font-size:14px;font-weight:700;text-decoration:none}
.eqw .btn:disabled{opacity:.55;cursor:default}
.eqw .btn.ghost{background:transparent;border-color:var(--line2);color:var(--text);font-weight:400}
.eqw .btn.good{background:rgba(79,184,138,.16);border-color:rgba(79,184,138,.5);color:#7FD3AE}
.eqw .btn.bad{background:rgba(207,80,73,.14);border-color:rgba(207,80,73,.5);color:#F0A184}

.eqw .gate{display:flex;gap:8px;margin-top:10px}
.eqw .reject{margin-top:10px;display:flex;flex-direction:column;gap:8px}
.eqw .reject textarea{width:100%;background:var(--surface2);color:var(--text);
 border:1px solid var(--line2);border-radius:9px;padding:9px 10px;resize:vertical}
.eqw .closed{margin:10px 0 0;font-size:13px;color:var(--muted)}
.eqw .err{margin:0 24px 24px;padding:10px 12px;border-radius:9px;
 background:rgba(207,80,73,.14);border:1px solid rgba(207,80,73,.45);color:#F0A184;font-size:13px}

@media(max-width:1100px){
 .eqw .work{grid-template-columns:1fr 320px}
}
@media(max-width:860px){
 /* minmax(0,1fr), not 1fr: a bare 1fr floors at the column's min-content
    width, which pushes the page into a horizontal scroll on a phone. */
 .eqw .work{grid-template-columns:minmax(0,1fr);padding:12px 14px 40px}
 .eqw .top{padding:12px 14px}
 .eqw .top .st{margin-left:0}
 .eqw .frame img,.eqw .frame video{max-height:44vh}
 .eqw .err{margin:0 14px 20px}
}
`;
