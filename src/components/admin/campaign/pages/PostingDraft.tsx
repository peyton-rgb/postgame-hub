// ============================================================
// Posting instructions draft — /admin/campaigns/[id]/posting.
//   1 What every post needs (tag · hashtag · ad disclosure · collab)
//   2 What athletes post, in order (deliverables)
//   3 When they post (same day / spread / per athlete)
//   4 Who gets instructions (the selected roster, with content status)
// Right: "What the athlete sees" — their posting link in the app frame.
// ============================================================

"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import {
  DELIVERABLE_KEYS,
  DELIVERABLE_LABELS,
  FTC_OPTIONS,
  shortDate,
  type DeliverableKey,
  type PostingDates,
  type PostingDraft as Draft,
} from "@/lib/admin/campaigns/page-drafts";
import { IPhoneFrame } from "../OptinPreview";
import { Pill } from "../bits";
import s from "../optin.module.css";
import { DraftBar, DraftForm, Fld, Sec, input } from "./DraftShell";

export interface RosterRow {
  person_id: string;
  name: string;
  handle: string | null;
  pic: string | null;
  /** content_submissions.status, or null when nothing was uploaded */
  content: string | null;
}

function contentLabel(c: string | null): { text: string; tone: "ok" | "info" | "warn" } {
  if (!c) return { text: "Not uploaded", tone: "warn" };
  if (c === "approved") return { text: "Approved", tone: "ok" };
  return { text: c.replace(/_/g, " "), tone: "info" };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() ?? "")
    .join("");
}

