// ============================================================
// Creator brief draft — /admin/campaigns/[id]/brief. What athletes and
// videographers need to make the content: the idea, shot list, do's
// and don'ts, deadlines and where to upload. Plus the Google Doc link
// when the brief also lives as a doc.
// ============================================================

"use client";

import { useState } from "react";
import type { BriefDraft as Draft } from "@/lib/admin/campaigns/page-drafts";
import { DraftBar, DraftForm, Fld, Sec, SrcTag, input } from "./DraftShell";

export default function BriefDraft({
  campaignId,
  campaignName,
  initial,
  filledFrom,
  status,
  exists,
  pending,
  action,
}: {
  campaignId: number;
  campaignName: string;
  initial: Draft;
  filledFrom: string[];
  status: "draft" | "live";
  exists: boolean;
  pending: boolean;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setShot = (i: number, v: string) => set("shots")(d.shots.map((x, j) => (j === i ? v : x)));

  return (
    <DraftForm
      campaignId={campaignId}
      campaignName={campaignName}
      kind="brief"
      title="Creator brief"
      sub="What athletes and videographers need to make the content. Shared as a link."
      status={status}
      exists={exists}
      pending={pending}
      content={d}
      filledFrom={filledFrom}
      action={action}
    >
      <DraftBar what="creator brief" srcs={filledFrom} note="The idea, shot list and deadlines came from the sources on the right." />

      <div className="grid max-w-[760px] gap-3.5">
        <Sec n={1} title="The idea">
          <Fld label="In one line" name="idea" value={d.idea} onChange={set("idea")} sources={d.sources} area hint="Fills in from the opt-in page's description once that's written." />
          <Fld label="Product" name="product" value={d.product} onChange={set("product")} sources={d.sources} hint="What the content is about. Nothing on the campaign records this yet." />
        </Sec>

        <Sec n={2} title="Shot list" form={false}>
          {d.sources.shots && (
            <div className="mb-2 text-[12px] text-stone-500">
              <SrcTag src="shots" sources={d.sources} />
            </div>
          )}
          {d.shots.length === 0 && <div className="mb-2 text-[12px] text-stone-500">No required posts on the opt-in page yet, so the list starts empty.</div>}
          <div className="grid gap-2">
            {d.shots.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-[13px] text-stone-400">{i + 1}.</span>
                <input value={x} onChange={(e) => setShot(i, e.target.value)} aria-label={`Shot ${i + 1}`} className={input} />
                <button type="button" aria-label={`Remove shot ${i + 1}`} onClick={() => set("shots")(d.shots.filter((_, j) => j !== i))} className="text-[13px] text-stone-500 hover:text-stone-900">
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => set("shots")([...d.shots, ""])} className="mt-2 text-[13px] font-medium text-[#D73F09] hover:underline">
            + Add shot
          </button>
        </Sec>

        <Sec n={3} title="Do's and don'ts">
          <Fld label="Do" name="dos" value={d.dos} onChange={set("dos")} sources={d.sources} area hint="Fills in from the brief's must-say list when there is one." />
          <Fld label="Don't" name="donts" value={d.donts} onChange={set("donts")} sources={d.sources} area hint="Fills in from the brief's avoid list when there is one." />
        </Sec>

        <Sec n={4} title="Deadlines & upload">
          <Fld label="Content due" name="content_due" value={d.content_due} onChange={set("content_due")} sources={d.sources} type="date" hint="Fills in from the opt-in page timeline's Create step." />
          <Fld label="Upload to" name="upload_to" value={d.upload_to} onChange={set("upload_to")} sources={d.sources} hint="Fills in once the campaign has a content submission form. Raw files and edits go to LucidLink; finals are exported to Drive." />
          <Fld label="Google Doc" name="doc_link" value={d.doc_link} onChange={set("doc_link")} sources={d.sources} type="url" span2 placeholder="https://docs.google.com/document/d/…" hint="Paste the Campaign Brief doc when the brief also lives in Google Docs. Fills in from the campaign's Brief link." />
        </Sec>
      </div>
    </DraftForm>
  );
}
