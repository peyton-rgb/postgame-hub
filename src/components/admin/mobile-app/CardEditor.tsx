// ============================================================
// Card editor — the prototype's card-edit screen: type segment, brand
// + campaign, internal name, content overlay (eyebrow, brand logo,
// details), media, visibility, link/destination, schedule, with the
// live preview at the card's own aspect on the right and Export SVG.
//
// One form; the whole draft travels as JSON in a hidden field to
// saveCard. Save Draft / Publish set `intent`. The Live / Off switch is
// its own small form (setCardStatus) so flipping a card off doesn't
// have to re-save every field.
// ============================================================

"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CARD_SPEC,
  CARD_TYPES,
  DEFAULT_BG,
  emptyDraft,
  isVideoUrl,
  type CardDraft,
  type CardStatus,
  type CardType,
  type EditorOptions,
} from "@/lib/admin/mobile-app/cards";
import { brandLogo } from "@/lib/admin/campaigns/queries";
import { buildCardSvg, svgFileName } from "@/lib/admin/mobile-app/card-svg";
import CardArt from "./CardArt";
import { Pill } from "@/components/admin/campaign/bits";

const input = "w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900 disabled:bg-stone-50 disabled:text-stone-500";
const btn = "inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400 disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407] disabled:opacity-50";

function SecH({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-[18px] flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-stone-500 first:mt-0">
      <span>{children}</span>
      {right}
    </div>
  );
}

