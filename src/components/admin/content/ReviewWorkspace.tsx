"use client";

// ============================================================
// Review file workspace — batch-2 screens 1c (photo) and 1d (video).
//
// Three columns like the prototype: the athlete's files (rail), the
// file large (stage), and the decision panel. Stacks on mobile.
//
// The decisions are the review hub's three real actions, sent to the
// existing staff API POST /api/submission-forms/[token]/review:
//   approve     → tier3 status 'approved' (withdraws open edit jobs)
//   queue-edit  → 'needs_edit' + an edit_jobs row (the AI edit queue)
//   reshoot     → 'rejected' with a note to the athlete
// Nothing here writes to the database directly.
//
// What is NOT wired yet (shown honestly, disabled): marking a region
// on the photo, before/after compare of AI versions, size variants,
// and "Send folder to brand" — those belong to the desktop/LucidLink
// pipeline that hasn't shipped. The full AI editor stays one click
// away (the existing per-file editor).
// ============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bigImage, flagsFor } from "@/components/submission-forms/reviewHubLogic";
import { TO_REVIEW, fileStateLabel, type FileRow, type ReviewWorkspaceData } from "@/lib/admin/content/types";

/* eslint-disable @next/next/no-img-element */

function drivePreview(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^/?#]+)/) ?? url.match(/[?&]id=([^&#]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

const TONE_DOT: Record<string, string> = {
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  bad: "bg-status-bad",
  muted: "bg-stone-300",
};

function Score({ label, v }: { label: string; v: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-stone-500">{label}</span>
      <b className={v == null ? "text-stone-400" : v >= 70 ? "text-status-ok" : v >= 50 ? "text-status-warn" : "text-status-bad"}>
        {v == null ? "—" : Math.round(v)}
      </b>
    </span>
  );
}

export default function ReviewWorkspace({ data, base }: { data: ReviewWorkspaceData; base: string }) {
  const router = useRouter();
  const { file, siblings, token } = data;
  const flags = useMemo(() => flagsFor(file), [file]);
  const [picked, setPicked] = useState<boolean[]>(() => flags.map((f) => f.high));
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [reshootOpen, setReshootOpen] = useState(false);
  const [reshootNote, setReshootNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const idx = siblings.findIndex((f) => f.id === file.id);
  const approvedCount = siblings.filter((f) => f.status === "approved").length;
  const pct = siblings.length ? Math.round((approvedCount / siblings.length) * 100) : 0;
  const nextFile: FileRow | undefined =
    siblings.slice(idx + 1).find((f) => TO_REVIEW.has(f.status)) ??
    siblings.find((f) => f.id !== file.id && TO_REVIEW.has(f.status)) ??
    siblings[idx + 1];
  const isVideo = file.assetType === "video";
  const state = fileStateLabel(file.status);
  const toReview = TO_REVIEW.has(file.status);
  const instructions = [
    ...flags.filter((_, i) => picked[i]).map((f) => ({ source: "flag" as const, text: f.text })),
    ...notes.map((n) => ({ source: "note" as const, text: n })),
  ];

  async function send(body: Record<string, unknown>, done: string, goNext: boolean) {
    if (!token) {
      setMsg({ tone: "bad", text: "This campaign has no submission form link, so there is nowhere to save the review." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/submission-forms/${token}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't save the review.");
      setMsg({ tone: "ok", text: done });
      if (goNext && nextFile && nextFile.id !== file.id) router.push(`${base}/${nextFile.id}`);
      else router.refresh();
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Couldn't save the review." });
    } finally {
      setBusy(false);
    }
  }

  const preview = drivePreview(file.fileUrl);
  const image = bigImage(file.thumbUrl);

  return (
    <div className="-mx-4 -my-5 md:-mx-7 md:-my-6">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
        <Link
          href={base}
          aria-label="Back to the campaign"
          className="grid h-8 w-8 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[12px] text-stone-500">
            {data.campaignName} · {file.fileName} · {idx + 1} of {siblings.length}
          </div>
          <h1 className="truncate text-[18px] font-semibold text-stone-900">{data.athleteName}</h1>
        </div>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] text-stone-600">
          <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-stone-100">
            <i className="block h-full rounded-full bg-status-ok" style={{ width: `${pct}%` }} />
          </span>
          {approvedCount} of {siblings.length} approved
        </span>
        <button
          type="button"
          disabled
          title="Arrives with the LucidLink → Drive hand-off; not wired yet"
          className="cursor-not-allowed rounded-md bg-[#D73F09]/40 px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Send folder to brand
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-[170px_minmax(0,1fr)_340px]">
        {/* rail */}
        <aside className="flex gap-2 overflow-x-auto border-b border-stone-200 bg-white p-3 lg:block lg:space-y-2 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="hidden px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-stone-500 lg:block">Files</div>
          {siblings.map((f) => {
            const s = fileStateLabel(f.status);
            const cur = f.id === file.id;
            return (
              <Link
                key={f.id}
                href={`${base}/${f.id}`}
                aria-current={cur ? "page" : undefined}
                className={
                  "block w-[120px] shrink-0 rounded-lg border p-1.5 lg:w-auto " +
                  (cur ? "border-[#D73F09] bg-[#D73F09]/5" : "border-stone-200 hover:border-stone-300")
                }
              >
                <span className="relative block aspect-[4/5] overflow-hidden rounded-md bg-stone-800">
                  {f.thumbUrl && <img src={f.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  {f.assetType === "video" && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">Video</span>
                  )}
                </span>
                <span className="mt-1 block truncate text-[11px] text-stone-700">{f.fileName}</span>
                <span className="flex items-center gap-1 text-[11px] text-stone-500">
                  <i className={"inline-block h-1.5 w-1.5 rounded-full " + TONE_DOT[s.tone]} />
                  {s.label}
                </span>
              </Link>
            );
          })}
        </aside>

        {/* stage */}
        <section className="min-w-0 bg-[#16181D] p-3 md:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-white/80">
            <span className="font-medium text-white">{file.fileName}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5">{isVideo ? "Video" : "Photo"}</span>
            <span className="flex-1" />
            {file.fileUrl && (
              <a href={file.fileUrl} target="_blank" rel="noreferrer" className="rounded-md border border-white/20 px-2.5 py-1 hover:bg-white/10">
                Open in Drive
              </a>
            )}
            {nextFile && nextFile.id !== file.id && (
              <Link href={`${base}/${nextFile.id}`} className="rounded-md border border-white/20 px-2.5 py-1 hover:bg-white/10">
                Skip ›
              </Link>
            )}
          </div>
          <div className="grid min-h-[320px] place-items-center rounded-lg bg-black/40">
            {isVideo && preview ? (
              <iframe
                src={preview}
                title={file.fileName}
                allow="autoplay; fullscreen"
                className="aspect-[9/16] h-[min(70vh,640px)] max-w-full rounded-md border-0"
              />
            ) : image ? (
              <img src={image} alt={file.fileName} className="max-h-[70vh] max-w-full rounded-md object-contain" />
            ) : preview ? (
              <iframe src={preview} title={file.fileName} className="h-[60vh] w-full rounded-md border-0" />
            ) : (
              <span className="text-[13px] text-white/60">No preview for this file.</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/70 [&_b]:text-white">
            <Score label="Overall" v={file.composite} />
            <Score label="Composition" v={file.composition} />
            <Score label="Lighting" v={file.lighting} />
            <Score label="Subject" v={file.subject} />
            <Score label="Brand" v={file.brandVisibility} />
            {!isVideo && <Score label="Hook" v={file.hook} />}
          </div>
        </section>

        {/* panel */}
        <aside className="border-t border-stone-200 bg-white p-4 lg:border-l lg:border-t-0">
          <div className="space-y-3">
            {msg && (
              <div
                className={
                  "rounded-md px-3 py-2 text-[12px] " +
                  (msg.tone === "ok" ? "bg-status-ok/10 text-status-ok" : "bg-status-bad/10 text-status-bad")
                }
              >
                {msg.text}
              </div>
            )}

            {toReview && (
              <>
                <h3 className="text-[15px] font-semibold text-stone-900">What do you want to do with this file?</h3>
                {flags.length > 0 ? (
                  <div className="rounded-lg border border-stone-200 p-3">
                    <div className="mb-2 text-[13px] font-medium text-stone-900">
                      AI found {flags.length} thing{flags.length === 1 ? "" : "s"} to fix
                    </div>
                    <div className="space-y-2">
                      {flags.map((f, i) => (
                        <label key={f.text} className="flex items-start gap-2 text-[13px] text-stone-700">
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-[#D73F09]"
                            checked={picked[i] ?? false}
                            onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))}
                          />
                          <span>
                            {f.text}
                            <span className="block text-[11px] text-stone-500">{f.why}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-stone-500">The scorer didn&apos;t flag anything on this file.</p>
                )}

                <div>
                  <div className="mb-1 text-[12px] font-medium text-stone-700">Or write what to change</div>
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && draft.trim()) {
                          e.preventDefault();
                          setNotes((n) => [...n, draft.trim()]);
                          setDraft("");
                        }
                      }}
                      placeholder={isVideo ? "e.g. trim the intro" : "e.g. remove the logo"}
                      className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px]"
                    />
                    <button
                      type="button"
                      disabled={!draft.trim()}
                      onClick={() => {
                        setNotes((n) => [...n, draft.trim()]);
                        setDraft("");
                      }}
                      className="rounded-md border border-stone-300 px-3 text-[12px] font-medium text-stone-700 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                  {notes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {notes.map((n, i) => (
                        <li key={i} className="flex items-center gap-2 rounded-md bg-stone-50 px-2 py-1 text-[12px] text-stone-700">
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#D73F09] text-[10px] text-white">{i + 1}</span>
                          <span className="flex-1">{n}</span>
                          <button type="button" aria-label="Remove note" onClick={() => setNotes((x) => x.filter((_, j) => j !== i))} className="text-stone-400 hover:text-stone-700">
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  disabled={busy || instructions.length === 0}
                  onClick={() =>
                    send(
                      { action: "queue-edit", submissionId: file.id, instructions },
                      `Queued ${instructions.length} edit${instructions.length === 1 ? "" : "s"}`,
                      true
                    )
                  }
                  className="w-full rounded-md bg-[#D73F09] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
                >
                  {instructions.length ? `Queue edit · ${instructions.length}` : "Queue edit"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send({ action: "approve", submissionId: file.id }, "Approved for the brand", true)}
                  className="w-full rounded-md border border-status-ok px-3 py-2 text-[13px] font-medium text-status-ok hover:bg-status-ok/5 disabled:opacity-40"
                >
                  Approve as-is for brand
                </button>
                <div className="text-[11px] text-stone-500">
                  Queue edit sends the ticked fixes to the AI edit queue. Nothing goes to the brand until the folder is sent.
                </div>
              </>
            )}

            {file.status === "needs_edit" && (
              <>
                <h3 className="text-[15px] font-semibold text-stone-900">In the edit queue</h3>
                {file.reviewInstructions?.length ? (
                  <ul className="space-y-1 text-[13px] text-stone-700">
                    {file.reviewInstructions.map((i, n) => (
                      <li key={n} className="flex gap-2">
                        <span className="text-stone-400">{n + 1}.</span>
                        {i.text}
                        <span className="ml-auto text-[10px] uppercase text-stone-400">{i.source === "flag" ? "AI" : "Staff"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-stone-500">No instructions were saved with this edit.</p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send({ action: "approve", submissionId: file.id }, "Edit called off — approved as-is", true)}
                  className="w-full rounded-md border border-status-ok px-3 py-2 text-[13px] font-medium text-status-ok disabled:opacity-40"
                >
                  Approve as-is (cancel the edit)
                </button>
              </>
            )}

            {file.status === "approved" && (
              <>
                <h3 className="text-[15px] font-semibold text-stone-900">Approved for the brand</h3>
                <p className="text-[13px] text-stone-600">
                  This file goes to the brand when the folder is sent. Nothing else to do here.
                </p>
                {nextFile && nextFile.id !== file.id && (
                  <Link href={`${base}/${nextFile.id}`} className="block w-full rounded-md border border-stone-300 px-3 py-2 text-center text-[13px] font-medium text-stone-700">
                    Next file ›
                  </Link>
                )}
              </>
            )}

            {file.status === "rejected" && (
              <>
                <h3 className="text-[15px] font-semibold text-stone-900">Sent back to the athlete</h3>
                <p className="text-[13px] text-stone-600">{file.reviewNotes || "No note was saved."}</p>
              </>
            )}

            {!toReview && !["needs_edit", "approved", "rejected"].includes(file.status) && (
              <p className="text-[13px] text-stone-600">Status: {state.label}</p>
            )}

            {/* reshoot */}
            {file.status !== "rejected" && (
              <details className="rounded-lg border border-stone-200" open={reshootOpen} onToggle={(e) => setReshootOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-stone-800">Ask the athlete for a reshoot</summary>
                <div className="space-y-2 px-3 pb-3">
                  <textarea
                    value={reshootNote}
                    onChange={(e) => setReshootNote(e.target.value)}
                    rows={3}
                    placeholder="What should they reshoot, and why?"
                    className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px]"
                  />
                  <button
                    type="button"
                    disabled={busy || !reshootNote.trim()}
                    onClick={() =>
                      send({ action: "reshoot", submissionIds: [file.id], note: reshootNote.trim() }, "Sent back to the athlete", true)
                    }
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-[12px] font-medium text-stone-700 disabled:opacity-40"
                  >
                    Send back to athlete
                  </button>
                </div>
              </details>
            )}

            {/* AI suggestions */}
            {data.suggestions.length > 0 && (
              <details className="rounded-lg border border-stone-200">
                <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-stone-800">
                  AI suggestions <span className="font-normal text-stone-500">· {data.suggestions.length}</span>
                </summary>
                <div className="space-y-2 px-3 pb-3 text-[12px] text-stone-700">
                  {data.suggestions.map((s) => (
                    <div key={s.id}>
                      <div className="font-medium">{s.summary ?? s.kind ?? "Suggestion"}</div>
                      {s.detail && <div className="text-stone-500">{s.detail}</div>}
                      {s.status && <div className="text-[11px] text-stone-400">{s.status}</div>}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* more */}
            <details className="rounded-lg border border-stone-200">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-stone-800">
                More <span className="font-normal text-stone-500">· versions, editor, details</span>
              </summary>
              <div className="space-y-2 px-3 pb-3 text-[12px] text-stone-600">
                <div>
                  <b className="text-stone-800">Versions</b> · V0 original
                  {data.versions.map((v, i) => (
                    <span key={v.id}>
                      {" · "}
                      {v.outputUrl ? (
                        <a href={v.outputUrl} target="_blank" rel="noreferrer" className="text-[#D73F09] hover:underline">
                          V{i + 1}
                        </a>
                      ) : (
                        `V${i + 1}`
                      )}{" "}
                      ({v.status})
                    </span>
                  ))}
                </div>
                {token && (
                  <div>
                    <b className="text-stone-800">AI editor</b> ·{" "}
                    <Link href={`/dashboard/submission-forms/${token}/review/${file.id}`} className="text-[#D73F09] hover:underline">
                      Open the full per-file editor
                    </Link>
                  </div>
                )}
                {file.tags.length > 0 && (
                  <div>
                    <b className="text-stone-800">Tags</b> · {file.tags.join(", ").replace(/_/g, " ")}
                  </div>
                )}
                <div>
                  <b className="text-stone-800">Not wired yet</b> · marking a spot on the photo, before/after compare, and
                  9:16 · 4:5 · 1:1 · 16:9 size copies arrive with the LucidLink edit pipeline.
                </div>
              </div>
            </details>
          </div>
        </aside>
      </div>
    </div>
  );
}
