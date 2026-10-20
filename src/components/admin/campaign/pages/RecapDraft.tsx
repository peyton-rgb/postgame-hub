// ============================================================
// Recap draft — /admin/campaigns/[id]/recap. Built from the campaign's
// performance tracker: the RECAP SUMMARY tab is read live and shown as
// the headline numbers, the summary is written by a person, and the
// "What's included" boxes pick the recap sections. The existing recap
// renderer and its pages are untouched; publishing here marks the
// draft live and links to the recap that exists for the campaign.
// ============================================================

"use client";

import Link from "next/link";
import { useState } from "react";
import { RECAP_SECTIONS, type RecapDraft as Draft } from "@/lib/admin/campaigns/page-drafts";
import { DraftBar, DraftForm, Fld, Sec, input } from "./DraftShell";

export interface TrackerNumbers {
  rows: string[][];
  readAt: string;
  error: string | null;
}

export default function RecapDraft({
  campaignId,
  campaignName,
  brandName,
  initial,
  filledFrom,
  status,
  exists,
  pending,
  numbers,
  existingRecap,
  action,
}: {
  campaignId: number;
  campaignName: string;
  brandName: string | null;
  initial: Draft;
  filledFrom: string[];
  status: "draft" | "live";
  exists: boolean;
  pending: boolean;
  numbers: TrackerNumbers;
  existingRecap: { id: string; slug: string | null } | null;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [d, setD] = useState<Draft>({
    ...initial,
    numbers: numbers.rows.length ? numbers.rows : initial.numbers,
    numbers_read_at: numbers.readAt || initial.numbers_read_at,
  });
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const grid = d.numbers;
  const readAt = d.numbers_read_at ? new Date(d.numbers_read_at) : null;
  const srcs = filledFrom.map((f) => (f === "Performance tracker" && readAt ? `Performance tracker · read ${readAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : f));

  return (
    <DraftForm
      campaignId={campaignId}
      campaignName={campaignName}
      kind="recap"
      title={`${campaignName} recap`}
      sub={`Built from the performance tracker. Publishing gives ${brandName ?? "the brand"} a new recap link.`}
      status={status}
      exists={exists}
      pending={pending}
      content={d}
      filledFrom={filledFrom}
      action={action}
      extraActions={
        <Link href={`/admin/campaigns/${campaignId}/recap?refresh=1`} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400">
          ↻ Refresh numbers
        </Link>
      }
    >
      <DraftBar what="recap" srcs={srcs} note="Numbers came from the sources on the right. The summary is yours to write." />

      <div className="grid max-w-[860px] gap-3.5">
        <Sec n={1} title="Performance tracker">
          <Fld label="Tracker sheet" name="tracker_link" value={d.tracker_link} onChange={set("tracker_link")} sources={d.sources} type="url" span2 placeholder="https://docs.google.com/spreadsheets/d/…" hint="Add the performance tracker on Edit campaign (or paste it here) and the numbers read from its RECAP SUMMARY tab." />
          <div className="md:col-span-2">
            {grid.length ? (
              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full text-[13px]">
                  <tbody>
                    {grid.map((row, i) => (
                      <tr key={i} className="border-t border-stone-100 first:border-t-0">
                        {row.map((cell, j) => (
                          <td key={j} className={"whitespace-nowrap px-3 py-1.5 " + (j === 0 ? "font-medium text-stone-900" : "text-stone-700 tabular-nums")}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-500">
                  RECAP SUMMARY tab, as the sheet shows it{readAt ? ` · read ${readAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-stone-300 px-4 py-5 text-center text-[13px] text-stone-500">{numbers.error ?? "No numbers yet."}</div>
            )}
          </div>
        </Sec>

        <Sec n={2} title="Summary" form={false}>
          <label htmlFor="f-summary" className="mb-1 block text-[12px] font-medium text-stone-600">
            Written from the numbers. Edit before publishing.
          </label>
          <textarea id="f-summary" rows={4} value={d.summary} onChange={(e) => set("summary")(e.target.value)} className={input} placeholder="How many athletes posted, what it reached, what stood out." />
          {!d.summary && <div className="mt-1 text-[12px] text-stone-500">Nothing writes this for you yet; a few lines from the numbers above.</div>}
        </Sec>

        <Sec n={3} title="What's included" form={false}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {RECAP_SECTIONS.map((x) => (
              <label key={x} className="flex items-center gap-2 text-[13px] text-stone-800">
                <input type="checkbox" checked={d.include[x] !== false} onChange={(e) => setD((p) => ({ ...p, include: { ...p.include, [x]: e.target.checked } }))} />
                {x}
              </label>
            ))}
          </div>
          <div className="mt-2 text-[12px] text-stone-500">
            {existingRecap ? (
              <>
                This campaign already has a recap in the recap editor:{" "}
                <Link href={`/dashboard/${existingRecap.id}`} className="font-medium text-[#D73F09] hover:underline">
                  open it
                </Link>
                . Top posts, top athletes and the gallery come from there.
              </>
            ) : (
              "Top posts, top athletes and the gallery are built in the recap editor once content is in; this draft holds the numbers and the summary."
            )}
          </div>
        </Sec>
      </div>
    </DraftForm>
  );
}
