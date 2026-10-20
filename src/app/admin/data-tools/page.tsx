// ============================================================
// /admin/data-tools — Data tools (prototype S["data-tools"]):
// the roster import on top, the clean-up tools below.
//
// The import card hands off to the existing roster import wizard
// (/admin/profiles/upload — live CSV preview, apply step still off).
// Clean-up tools that are not built yet say so instead of pretending.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/ui";
import { Pill } from "@/components/admin/campaign/bits";
import { btnCls, btnDisabledCls } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

const TOOLS: { t: string; d: string; b: string; href?: string }[] = [
  { t: "Shared Instagram handles", d: "Users or profiles using the same handle.", b: "Find" },
  { t: "Clean up handles", d: "Strip @, spaces and URLs from handles.", b: "Run" },
  { t: "Link profiles to users", d: "Match profiles to the athlete who owns them.", b: "Find matches" },
  { t: "Merge duplicate profiles", d: "Repoint everything to one profile, archive the other.", b: "Review" },
  { t: "Merge duplicate users", d: "Move opt-ins, invoices and profiles to one user.", b: "Review" },
  { t: "Instagram updates per month", d: "How many profiles were refreshed each month.", b: "View chart", href: "/admin/instagram?tab=history" },
];

export default async function DataToolsPage() {
  await requireAdmin("staff");

  return (
    <div>
      <PageHeader title="Data tools" subtitle="Import rosters and clean up duplicate or messy records." />

      <section className="min-w-0 rounded-xl border border-stone-200 bg-white px-4 py-4 md:px-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {["1 Upload CSV", "2 Match columns", "3 Review", "4 Import"].map((s, i) => (
            <Pill key={s} tone={i === 0 ? "acc" : "muted"}>
              {s}
            </Pill>
          ))}
        </div>
        <Link
          href="/admin/profiles/upload"
          className="block rounded-lg border-2 border-dashed border-stone-300 px-4 py-10 text-center text-[13px] text-stone-600 hover:border-stone-400"
        >
          <svg className="mx-auto mb-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
          Import a team roster: open the import wizard and drop a roster CSV
          <div className="mt-1.5 text-[12px] text-stone-500">Needs at least a name and Instagram handle column.</div>
        </Link>
        <p className="mt-3 text-[12px] text-stone-500">
          The wizard previews the file in your browser. Writing the rows into the people list is switched off until it has
          been reviewed, so nothing is changed by trying it.
        </p>
      </section>

      <h2 className="mb-2.5 mt-6 text-[14px] font-semibold text-stone-900">Clean-up tools</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((x) => (
          <section key={x.t} className="rounded-xl border border-stone-200 bg-white px-4 py-4">
            <div className="text-[14px] font-semibold text-stone-900">{x.t}</div>
            <p className="mb-3 mt-1 text-[13px] text-stone-500">{x.d}</p>
            {x.href ? (
              <Link href={x.href} className={btnCls}>
                {x.b}
              </Link>
            ) : (
              <span className={btnDisabledCls} title="Not built yet">
                {x.b} · not built yet
              </span>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
