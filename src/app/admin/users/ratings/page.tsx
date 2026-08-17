// ============================================================
// /admin/users/ratings — Ratings bulk-assign (ratings.cfm absorbed
// as a registry bulk action). Paste handles → live preview of who
// matched → confirmed POST applies the rating to matched people.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { parseHandles } from "@/lib/admin/handles";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { bulkAssignRatings } from "./actions";

export const dynamic = "force-dynamic";

export default async function RatingsBulkPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const handlesRaw = searchParams.handles ?? "";
  const rating = (searchParams.rating ?? "A").toUpperCase();
  const handles = parseHandles(handlesRaw);
  const result = searchParams.result;

  // Preview resolution (read-only) when handles are present in the URL.
  let matched: { id: string; instagram_handle: string | null; first_name: string | null; last_name: string | null }[] = [];
  if (handles.length > 0) {
    for (let i = 0; i < handles.length; i += 100) {
      const { data } = await supabase
        .from("people")
        .select("id, instagram_handle, first_name, last_name")
        .in("instagram_handle", handles.slice(i, i + 100));
      matched.push(...((data ?? []) as typeof matched));
    }
  }
  const matchedSet = new Set(matched.map((m) => (m.instagram_handle ?? "").toLowerCase()));
  const unmatched = handles.filter((h) => !matchedSet.has(h));

  return (
    <div>
      <PageHeader
        title="Ratings — bulk assign"
        subtitle="Paste IG handles, preview the matches, then apply a rating to everyone matched (max 500 per batch)"
      />

      {result === "applied" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Applied — {searchParams.matched ?? "?"} of {searchParams.submitted ?? "?"} handles
          matched and were rated. Logged to the audit trail.
        </div>
      )}
      {result === "bad-rating" && <ErrorNote message="Pick a rating A–F. Nothing was changed." />}
      {result === "no-handles" && <ErrorNote message="Paste at least one handle. Nothing was changed." />}
      {result === "no-matches" && (
        <ErrorNote message="None of those handles matched a person. Nothing was changed." />
      )}
      {result === "error" && <ErrorNote message="Update failed — nothing was changed." />}

      {/* Step 1: preview (GET — read-only) */}
      <form action="/admin/users/ratings" method="GET" className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <label className="block text-[12px] font-medium text-stone-600">
          IG handles (spaces, commas, or one per line)
          <textarea
            name="handles"
            defaultValue={handlesRaw}
            rows={5}
            className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] font-mono"
          />
        </label>
        <div className="mt-3 flex items-end gap-3">
          <label className="block text-[12px] font-medium text-stone-600">
            Rating
            <select
              name="rating"
              defaultValue={rating}
              className="mt-1 block rounded-md border border-stone-300 bg-white px-2 py-1.5 text-[13px]"
            >
              {["A", "B", "C", "D", "F"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
          >
            Preview matches
          </button>
        </div>
      </form>

      {/* Step 2: results + confirmed apply */}
      {handles.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-stone-200 bg-white p-4 text-[13px]">
            <span className="font-semibold text-stone-900">{matched.length}</span> matched ·{" "}
            <span className={unmatched.length ? "font-semibold text-amber-700" : "text-stone-500"}>
              {unmatched.length} unmatched
            </span>
            {unmatched.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {unmatched.slice(0, 30).map((h) => (
                  <span key={h} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                    @{h}
                  </span>
                ))}
                {unmatched.length > 30 && (
                  <span className="text-[11px] text-stone-500">+{unmatched.length - 30} more</span>
                )}
              </div>
            )}
            {matched.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {matched.slice(0, 30).map((m) => (
                  <span key={m.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700">
                    {[m.first_name, m.last_name].filter(Boolean).join(" ") || `@${m.instagram_handle}`}
                  </span>
                ))}
                {matched.length > 30 && (
                  <span className="text-[11px] text-stone-500">+{matched.length - 30} more</span>
                )}
              </div>
            )}
          </div>

          {matched.length > 0 && (
            <form action={bulkAssignRatings}>
              <input type="hidden" name="handles" value={handles.join(" ")} />
              <input type="hidden" name="rating" value={rating} />
              <ConfirmSubmit
                summary={`Set rating "${rating}" on ${matched.length} matched ${matched.length === 1 ? "person" : "people"}? Handles are re-resolved at submit time and the batch is audit-logged.`}
                confirmLabel={`Apply ${rating} to ${matched.length}`}
              >
                Apply rating to {matched.length} matched
              </ConfirmSubmit>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
