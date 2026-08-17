// ============================================================
// /admin/audiences — Audience builder (audiences_edit.cfm rebuilt
// as a LIVE segment builder).
//
// CF stored 894 saved audiences in its own DB; the Hub has no
// audiences table yet, so tonight this is the real-time version:
// build a segment against `people` with CF's filter set, see the
// live count + a 50-row preview, download the full segment as CSV.
// Saving named audiences lands with an audiences migration —
// flagged in the morning report, not faked here.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { buildAudienceFilters, applyAudienceFilters } from "@/lib/admin/audience";
import { PageHeader } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import FilterPopover from "@/components/admin/FilterPopover";
import { KNOWN_SPORTS } from "@/lib/team-folders";

export const dynamic = "force-dynamic";

const US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");

export default async function AudiencesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const f = buildAudienceFilters(searchParams);
  const hasFilters = Object.values(f).some((v) => v !== "" && v != null);

  const [{ data, error }, { count }] = await Promise.all([
    applyAudienceFilters(
      supabase
        .from("people")
        .select("id, first_name, last_name, sport, college_raw, college_state, instagram_handle, instagram_followers, rating"),
      f
    )
      .order("instagram_followers", { ascending: false, nullsFirst: false })
      .limit(50),
    applyAudienceFilters(supabase.from("people").select("id", { count: "exact", head: true }), f),
  ]);

  const rows = (data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    sport: string | null;
    college_raw: string | null;
    college_state: string | null;
    instagram_handle: string | null;
    instagram_followers: number | null;
    rating: string | null;
  }[];

  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (v) exportQs.set(k, v);

  return (
    <div>
      <PageHeader
        title="Audiences"
        subtitle="Live segment builder over the athlete network · CF's 894 saved audiences stay in the CF database (saved audiences land with their migration)"
        actions={
          hasFilters ? (
            <a
              href={`/admin/audiences/export?${exportQs}`}
              className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]"
            >
              Download segment CSV ({(count ?? 0).toLocaleString()})
            </a>
          ) : undefined
        }
      />

      <div className="pb-4">
        <FilterPopover
          fields={[
            {
              key: "state",
              label: "State",
              type: "select",
              options: US_STATES.map((s) => ({ value: s, label: s })),
            },
            {
              key: "gender",
              label: "Gender",
              type: "select",
              options: [
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
              ],
            },
            {
              key: "sport",
              label: "Sport",
              type: "select",
              options: KNOWN_SPORTS.map((s: string) => ({ value: s, label: s })),
            },
            { key: "college", label: "College", type: "text" },
            { key: "min", label: "Followers from", type: "text", placeholder: "e.g. 10000" },
            { key: "max", label: "Followers to", type: "text", placeholder: "e.g. 100000" },
            { key: "rating", label: "Minimum rating", type: "text", placeholder: "e.g. A" },
          ]}
        />
      </div>

      <div className="pb-3 text-[13px] text-stone-600">
        {hasFilters ? (
          <>
            Segment size: <span className="font-semibold text-stone-900">{(count ?? 0).toLocaleString()}</span>{" "}
            active athletes · previewing top 50 by followers
          </>
        ) : (
          "Add filters to build a segment. The count, preview, and CSV update live."
        )}
      </div>

      {hasFilters && (
        <AdminTable
          rows={rows}
          rowKey={(r) => r.id}
          emptyLabel="No athletes match this segment."
          columns={[
            {
              key: "name",
              header: "Name",
              render: (r) => (
                <span className="font-medium text-stone-900">
                  {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                </span>
              ),
            },
            { key: "sport", header: "Sport", render: (r) => r.sport ?? "—" },
            { key: "college", header: "College", render: (r) => r.college_raw ?? "—" },
            { key: "state", header: "State", secondary: true, render: (r) => r.college_state ?? "—" },
            {
              key: "ig",
              header: "IG",
              render: (r) => (r.instagram_handle ? `@${r.instagram_handle.replace(/^@/, "")}` : "—"),
            },
            {
              key: "followers",
              header: "Followers",
              align: "right",
              render: (r) => r.instagram_followers?.toLocaleString() ?? "—",
            },
            { key: "rating", header: "Rating", align: "center", render: (r) => r.rating ?? "—" },
          ]}
          mobile={{
            title: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
            subtitle: (r) => [r.college_raw, r.sport].filter(Boolean).join(" · "),
            figure: (r) => r.instagram_followers?.toLocaleString() ?? "",
          }}
        />
      )}
    </div>
  );
}
