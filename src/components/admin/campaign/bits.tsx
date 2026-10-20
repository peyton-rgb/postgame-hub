// ============================================================
// Small server-safe pieces shared by the campaign screens: status
// pill, card shell, section heading, "who" cell with avatar, and the
// row layout used by the Playbook / Setup lists.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { PersonLite } from "@/lib/admin/campaigns/types";
import { personName } from "@/lib/admin/campaigns/types";

export type Tone = "ok" | "warn" | "bad" | "info" | "acc" | "muted";

const TONES: Record<Tone, string> = {
  ok: "bg-status-ok/10 text-status-ok",
  warn: "bg-status-warn/10 text-status-warn",
  bad: "bg-status-bad/10 text-status-bad",
  info: "bg-stone-100 text-stone-700",
  acc: "bg-[#D73F09]/10 text-[#D73F09]",
  muted: "bg-stone-100 text-stone-500",
};

export function Pill({ tone = "muted", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium " +
        TONES[tone]
      }
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  sub,
  actions,
  children,
  className = "",
  pad = true,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={"min-w-0 rounded-xl border border-stone-200 bg-white " + className}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 md:px-5">
          <div>
            {title && <h2 className="text-[14px] font-semibold text-stone-900">{title}</h2>}
            {sub && <div className="text-[12px] text-stone-500">{sub}</div>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={pad ? "px-4 py-3 md:px-5" : ""}>{children}</div>
    </section>
  );
}

/** The small uppercase group heading inside a card ("Google files", "Athlete pages"). */
export function GroupHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
      <span>{children}</span>
      {right && <span className="font-normal normal-case tracking-normal">{right}</span>}
    </div>
  );
}

/** One row in a Playbook / Setup list: optional icon, label, right-side action. */
export function ListRow({
  icon,
  label,
  right,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-stone-100 py-2.5 text-[13px] first:border-t-0">
      {icon && <span className="inline-grid w-[18px] shrink-0 place-items-center text-stone-500">{icon}</span>}
      <span className="min-w-0 flex-1 text-stone-900">{label}</span>
      {right && <span className="flex shrink-0 items-center gap-3">{right}</span>}
    </div>
  );
}

export function TextLink({
  href,
  children,
  external = false,
  muted = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  muted?: boolean;
}) {
  const cls = "text-[13px] font-medium hover:underline " + (muted ? "text-stone-500" : "text-[#D73F09]");
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Btn({
  href,
  children,
  primary = false,
  small = false,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  small?: boolean;
  external?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-md font-medium " +
    (small ? "px-2.5 py-1 text-[12px] " : "px-3 py-1.5 text-[13px] ") +
    (primary
      ? "bg-[#D73F09] text-white hover:bg-[#B33407]"
      : "border border-stone-300 bg-white text-stone-700 hover:border-stone-400");
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

function initials(name: string | null): string {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

/** Avatar + name + handle, the "who" cell used in every athlete table. */
export function WhoCell({ person, handle }: { person: PersonLite | null; handle?: string | null }) {
  const name = personName(person) ?? handle ?? "Unknown athlete";
  const ig = person?.instagram_handle ?? handle ?? null;
  const pic = person?.profilepicurl ?? null;
  return (
    <div className="flex items-center gap-2.5">
      {pic ? (
        <img src={pic} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-stone-200 text-[11px] font-semibold text-stone-600">
          {initials(name)}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate font-medium text-stone-900">{name}</div>
        {ig && <div className="truncate text-[12px] text-stone-500">@{ig.replace(/^@/, "")}</div>}
      </div>
    </div>
  );
}

export function fmtNum(n: number | null | undefined): string {
  return n == null ? "—" : Number(n).toLocaleString("en-US");
}

export function fmtMoney(n: number | null | undefined): string {
  return n == null ? "—" : Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function fmtShortDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtLongDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Inline SVG icons used on the Setup card (stroke icons, 15px). */
export function Ico({ name }: { name: "up" | "folder" | "check" | "image" | "at" | "link" | "drive" | "lucid" | "sheet" | "doc" }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "up":
      return <svg {...common}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
    case "folder":
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>;
    case "check":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></svg>;
    case "image":
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-8 8" /></svg>;
    case "at":
      return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" /></svg>;
    case "link":
      return <svg {...common}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>;
    case "drive":
      return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8.5 3h7l6 10.5-3.5 6h-12L2.5 13.5 8.5 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M2.5 13.5h19M8.5 3l6 10.5M15.5 3l-6 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
    case "lucid":
      return <svg {...common}><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3z" /><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" /></svg>;
    case "sheet":
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 9v12" /></svg>;
    case "doc":
      return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" /><path d="M14 3v6h6M8 13h8M8 17h8" /></svg>;
  }
}
