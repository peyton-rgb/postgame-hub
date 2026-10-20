// ============================================================
// Opt-in page builder — Lovable's 12 numbered rows plus 13 "Who's
// eligible" and 14 "Hero video / photo", with a live App / Mobile web /
// Desktop web preview on the right. One Save posts the whole page as
// JSON to the saveOptinPage server action (plus the athlete contract
// fields, which live on the campaign row).
//
// Uploads are a later step: content examples and the hero accept URLs.
// ============================================================

"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import type { OptinEventInfo, OptinPageData } from "@/lib/admin/campaigns/optin-page";
import type { CampaignType } from "@/lib/admin/campaigns/types";
import OptinPreview, { type OptinView } from "./OptinPreview";
import CopyButton from "./CopyButton";
import { Pill } from "./bits";

const input = "w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900 disabled:bg-stone-50 disabled:text-stone-500";
const small = "rounded-md border border-stone-300 px-2 py-1 text-[12px] text-stone-700 hover:border-stone-400";

function Row({ n, label, hint, children }: { n: number; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-stone-200 py-3 first:border-t-0">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#D73F09]/10 text-[12px] font-bold text-[#D73F09]">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <label className="mb-1.5 block text-[13px] font-semibold text-stone-900">{label}</label>
        {hint && <div className="-mt-1 mb-1.5 text-[12px] text-stone-500">{hint}</div>}
        {children}
      </div>
    </div>
  );
}

