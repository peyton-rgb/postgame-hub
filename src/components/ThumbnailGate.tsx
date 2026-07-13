"use client";

// Thumbnail gate — blocks "Preview Recap" when any selected video card is missing
// a thumbnail. One row per blocking card; clicking a row expands a two-tab fix
// panel (Timeline scrub | Upload image). Resolving a row greys it out and
// auto-advances to the next unresolved row. The gate is absolute: "Open preview"
// stays locked until every row is done — there is no skip. Behavior matches
// reference-thumbnail-gate.html; markup is the app's own Tailwind styling.

import { useCallback, useRef, useState } from "react";
import { VideoFrameScrubber } from "./VideoFrameScrubber";

export type BlockingCard = {
  key: string; // stable row key
  mediaId: string; // media row to UPDATE
  bucketKey: string; // media[] key (athlete id, or collab group id)
  kind: "solo" | "collab";
  fileUrl: string; // video source for the scrubber
  label: string; // athlete name, or team name for collabs
  cardType: string; // which card ("Cover photo" | "Collab post")
  ext?: string; // file extension hint (e.g. "mov")
};

export function ThumbnailGate({
  cards,
  onResolve,
  onOpenPreview,
  onCancel,
}: {
  cards: BlockingCard[];
  onResolve: (card: BlockingCard, file: File) => Promise<string | null>; // returns saved thumb url
  onOpenPreview: () => void;
  onCancel: () => void;
}) {
  // Snapshot the list once so resolved rows grey out in place instead of vanishing
  // as the parent's blocking-card memo shrinks.
  const [rows] = useState(() => cards);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [undecodable, setUndecodable] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Record<string, "tl" | "up">>({});
  const [openId, setOpenId] = useState<string | null>(rows[0]?.key ?? null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const total = rows.length;
  const doneCount = rows.filter((r) => done[r.key]).length;
  const remaining = total - doneCount;
  const allDone = total > 0 && doneCount === total;

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const activeTab = (c: BlockingCard): "tl" | "up" =>
    undecodable[c.key] ? "up" : tab[c.key] || "tl";

  async function doResolve(card: BlockingCard, file: File, how: "frame" | "upload") {
    if (busy) return;
    setBusy(true);
    const url = await onResolve(card, file);
    setBusy(false);
    if (!url) { showToast("Upload failed — try again"); return; }
    const nextDone = { ...done, [card.key]: true };
    setDone(nextDone);
    setThumbs((prev) => ({ ...prev, [card.key]: url }));
    showToast(how === "upload" ? "Cover uploaded ✓" : "Frame captured ✓");
    const next = rows.find((r) => !nextDone[r.key]);
    setOpenId(next ? next.key : null);
  }

  function markUndecodable(key: string) {
    setUndecodable((u) => (u[key] ? u : { ...u, [key]: true }));
    setTab((t) => ({ ...t, [key]: "up" }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Thumbnail gate"
        className="w-full max-w-[680px] max-h-[88vh] flex flex-col bg-[#0b0b0f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em]">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: allDone ? "#57D98A" : "#D73F09",
                boxShadow: `0 0 12px ${allDone ? "#57D98A" : "#D73F09"}`,
              }}
            />
            <span style={{ color: allDone ? "#57D98A" : "#D73F09" }}>
              {allDone ? "Preview ready" : "Preview locked"}
            </span>
          </div>
          {allDone ? (
            <h2 className="text-2xl font-black mt-2 mb-1">
              All set — <span style={{ color: "#57D98A" }}>preview unlocked</span>
            </h2>
          ) : (
            <h2 className="text-2xl font-black mt-2 mb-1">
              <span style={{ color: "#D73F09" }}>{remaining}</span>{" "}
              {remaining === 1 ? "video needs" : "videos need"} a thumbnail before preview
            </h2>
          )}
          <p className="text-[13px] text-white/50 m-0">
            {allDone
              ? "Every card has a cover. You can open the recap preview."
              : "Every selected video card needs a cover frame. Fix each one below — scrub for a frame or upload your own."}
          </p>
        </div>

        {/* List */}
        <div className="p-3 overflow-auto">
          {rows.map((c) => {
            const isDone = !!done[c.key];
            const isOpen = openId === c.key && !isDone;
            const t = activeTab(c);
            const movBlocked = !!undecodable[c.key];
            return (
              <div
                key={c.key}
                className={`border border-white/10 rounded-2xl my-2 overflow-hidden transition-opacity ${
                  isOpen ? "bg-white/[0.06]" : "bg-white/[0.03]"
                } ${isDone ? "opacity-50" : ""}`}
              >
                {/* Row head */}
                <div
                  className={`flex items-center gap-3.5 p-3 ${isDone ? "cursor-default" : "cursor-pointer"}`}
                  onClick={() => { if (!isDone) setOpenId(isOpen ? null : c.key); }}
                >
                  <div
                    className="w-16 h-11 rounded-lg flex-none relative overflow-hidden border border-white/10 flex items-center justify-center bg-cover bg-center"
                    style={
                      thumbs[c.key]
                        ? { backgroundImage: `url('${thumbs[c.key]}')` }
                        : {
                            backgroundImage:
                              "repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 8px,rgba(255,255,255,.02) 8px 16px)",
                          }
                    }
                  >
                    {!thumbs[c.key] && (
                      <span
                        className="ml-0.5"
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: "9px solid rgba(250,248,245,.5)",
                          borderTop: "6px solid transparent",
                          borderBottom: "6px solid transparent",
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-black leading-none truncate">{c.label}</div>
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-white/40 mt-1.5">
                      {c.cardType}
                      {c.kind === "collab" ? " · Collab" : ""}
                      {movBlocked || c.ext === "mov" || c.ext === "qt"
                        ? ` · ${(c.ext || "mov").toUpperCase()}`
                        : ""}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-mono uppercase tracking-[0.12em] px-2.5 py-1.5 rounded-full whitespace-nowrap flex-none border"
                    style={
                      isDone
                        ? { color: "#57D98A", background: "rgba(87,217,138,.12)", borderColor: "rgba(87,217,138,.3)" }
                        : { color: "#D73F09", background: "rgba(215,63,9,.14)", borderColor: "rgba(215,63,9,.32)" }
                    }
                  >
                    {isDone ? "Done ✓" : "Needs thumbnail"}
                  </span>
                  {!isDone && (
                    <span
                      className="flex-none text-white/40 text-sm transition-transform"
                      style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                    >
                      ›
                    </span>
                  )}
                </div>

                {/* Fix panel */}
                {isOpen && (
                  <div className="px-3.5 pb-4 pt-1">
                    <div className="inline-flex p-0.5 gap-0.5 bg-black/30 border border-white/10 rounded-xl mb-3.5">
                      <button
                        disabled={movBlocked}
                        onClick={() => setTab((s) => ({ ...s, [c.key]: "tl" }))}
                        className={`text-[11px] font-mono uppercase tracking-[0.12em] px-4 py-2 rounded-lg ${
                          t === "tl" ? "bg-white/10 text-white" : "text-white/50"
                        } disabled:text-white/25 disabled:cursor-not-allowed`}
                      >
                        Timeline
                      </button>
                      <button
                        onClick={() => setTab((s) => ({ ...s, [c.key]: "up" }))}
                        className={`text-[11px] font-mono uppercase tracking-[0.12em] px-4 py-2 rounded-lg ${
                          t === "up" ? "bg-white/10 text-white" : "text-white/50"
                        }`}
                      >
                        Upload
                      </button>
                    </div>

                    {movBlocked && (
                      <div className="flex gap-2 items-start mb-3 px-3 py-2.5 rounded-xl text-xs leading-relaxed"
                        style={{ background: "rgba(215,63,9,.1)", border: "1px solid rgba(215,63,9,.28)", color: "rgba(250,248,245,.82)" }}
                      >
                        <span>⚠</span>
                        <div>
                          <b style={{ color: "#D73F09" }}>This video can&apos;t preview in the browser.</b>{" "}
                          The timeline is disabled for it — upload a cover image instead.
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {t === "tl" && !movBlocked && (
                      <VideoFrameScrubber
                        videoUrl={c.fileUrl}
                        onUndecodable={() => markUndecodable(c.key)}
                        actionLabel="Use this frame"
                        onAction={(f) => doResolve(c, f, "frame")}
                        busy={busy}
                      />
                    )}

                    {/* Upload */}
                    {t === "up" && (
                      <div
                        onClick={() => uploadRefs.current[c.key]?.click()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const f = e.dataTransfer?.files?.[0];
                          if (f) doResolve(c, f, "upload");
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        className="h-[200px] rounded-xl border-[1.5px] border-dashed border-white/20 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer hover:border-[#D73F09]/60 hover:bg-[#D73F09]/5 transition-colors"
                      >
                        <div className="text-xl font-black">{busy ? "Uploading…" : "Drop an image"}</div>
                        <div className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-white/40">
                          or click to browse · jpg / png
                        </div>
                        <input
                          ref={(el) => { uploadRefs.current[c.key] = el; }}
                          type="file"
                          accept="image/*,.heic,.heif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) doResolve(c, f, "upload");
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer / gate */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-white/10 bg-black/20 mt-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/50">
            <b className="text-white">{doneCount}</b> of <b className="text-white">{total}</b> resolved
          </div>
          <button
            onClick={() => { if (allDone) onOpenPreview(); else showToast("Still locked — resolve every card first"); }}
            disabled={!allDone}
            className={`flex items-center gap-2 text-[13px] font-mono uppercase tracking-[0.1em] font-semibold rounded-xl px-5 py-3 transition ${
              allDone
                ? "bg-[#D73F09] text-white cursor-pointer hover:brightness-110"
                : "bg-white/[0.08] text-white/40 cursor-not-allowed"
            }`}
          >
            <span>{allDone ? "▶" : "🔒"}</span>
            <span>Open preview</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-7 bg-[#14141a]/90 border border-white/10 backdrop-blur px-4 py-3 rounded-xl font-mono text-xs tracking-[0.08em] text-white z-[60]">
          {toast}
        </div>
      )}
    </div>
  );
}
