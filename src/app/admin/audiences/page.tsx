// ============================================================
// /admin/audiences — saved athlete lists (the prototype's
// S.audiences): a card per audience with its live size, a plain
// summary of its filters, and Open / Edit / Download CSV.
//
// Source: saved_audiences (migration 083). Until 083 is applied the
// grid says so and points at the builder, which already counts and
// downloads live. ColdFusion's 894 saved audiences stay in the CF
// database until the data copy.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { TablePending } from "@/components/admin/ops-bits";
import { LinkBtn, Note } from "@/components/admin/people/bits";
import { buildAudienceFilters, countAudience, describeAudience, resolveExcludedPeople, savedFiltersToParams } from "@/lib/admin/audience";
import { fmtDay } from "@/lib/admin/athlete-detail";

export const dynamic = "force-dynamic";

interface SavedRow {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown> | null;
  updated_at: string | null;
}

export default async function AudiencesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const saved = await safeQuery<SavedRow[]>(
    () => (supabase as any).from("saved_audiences").select("id, name, description, filters, updated_at").order("updated_at", { ascending: false }).limit(60)
  );

  const rows = saved.data ?? [];
  const cards = await Promise.all(
    rows.map(async (a) => {
      const f = buildAudienceFilters(savedFiltersToParams(a.filters));
      const excluded = await resolveExcludedPeople(supabase, f);
      const c = await countAudience(supabase, f, excluded);
      return { a, size: c.error ? null : c.total, lines: describeAudience(f).slice(0, 3) };
    })
  );

  return (
    <div>
      <PageHeader
        title="Audiences"
        subtitle="Saved athlete lists you can reuse for campaigns and app cards."
        actions={
          <LinkBtn href="/admin/audiences/new" primary>
            + Make an audience
          </LinkBtn>
        }
      />

      {searchParams.result === "deleted" && (
        <div className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-600">Audience deleted.</div>
      )}

      {saved.error ? (
        <ErrorNote message={saved.error} />
      ) : saved.pending ? (
        <section className="rounded-xl border border-stone-200 bg-white">
          <TablePending table="saved_audiences" feature="Saved audiences" />
          <div className="border-t border-stone-200 px-4 py-3 text-center text-[13px] text-stone-600">
            You can already{" "}
            <Link href="/admin/audiences/new" className="font-medium text-[#D73F09] hover:underline">
              build an audience
            </Link>
            , see its exact size and download it as a CSV. Saving it for reuse turns on with the migration.
          </div>
        </section>
      ) : cards.length === 0 ? (
        <section className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-[13px] text-stone-500">
          No saved audiences yet.{" "}
          <Link href="/admin/audiences/new" className="font-medium text-[#D73F09] hover:underline">
            Make the first one
          </Link>
          .
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ a, size, lines }) => (
            <section key={a.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4">
              <Link href={`/admin/audiences/${a.id}`} className="font-semibold text-stone-900 hover:underline">
                {a.name}
              </Link>
              <div className="mt-0.5 text-[12px] text-stone-500">Updated {fmtDay(a.updated_at)}</div>
              <div className="mt-3">
                <div className="text-2xl font-semibold tabular-nums text-stone-900">{size == null ? "—" : size.toLocaleString("en-US")}</div>
                <div className="text-[12px] text-stone-500">Athletes</div>
              </div>
              <div className="mt-3 grid flex-1 gap-0.5 text-[12px] text-stone-600">
                {lines.length === 0 ? (
                  <span className="text-stone-400">Every active college athlete</span>
                ) : (
                  lines.map((l) => (
                    <span key={l.k} className="truncate">
                      <span className="text-stone-400">{l.k}:</span> {l.v}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <LinkBtn href={`/admin/audiences/new?id=${a.id}`} small>
                  Edit
                </LinkBtn>
                <LinkBtn href={`/admin/audiences/export?id=${a.id}`} small external>
                  Download CSV
                </LinkBtn>
              </div>
            </section>
          ))}
        </div>
      )}

      <Note>
        Audiences stay live: new roster athletes who match are added automatically, and anyone archived drops off. ColdFusion&apos;s
        894 saved audiences come over with the data copy.
      </Note>
    </div>
  );
}