export default function PostingDraft({
  campaignId,
  campaignName,
  brandName,
  initial,
  filledFrom,
  status,
  exists,
  pending,
  roster,
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
  roster: RosterRow[];
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const approvedCount = roster.filter((a) => a.content === "approved").length;
  const included = (a: RosterRow) => !d.only_approved || a.content === "approved";
  const ready = roster.filter(included);

  const steps = [
    d.deliverables.reel && "Post your Reel with the cover image",
    d.deliverables.feed && "Post your feed photos as a carousel",
    d.deliverables.story && `Share a Story${d.tag ? ` and tag @${d.tag}` : ""}`,
    d.deliverables.tiktok && "Post your TikTok",
  ].filter((x): x is string => !!x);
  const ftcStep =
    d.ftc === "#ad in caption"
      ? "Put #ad in your caption"
      : d.ftc
        ? `Turn on the Paid partnership label${d.ftc.includes("#ad") ? " and add #ad" : ""}`
        : null;
  const postDay = d.dates === "one" ? shortDate(d.start) : d.dates === "spread" ? shortDate(d.start) : "";

  const seg = (
    <div className="inline-flex max-w-full flex-wrap rounded-lg border border-stone-200 bg-stone-100 p-0.5">
      {(
        [
          ["one", "Same day for everyone"],
          ["spread", "Spread across dates"],
          ["each", "Set per athlete"],
        ] as [PostingDates, string][]
      ).map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={d.dates === k}
          onClick={() => set("dates")(k)}
          className={"rounded-md px-3 py-1 text-[13px] font-medium " + (d.dates === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <DraftForm
      campaignId={campaignId}
      campaignName={campaignName}
      kind="posting"
      title="Set up posting instructions"
      sub={`${[campaignName, brandName].filter(Boolean).join(" · ")}. Each athlete gets a link with their files, caption and step-by-step posting help.`}
      status={status}
      exists={exists}
      pending={pending}
      content={d}
      filledFrom={filledFrom}
      action={action}
      publishLabel={`Create for ${ready.length} athlete${ready.length === 1 ? "" : "s"}`}
    >
      <DraftBar what="posting instructions" srcs={filledFrom} note="Tag, hashtag, posts and dates came from the sources on the right." />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-3.5">
          <Sec n={1} title="What every post needs">
            <Fld label="Tag this account" name="tag" value={d.tag ? "@" + d.tag : ""} onChange={(v) => set("tag")(v.replace(/^@/, ""))} sources={d.sources} placeholder="@brand" hint="The brand's handle. Set the Instagram mention on the campaign or opt-in page and it fills in." />
            <Fld label="Use this hashtag" name="hashtag" value={d.hashtag ? "#" + d.hashtag : ""} onChange={(v) => set("hashtag")(v.replace(/^#/, ""))} sources={d.sources} placeholder="#campaign" hint="Fills in from the campaign's first hashtag." />
            <Fld label="Ad disclosure" name="ftc" value={d.ftc} onChange={set("ftc")} sources={d.sources} options={FTC_OPTIONS} emptyOption="Pick how athletes disclose" />
            <div>
              <div className="mb-1 text-[12px] font-medium text-stone-600">Instagram collab post</div>
              <label className="flex items-center gap-2 text-[13px] text-stone-800">
                <input type="checkbox" checked={d.collab} onChange={(e) => set("collab")(e.target.checked)} />
                Invite {d.tag ? `@${d.tag}` : "the brand"} as a collaborator
              </label>
            </div>
          </Sec>

          <Sec n={2} title="What athletes post, in order" form={false}>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {DELIVERABLE_KEYS.map((k: DeliverableKey) => (
                <label key={k} className="flex items-center gap-2 text-[13px] text-stone-800">
                  <input
                    type="checkbox"
                    checked={d.deliverables[k]}
                    onChange={(e) => setD((p) => ({ ...p, deliverables: { ...p.deliverables, [k]: e.target.checked } }))}
                  />
                  {DELIVERABLE_LABELS[k]}
                </label>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-stone-500">
              {d.sources.deliverables
                ? `Pulled from the ${d.sources.deliverables.toLowerCase()}. Files come from each athlete's approved content in LucidLink.`
                : "Nothing picked yet: the opt-in page has no required posts to pull from. Files come from each athlete's approved content in LucidLink."}
            </div>
          </Sec>

          <Sec n={3} title="When they post">
            <div className="md:col-span-2">{seg}</div>
            {d.dates === "one" && <Fld label="Post date" name="start" value={d.start} onChange={set("start")} sources={d.sources} type="date" hint="Fills in from the opt-in page timeline's Post step." />}
            {d.dates === "spread" && (
              <>
                <Fld label="First day" name="start" value={d.start} onChange={set("start")} sources={d.sources} type="date" hint="Fills in from the opt-in page timeline's Post step." />
                <Fld label="Last day" name="end" value={d.end} onChange={set("end")} type="date" />
              </>
            )}
            {d.dates === "each" && <div className="text-[12px] text-stone-500 md:col-span-2">You&apos;ll set each athlete&apos;s date in the list below.</div>}
          </Sec>

          <Sec n={4} title="Who gets instructions" form={false}>
            <label className="flex items-center gap-2 text-[13px] text-stone-800">
              <input type="checkbox" checked={d.only_approved} onChange={(e) => set("only_approved")(e.target.checked)} />
              Only athletes whose content is approved ({approvedCount} of {roster.length})
            </label>
            {roster.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-[13px] text-stone-500">
                No athletes selected on this campaign yet. Select athletes from the Opt-ins tab first.
              </div>
            ) : (
              <div className="-mx-4 mt-3 overflow-x-auto md:-mx-5">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wider text-stone-500">
                      <th className="px-4 py-2 font-semibold md:px-5">Athlete</th>
                      <th className="px-3 py-2 font-semibold">Content</th>
                      <th className="px-3 py-2 font-semibold">Post date</th>
                      <th className="px-4 py-2 md:px-5" />
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((a) => {
                      const c = contentLabel(a.content);
                      return (
                        <tr key={a.person_id} className="border-b border-stone-100">
                          <td className="px-4 py-2 md:px-5">
                            <div className="flex items-center gap-2.5">
                              {a.pic ? (
                                <img src={a.pic} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />
                              ) : (
                                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-stone-200 text-[11px] font-semibold text-stone-600">{initials(a.name)}</span>
                              )}
                              <div className="min-w-0">
                                <div className="truncate font-medium text-stone-900">{a.name}</div>
                                {a.handle && <div className="truncate text-[12px] text-stone-500">@{a.handle.replace(/^@/, "")}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Pill tone={c.tone}>{c.text}</Pill>
                          </td>
                          <td className="px-3 py-2">
                            {d.dates === "each" ? (
                              <input
                                type="date"
                                value={d.per_athlete[a.person_id] ?? ""}
                                onChange={(e) => setD((p) => ({ ...p, per_athlete: { ...p.per_athlete, [a.person_id]: e.target.value } }))}
                                className={input + " h-[30px] w-[150px] py-0"}
                                aria-label={`Post date for ${a.name}`}
                              />
                            ) : (
                              <span className="text-stone-500">{postDay || "—"}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-right md:px-5">
                            {included(a) ? <span className="text-[12px] text-status-ok">✓ Included</span> : <span className="text-[12px] text-stone-400">Waits until approved</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Sec>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-3">
          <div className="mb-2 flex items-center justify-between text-[12px] text-stone-500">
            <b className="text-[13px] text-stone-900">What the athlete sees</b>
            <span>Their posting link</span>
          </div>
          <div className={s.stage} style={{ padding: "16px 6px" }}>
            <IPhoneFrame>
              <div className={s.ap} style={{ padding: "64px 20px 30px" }}>
                <div className={s.eyebrow}>Posting instructions</div>
                <div className={s.h1} style={{ fontSize: 22 }}>
                  {campaignName}
                  {postDay ? ` · post on ${postDay}` : ""}
                </div>
                <div className={s.stats} style={{ margin: "16px 0" }}>
                  <div className={s.stat}>
                    <div className={s.lbl}>Tag</div>
                    <div className={s.val}>{d.tag ? `@${d.tag}` : "—"}</div>
                  </div>
                  <div className={s.stat}>
                    <div className={s.lbl}>Hashtag</div>
                    <div className={s.val}>{d.hashtag ? `#${d.hashtag}` : "—"}</div>
                  </div>
                </div>
                <div className={s.sec}>
                  <div className={s.lbl}>Your files</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ aspectRatio: "9 / 16", borderRadius: 8, background: "#1B1B21" }} />
                    ))}
                  </div>
                  <div className={s.sub} style={{ marginTop: 8 }}>
                    Their approved files · tap to save to your phone
                  </div>
                </div>
                <div className={s.sec}>
                  <div className={s.lbl}>Your caption</div>
                  <div className={s.p} style={{ background: "#1B1B21", borderRadius: 8, padding: 12 }}>
                    <span style={{ color: "#AAAAB0" }}>Their caption</span>
                    {d.tag ? ` @${d.tag}` : ""}
                    {d.hashtag ? ` #${d.hashtag}` : ""}
                    {d.ftc && d.ftc.includes("#ad") ? " #ad" : ""}
                  </div>
                  <div className={s.sub} style={{ marginTop: 8 }}>
                    Tap to copy
                  </div>
                </div>
                <div className={s.sec}>
                  <div className={s.lbl}>Steps</div>
                  {steps.length === 0 && !ftcStep && <div className={s.sub}>Pick what athletes post and the steps fill in.</div>}
                  {[...steps, ...(ftcStep ? [ftcStep + (d.collab && d.tag ? ` and invite @${d.tag} as a collaborator` : "")] : [])].map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.08)", fontSize: 13, color: "#fff" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#1B1B21", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{i + 1}</span>
                      {x}
                    </div>
                  ))}
                </div>
                <button type="button" className={s.btn} style={{ marginTop: 16, height: 44 }}>
                  I posted it ›
                </button>
              </div>
            </IPhoneFrame>
          </div>
        </aside>
      </div>
    </DraftForm>
  );
}
