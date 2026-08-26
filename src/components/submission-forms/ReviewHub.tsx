// src/components/submission-forms/ReviewHub.tsx
// ============================================================
// Submission review hub — the approved design (review-hub-clean.html).
//
// Two screens behind one route. The athlete list, then the review
// workspace, which REPLACES the list rather than floating over it: a
// reviewer works one athlete at a time and the back link in the header is
// the way out. An overlay would keep the list mounted underneath and put
// the scroll position of two screens in play at once.
//
// Styling is a scoped <style> block rather than Tailwind, matching
// SplitView and the submit page. Every selector is namespaced under `.rvx`.
// The design is a fixed three-column workspace with a drag-scrub timeline;
// expressing that as utility classes would be a translation with nothing
// gained.
//
// THINGS THAT LOOK LIKE BUGS AND ARE NOT:
//
//   • score_hook is null on EVERY video, by design. It is scored from a
//     poster frame, which cannot carry a temporal property, and the
//     composite renormalises over the other four. It renders blank — never
//     zero. `col(null)` is the grey track and the bar has no width.
//
//   • The timeline is rendered DISABLED. tier3_submissions stores no
//     duration and nothing else on the row implies one, so there is no
//     honest length to scrub against. The prototype faked it; a fake length
//     would make every timecode a reviewer wrote against it wrong, which is
//     worse than no timeline. The drag machinery below is complete and
//     correct — it switches on the moment `duration` is a real number.
//
//   • Every <img> carries referrerPolicy="no-referrer". Google serves
//     drive.google.com/thumbnail (and the lh3.googleusercontent.com it
//     redirects to) only when NO referrer is attached: with one, both return
//     an error and every thumbnail and stage image renders broken. Verified
//     both ways in the browser — dropping this attribute empties the screen.
//
//   • Athletes are grouped by NAME, not by submission_id. Some files link
//     to a parent `submissions` row and some do not (older uploads, and
//     link-ups that failed), so the same athlete can hold both. Grouping by
//     the parent id splits them in two — Marcellus Nash on the live SVA
//     campaign is exactly that case.
//
// Pulls from: /api/submission-forms/[token]/review
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  bigImage,
  buildAthletes,
  col,
  flagsFor,
  fmt,
  needsAttention,
  type Athlete,
  type FileRow,
  type Instruction,
} from "@/components/submission-forms/reviewHubLogic";

// ── Types ──
// The derivation rules (flagsFor, buildAthletes, the needs-attention test)
// live in ./reviewHubLogic — they are the spec, and they are testable there.

interface HubData {
  campaign: { id: string; name: string; clientName: string | null; logoUrl: string | null };
  requirements: { minPhotos: number; minVideos: number };
  files: FileRow[];
}

interface Note {
  text: string;
  timecode?: number;
}

type Tab = "ready" | "att" | "all";

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  needs_edit: "Queued for edit",
  rejected: "Reshoot requested",
};

// ── The view ──