function Box({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={"rounded-[10px] border border-stone-200 bg-white " + className}>{children}</div>;
}

function Radio({ name, value, current, onChange, children }: { name: string; value: string; current: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const on = value === current;
  return (
    <label className={"flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[14px] " + (on ? "border-stone-400 bg-stone-50" : "border-stone-200")}>
      <input type="radio" name={name} value={value} checked={on} onChange={() => onChange(value)} className="accent-[#D73F09]" />
      {children}
    </label>
  );
}

function TagBox({ label, values, placeholder, onChange }: { label: string; values: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/,$/, "");
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

type LinkMode = "none" | "external" | "campaign" | "app";

function linkModeOf(d: CardDraft): LinkMode {
  if (!d.cta_href) return "none";
  if (d.campaign_id && d.cta_href === `/join/${d.campaign_id}`) return "campaign";
  if (d.cta_href.startsWith("/")) return "app";
  return "external";
}

export default function CardEditor({
  id,
  initial,
  savedStatus,
  updatedAt,
  options,
  action,
  statusAction,
}: {
  id: string | null;
  initial: CardDraft;
  savedStatus: CardStatus | null;
  updatedAt: string | null;
  options: EditorOptions;
  action: (formData: FormData) => Promise<void> | void;
  statusAction: (formData: FormData) => Promise<void> | void;
}) {
  const [d, setD] = useState<CardDraft>(initial);
  const [linkMode, setLinkMode] = useState<LinkMode>(() => linkModeOf(initial));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof CardDraft>(k: K, v: CardDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const isNew = !id;
  const live = savedStatus === "live";
  const spec = CARD_SPEC[d.card_type];
  const brand = useMemo(() => options.brands.find((b) => b.id === d.brand_id) ?? null, [options.brands, d.brand_id]);
  const brandLogoUrl = brandLogo(brand, "dark");
  const campaigns = useMemo(
    () => (d.brand_id ? options.campaigns.filter((c) => c.brand_id === d.brand_id) : []),
    [options.campaigns, d.brand_id]
  );
  const campaign = campaigns.find((c) => c.campaign_id === d.campaign_id) ?? null;

  const changeType = (t: CardType) => {
    const fresh = emptyDraft(t);
    setD((prev) => ({
      ...prev,
      card_type: t,
      eyebrow: prev.eyebrow === CARD_SPEC[prev.card_type].defaultEyebrow || !prev.eyebrow ? fresh.eyebrow : prev.eyebrow,
      cta_label: prev.cta_label === CARD_SPEC[prev.card_type].defaultCta || !prev.cta_label ? fresh.cta_label : prev.cta_label,
      campaign_id: t === "optin" ? prev.campaign_id : null,
      name: prev.name || (t === "coming_soon" ? "Coming Soon" : ""),
    }));
  };

  const changeLink = (mode: LinkMode) => {
    setLinkMode(mode);
    if (mode === "none") set("cta_href", "");
    else if (mode === "campaign") set("cta_href", d.campaign_id ? `/join/${d.campaign_id}` : "");
    else if (mode === "app" && !d.cta_href.startsWith("/")) set("cta_href", "/");
    else if (mode === "external" && d.cta_href.startsWith("/")) set("cta_href", "");
  };

  const exportSvg = () => {
    const svg = buildCardSvg(d, brandLogoUrl);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = svgFileName(d);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const detailsLabel = d.card_type === "optin" ? "Details" : "Subline";
  const detailsMax = d.card_type === "optin" ? 32 : 26;
  const sizeLabel = `${spec.width}×${spec.height}`;

  const preview = (
    <CardArt
      type={d.card_type}
      bgColor={d.bg_color || DEFAULT_BG}
      mediaUrl={d.media_url || null}
      posterUrl={d.poster_url || null}
      eyebrow={d.eyebrow || null}
      headline={d.headline || null}
      ctaLabel={d.card_type === "optin" ? d.cta_label || null : null}
      brandLogoUrl={brandLogoUrl}
      brandName={brand?.name ?? null}
      stripText={d.card_type === "strip_banner" ? d.headline || d.name || null : null}
      placeholders
      style={d.card_type === "strip_banner" ? { width: "100%" } : { width: "min(340px, 100%)" }}
    />
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-stone-900">{isNew ? "New Card" : d.name || "Untitled card"}</h1>
          <div className="mt-1 text-[13px] text-stone-500">
            {isNew ? "Design a card for the mobile app and Instagram" : `Status: ${savedStatus ?? "draft"}${updatedAt ? ` · updated ${new Date(updatedAt).toLocaleString("en-US")}` : ""}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/mobile-app/cards" className="rounded-md px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-100">
            ← Back
          </Link>
          {!isNew && (
            <form action={statusAction} className="inline-flex">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={live ? "draft" : "live"} />
              <button
                type="submit"
                title={live ? "Switch this card off (back to draft)" : "Switch this card live as last saved"}
                className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-700 hover:border-stone-400"
              >
                <span className={"relative inline-block h-[18px] w-[32px] rounded-full transition " + (live ? "bg-[#D73F09]" : "bg-stone-300")}>
                  <span className={"absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition " + (live ? "left-[16px]" : "left-[2px]")} />
                </span>
                {live ? "Live" : "Off"}
              </button>
            </form>
          )}
          <button type="button" className={btn} onClick={exportSvg}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v12M6 11l6 6 6-6M5 20h14" /></svg>
            Export SVG
          </button>
          <button type="submit" form="card-form" name="intent" value="draft" disabled={saving} className={btn}>
            Save Draft
          </button>
          <button type="submit" form="card-form" name="intent" value="publish" disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : live ? "Update Live" : "Publish"}
          </button>
        </div>
      </div>

      <form id="card-form" action={action} onSubmit={() => setSaving(true)}>
        {id && <input type="hidden" name="id" value={id} />}
        <input type="hidden" name="data" value={JSON.stringify(d)} />
      </form>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---------- Left: the fields ---------- */}
        <div className="min-w-0">
          <SecH>Card type</SecH>
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 p-0.5">
            {CARD_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={d.card_type === t}
                onClick={() => changeType(t)}
                className={"rounded-md px-2 py-2 text-center text-[13px] font-medium " + (d.card_type === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")}
              >
                {CARD_SPEC[t].label}
              </button>
            ))}
          </div>

          <div className="mt-[14px] grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className={"block text-[12px] font-medium text-stone-600 " + (d.card_type === "optin" ? "" : "md:col-span-2")}>
              Brand
              <select
                value={d.brand_id ?? ""}
                onChange={(e) => {
                  set("brand_id", e.target.value || null);
                  set("campaign_id", null);
                  if (linkMode === "campaign") set("cta_href", "");
                }}
                className={input + " mt-1"}
              >
                <option value="">Select a brand</option>
                {options.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? "Unnamed brand"}
                  </option>
                ))}
              </select>
            </label>
            {d.card_type === "optin" && (
              <label className="block text-[12px] font-medium text-stone-600">
                Campaign
                <select
                  value={d.campaign_id ?? ""}
                  disabled={!d.brand_id || options.campaignsPending}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    set("campaign_id", v);
                    if (linkMode === "campaign") set("cta_href", v ? `/join/${v}` : "");
                  }}
                  className={input + " mt-1"}
                >
                  <option value="">
                    {options.campaignsPending ? "Campaigns table not migrated yet (083)" : !d.brand_id ? "Choose a brand first" : campaigns.length === 0 ? "No campaigns for this brand" : "Select a campaign"}
                  </option>
                  {campaigns.map((c) => (
                    <option key={c.campaign_id} value={c.campaign_id}>
                      {c.campaign_name ?? `Campaign ${c.campaign_id}`}
                      {c.is_active === false ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <SecH>Card name (internal)</SecH>
          <input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Brand — Campaign — Card type" className={input} />

          {d.card_type !== "strip_banner" && (
            <>
              <SecH right={<span className="font-normal normal-case tracking-normal text-stone-500">Shown on the card</span>}>Content overlay</SecH>
              <Box>
                <div className="border-b border-stone-200 px-4 py-3">
                  <label className="block text-[12px] font-medium text-stone-600">
                    Eyebrow
                    <input value={d.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} maxLength={60} className={input + " mt-1 font-semibold uppercase tracking-wider"} />
                  </label>
                  <div className="mt-1 text-[12px] text-stone-500">Added automatically — {spec.defaultEyebrow} unless you change it.</div>
                </div>
                <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
                  <span className="grid h-[44px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-md bg-stone-900 p-1.5">
                    {brandLogoUrl ? (
                      <img src={brandLogoUrl} alt={brand?.name ? `${brand.name} logo` : ""} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-8 8" /></svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] text-stone-900">{brand?.name ?? "Choose a brand"}</b>
                    <div className="text-[12px] text-stone-500">
                      {brand && !brandLogoUrl ? "This brand has no light-ink logo on file — add one on the brand page." : "The brand's light-ink logo from its brand page. Never typed."}
                    </div>
                  </div>
                  {brand && (
                    <Link href={`/admin/brands/${brand.id}`} className={btn}>
                      Brand page
                    </Link>
                  )}
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="card-headline" className="text-[13px] font-semibold text-stone-900">
                      {detailsLabel}
                    </label>
                    <span className={"text-[12px] " + (d.headline.length > detailsMax ? "text-status-warn" : "text-stone-500")}>
                      {d.headline.length} / {detailsMax} characters recommended
                    </span>
                  </div>
                  <input
                    id="card-headline"
                    value={d.headline}
                    onChange={(e) => set("headline", e.target.value)}
                    placeholder={d.card_type === "optin" ? "SHOES + APPAREL + CASH" : "Open to all athletes."}
                    maxLength={200}
                    className={input + " mt-1.5"}
                  />
                </div>
              </Box>
            </>
          )}

          <SecH>Media</SecH>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
            <label className="block text-[12px] font-medium text-stone-600">
              {d.card_type === "strip_banner" ? "Banner image URL" : "Video or photo URL"}
              <input value={d.media_url} onChange={(e) => set("media_url", e.target.value)} placeholder="https://…" inputMode="url" className={input + " mt-1"} />
            </label>
            <label className="block text-[12px] font-medium text-stone-600">
              Background colour
              <span className="mt-1 flex items-center gap-2">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(d.bg_color) ? d.bg_color : DEFAULT_BG} onChange={(e) => set("bg_color", e.target.value.toUpperCase())} aria-label="Background colour" className="h-[34px] w-[44px] cursor-pointer rounded-md border border-stone-300 bg-white p-0.5" />
                <input value={d.bg_color} onChange={(e) => set("bg_color", e.target.value)} placeholder={DEFAULT_BG} maxLength={7} className={input + " font-mono uppercase"} />
              </span>
            </label>
          </div>
          {isVideoUrl(d.media_url) && (
            <label className="mt-3 block text-[12px] font-medium text-stone-600">
              Poster still (for video) — used for the SVG export and while the video loads
              <input value={d.poster_url} onChange={(e) => set("poster_url", e.target.value)} placeholder="https://…jpg" inputMode="url" className={input + " mt-1"} />
            </label>
          )}
          <div className="mt-1.5 text-[12px] text-stone-500">{spec.mediaHint} Upload arrives with the storage step — paste a public URL for now.</div>
          {d.card_type === "strip_banner" && (
            <label className="mt-3 block text-[12px] font-medium text-stone-600">
              Banner text
              <input value={d.headline} onChange={(e) => set("headline", e.target.value)} placeholder={d.name || "What the banner says"} maxLength={200} className={input + " mt-1"} />
            </label>
          )}

          <Box className="mt-[18px] px-4 py-3.5">
            <SecH>Visibility</SecH>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Radio name="vis" value="everyone" current={d.visibility} onChange={(v) => set("visibility", v as "everyone" | "whitelist")}>
                Everyone
              </Radio>
              <Radio name="vis" value="whitelist" current={d.visibility} onChange={(v) => set("visibility", v as "everyone" | "whitelist")}>
                Whitelist only
              </Radio>
            </div>
            {d.visibility === "whitelist" && (
              <div className="mt-3 grid grid-cols-1 gap-3">
                <label className="block text-[12px] font-medium text-stone-600">
                  Audience
                  <select value={d.audience_id ?? ""} onChange={(e) => set("audience_id", e.target.value || null)} disabled={options.audiencesPending} className={input + " mt-1"}>
                    <option value="">{options.audiencesPending ? "Audiences table not migrated yet (083)" : options.audiences.length === 0 ? "No saved audiences yet" : "No audience"}</option>
                    {options.audiences.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <TagBox label="Colleges" values={d.whitelist.colleges} placeholder="Type a college, Enter" onChange={(v) => set("whitelist", { ...d.whitelist, colleges: v })} />
                <TagBox label="Sports" values={d.whitelist.sports} placeholder="Type a sport, Enter" onChange={(v) => set("whitelist", { ...d.whitelist, sports: v })} />
                <TagBox label="Instagram handles" values={d.whitelist.handles} placeholder="@handle, Enter" onChange={(v) => set("whitelist", { ...d.whitelist, handles: v.map((h) => h.replace(/^@/, "").toLowerCase()) })} />
              </div>
            )}
            <div className="mt-2.5 text-[12px] text-stone-500">
              User sees this card if they match any selected audience, college, sport, or handle. Leave everything empty to show to everyone.
            </div>
          </Box>

          <Box className="mt-[14px] px-4 py-3.5">
            <SecH>Link / destination</SecH>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Radio name="lnk" value="none" current={linkMode} onChange={(v) => changeLink(v as LinkMode)}>
                No link
              </Radio>
              <Radio name="lnk" value="external" current={linkMode} onChange={(v) => changeLink(v as LinkMode)}>
                External URL
              </Radio>
              <Radio name="lnk" value="campaign" current={linkMode} onChange={(v) => changeLink(v as LinkMode)}>
                Campaign Opt-In
              </Radio>
              <Radio name="lnk" value="app" current={linkMode} onChange={(v) => changeLink(v as LinkMode)}>
                App Page
              </Radio>
            </div>
            {linkMode === "external" && (
              <input value={d.cta_href} onChange={(e) => set("cta_href", e.target.value)} placeholder="https://…" inputMode="url" className={input + " mt-3"} />
            )}
            {linkMode === "app" && (
              <input value={d.cta_href} onChange={(e) => set("cta_href", e.target.value)} placeholder="/deals" className={input + " mt-3 font-mono"} />
            )}
            {linkMode === "campaign" && (
              <div className="mt-3 text-[13px] text-stone-900">
                {d.card_type !== "optin" ? (
                  <span className="text-stone-500">Campaign links are for Opt-In cards — switch the card type above.</span>
                ) : campaign ? (
                  <>
                    Opens the opt-in for {campaign.campaign_name ?? `campaign ${campaign.campaign_id}`}, the campaign selected above.{" "}
                    <Link href={`/admin/campaigns/${campaign.campaign_id}/page`} className="text-[12px] font-medium text-[#D73F09] hover:underline">
                      Edit opt-in page →
                    </Link>
                  </>
                ) : (
                  <span className="text-stone-500">Pick a brand and campaign above first.</span>
                )}
              </div>
            )}
            {d.card_type === "optin" && (
              <label className="mt-3 block text-[12px] font-medium text-stone-600">
                Button label
                <input value={d.cta_label} onChange={(e) => set("cta_label", e.target.value)} placeholder="OPT IN" maxLength={40} className={input + " mt-1 uppercase"} />
              </label>
            )}
            <div className="mt-2 text-[12px] text-stone-500">Where the CTA button takes the user when tapped in the mobile app.</div>
          </Box>

          <Box className="mt-[14px] px-4 py-3.5">
            <SecH>Schedule</SecH>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-stone-600">
                Show from
                <input type="datetime-local" value={d.schedule_start} onChange={(e) => set("schedule_start", e.target.value)} className={input + " mt-1"} />
              </label>
              <label className="block text-[12px] font-medium text-stone-600">
                Hide after
                <input type="datetime-local" value={d.schedule_end} onChange={(e) => set("schedule_end", e.target.value)} className={input + " mt-1"} />
              </label>
            </div>
            <div className="mt-2 text-[12px] text-stone-500">Optional. Outside this window a live card stays live but doesn&rsquo;t show in the feed.</div>
          </Box>

          {!isNew && (
            <div className="mt-[14px] flex items-center gap-2 text-[12px] text-stone-500">
              <Pill tone={live ? "ok" : savedStatus === "archived" ? "muted" : "warn"}>{savedStatus ?? "draft"}</Pill>
              Saving with Publish sets the card live; Save Draft takes it off the feed.
            </div>
          )}
        </div>

        {/* ---------- Right: preview ---------- */}
        <aside className="min-w-0 lg:sticky lg:top-4">
          <SecH>Preview · {sizeLabel}</SecH>
          <div className="grid place-items-center rounded-[10px] border border-stone-200 bg-white p-4 md:p-6">{preview}</div>
          <div className="mt-2 text-[12px] text-stone-500">Exports as a vector SVG at full resolution ({sizeLabel}).</div>
        </aside>
      </div>
    </div>
  );
}
