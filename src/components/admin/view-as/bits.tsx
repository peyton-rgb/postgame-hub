// ============================================================
// Small server-safe pieces for the View-as preview screens: the page
// header (prototype `ph`), a key/value list (`.kv`), the "preview"
// note shown above every brand/athlete screen, and the athlete-app
// phone stage (`athPhone`: phone frame + a "What this is" card).
// ============================================================

import Link from "next/link";
import { IPhoneFrame } from "@/components/admin/campaign/OptinPreview";

export function PreviewHead({
  title,
  sub,
  actions,
  crumb,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  crumb?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-4">
      {crumb && crumb.length > 0 && (
        <div className="mb-1 text-[12px] text-stone-500">
          {crumb.map((c, i) => (
            <span key={c.href}>
              {i > 0 && " › "}
              <Link href={c.href} className="hover:text-stone-900 hover:underline">
                {c.label}
              </Link>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
          {sub && <p className="mt-0.5 text-[13px] text-stone-500">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="grid gap-2.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <span className="shrink-0 text-stone-500">{k}</span>
          <span className="min-w-0 text-right text-stone-900">{v}</span>
        </div>
      ))}
    </div>
  );
}

/** A dim, honest footnote line under a card or section. */
export function Foot({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-stone-200 px-4 py-2.5 text-[12px] text-stone-500">{children}</div>;
}

/** Disabled action button — previews never write (see src/lib/portal/preview.ts on actor attribution). */
export function PreviewBtn({ children, primary = false, full = false }: { children: React.ReactNode; primary?: boolean; full?: boolean }) {
  return (
    <button
      type="button"
      disabled
      title="Preview only: actions are off while viewing as someone else"
      className={
        "inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium opacity-70 " +
        (full ? "w-full py-2.5 " : "") +
        (primary ? "bg-[#D73F09] text-white" : "border border-stone-300 bg-white text-stone-700")
      }
    >
      {children}
    </button>
  );
}

/** The athlete screens: the app in a phone on the left, a short explanation on the right. */
export function AthPhone({ children, note }: { children: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[410px_minmax(0,1fr)]">
      <div className="flex justify-center overflow-x-hidden py-2">
        <IPhoneFrame>{children}</IPhoneFrame>
      </div>
      <section className="min-w-0 rounded-xl border border-stone-200 bg-white px-4 py-3.5">
        <b className="text-[14px] text-stone-900">What this is</b>
        <div className="mt-1.5 text-[13px] leading-relaxed text-stone-500">{note}</div>
      </section>
    </div>
  );
}

/* ---------- athlete-app inner pieces (dark app styling) ---------- */

export function ApTop({ title, logo }: { title: string; logo: string | null }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt="Postgame" className="h-4 w-auto object-contain" /> : <span className="h-4" />}
        <span className="text-[10px] font-bold text-[#DF4A06]">●</span>
      </div>
      <div className="px-4 pb-3 pt-1 font-['Poppins',sans-serif] text-[20px] font-extrabold text-white">{title}</div>
    </>
  );
}

export function ApList({ rows, empty }: { rows: [React.ReactNode, React.ReactNode, React.ReactNode?][]; empty?: string }) {
  if (!rows.length) return <div className="px-4 py-10 text-center text-[13px] text-[#AAAAB0]">{empty ?? "Nothing here yet."}</div>;
  return (
    <div>
      {rows.map(([t, s, r], i) => (
        <div key={i} className="flex items-center gap-2.5 border-b border-[#1B1B21] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-white">{t}</div>
            <div className="truncate text-[12px] text-[#AAAAB0]">{s}</div>
          </div>
          <span className="shrink-0 text-[12px] text-[#AAAAB0]">{r}</span>
        </div>
      ))}
    </div>
  );
}

export function ApTabs({ on }: { on: "Home" | "Campaigns" | "My deals" | "Profile" }) {
  return (
    <div className="sticky bottom-0 mt-auto flex justify-around border-t border-[#303036] bg-[#0C0C10] px-2 py-3 pb-6 text-[10px] font-semibold text-[#6B6B73]">
      {(["Home", "Campaigns", "My deals", "Profile"] as const).map((t) => (
        <span key={t} className={t === on ? "text-[#DF4A06]" : ""}>
          {t}
        </span>
      ))}
    </div>
  );
}

export function ApScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-col bg-[#0C0C10] font-sans text-white">{children}</div>;
}
