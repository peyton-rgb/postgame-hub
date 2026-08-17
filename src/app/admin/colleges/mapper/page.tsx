// ============================================================
// /admin/colleges/mapper — Dedupe / alias mapper (colleges_map.cfm
// rebuilt as a search-driven workflow).
//
// Flow: search a fragment ("penn") → the page pulls unlinked
// people.college_raw values matching it (college_id IS NULL),
// dedupes them with counts → for each raw string, pick a canonical
// college → "Map" is a confirmed POST inserting into school_aliases.
//
// Honest-data note: the dedupe happens over up to 2,000 matching
// unlinked rows per search (server-side cap, stated on screen), so
// counts are exact within the sample. Attaching an alias does NOT
// backfill people.college_id — that's the separate gated job.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { mapAlias } from "../actions";

export const dynamic = "force-dynamic";

const SAMPLE_CAP = 2000;

const RESULT_NOTES: Record<string, { tone: "ok" | "warn" | "err"; text: string }> = {
  mapped: { tone: "ok", text: "Alias mapped. Future imports matching it resolve to that college." },
  "already-mapped": { tone: "warn", text: "That raw string is already mapped to a college — nothing inserted." },
  "no-college": { tone: "err", text: "Pick a college to map to — nothing inserted." },
  error: { tone: "err", text: "Insert failed — nothing was changed." },
};

export default async function AliasMapperPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const note = searchParams.result ? RESULT_NOTES[searchParams.result] : undefined;

  let groups: { raw: string; count: number; alreadyAliased: boolean }[] = [];
  let sampleHit = false;

  if (q) {
    const [{ data: rawRows, error }, { data: aliasRows }] = await Promise.all([
      supabase
        .from("people")
        .select("college_raw")
        .is("college_id", null)
        .not("college_raw", "is", null)
        .ilike("college_raw", `%${q}%`)
        .limit(SAMPLE_CAP),
      supabase.from("school_aliases").select("alias").ilike("alias", `%${q}%`),
    ]);
    if (error) {
      return (
        <div>
          <PageHeader title="Alias mapper" />
          <ErrorNote message={error.message} />
        </div>
      );
    }
    const aliasSet = new Set(
      ((aliasRows ?? []) as { alias: string }[]).map((a) => a.alias.trim().toUpperCase())
    );
    const counts = new Map<string, number>();
    for (const r of (rawRows ?? []) as { college_raw: string | null }[]) {
      const key = (r.college_raw ?? "").trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    sampleHit = (rawRows ?? []).length >= SAMPLE_CAP;
    groups = Array.from(counts.entries())
      .map(([raw, count]) => ({
        raw,
        count,
        alreadyAliased: aliasSet.has(raw.toUpperCase()),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }

  // Candidate canonical colleges for the picker (matching the search).
  const { data: candidates } = q
    ? await supabase
        .from("colleges")
        .select("id, name, state")
        .or(`name.ilike.%${q}%,short_name.ilike.%${q}%`)
        .order("name")
        .limit(100)
    : { data: [] as { id: number; name: string | null; state: string | null }[] };
  const { data: fallback } = await supabase
    .from("colleges")
    .select("id, name, state")
    .order("name")
    .limit(1200);

  const pickerOptions = ((candidates ?? []).length > 0 ? candidates! : (fallback ?? [])).map(
    (c) => ({ value: String(c.id), label: `${c.name}${c.state ? ` (${c.state})` : ""}` })
  );

  return (
    <div>
      <PageHeader
        title="Alias mapper"
        subtitle="Attach unmatched raw school strings to canonical colleges. Inserts into school_aliases only — the people.college_id backfill stays a separate, gated job."
      />

      {note && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
            (note.tone === "ok"
              ? "border-green-200 bg-green-50 text-green-900"
              : note.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-900")
          }
        >
          {note.text}
        </div>
      )}

      <form className="pb-4" action="/admin/colleges/mapper" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder='Search a school fragment, e.g. "penn" or "st johns"'
          className="w-full max-w-md rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
        />
      </form>

      {!q && (
        <p className="text-[13px] text-stone-500">
          Type a fragment above. You&apos;ll get the unlinked raw strings that match, with row
          counts, and a canonical-college picker for each.
        </p>
      )}

      {q && groups.length === 0 && (
        <p className="text-[13px] text-stone-500">
          No unlinked raw strings match &ldquo;{q}&rdquo;.
        </p>
      )}

      {sampleHit && (
        <p className="pb-3 text-[12px] text-amber-700">
          Counts computed from the first {SAMPLE_CAP.toLocaleString()} matching rows — narrow the
          search for exact counts.
        </p>
      )}

      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.raw} className="rounded-lg border border-stone-200 bg-white p-3">
            <form action={mapAlias} className="flex flex-col gap-2 md:flex-row md:items-center">
              <input type="hidden" name="alias" value={g.raw} />
              <input type="hidden" name="back" value={`/admin/colleges/mapper?q=${encodeURIComponent(q)}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-stone-900">{g.raw}</div>
                <div className="text-[12px] text-stone-500">
                  {g.count.toLocaleString()} unlinked {g.count === 1 ? "row" : "rows"}
                  {g.alreadyAliased && (
                    <span className="ml-2 text-amber-700">already has an alias entry</span>
                  )}
                </div>
              </div>
              <select
                name="college_id"
                defaultValue=""
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-[13px] md:w-72"
              >
                <option value="">Pick canonical college…</option>
                {pickerOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ConfirmSubmit
                summary={`Map "${g.raw}" as an alias of the selected college? Future imports matching this string resolve to that college. This inserts one school_aliases row and is logged.`}
                confirmLabel="Map alias"
                disabled={g.alreadyAliased}
              >
                Map
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