export default function ReviewHub({ token }: { token: string }) {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("ready");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);

  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [crop, setCrop] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reshootOpen, setReshootOpen] = useState(false);
  const [reshootNote, setReshootNote] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/submission-forms/${token}/review`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ── Athlete aggregation ──
  const athletes = useMemo<Athlete[]>(
    () => (data ? buildAthletes(data.files, data.requirements) : []),
    [data]
  );

  const nReady = athletes.filter((t) => !needsAttention(t)).length;
  const nAtt = athletes.filter(needsAttention).length;

  const rows = athletes.filter((t) => (tab === "all" ? true : tab === "att" ? needsAttention(t) : !needsAttention(t)));

  const athlete = openKey ? athletes.find((t) => t.key === openKey) ?? null : null;

  // Rail order: photos then video, each by score. The workspace opens on the
  // athlete's best file — the one most likely to be approved as-is.
  const railPhotos = useMemo(
    () => (athlete ? athlete.files.filter((f) => f.assetType !== "video").sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0)) : []),
    [athlete]
  );
  const railVideos = useMemo(
    () => (athlete ? athlete.files.filter((f) => f.assetType === "video").sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0)) : []),
    [athlete]
  );

  const file = athlete && fileId ? athlete.files.find((f) => f.id === fileId) ?? null : null;
  const flags = useMemo(() => (file ? flagsFor(file) : []), [file]);
  const isVideo = file?.assetType === "video";

  // No duration is stored, so there is nothing honest to scrub against. See
  // the header note — this is the single switch that turns the timeline on.
  const duration: number | null = null;

  // Opening a file restores whatever was queued against it last time. Without
  // this, re-opening a file that is already `needs_edit` would show an empty
  // panel, and saving again would silently wipe the instructions already there.
  const openFile = useCallback((f: FileRow) => {
    setFileId(f.id);
    setCrop(f.reviewedAtStage ?? null);
    const stored = f.reviewInstructions ?? [];
    setNotes(stored.filter((i) => i.source === "note").map((i) => ({ text: i.text, timecode: i.timecode })));
    const flagTexts = new Set(stored.filter((i) => i.source === "flag").map((i) => i.text));
    const derived = flagsFor(f);
    setPicked(new Set(derived.map((fl, i) => (flagTexts.has(fl.text) ? i : -1)).filter((i) => i >= 0)));
    setDraft("");
  }, []);

  const openAthlete = useCallback(
    (t: Athlete) => {
      setOpenKey(t.key);
      const best = t.files.slice().sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))[0];
      if (best) openFile(best);
    },
    [openFile]
  );

  const closeAthlete = () => {
    setOpenKey(null);
    setFileId(null);
    setReshootOpen(false);
  };

  // Re-resolve the open file against freshly loaded data so its status badge
  // and restored instructions reflect what was just written.
  useEffect(() => {
    if (!data || !fileId) return;
    const fresh = data.files.find((f) => f.id === fileId);
    if (fresh) openFile(fresh);
    // openFile is stable; re-running on every `data` change is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Actions ──

  const dirty = picked.size + notes.length > 0;

  const post = async (payload: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/submission-forms/${token}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await load();
      say(done);
      return true;
    } catch (e: any) {
      say(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const approve = () => {
    if (!file) return;
    post({ action: "approve", submissionId: file.id }, "Approved for brand");
  };

  const queueEdit = () => {
    if (!file) return;
    const instructions: Instruction[] = [
      ...flags.filter((_, i) => picked.has(i)).map((f) => ({ source: "flag" as const, text: f.text })),
      ...notes.map((n) => ({ source: "note" as const, text: n.text, ...(n.timecode != null ? { timecode: n.timecode } : {}) })),
    ];
    if (!instructions.length) return;
    post(
      { action: "queue-edit", submissionId: file.id, instructions, stage: crop },
      `Queued ${instructions.length} edit${instructions.length > 1 ? "s" : ""}`
    );
  };

  const requestReshoot = async () => {
    if (!athlete || !reshootNote.trim()) return;
    const ok = await post(
      { action: "reshoot", submissionIds: athlete.files.map((f) => f.id), note: reshootNote.trim() },
      `Reshoot requested from ${athlete.name}`
    );
    if (ok) {
      setReshootOpen(false);
      setReshootNote("");
    }
  };

  const addNote = () => {
    const v = draft.trim();
    if (!v) return;
    setNotes((n) => [...n, duration != null && isVideo ? { text: v, timecode: 0 } : { text: v }]);
    setDraft("");
  };

  // ── Render ──

  if (loading) return <Shell><div className="rvx-msg">Loading…</div></Shell>;
  if (error || !data) return <Shell><div className="rvx-msg bad">{error || "Not found"}</div></Shell>;

  const totalFiles = data.files.length;

  return (
    <Shell>
      <div className="top">
        {athlete ? (
          <button className="back" onClick={closeAthlete}>← All athletes</button>
        ) : (
          <Link className="back" href={`/dashboard/submission-forms/${token}`}>← Submission form</Link>
        )}
        {data.campaign.logoUrl && (
          <div className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.campaign.logoUrl} alt="" />
          </div>
        )}
        <div className="hdtxt">
          <div className="ttl">{athlete ? athlete.name : data.campaign.name}</div>
          <div className="sub">
            {athlete
              ? [athlete.school, `${athlete.photos} photo${athlete.photos === 1 ? "" : "s"}, ${athlete.videos} video${athlete.videos === 1 ? "" : "s"}`, data.campaign.name]
                  .filter(Boolean)
                  .join(" · ")
              : [data.campaign.clientName, `${athletes.length} athlete${athletes.length === 1 ? "" : "s"}`, `${totalFiles} file${totalFiles === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(" · ")}
          </div>
        </div>
      </div>

      {!athlete ? (
        /* ── Athlete list ── */
        <div className="page">
          <div className="tabs">
            <button className={tab === "ready" ? "on" : ""} onClick={() => setTab("ready")}>
              Ready for review <span className="n">{nReady}</span>
            </button>
            <button className={tab === "att" ? "on" : ""} onClick={() => setTab("att")}>
              Needs attention <span className="n">{nAtt}</span>
            </button>
            <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>
              All <span className="n">{athletes.length}</span>
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="empt">
              {athletes.length === 0
                ? "No submissions to review yet."
                : tab === "att"
                  ? "Nobody needs chasing — everyone has met the minimum."
                  : "Nothing ready yet. Every athlete is short of the minimum or scored low on brand visibility."}
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Athlete</th><th>Photos</th><th>Video</th><th>Quality</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.key} onClick={() => openAthlete(t)}>
                    <td>
                      <div className="who">{t.name}</div>
                      <div className="school">{t.school ?? ""}</div>
                    </td>
                    <td><span className={`chip ${t.photos >= data.requirements.minPhotos ? "ok" : "warn"}`}>{t.photos} of {data.requirements.minPhotos}</span></td>
                    <td><span className={`chip ${t.videos >= data.requirements.minVideos ? "ok" : "warn"}`}>{t.videos} of {data.requirements.minVideos}</span></td>
                    <td>
                      <div className="qwrap">
                        <span className="qnum" style={{ color: col(t.avg) }}>{t.avg == null ? "—" : t.avg.toFixed(0)}</span>
                        <span className="qbars">
                          {[t.lighting, t.subject, t.brandVisibility, t.hook].map((v, i) => (
                            <span className="qb" key={i}><i style={{ width: `${v ?? 0}%`, background: col(v) }} /></span>
                          ))}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}><button className="go">Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* ── Review workspace ── */
        <div className="work">
          <div className="rail">
            {railPhotos.length > 0 && <p className="railhd">Photos ({railPhotos.length})</p>}
            {railPhotos.map((f) => <Thumb key={f.id} f={f} on={f.id === fileId} onOpen={openFile} />)}
            {railVideos.length > 0 && <p className="railhd">Video ({railVideos.length})</p>}
            {railVideos.map((f) => <Thumb key={f.id} f={f} on={f.id === fileId} onOpen={openFile} />)}
          </div>

          <div className="stagewrap">
            <div className="stagebar">
              <div>
                <div className="fname">{file?.fileName ?? ""}</div>
                <div className="fmeta">
                  {file ? `${isVideo ? "Video" : "Photo"} · scored ${file.composite == null ? "—" : file.composite.toFixed(0)}` : ""}
                  {/* Hook reads as absent, not as a zero. */}
                  {isVideo && " · hook not scored on video"}
                  {file && STATUS_LABEL[file.status] && <span className={`st ${file.status}`}>{STATUS_LABEL[file.status]}</span>}
                </div>
              </div>
              <div className="crops">
                {["9:16", "4:5", "1:1", "16:9"].map((r) => (
                  <button key={r} className={crop === r ? "on" : ""} onClick={() => setCrop(crop === r ? null : r)}>{r}</button>
                ))}
                <button onClick={() => setCrop(null)}>None</button>
              </div>
            </div>

            <Stage file={file} crop={crop} isVideo={isVideo} />

            {isVideo && <Timeline duration={duration} notes={notes} />}
          </div>

          <div className="side">
            <div className="sidescroll">
              <div className="sec">
                <h3 className="sechd">Flagged at intake <span className="c">{flags.length ? `(${flags.length})` : ""}</span></h3>
                <p className="secnote">From the automatic scoring. Tick the ones you want the editor to act on.</p>
                {flags.length === 0 ? (
                  <p className="empty">Nothing flagged — this one scored clean.</p>
                ) : (
                  flags.map((s, i) => (
                    <div
                      key={`${s.text}-${i}`}
                      className={`item${picked.has(i) ? " on" : ""}`}
                      onClick={() => setPicked((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    >
                      <div className="box">✓</div>
                      <div className="itxt"><div className="i1">{s.text}</div><div className="i2">{s.why}</div></div>
                      <span className={`tag${s.high ? " hi" : ""}`}>{s.high ? "Needs work" : "Minor"}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="sec">
                <h3 className="sechd">Notes <span className="c">{notes.length ? `(${notes.length})` : ""}</span></h3>
                <p className="secnote">
                  {isVideo
                    ? "Playback isn't wired up yet, so notes aren't timecoded. Say which moment you mean."
                    : "Anything you want changed that wasn't flagged."}
                </p>
                {notes.length === 0 ? (
                  <p className="empty">No notes yet.</p>
                ) : (
                  notes.map((n, i) => (
                    <div className="item" key={i}>
                      {n.timecode != null && <span className="tc">{fmt(n.timecode)}</span>}
                      <div className="itxt"><div className="i1">{n.text}</div></div>
                      <button className="del" onClick={() => setNotes((v) => v.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))
                )}
                <div className="addrow">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }}
                    placeholder="Add a note…"
                    autoComplete="off"
                  />
                  <button onClick={addNote}>Add</button>
                </div>
              </div>
            </div>

            {/* The two top buttons SWAP so the sensible action is always on
                top: approving as-is stops being it the moment an edit is
                queued. Approve stays clickable while greyed — a reviewer who
                queues an edit and then changes their mind should not have to
                delete notes to approve. Request reshoot never moves: it is
                the destructive one, and a button that shifts under the cursor
                causes accidents. */}
            <div className="actions">
              <button
                className={`btn primary${dirty ? " muted" : ""}`}
                style={{ order: dirty ? 2 : 1 }}
                onClick={approve}
                disabled={busy || !file}
              >
                Approve for brand
              </button>
              <button
                className={`btn queue${dirty ? " live" : ""}`}
                style={{ order: dirty ? 1 : 2 }}
                onClick={queueEdit}
                disabled={busy || !file || !dirty}
              >
                {dirty ? `Send ${picked.size + notes.length} edit${picked.size + notes.length > 1 ? "s" : ""} to queue` : "Send to edit queue"}
              </button>
              <button className="btn danger" style={{ order: 3 }} onClick={() => setReshootOpen(true)} disabled={busy}>
                Request reshoot
              </button>
            </div>
          </div>
        </div>
      )}

      {reshootOpen && athlete && (
        <div className="scrim" onClick={() => setReshootOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Request a reshoot from {athlete.name}</h3>
            <p>
              This rejects all {athlete.files.length} of their file{athlete.files.length === 1 ? "" : "s"} — a reshoot is
              asked for per athlete, not per file. Tell them what to do differently.
            </p>
            <textarea
              value={reshootNote}
              onChange={(e) => setReshootNote(e.target.value)}
              rows={4}
              placeholder="e.g. the cup label is turned away in every shot — reshoot with it facing camera"
            />
            <div className="mrow">
              <button className="btn" onClick={() => setReshootOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn danger" onClick={requestReshoot} disabled={busy || !reshootNote.trim()}>
                Request reshoot
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </Shell>
  );
}

// ── Pieces ──

function Thumb({ f, on, onOpen }: { f: FileRow; on: boolean; onOpen: (f: FileRow) => void }) {
  return (
    <div className={`thumb${on ? " on" : ""}`} onClick={() => onOpen(f)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" referrerPolicy="no-referrer" src={f.thumbUrl ?? undefined} alt="" />
      <div className="tn">{f.fileName}</div>
      {STATUS_LABEL[f.status] && <span className={`dot ${f.status}`} title={STATUS_LABEL[f.status]} />}
      <div className="ts" style={{ color: col(f.composite) }}>{f.composite == null ? "—" : f.composite.toFixed(0)}</div>
    </div>
  );
}

// The crop overlay is measured off the rendered image, so it has to be redrawn
// whenever the image finishes loading or the stage resizes — the natural size
// is not known before either.
function Stage({ file, crop, isVideo }: { file: FileRow | null; crop: string | null; isVideo: boolean }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const draw = useCallback(() => {
    const st = stageRef.current, img = imgRef.current, box = boxRef.current;
    if (!st || !img || !box) return;
    if (!crop) { box.classList.remove("on"); return; }
    const [w0, h0] = crop.split(":").map(Number);
    const ratio = w0 / h0;
    const ib = img.getBoundingClientRect(), sb = st.getBoundingClientRect();
    if (!ib.width || !ib.height) return;
    let w = ib.width, h = w / ratio;
    if (h > ib.height) { h = ib.height; w = h * ratio; }
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    box.style.left = `${ib.left - sb.left + (ib.width - w) / 2}px`;
    box.style.top = `${ib.top - sb.top + (ib.height - h) / 2}px`;
    box.classList.add("on");
  }, [crop]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw, file?.id]);

  const src = bigImage(file?.thumbUrl ?? null) ?? file?.fileUrl ?? undefined;

  return (
    <div className="stage" ref={stageRef}>
      {file && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} referrerPolicy="no-referrer" src={src} alt={file.fileName} onLoad={draw} />
          {/* The poster frame, not playback. A signed Drive URL (or the file
              served from Storage) is what playing would need, and neither
              exists yet — so there is no play button to press. */}
          {isVideo && <div className="poster">Poster frame</div>}
          <div className="cropbox" ref={boxRef} />
        </>
      )}
    </div>
  );
}

// Drag-scrub: pointer capture so the drag survives leaving the track, and only
// the fill, the playhead and the clock are touched while dragging. Repainting
// the note markers every frame is what made an earlier version feel sticky.
//
// `duration` is null until a real one is stored, and the whole control is
// disabled in that state rather than invented.
function Timeline({ duration, notes }: { duration: number | null; notes: Note[] }) {
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const nowRef = useRef<HTMLSpanElement | null>(null);
  const posRef = useRef(0);

  const live = duration != null && duration > 0;

  useEffect(() => {
    const s = scrubRef.current;
    if (!s || !live) return;
    const d = duration as number;
    let drag = false;

    const at = (x: number) => {
      const b = s.getBoundingClientRect();
      return Math.max(0, Math.min(d, ((x - b.left) / b.width) * d));
    };
    // The hot path. Three style writes, no React, no marker rebuild.
    const quick = () => {
      const p = (posRef.current / d) * 100;
      if (fillRef.current) fillRef.current.style.width = `${p}%`;
      if (headRef.current) headRef.current.style.left = `${p}%`;
      if (nowRef.current) nowRef.current.textContent = fmt(posRef.current);
    };
    const down = (e: PointerEvent) => {
      drag = true;
      s.setPointerCapture(e.pointerId);
      posRef.current = at(e.clientX);
      quick();
    };
    const move = (e: PointerEvent) => { if (drag) { posRef.current = at(e.clientX); quick(); } };
    const stop = (e: PointerEvent) => {
      if (!drag) return;
      drag = false;
      try { s.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };

    s.addEventListener("pointerdown", down);
    s.addEventListener("pointermove", move);
    s.addEventListener("pointerup", stop);
    s.addEventListener("pointercancel", stop);
    return () => {
      s.removeEventListener("pointerdown", down);
      s.removeEventListener("pointermove", move);
      s.removeEventListener("pointerup", stop);
      s.removeEventListener("pointercancel", stop);
    };
  }, [live, duration]);

  return (
    <div className={`tl${live ? "" : " off"}`}>
      <div className="scrub" ref={scrubRef}>
        <div className="track" />
        <div className="fill" ref={fillRef} />
        <div className="head" ref={headRef} />
        {live && notes.map((n, i) => (
          n.timecode != null ? <div className="mk" key={i} style={{ left: `${(n.timecode / (duration as number)) * 100}%` }} title={`${fmt(n.timecode)} — ${n.text}`} /> : null
        ))}
      </div>
      <div className="times">
        <span ref={nowRef}>0:00.0</span>
        <span>{live ? fmt(duration as number) : "—:—"}</span>
      </div>
      {!live && (
        <p className="tlnote">
          Playback isn&apos;t wired up. No duration is stored for this file, so the timeline stays disabled rather than
          scrub against an invented length.
        </p>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rvx">
      <Styles />
      {children}
    </div>
  );
}

// ── Styles ──
// Ported from the approved design. Everything is namespaced under `.rvx`.

function Styles() {
  return (
    // dangerouslySetInnerHTML, not a text child: browsers parse <style> as raw
    // text and never decode entities, but React's SSR escapes text children, so
    // a quote ships as &quot; and the client render cannot reproduce it. React
    // recovers from that mismatch by re-rendering on the client, and handlers
    // can end up bound to the discarded tree — which is how the submit form's
    // uploads failed silently (#167). Here that would mean Approve, Send to
    // queue and Request reshoot appearing to work and doing nothing. This block
    // interpolates no values, so nothing needs escaping.
    <style dangerouslySetInnerHTML={{ __html: `
.rvx{--bg:#0B0B0F;--surface:#131319;--surface2:#1A1A22;
 --line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.16);
 --text:#F2F1EE;--muted:#9A9AA4;--faint:#6B6B75;
 --orange:#D73F09;--good:#4FB88A;--mid:#D99A2B;--bad:#CF5049;--red:#A31410;
 background:var(--bg);color:var(--text);min-height:100vh;
 font-family:Arimo,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
 font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
.rvx *{box-sizing:border-box}
.rvx button,.rvx input,.rvx textarea{font-family:inherit;font-size:inherit}
.rvx button{cursor:pointer}
.rvx-msg{padding:64px 24px;text-align:center;color:var(--muted);font-size:14px}
.rvx-msg.bad{color:var(--bad)}

/* shell */
.rvx .top{display:flex;align-items:center;gap:14px;padding:16px 24px;
 border-bottom:1px solid var(--line);background:var(--surface)}
.rvx .back{display:flex;align-items:center;gap:7px;color:var(--muted);text-decoration:none;
 font-size:14px;padding:7px 11px;border-radius:8px;background:transparent;border:0}
.rvx .back:hover{background:var(--surface2);color:var(--text)}
.rvx .mark{width:38px;height:38px;border-radius:9px;background:#fff;display:flex;
 align-items:center;justify-content:center;flex:none}
.rvx .mark img{width:26px;height:26px;object-fit:contain}
/* min-width:0 so the flex child may shrink: without it the campaign name and
   the school/counts line set a floor on the header's width, and on a narrow
   screen that alone pushes the page into a horizontal scroll. */
.rvx .hdtxt{min-width:0}
.rvx .ttl{font-size:18px;font-weight:700;letter-spacing:-.01em;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rvx .sub{font-size:13.5px;color:var(--muted);
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* list */
.rvx .page{padding:22px 24px 60px;max-width:1080px;margin:0 auto}
.rvx .tabs{display:flex;gap:4px;margin-bottom:18px}
.rvx .tabs button{background:transparent;border:1px solid transparent;color:var(--muted);
 padding:8px 14px;border-radius:9px;font-size:14px}
.rvx .tabs button:hover{color:var(--text)}
.rvx .tabs button.on{background:var(--surface2);border-color:var(--line);color:var(--text);font-weight:500}
.rvx .tabs .n{color:var(--faint);margin-left:6px;font-size:13px}
.rvx .empt{padding:48px 24px;text-align:center;color:var(--muted);font-size:14px;
 background:var(--surface);border:1px solid var(--line);border-radius:12px}
.rvx table{width:100%;border-collapse:collapse;background:var(--surface);
 border:1px solid var(--line);border-radius:12px;overflow:hidden}
.rvx th{text-align:left;font-size:13px;font-weight:500;color:var(--muted);
 padding:11px 16px;border-bottom:1px solid var(--line);background:var(--surface2)}
.rvx td{padding:13px 16px;border-bottom:1px solid var(--line);vertical-align:middle}
.rvx tr:last-child td{border-bottom:0}
.rvx tbody tr{cursor:pointer}
.rvx tbody tr:hover{background:var(--surface2)}
.rvx .who{font-weight:600;font-size:15px}
.rvx .school{font-size:13px;color:var(--muted)}
.rvx .chip{display:inline-block;font-size:13px;padding:3px 9px;border-radius:7px;
 border:1px solid var(--line2);color:var(--muted);white-space:nowrap}
.rvx .chip.ok{border-color:rgba(79,184,138,.4);color:var(--good)}
.rvx .chip.warn{border-color:rgba(207,80,73,.45);color:var(--bad)}
.rvx .qwrap{display:flex;align-items:center;gap:10px}
.rvx .qnum{font-size:17px;font-weight:700;width:26px}
.rvx .qbars{display:flex;gap:3px;width:96px}
.rvx .qb{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.11);overflow:hidden}
.rvx .qb i{display:block;height:100%;border-radius:3px}
.rvx .go{background:var(--surface2);border:1px solid var(--line2);color:var(--text);
 padding:7px 15px;border-radius:8px;font-size:14px;white-space:nowrap}
.rvx .go:hover{border-color:var(--orange);color:#F0A184}

/* workspace */
.rvx .work{display:grid;grid-template-columns:210px 1fr 340px;height:calc(100vh - 71px);min-height:560px}
.rvx .rail{border-right:1px solid var(--line);overflow-y:auto;padding:14px;background:var(--surface);min-height:0}
.rvx .railhd{font-size:13px;color:var(--muted);margin:0 0 9px;font-weight:500}
.rvx .railhd:not(:first-child){margin-top:18px}
.rvx .thumb{display:flex;gap:10px;padding:8px;border-radius:10px;border:1px solid transparent;
 margin-bottom:6px;cursor:pointer;align-items:center}
.rvx .thumb:hover{background:var(--surface2)}
.rvx .thumb.on{background:var(--surface2);border-color:var(--orange)}
.rvx .thumb img{width:42px;height:56px;object-fit:cover;border-radius:6px;background:#000;flex:none}
.rvx .thumb .tn{font-size:13px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.rvx .thumb .ts{font-size:13px;font-weight:700;margin-left:auto}
.rvx .dot{width:7px;height:7px;border-radius:50%;flex:none}
.rvx .dot.approved{background:var(--good)}
.rvx .dot.needs_edit{background:var(--orange)}
.rvx .dot.rejected{background:var(--bad)}

.rvx .stagewrap{display:flex;flex-direction:column;min-width:0;background:#0E0E13;
 /* min-height:0 matters: a grid item defaults to min-height:auto, which is its
    content size, so a tall photo pushes the column past its row and the whole
    page scrolls instead of the image fitting. This is what makes the stage's
    max-height:100% actually bind. */
 min-height:0}
.rvx .stagebar{display:flex;align-items:center;gap:10px;padding:11px 18px;border-bottom:1px solid var(--line)}
.rvx .fname{font-size:15px;font-weight:600;word-break:break-all}
.rvx .fmeta{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rvx .st{font-size:12px;padding:1px 7px;border-radius:6px;border:1px solid var(--line2)}
.rvx .st.approved{border-color:rgba(79,184,138,.45);color:var(--good)}
.rvx .st.needs_edit{border-color:rgba(215,63,9,.5);color:#F0A184}
.rvx .st.rejected{border-color:rgba(207,80,73,.45);color:var(--bad)}
.rvx .crops{display:flex;gap:5px;margin-left:auto}
.rvx .crops button{background:transparent;border:1px solid var(--line2);color:var(--muted);
 padding:5px 10px;border-radius:7px;font-size:13px}
.rvx .crops button:hover{color:var(--text)}
.rvx .crops button.on{background:rgba(215,63,9,.16);border-color:var(--orange);color:#F0A184}
.rvx .stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:20px;position:relative}
.rvx .stage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
.rvx .poster{position:absolute;top:28px;left:28px;font-size:12px;color:var(--muted);
 background:rgba(0,0,0,.6);border:1px solid var(--line2);border-radius:7px;padding:3px 9px}
.rvx .cropbox{position:absolute;border:1px solid rgba(255,255,255,.85);
 box-shadow:0 0 0 9999px rgba(11,11,15,.6);pointer-events:none;display:none}
.rvx .cropbox.on{display:block}

.rvx .tl{padding:12px 20px 16px;border-top:1px solid var(--line)}
.rvx .scrub{position:relative;height:22px;cursor:pointer;touch-action:none}
.rvx .tl.off .scrub{cursor:default;opacity:.45}
.rvx .track{position:absolute;top:9px;left:0;right:0;height:4px;border-radius:3px;background:rgba(255,255,255,.14)}
.rvx .fill{position:absolute;top:9px;left:0;height:4px;width:0;border-radius:3px;background:var(--orange)}
.rvx .head{position:absolute;top:4px;left:0;width:3px;height:14px;border-radius:2px;background:#fff;transform:translateX(-1px)}
.rvx .tl.off .head{background:rgba(255,255,255,.4)}
.rvx .mk{position:absolute;top:3px;width:13px;height:13px;border-radius:50%;background:var(--orange);
 border:2px solid #0E0E13;transform:translateX(-6.5px);z-index:2}
.rvx .times{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-top:2px;
 font-variant-numeric:tabular-nums}
.rvx .tlnote{font-size:12.5px;color:var(--faint);margin:8px 0 0;line-height:1.45}

/* right column */
.rvx .side{border-left:1px solid var(--line);display:flex;flex-direction:column;background:var(--surface);min-height:0}
.rvx .sidescroll{flex:1;min-height:0;overflow-y:auto;padding:16px}
.rvx .sechd{font-size:14px;font-weight:600;margin:0 0 4px}
.rvx .sechd .c{color:var(--faint);font-weight:400}
.rvx .secnote{font-size:13px;color:var(--muted);margin:0 0 10px}
.rvx .sec{margin-bottom:22px}
.rvx .item{display:flex;gap:10px;padding:10px 11px;border:1px solid var(--line);
 border-radius:10px;margin-bottom:7px;cursor:pointer;align-items:flex-start}
.rvx .item:hover{border-color:var(--line2)}
.rvx .item.on{border-color:var(--orange);background:rgba(215,63,9,.08)}
.rvx .box{width:16px;height:16px;border-radius:5px;border:1px solid var(--line2);flex:none;
 margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:11px;color:transparent}
.rvx .item.on .box{background:var(--orange);border-color:var(--orange);color:#fff}
.rvx .itxt{flex:1;min-width:0}
.rvx .i1{font-size:14px;line-height:1.4;overflow-wrap:anywhere}
.rvx .i2{font-size:13px;color:var(--muted);margin-top:2px}
.rvx .tag{font-size:12px;padding:2px 7px;border-radius:6px;border:1px solid var(--line2);
 color:var(--muted);flex:none;height:fit-content}
.rvx .tag.hi{border-color:rgba(207,80,73,.45);color:var(--bad)}
.rvx .tc{font-size:13px;color:var(--orange);flex:none;width:44px;font-variant-numeric:tabular-nums}
.rvx .del{background:none;border:0;color:var(--faint);font-size:17px;line-height:1;flex:none;padding:0 2px}
.rvx .del:hover{color:var(--bad)}
.rvx .empty{font-size:13.5px;color:var(--muted);padding:2px 0 6px}
.rvx .addrow{display:flex;gap:6px}
.rvx .addrow input{flex:1;min-width:0;background:var(--surface2);border:1px solid var(--line);
 color:var(--text);border-radius:8px;padding:9px 11px;outline:none;font-size:14px}
.rvx .addrow input:focus{border-color:var(--orange)}
.rvx .addrow input::placeholder{color:var(--faint)}
.rvx .addrow button{background:var(--surface2);border:1px solid var(--line2);color:var(--muted);
 border-radius:8px;padding:0 13px}
.rvx .addrow button:hover{border-color:var(--orange);color:#F0A184}

.rvx .actions{border-top:1px solid var(--line);padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.rvx .btn{width:100%;padding:12px;border-radius:9px;font-size:14.5px;font-weight:500;
 border:1px solid var(--line2);background:transparent;color:var(--text)}
.rvx .btn:hover{border-color:var(--text)}
.rvx .btn:disabled{opacity:.45;cursor:not-allowed}
.rvx .btn.primary{background:var(--good);border-color:var(--good);color:#06231A;font-weight:600}
.rvx .btn.primary:hover{filter:brightness(1.07)}
/* Greyed, but NOT disabled — see the comment on the buttons. */
.rvx .btn.primary.muted{background:var(--surface2);border-color:var(--line2);color:var(--muted);font-weight:500}
.rvx .btn.primary.muted:hover{border-color:var(--good);color:var(--good)}
.rvx .btn.queue.live{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600}
.rvx .btn.queue.live:disabled{opacity:1}
.rvx .btn.danger{background:var(--red);border-color:var(--red);color:#fff;font-weight:600}
.rvx .btn.danger:hover{filter:brightness(1.15)}

/* reshoot confirm */
.rvx .scrim{position:fixed;inset:0;background:rgba(6,6,9,.72);display:flex;align-items:center;
 justify-content:center;padding:20px;z-index:60}
.rvx .modal{background:var(--surface);border:1px solid var(--line2);border-radius:14px;
 padding:20px;width:100%;max-width:460px}
.rvx .modal h3{margin:0 0 8px;font-size:16px}
.rvx .modal p{margin:0 0 12px;font-size:13.5px;color:var(--muted);line-height:1.5}
.rvx .modal textarea{width:100%;background:var(--surface2);border:1px solid var(--line);
 color:var(--text);border-radius:9px;padding:10px 12px;outline:none;font-size:14px;resize:vertical}
.rvx .modal textarea:focus{border-color:var(--orange)}
.rvx .mrow{display:flex;gap:8px;margin-top:14px}

.rvx .toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:70;
 background:var(--surface2);border:1px solid var(--line2);color:var(--text);
 padding:10px 16px;border-radius:10px;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.45)}

@media(max-width:1100px){
 .rvx .work{grid-template-columns:170px 1fr 300px}
}
@media(max-width:860px){
 /* minmax(0,1fr), not 1fr: a bare 1fr floors at the column's min-content
    width, and the crop-preset bar's five buttons make that ~263px — wider
    than a phone's content area once the dashboard sidebar has taken its
    share, which pushes the whole page into a horizontal scroll. */
 .rvx .work{grid-template-columns:minmax(0,1fr);height:auto;min-height:0}
 /* The preset bar wraps under the filename instead of forcing the column
    wide; it is a row of small targets, so wrapping costs nothing. */
 .rvx .stagebar{flex-wrap:wrap}
 .rvx .crops{margin-left:0;flex-wrap:wrap}
 .rvx .rail{border-right:0;border-bottom:1px solid var(--line);display:flex;gap:8px;overflow-x:auto}
 .rvx .railhd{display:none}
 .rvx .thumb{flex-direction:column;width:78px;flex:none}
 .rvx .thumb .tn{flex:none;width:100%;text-align:center}
 .rvx .thumb .ts{margin-left:0}
 .rvx .side{border-left:0;border-top:1px solid var(--line)}
 .rvx .stage{min-height:52vh}
 /* The sheet overlays the photo rather than squeezing it, and the actions
    stay on screen: on a phone the reviewer scrolls the panel, not the page. */
 .rvx .sidescroll{max-height:46vh}
 .rvx .actions{position:sticky;bottom:0;background:var(--surface)}
}
@media(max-width:560px){
 .rvx .page{padding:16px 12px 40px}
 .rvx thead{display:none}
 .rvx table{border:0;background:transparent}
 .rvx tbody tr{display:grid;grid-template-columns:1fr auto;gap:6px 10px;background:var(--surface);
  border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px}
 .rvx td{border:0;padding:0}
 .rvx td:nth-child(1){grid-column:1/-1}
 .rvx td:nth-child(4){grid-column:1/2}
 .rvx td:nth-child(5){grid-column:2/3;text-align:right!important}
 .rvx .top{padding:12px 14px;gap:10px}
}
` }} />
  );
}
