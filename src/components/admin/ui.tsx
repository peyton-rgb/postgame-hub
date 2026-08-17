// ============================================================
// Shared /admin primitives — page header, stat tiles, honest
// status states, completeness flags, pagination.
// Server-safe (no client hooks) so lists stay server-rendered.
// ============================================================

import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="text-2xl font-semibold text-stone-900 tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] uppercase tracking-wide text-stone-500">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Honest pending state for features waiting on an unapplied migration. */
export function PendingMigration({ migration, feature }: { migration: string; feature: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      <span className="font-medium">{feature}</span> arrives with migration{" "}
      <code className="rounded bg-amber-100 px-1">{migration}</code> — written, reviewed in the
      morning, not applied yet. No placeholder data is shown here on purpose.
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
      {message}
    </div>
  );
}

export function EmptyRows({ label }: { label: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-stone-500">{label}</div>;
}

// ------------------------------------------------------------
// Completeness flags — orange link icon = set · green check =
// done · red X = missing (CF's red N, kept for muscle memory).
// ------------------------------------------------------------

export function FlagCell({
  state,
  href,
  title,
}: {
  state: "set" | "done" | "missing";
  href?: string | null;
  title?: string;
}) {
  if (state === "missing") {
    return (
      <span title={title ?? "Missing"} className="inline-block font-semibold text-red-600">
        ✕
      </span>
    );
  }
  if (state === "done") {
    return (
      <span title={title ?? "Done"} className="inline-block font-semibold text-green-600">
        ✓
      </span>
    );
  }
  const icon = (
    <span title={title ?? "Set"} className="inline-block font-semibold text-[#D73F09]">
      ↗
    </span>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {icon}
    </a>
  ) : (
    icon
  );
}

// ------------------------------------------------------------
// Pagination — server-side, 50/page everywhere. Links preserve
// the current query string apart from `page`.
// ------------------------------------------------------------

export function Paginator({
  page,
  total,
  pageSize,
  basePath,
  params,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, page), pages);
  const first = total === 0 ? 0 : (clamped - 1) * pageSize + 1;
  const last = Math.min(clamped * pageSize, total);

  const linkTo = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3 text-[13px] text-stone-600">
      <span className="tabular-nums">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </span>
      <span className="flex items-center gap-1">
        {clamped > 1 ? (
          <Link
            href={linkTo(clamped - 1)}
            className="rounded border border-stone-300 px-2.5 py-1 hover:border-stone-400"
          >
            ← Prev
          </Link>
        ) : (
          <span className="rounded border border-stone-200 px-2.5 py-1 text-stone-300">← Prev</span>
        )}
        <span className="px-2 tabular-nums">
          {clamped} / {pages}
        </span>
        {clamped < pages ? (
          <Link
            href={linkTo(clamped + 1)}
            className="rounded border border-stone-300 px-2.5 py-1 hover:border-stone-400"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded border border-stone-200 px-2.5 py-1 text-stone-300">Next →</span>
        )}
      </span>
    </div>
  );
}

/** Masked PII display — reveal is a separate, logged, exec-gated action. */
export function Masked({ last4 }: { last4?: string | null }) {
  return <span className="font-mono text-stone-600">•••-••-{last4 ?? "••••"}</span>;
}
