"use client";

// ============================================================
// SubmissionPreview — live preview of the submission form:
//   phone    Athlete app screen (IPhoneFrame)
//   mweb     Athlete mobile web screen (IPhoneFrame with Safari header)
//   desktop  Desktop web landing page (BrowserFrame)
//
// Matches prototype helpers subAthleteScreen and subDesktopScreen.
// Client-safe: no server imports.
// ============================================================

import { IPhoneFrame, BrowserFrame } from "@/components/admin/campaign/OptinPreview";
import type { Deliverable, SubmissionPreviewView } from "@/lib/admin/submissions/types";

interface SubmissionPreviewProps {
  view: SubmissionPreviewView;
  headline: string;
  intro: string;
  items: Deliverable[];
  confirmations: string[];
  dueDate: string;
  photoLimit: string;
  videoLimit: string;
  acceptedTypes: string;
  brandName?: string | null;
  campaignName?: string;
  publicUrl?: string;
}

export function SubAthleteScreen({
  web,
  headline,
  intro,
  items,
  confirmations,
  dueDate,
  photoLimit,
  videoLimit,
  acceptedTypes,
  brandName,
}: { web?: boolean } & Omit<SubmissionPreviewProps, "view">) {
  const formattedDue = dueDate
    ? new Date(dueDate + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "No deadline set";

  const totalFiles = items.reduce((t, it) => t + (Number(it.count) || 1), 0);

  return (
    <div className="min-h-full bg-[#0C0C10] text-[#F8F8F9] font-sans text-xs flex flex-col justify-between">
      <div>
        {/* Safari bar if web */}
        {web && (
          <div className="bg-[#18181D] px-3 py-1.5 text-center text-[10px] text-stone-400 border-b border-stone-800">
            🔒 postgame1.com/submit
          </div>
        )}

        {/* Hero header */}
        <div
          className={`relative bg-gradient-to-b from-[#1E1E26] to-[#0C0C10] px-4 flex items-center justify-between ${
            web ? "h-24 pt-2" : "h-32 pt-6"
          }`}
        >
          {!web && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1B1B21] text-white text-xs">
              ‹
            </span>
          )}
          <div className="text-center font-bold tracking-tight text-white uppercase text-sm mx-auto">
            {brandName || "Brand"}
          </div>
          {!web && <span className="h-7 w-7 opacity-0" />}
        </div>

        {/* Sheet */}
        <div className="px-5 -mt-4 pb-20">
          <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-stone-700" />
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#DF4A06]">Content submission</div>
          <h1 className="mt-1 text-base font-bold text-white leading-tight">{headline || "Upload your content"}</h1>
          {intro && <p className="mt-1.5 text-xs text-stone-400 leading-relaxed">{intro}</p>}

          {/* What to upload */}
          <div className="mt-5 border-t border-stone-800/80 pt-4">
            <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">What to upload</div>
            <div className="mt-2 divide-y divide-stone-800/60">
              {items.length === 0 ? (
                <div className="py-2 text-stone-500 italic">No deliverables specified</div>
              ) : (
                items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1B1B21] text-base">
                      {it.kind === "video" ? "▶" : "📷"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white">
                        {it.count} {it.kind === "video" ? "Video" : "Photo"}
                        {it.count === 1 ? "" : "s"}
                      </div>
                      {it.note && <div className="text-[11px] text-stone-400 truncate">{it.note}</div>}
                    </div>
                    <span className="text-xs font-semibold text-[#DF4A06]">+ Add</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Confirmations */}
          {confirmations.length > 0 && (
            <div className="mt-5 border-t border-stone-800/80 pt-4">
              <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Before you upload</div>
              <div className="mt-2 space-y-2">
                {confirmations.map((c, i) => (
                  <label key={i} className="flex items-start gap-2.5 text-xs text-stone-300">
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-stone-700 bg-[#16161c]" />
                    <span className="leading-snug">{c}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Due date and limits */}
          <div className="mt-5 border-t border-stone-800/80 pt-4 text-xs">
            <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Due</div>
            <div className="mt-1 font-semibold text-white">{formattedDue}</div>
            <div className="mt-1 text-[11px] text-stone-400">
              Photos up to {photoLimit} · videos up to {videoLimit} · {acceptedTypes}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="p-4 bg-[#0C0C10] border-t border-stone-800/60 sticky bottom-0">
        <button
          type="button"
          className="w-full rounded-xl bg-[#DF4A06] py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg"
        >
          Upload {totalFiles} {totalFiles === 1 ? "file" : "files"} ›
        </button>
      </div>
    </div>
  );
}

export function SubDesktopScreen({
  headline,
  intro,
  items,
  confirmations,
  dueDate,
  photoLimit,
  videoLimit,
  acceptedTypes,
  brandName,
}: Omit<SubmissionPreviewProps, "view">) {
  const formattedDue = dueDate
    ? new Date(dueDate + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "No deadline set";

  return (
    <div className="min-h-full bg-[#0C0C10] text-[#F8F8F9] p-6 lg:p-8 font-sans">
      {/* Top logo strip */}
      <div className="flex items-center justify-between border-b border-stone-800/80 pb-4">
        <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
          <span className="text-[#DF4A06]">●</span> POSTGAME
        </div>
        <span className="rounded-md border border-stone-800 bg-[#15151A] px-2.5 py-1 text-xs text-stone-400">
          Get the app
        </span>
      </div>

      <div className="mx-auto max-w-2xl pt-6">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-400">{brandName || "Brand"}</div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#DF4A06] mt-1">Content submission</div>
        <h1 className="mt-1 text-2xl font-bold text-white">{headline || "Upload your content"}</h1>
        {intro && <p className="mt-2 text-sm text-stone-400">{intro}</p>}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left: What to upload & Confirmations */}
          <div className="space-y-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">What to upload</div>
              <div className="divide-y divide-stone-800 border-y border-stone-800">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1B1B21] text-base">
                      {it.kind === "video" ? "▶" : "📷"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white text-sm">
                        {it.count} {it.kind === "video" ? "Video" : "Photo"}
                        {it.count === 1 ? "" : "s"}
                      </div>
                      {it.note && <div className="text-xs text-stone-400 truncate">{it.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {confirmations.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Before you upload</div>
                <div className="space-y-2.5">
                  {confirmations.map((c, i) => (
                    <label key={i} className="flex items-start gap-2.5 text-xs text-stone-300">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-stone-700 bg-[#16161c]" />
                      <span className="leading-snug">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Drop zone */}
          <div>
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-800 bg-[#111115] p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1B1B21] text-xl text-[#DF4A06]">
                ↑
              </div>
              <div className="mt-3 font-semibold text-white text-sm">Drop your files here</div>
              <div className="mt-1 text-xs text-stone-400">
                {acceptedTypes} · photos to {photoLimit}, videos to {videoLimit}
              </div>
              <button
                type="button"
                className="mt-4 rounded-lg bg-[#DF4A06] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#b33407]"
              >
                Choose files
              </button>
            </div>
            <div className="mt-3 text-center text-xs text-stone-500">
              Due {formattedDue} · you can come back and add more until then
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubmissionPreview(props: SubmissionPreviewProps) {
  const url = props.publicUrl || "postgame1.com/submit";

  if (props.view === "desktop") {
    return (
      <div className="p-3">
        <BrowserFrame url={url}>
          <SubDesktopScreen {...props} />
        </BrowserFrame>
      </div>
    );
  }

  return (
    <div className="p-3 flex justify-center">
      <IPhoneFrame>
        <SubAthleteScreen web={props.view === "mweb"} {...props} />
      </IPhoneFrame>
    </div>
  );
}
