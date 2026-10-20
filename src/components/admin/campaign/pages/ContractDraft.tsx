// ============================================================
// Athlete contract draft — the editor behind /admin/campaigns/[id]/contract.
//   1 Template (Standard athlete agreement / Event appearance agreement)
//   2 Schedule A · Scope of work (filled from the campaign)
//   3 Event terms (event variant only)
//   3/4 Schedule B · Brand guidelines
//   4/5 Standard terms (locked list of the agreement's sections)
// Right: "What the athlete signs" — the paper preview, with the parts
// that came from the campaign highlighted.
// ============================================================

"use client";

import { useState } from "react";
import {
  CANCEL_OPTIONS,
  STD_SECTIONS,
  TRAVEL_OPTIONS,
  USAGE_PERIODS,
  type ContractDraft as Draft,
  type ContractVariant,
} from "@/lib/admin/campaigns/page-drafts";
import { DraftBar, DraftForm, Fld, Sec, SrcTag } from "./DraftShell";

function Af({ children }: { children: string }) {
  // "auto-filled" highlight; empty values render as a blank to fill in
  return children ? <mark className="rounded-[3px] bg-[#FDEEE7] px-0.5 text-inherit">{children}</mark> : <span className="border-b border-stone-400 px-1 italic text-stone-400">to fill in</span>;
}

