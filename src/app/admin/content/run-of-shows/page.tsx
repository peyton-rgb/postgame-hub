// ============================================================
// /admin/content/run-of-shows — Run of shows list.
// Matches prototype S["run-of-shows"]: Event · Shoots · Next shoot ·
// Status · Copy link. Source: run_of_shows + ros_shoots.
//
// The run-of-show EDITOR (shoots, shot lists, timelines, contacts) is
// the existing /dashboard/run-of-show/[id] editor — linked as "Edit",
// not rebuilt. "New run of show" opens the Hub list that owns creation
// (it seeds the default contacts).
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadRunOfShows } from "@/lib/admin/content/queries";
import { EmptyRows, ErrorNote, PageHeader } from "@/components/admin/ui";
import { CampCell, CardFoot } from "@/components/admin/ops-bits";
import { BtnLink, Card, Pill, TableWrap, Td, Th } from "@/components/admin/content/bits";
import CopyButton from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

export default async function RunOfShowsPage() {
  await requireAdmin("staff");
  const { rows, error } = await loadRunOfShows(createServiceSupabase());
  return (
    <div>
      <PageHeader
        title="Run of shows"
        subtitle="Shoot-day plans shared with videographers and athletes."
        actions={
          <BtnLink href="/dashboard?tab=ros" primary>
            + New run of show
          </BtnLink>
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}
      <Card>
        {rows.length === 0 ? (
          <EmptyRows label="No runs of show yet." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th right>Shoots</Th>
                <Th>Next shoot</Th>
                <Th>Status</Th>
                <Th right />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/60">
                  <Td>
                    <CampCell name={r.name} brandName={r.client} logo={r.logo} href={`/dashboard/run-of-show/${r.id}`} />
                  </Td>
                  <Td right className="tabular-nums">{r.shoots}</Td>
                  <Td className="text-stone-700">{r.nextShoot ?? "—"}</Td>
                  <Td>{r.published ? <Pill tone="ok">Live</Pill> : <Pill>Draft</Pill>}</Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-2">
                      {r.slug && (
                        <CopyButton
                          value={`/run-of-show/${r.slug}`}
                          label="Copy link"
                          className="whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-100"
                        />
                      )}
                      <BtnLink href={`/dashboard/run-of-show/${r.id}`}>Edit</BtnLink>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <CardFoot>
          <span>
            {rows.length} run{rows.length === 1 ? "" : "s"} of show · real data
          </span>
        </CardFoot>
      </Card>
    </div>
  );
}
