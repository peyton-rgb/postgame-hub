// ============================================================
// Shared chrome for the five campaign page drafts (contract, deal,
// posting, brief, recap), to the approved prototype:
//   crumb · title + Draft/Live pill + sub · Cancel / Save draft / Publish
//   the "Draft X, filled in from this campaign" bar with source chips
//   numbered section cards · fields with a "from <source>" tag
//
// DraftForm posts the whole draft as JSON (`content`) plus the source
// list (`filled_from`) to the saveCampaignPage server action.
// ============================================================

"use client";

import Link from "next/link";
import { useState } from "react";
import type { DraftStatus, PageKind, Sources } from "@/lib/admin/campaigns/page-drafts";
import { Pill } from "../bits";

export const input =
  "w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none";

export function Spark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4 4L19 7" />
    </svg>
  );
}

/** "Draft contract, filled in from this campaign." + the source chips. */
export function DraftBar({ what, srcs, note = "Highlighted parts came from the sources on the right." }: { what: string; srcs: string[]; note?: string }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#D73F09]/30 bg-[#D73F09]/[0.06] px-3.5 py-2.5">
      <span className="grid text-[#D73F09]">
        <Spark />
      </span>
      <div className="min-w-0 flex-[1_1_260px] text-[13px]">
        <b className="text-stone-900">Draft {what}, filled in from this campaign.</b>{" "}
        <span className="text-stone-500">
          {srcs.length ? note : "Nothing on this campaign fills it in yet — every field below is empty on purpose."} Check them, then publish.
        </span>
      </div>
      {srcs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {srcs.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[12px] text-stone-800">
              <span className="text-status-ok">
                <Check />
              </span>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Numbered section card. */
export function Sec({ n, title, sub, right, children, form = true }: { n: number; title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; form?: boolean }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 md:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-stone-900">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-900 text-[11px] font-semibold text-white">{n}</span>
            {title}
          </h2>
          {sub && <div className="text-[12px] text-stone-500">{sub}</div>}
        </div>
        {right}
      </div>
      <div className={"px-4 py-3 md:px-5 " + (form ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "")}>{children}</div>
    </section>
  );
}

/** "from Opt-in page" / "added for events" tag next to a label. */
export function SrcTag({ src, sources, tone = "muted" }: { src: string; sources?: Sources; tone?: "muted" | "new" }) {
  const label = sources ? sources[src] : src;
  if (!label) return null;
  return <span className={"ml-1.5 text-[11px] font-normal " + (tone === "new" ? "text-[#D73F09]" : "text-stone-500")}>{tone === "new" ? label : `from ${label}`}</span>;
}

export function Fld({
  label,
  name,
  value,
  onChange,
  sources,
  hint,
  placeholder,
  type = "text",
  area = false,
  rows = 2,
  options,
  span2 = false,
  emptyOption = "Pick one",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  sources?: Sources;
  hint?: string;
  placeholder?: string;
  type?: "text" | "date" | "url";
  area?: boolean;
  rows?: number;
  options?: string[];
  span2?: boolean;
  emptyOption?: string;
}) {
  const id = "f-" + name;
  const from = sources?.[name];
  return (
    <div className={"min-w-0 " + (span2 ? "md:col-span-2" : "")}>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-stone-600">
        {label}
        {from && <SrcTag src={name} sources={sources} />}
      </label>
      {options ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={input}>
          <option value="">{emptyOption}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : area ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={input} />
      ) : (
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={input} />
      )}
      {hint && !value && <div className="mt-1 text-[12px] text-stone-500">{hint}</div>}
    </div>
  );
}

export const RESULT_NOTES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  saved: { tone: "ok", text: "Draft saved." },
  published: { tone: "ok", text: "Published. The page is marked live for this campaign; the app reads it from the next app release." },
  "pages-pending": { tone: "bad", text: "Saving needs migration 20261020_088 applied first. Nothing was changed." },
  error: { tone: "bad", text: "That didn't save. Nothing was changed." },
};

export function ResultNote({ result }: { result?: string }) {
  const note = result ? RESULT_NOTES[result] : undefined;
  if (!note) return null;
  return (
    <div
      className={
        "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
        (note.tone === "ok" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-status-bad")
      }
    >
      {note.text}
    </div>
  );
}

export interface DraftFormProps {
  campaignId: number;
  campaignName: string;
  kind: PageKind;
  title: string;
  sub: string;
  status: DraftStatus;
  exists: boolean;
  /** migration 088 missing: show the drafts, explain that saving waits */
  pending: boolean;
  variant?: string;
  content: unknown;
  filledFrom: string[];
  action: (formData: FormData) => Promise<void> | void;
  publishLabel?: string;
  /** extra buttons between Cancel and Save */
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}

export function DraftForm({
  campaignId,
  campaignName,
  kind,
  title,
  sub,
  status,
  exists,
  pending,
  variant,
  content,
  filledFrom,
  action,
  publishLabel = "Publish",
  extraActions,
  children,
}: DraftFormProps) {
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const back = `/admin/campaigns/${campaignId}`;
  const btn = "rounded-md px-3 py-1.5 text-[13px] font-medium disabled:opacity-50 ";
  return (
    <form action={action} onSubmit={() => setBusy((b) => b ?? "save")}>
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="kind" value={kind} />
      {variant !== undefined && <input type="hidden" name="variant" value={variant} />}
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      <input type="hidden" name="filled_from" value={JSON.stringify(filledFrom)} />

      <div className="pb-1.5 text-[12px] text-stone-500">
        <Link href="/admin/campaigns" className="hover:underline">
          Campaigns
        </Link>{" "}
        /{" "}
        <Link href={back} className="hover:underline">
          {campaignName}
        </Link>{" "}
        / {title}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
            {status === "live" ? <Pill tone="ok">Live</Pill> : <Pill tone="warn">{exists ? "Draft" : "Draft · not saved yet"}</Pill>}
          </div>
          <div className="mt-0.5 text-[13px] text-stone-500">{sub}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={back} className={btn + "text-stone-700 hover:bg-stone-100"}>
            Cancel
          </Link>
          {extraActions}
          <button type="submit" name="intent" value="save" disabled={busy !== null || pending} onClick={() => setBusy("save")} className={btn + "border border-stone-300 bg-white text-stone-700 hover:border-stone-400"}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button type="submit" name="intent" value="publish" disabled={busy !== null || pending} onClick={() => setBusy("publish")} className={btn + "bg-[#D73F09] text-white hover:bg-[#B33407]"}>
            {busy === "publish" ? "Publishing…" : publishLabel}
          </button>
        </div>
      </div>

      {pending && (
        <div className="mb-3.5 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-[13px] text-stone-600">
          This draft is filled in from the campaign, but saving it needs migration <span className="font-mono">20261020_088_campaign_pages</span> applied first.
        </div>
      )}

      {children}
    </form>
  );
}