function TagBox({ label, values, placeholder, onChange }: { label: string; values: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (!values.includes(t)) onChange([...values, t]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-1 text-[12px] font-medium text-stone-600">{label}</div>
      <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-md border border-stone-300 px-2 py-1">
        {values.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[12px] text-stone-800">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="text-stone-500 hover:text-stone-900" onClick={() => onChange(values.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          aria-label={label}
          className="min-w-[120px] flex-1 border-0 bg-transparent py-0.5 text-[13px] outline-none"
        />
      </div>
    </div>
  );
}

function SaveButton({ label = "Save opt-in page", pending }: { label?: string; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-[#D73F09] px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50">
      {pending ? "Saving…" : label}
    </button>
  );
}

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

export default function OptinBuilder({
  campaignId,
  campaignName,
  brandName,
  brandLogoUrl,
  postgameLogoUrl,
  campaignType,
  event,
  initial,
  exists,
  isActive,
  publicUrl,
  appCard,
  contractTitle,
  contract,
  action,
}: {
  campaignId: number;
  campaignName: string;
  brandName: string | null;
  brandLogoUrl: string | null;
  postgameLogoUrl: string | null;
  campaignType: CampaignType;
  event: OptinEventInfo | null;
  initial: OptinPageData;
  exists: boolean;
  isActive: boolean;
  publicUrl: string;
  appCard: { name: string; url: string } | null;
  contractTitle: string;
  contract: string;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [d, setD] = useState<OptinPageData>(initial);
  const [view, setView] = useState<OptinView>("app");
  const [heroUrlMode, setHeroUrlMode] = useState(!!initial.hero_media_url || !appCard);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof OptinPageData>(k: K, v: OptinPageData[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const posts = d.required_posts;
  const movePost = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= posts.length) return;
    const next = [...posts];
    [next[i], next[j]] = [next[j], next[i]];
    set("required_posts", next);
  };
  const moveExample = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.examples.length) return;
    const next = [...d.examples];
    [next[i], next[j]] = [next[j], next[i]];
    set("examples", next);
  };

  const preview = (
    <OptinPreview
      view={view}
      data={d}
      campaignName={campaignName}
      brandName={brandName}
      brandLogoUrl={brandLogoUrl}
      postgameLogoUrl={postgameLogoUrl}
      campaignType={campaignType}
      event={event}
      optInHref={null}
      publicUrl={publicUrl.replace(/^https?:\/\//, "")}
      heroFallbackUrl={appCard?.url ?? null}
    />
  );

  const viewSeg = (
    <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
      {(
        [
          ["app", "App"],
          ["mweb", "Mobile web"],
          ["desktop", "Desktop web"],
        ] as [OptinView, string][]
      ).map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={view === k}
          onClick={() => setView(k)}
          className={"rounded-md px-3 py-1 text-[13px] font-medium " + (view === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <form action={action} onSubmit={() => setSaving(true)}>
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="data" value={JSON.stringify(d)} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold text-stone-900">Opt-In Page</h1>
            {exists ? <Pill tone={isActive ? "ok" : "muted"}>{isActive ? "Live" : "Campaign inactive"}</Pill> : <Pill tone="warn">Not saved yet</Pill>}
          </div>
          <div className="mt-0.5 text-[13px] text-stone-500">{[campaignName, brandName].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/campaigns/${campaignId}`} className="rounded-md px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-100">
            ← Back to campaign
          </Link>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400">
            View live page
          </a>
          <SaveButton label="Save" pending={saving} />
        </div>
      </div>

      {/* Share bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-[13px]">
        <span className="text-stone-500">🔗</span>
        <b className="text-stone-900">{publicUrl.replace(/^https?:\/\//, "")}</b>
        <CopyButton value={publicUrl} label="Copy link" />
        <span className="ml-auto text-[12px] text-stone-500">Works in any phone browser. Athletes with the app also see it in the app.</span>
      </div>

      <div className={"grid grid-cols-1 items-start gap-4 " + (view === "desktop" ? "" : "lg:grid-cols-[minmax(0,1fr)_420px]")}>
        {/* Preview (first on desktop-web view so it gets the width) */}
        <aside className={"min-w-0 lg:sticky lg:top-3 " + (view === "desktop" ? "order-first" : "order-first lg:order-last")}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <b className="text-[13px] text-stone-900">Preview</b>
            {viewSeg}
          </div>
          <div className="mb-2 text-[12px] text-stone-500">The opt-in step shows Postgame&apos;s standard Terms of Service for every campaign.</div>
          {preview}
        </aside>

        {/* The builder */}
        <div className="grid min-w-0 gap-4">
          <section className="rounded-xl border border-stone-200 bg-white px-4 py-3 md:px-5">
            <div className="pb-2 pt-1 font-mono text-[11px] uppercase tracking-wider text-[#D73F09]">NIL Opportunity · fixed eyebrow</div>

            <Row n={1} label="Headline">
              <input className={input} value={d.headline} onChange={(e) => set("headline", e.target.value)} placeholder={`${brandName ?? "Brand"} ${campaignName}`} />
            </Row>
            <Row n={2} label="Campaign name" hint="From the campaign record. Edit it on Edit campaign.">
              <input className={input} value={campaignName} disabled readOnly />
            </Row>
            <Row n={3} label="Content type">
              <input className={input} value={d.content_type} onChange={(e) => set("content_type", e.target.value)} placeholder="Photos + A.I. Video" />
            </Row>
            <Row n={4} label="Campaign description">
              <textarea className={input} rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="Here's a first chance to impress us…" />
            </Row>
            <Row n={5} label="Compensation">
              <input className={input} value={d.compensation} onChange={(e) => set("compensation", e.target.value)} placeholder="Free gear + $25 + Bonus $$ opportunity" />
            </Row>
            <Row n={6} label="About the campaign">
              <textarea className={input} rows={4} value={d.about} onChange={(e) => set("about", e.target.value)} placeholder="What the brand is launching and who they want." />
            </Row>
            <Row n={7} label="Required posts">
              <div className="grid gap-1.5">
                {posts.map((x, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-[12px] text-stone-500">{i + 1}.</span>
                    <input
                      className={input}
                      value={x}
                      aria-label={`Required post ${i + 1}`}
                      placeholder="1 Instagram Feed Post (3-5 Photos + 1 A.I. photo/video)"
                      onChange={(e) => set("required_posts", posts.map((p, j) => (j === i ? e.target.value : p)))}
                    />
                    <span className="flex gap-0.5">
                      <button type="button" aria-label="Up" className={small} onClick={() => movePost(i, -1)}>↑</button>
                      <button type="button" aria-label="Down" className={small} onClick={() => movePost(i, 1)}>↓</button>
                      <button type="button" aria-label="Remove" className={small} onClick={() => set("required_posts", posts.filter((_, j) => j !== i))}>×</button>
                    </span>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-1.5 text-[13px] font-medium text-[#D73F09] hover:underline" onClick={() => set("required_posts", [...posts, ""])}>
                + Add post
              </button>
            </Row>
            <Row n={8} label="Opt-in deadline">
              <input type="date" className={input + " max-w-[220px]"} value={d.optin_deadline} onChange={(e) => set("optin_deadline", e.target.value)} />
            </Row>
            <Row n={9} label="Bonus note">
              <textarea className={input} rows={2} value={d.bonus_note} onChange={(e) => set("bonus_note", e.target.value)} placeholder="Top 3 posts by views earn an extra $100." />
            </Row>
            <Row n={10} label="Content examples" hint="Paste an image or video URL for each example and write the caption the way the athlete would post it. Uploads from your computer come in a later step. Hashtags and tagged accounts come from Tags (field 12).">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {d.examples.map((ex, i) => (
                  <div key={i} className="grid gap-1.5 rounded-lg border border-stone-200 p-2">
                    <div className="relative grid aspect-[4/5] max-h-[160px] place-items-center overflow-hidden rounded-md bg-stone-900">
                      {ex.url ? (
                        isVideo(ex.url) ? (
                          <video src={ex.url} muted playsInline className="h-full w-full object-cover" />
                        ) : (
                          <img src={ex.url} alt="" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <span className="text-[12px] text-stone-400">No media yet</span>
                      )}
                      <span className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between rounded bg-black/60 px-1 text-[12px] text-white">
                        <button type="button" aria-label="Move left" onClick={() => moveExample(i, -1)}>←</button>
                        <button type="button" aria-label="Remove" onClick={() => set("examples", d.examples.filter((_, j) => j !== i))}>×</button>
                        <button type="button" aria-label="Move right" onClick={() => moveExample(i, 1)}>→</button>
                      </span>
                    </div>
                    <input
                      className={input}
                      value={ex.url}
                      placeholder="https://… image or video URL"
                      aria-label={`Example ${i + 1} URL`}
                      onChange={(e) => set("examples", d.examples.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    />
                    <textarea
                      className={input}
                      rows={3}
                      value={ex.caption}
                      placeholder="Write a caption like the athlete would post it…"
                      aria-label={`Example ${i + 1} caption`}
                      onChange={(e) => set("examples", d.examples.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
                    />
                    <div className="text-right text-[11px] text-stone-500">{ex.caption.length.toLocaleString()} / 2,200</div>
                  </div>
                ))}
                <button
                  type="button"
                  className="grid min-h-[120px] place-items-center rounded-lg border-2 border-dashed border-stone-300 text-[13px] font-medium text-[#D73F09] hover:border-stone-400"
                  onClick={() => set("examples", [...d.examples, { url: "", caption: "" }])}
                >
                  + Add images or videos
                </button>
              </div>
            </Row>
            <Row n={11} label="What happens next" hint="Shown as a timeline on the page, then your note.">
              <div className="mb-2 grid gap-1.5">
                {d.timeline.map((st, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D73F09]/10 text-[11px] font-bold text-[#D73F09]">{i + 1}</span>
                    <input
                      className={input}
                      value={st.label}
                      aria-label={`Step ${i + 1}`}
                      placeholder="Step"
                      onChange={(e) => set("timeline", d.timeline.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    />
                    <input
                      className={input + " max-w-[140px]"}
                      value={st.date}
                      aria-label={`Step ${i + 1} date`}
                      placeholder="by Nov 15"
                      onChange={(e) => set("timeline", d.timeline.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                    />
                    <button type="button" aria-label="Remove step" className={small} onClick={() => set("timeline", d.timeline.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <button type="button" className="justify-self-start text-[13px] font-medium text-[#D73F09] hover:underline" onClick={() => set("timeline", [...d.timeline, { label: "", date: "" }])}>
                  + Add step
                </button>
              </div>
              <textarea className={input} rows={2} value={d.next_steps} onChange={(e) => set("next_steps", e.target.value)} placeholder="Selected athletes get a notification in the app, sign the contract, and receive product within a week." />
            </Row>
            <Row n={12} label="Tags">
              <div id="tags" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TagBox label="Instagram hashtags" values={d.ig_hashtags} placeholder="Add hashtag…" onChange={(v) => set("ig_hashtags", v)} />
                <TagBox label="Instagram mentions" values={d.ig_mentions} placeholder="Add mention…" onChange={(v) => set("ig_mentions", v)} />
                <TagBox label="TikTok hashtags" values={d.tiktok_hashtags} placeholder="Add hashtag…" onChange={(v) => set("tiktok_hashtags", v)} />
                <TagBox label="TikTok mentions" values={d.tiktok_mentions} placeholder="Add mention…" onChange={(v) => set("tiktok_mentions", v)} />
              </div>
            </Row>
            <Row n={13} label="Who's eligible" hint="Write it the way athletes should read it. Attached audiences don't fill this in yet.">
              <label className="mb-2 flex items-center gap-2 text-[13px] text-stone-700">
                <input type="checkbox" checked={d.eligibility.show} onChange={(e) => set("eligibility", { ...d.eligibility, show: e.target.checked })} className="h-4 w-4 accent-[#D73F09]" />
                Show on the page
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    ["who", "Who", "College athletes"],
                    ["sports", "Sports", "All sports"],
                    ["colleges", "Colleges", "SEC + Power 4 schools"],
                    ["min_followers", "Follower minimum", "10,000+ followers"],
                  ] as const
                ).map(([k, label, ph]) => (
                  <label key={k} className="block text-[12px] font-medium text-stone-600">
                    {label}
                    <input className={input + " mt-1"} value={d.eligibility[k]} placeholder={ph} onChange={(e) => set("eligibility", { ...d.eligibility, [k]: e.target.value })} />
                  </label>
                ))}
              </div>
            </Row>
            <Row n={14} label="Hero video / photo" hint="Shown at the top of the page in all three views. Comes from the App card unless you set something else.">
              {appCard && !heroUrlMode ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-14 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-stone-900">
                    {isVideo(appCard.url) ? <video src={appCard.url} muted playsInline className="h-full w-full object-cover" /> : <img src={appCard.url} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] text-stone-900">{appCard.name}</b>
                    <span className="text-[12px] text-stone-500">From the App card</span>
                  </span>
                  <button type="button" className="text-[13px] font-medium text-[#D73F09] hover:underline" onClick={() => setHeroUrlMode(true)}>
                    Use a URL instead
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input className={input + " min-w-[240px] flex-1"} value={d.hero_media_url} placeholder="https://… vertical video or photo URL" onChange={(e) => set("hero_media_url", e.target.value)} />
                  {appCard && (
                    <button
                      type="button"
                      className="text-[13px] font-medium text-[#D73F09] hover:underline"
                      onClick={() => {
                        set("hero_media_url", "");
                        setHeroUrlMode(false);
                      }}
                    >
                      Use the App card
                    </button>
                  )}
                  {!appCard && <span className="text-[12px] text-stone-500">No App card for this campaign yet.</span>}
                </div>
              )}
            </Row>

            <div className="flex justify-end border-t border-stone-200 pt-3">
              <SaveButton pending={saving} />
            </div>
          </section>

          <section id="contract" className="rounded-xl border border-stone-200 bg-white px-4 py-3 md:px-5">
            <h2 className="text-[14px] font-semibold text-stone-900">Athlete contract (signed after selection)</h2>
            <div className="mb-3 text-[12px] text-stone-500">Selected athletes read and sign this in the app after they&apos;re selected. Saved with the button above.</div>
            <label className="block text-[12px] font-medium text-stone-600">
              Title (optional)
              <input name="contract_title" defaultValue={contractTitle} className={input + " mt-1"} placeholder={`e.g. ${brandName ?? "Brand"} ${campaignName} – Athlete Contract`} />
            </label>
            <label className="mt-3 block text-[12px] font-medium text-stone-600">
              Contract text
              <textarea name="contract" defaultValue={contract} rows={8} className={input + " mt-1"} placeholder="Paste the full contract text" />
            </label>
          </section>
        </div>
      </div>
    </form>
  );
}