export default function ContractDraft({
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
  const ev = d.variant === "event";
  const setVariant = (v: ContractVariant) =>
    setD((p) => ({ ...p, variant: v, campaign_type: v === "event" ? "Event appearance" : "Social media campaign" }));

  const schedA: [string, string][] = [
    ["Brand", d.brand],
    ["Campaign type", d.campaign_type],
    ["Purpose", d.purpose],
    ...(ev ? ([["Event", d.event_when], ["Arrive by", d.arrive_by], ["At the event", d.at_event]] as [string, string][]) : []),
    ["Compensation", d.compensation],
    ["Gifting", d.gifting],
    ["Bonus", d.bonus],
    ["Deliverables", d.deliverables],
  ];
  const evTerms: [string, string][] = [
    ["Appearance", d.ev_appearance],
    ["Travel", [d.travel_pays, d.ev_travel].filter(Boolean).join(". ")],
    ["Cancellation & weather", [d.cancel_terms, d.ev_cancel].filter(Boolean).join(". ")],
    ["Photos & video on site", d.ev_photos],
  ];
  const sbLine = [d.sb_instagram && `Instagram ${d.sb_instagram}`, d.sb_tiktok && `TikTok ${d.sb_tiktok}`, d.sb_hashtags].filter(Boolean).join(" · ");

  let n = 1;
  const next = () => n++;

  return (
    <DraftForm
      campaignId={campaignId}
      campaignName={campaignName}
      kind="contract"
      title="Athlete contract"
      sub="Selected athletes read and sign this in the app. Their name, email and date fill in when they sign."
      status={status}
      exists={exists}
      pending={pending}
      variant={d.variant}
      content={d}
      filledFrom={filledFrom}
      action={action}
      publishLabel="Send for signature"
    >
      <DraftBar what="contract" srcs={filledFrom} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 gap-3.5">
          <Sec n={next()} title="Template" sub="Picked from the campaign type. Social campaigns use the standard agreement as is." form={false}>
            <div className="inline-flex max-w-full flex-wrap rounded-lg border border-stone-200 bg-stone-100 p-0.5">
              {(
                [
                  ["standard", "Standard athlete agreement"],
                  ["event", "Event appearance agreement"],
                ] as [ContractVariant, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={d.variant === k}
                  onClick={() => setVariant(k)}
                  className={"rounded-md px-3 py-1 text-[13px] font-medium " + (d.variant === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-stone-500">
              {ev
                ? "Standard agreement + an event schedule, with four event terms added. Have legal check the event terms before first use."
                : "Postgame, LLC Athlete Agreement · same terms on every social campaign."}
            </div>
          </Sec>

          <Sec n={next()} title="Schedule A · Scope of work" sub="Filled in from the campaign. Edit anything that's wrong.">
            <Fld label="Brand" name="brand" value={d.brand} onChange={set("brand")} sources={d.sources} span2 hint="Pick a brand on the campaign and it fills in here." />
            <Fld label="Campaign type" name="campaign_type" value={d.campaign_type} onChange={set("campaign_type")} sources={d.sources} span2 />
            <Fld label="Purpose" name="purpose" value={d.purpose} onChange={set("purpose")} sources={d.sources} span2 area hint="What the athlete is engaged to do. Fills in from the opt-in page's description once that's written." />
            {ev && (
              <>
                <Fld label="Event" name="event_when" value={d.event_when} onChange={set("event_when")} sources={d.sources} span2 hint="Date · time · venue. Fills in from the event details on Edit campaign." />
                <Fld label="Arrive by" name="arrive_by" value={d.arrive_by} onChange={set("arrive_by")} sources={d.sources} span2 hint="The call time from Edit campaign." />
                <Fld label="At the event" name="at_event" value={d.at_event} onChange={set("at_event")} sources={d.sources} span2 area hint="What athletes do there, from Edit campaign." />
              </>
            )}
            <Fld label="Compensation" name="compensation" value={d.compensation} onChange={set("compensation")} sources={d.sources} span2 hint="Fills in from the opt-in page's compensation line." />
            <Fld label="Gifting" name="gifting" value={d.gifting} onChange={set("gifting")} sources={d.sources} span2 hint="Product the brand ships, if any. Nothing on the campaign records this yet." />
            <Fld label="Bonus" name="bonus" value={d.bonus} onChange={set("bonus")} sources={d.sources} span2 hint="Fills in from the opt-in page's bonus note." />
            <Fld label="Deliverables" name="deliverables" value={d.deliverables} onChange={set("deliverables")} sources={d.sources} span2 area hint="Fills in from the opt-in page's required posts." />
            <Fld label="Usage period" name="usage_period" value={d.usage_period} onChange={set("usage_period")} options={USAGE_PERIODS} emptyOption="Pick a usage period" hint="How long the brand may use the content, from the first post." />
          </Sec>

          {ev && (
            <Sec n={next()} title="Event terms">
              {(
                [
                  ["Appearance", "ev_appearance"],
                  ["Travel", "ev_travel"],
                  ["Cancellation & weather", "ev_cancel"],
                  ["Photos & video on site", "ev_photos"],
                ] as [string, keyof Draft][]
              ).map(([label, key]) => (
                <div key={key} className="md:col-span-2">
                  <label htmlFor={"f-" + key} className="mb-1 block text-[12px] font-medium text-stone-600">
                    {label}
                    <SrcTag src="added for events" tone="new" />
                  </label>
                  <textarea id={"f-" + key} rows={2} value={d[key] as string} onChange={(e) => setD((p) => ({ ...p, [key]: e.target.value }))} className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900" />
                </div>
              ))}
              <Fld label="Who pays for travel" name="travel_pays" value={d.travel_pays} onChange={set("travel_pays")} options={TRAVEL_OPTIONS} emptyOption="Pick who pays" hint="Written into the Travel term above." />
              <Fld label="If the brand cancels" name="cancel_terms" value={d.cancel_terms} onChange={set("cancel_terms")} options={CANCEL_OPTIONS} emptyOption="Pick the cancellation terms" hint="Written into the Cancellation term above." />
            </Sec>
          )}

          <Sec n={next()} title="Schedule B · Brand guidelines">
            <Fld label="Instagram" name="sb_instagram" value={d.sb_instagram} onChange={set("sb_instagram")} sources={d.sources} placeholder="@brand" hint="The brand's Instagram handle. Set the mention on the campaign or opt-in page and it fills in." />
            <Fld label="TikTok" name="sb_tiktok" value={d.sb_tiktok} onChange={set("sb_tiktok")} sources={d.sources} placeholder="@brand" hint="The brand's TikTok handle." />
            <Fld label="Hashtags" name="sb_hashtags" value={d.sb_hashtags} onChange={set("sb_hashtags")} sources={d.sources} placeholder="#campaign #ad" hint="Fills in from the campaign's hashtags, plus #ad." />
            <Fld label="Style notes" name="sb_style" value={d.sb_style} onChange={set("sb_style")} sources={d.sources} area hint="Framing, lighting, what not to show. Nothing on the campaign records this yet." />
          </Sec>

          <Sec n={next()} title="Standard terms" sub="The same on every campaign. Only legal changes these." form={false} right={<span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Locked</span>}>
            <div className="flex flex-wrap gap-1.5">
              {STD_SECTIONS.map((s) => {
                const swap = ev && s === "Travel";
                return (
                  <span key={s} className={"rounded-md border px-2 py-0.5 text-[12px] " + (swap ? "border-[#D73F09] text-[#D73F09]" : "border-stone-200 text-stone-500")}>
                    {s}
                    {swap ? " → event version" : ""}
                  </span>
                );
              })}
            </div>
          </Sec>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-3">
          <div className="mb-2 flex items-center justify-between text-[12px] text-stone-500">
            <b className="text-[13px] text-stone-900">What the athlete signs</b>
            <span>Preview</span>
          </div>
          <div className="max-h-[78vh] overflow-auto rounded-md border border-stone-200 bg-white px-5 py-5 font-serif text-[12px] leading-[1.55] text-[#222] shadow-[0_2px_10px_rgba(0,0,0,.06)]">
            <div className="mb-3.5 text-center font-bold tracking-[.04em]">
              POSTGAME, LLC
              <br />
              ATHLETE AGREEMENT
            </div>
            <p className="mb-2.5">
              This Agreement, including the schedules thereto, is entered into by and between POSTGAME, LLC (&quot;Postgame&quot;) and{" "}
              <span className="border-b border-stone-400 px-1 italic text-stone-400">athlete&apos;s name</span>, with an email address of{" "}
              <span className="border-b border-stone-400 px-1 italic text-stone-400">athlete&apos;s email</span> (the &quot;Athlete&quot;).
            </p>
            <p className="mb-2.5">
              <b>ENGAGEMENT.</b> Postgame hereby engages Athlete … for the limited purpose of promoting <Af>{d.brand}</Af> … as outlined in the attached Schedule A.
            </p>
            <p className="mb-2.5 text-stone-500">… {STD_SECTIONS.length} standard sections …</p>
            <div className="mb-2 mt-4 font-bold tracking-[.03em]">SCHEDULE A · SCOPE OF WORK</div>
            <table className="w-full border-collapse">
              <tbody>
                {schedA.map(([k, v]) => (
                  <tr key={k}>
                    <td className="w-[32%] border border-stone-200 px-2 py-1.5 align-top font-semibold">{k}</td>
                    <td className="border border-stone-200 px-2 py-1.5 align-top">
                      <Af>{v}</Af>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="w-[32%] border border-stone-200 px-2 py-1.5 align-top font-semibold">Usage</td>
                  <td className="border border-stone-200 px-2 py-1.5 align-top">
                    <Af>{d.usage_period}</Af> from first post
                  </td>
                </tr>
              </tbody>
            </table>
            {ev && (
              <>
                <div className="mb-2 mt-4 font-bold tracking-[.03em]">EVENT TERMS</div>
                {evTerms.map(([k, v]) => (
                  <p key={k} className="mb-2.5">
                    <b>{k.toUpperCase()}.</b> <Af>{v}</Af>
                  </p>
                ))}
              </>
            )}
            <div className="mb-2 mt-4 font-bold tracking-[.03em]">SCHEDULE B · BRAND GUIDELINES</div>
            <p className="mb-2.5">
              <Af>{sbLine}</Af>
              {d.sb_style && (
                <>
                  <br />
                  <Af>{d.sb_style}</Af>
                </>
              )}
            </p>
            <div className="mt-5 flex gap-4">
              <span className="flex-1 border-t border-stone-400 pt-1 text-stone-500">Athlete signature</span>
              <span className="flex-1 border-t border-stone-400 pt-1 text-stone-500">Date</span>
            </div>
          </div>
        </aside>
      </div>
    </DraftForm>
  );
}
