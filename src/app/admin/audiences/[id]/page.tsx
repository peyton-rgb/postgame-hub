// ============================================================
// /admin/audiences/[id] — Audience detail (batch 2 "Audience"):
// one saved audience, its live size, what it's built from, the top
// 50 athletes by followers, and what to do with it next.
// Source: saved_audiences (migration 083) + `people`.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { ErrorNote } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { TablePending } from "@/components/admin/ops-bits";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { AppPill, CardFoot, Crumb, Facts, LevelPill, LinkBtn, Note, Tiles, Who, fmtCount, handleText } from "@/components/admin/people/bits";
import {
  buildAudienceFilters,
  countAudience,
  describeAudience,
  previewAudience,
  resolveExcludedPeople,
  savedFiltersToParams,
} from "@/lib/admin/audience";
import { fmtDay } from "@/lib/admin/athlete-detail";
import { deleteAudience } from "../actions";

export const dynamic = "force-dynamic";

interface SavedRow {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export default async function AudienceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createServiceSupabase();

  const saved = await safeQuery<SavedRow>(
    () => (supabase as any).from("saved_audiences").select("id, name, description, filters, created_at, updated_at").eq("id", params.id).maybeSingle()
  );
  if (saved.pending) {
    return (
      <div>
        <Crumb items={[{ label: "Audiences", href: "/admin/audiences" }, { label: "Audience" }]} />
        <section className="rounded-xl border border-stone-200 bg-white">
          <TablePending table="saved_audiences" feature="Saved audiences" />
        </section>
      </div>
    );
  }
  if (saved.error) return <ErrorNote message={saved.error} />;
  const a = saved.data;
  if (!a) notFound();

  const f = buildAudienceFilters(savedFiltersToParams(a.filters));
  const excluded = await resolveExcludedPeople(supabase, f);
  const [count, preview, campaignsRes, appCount] = await Promise.all([
    countAudience(supabase, f, excluded),
    previewAudience(supabase, f, excluded, 50),
    f.excludeCampaigns.length
      ? supabase.from("campaign_recaps").select("id, name, client_name").in("id", f.excludeCampaigns)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; client_name: string | null }> }),
    f.include === "noapp"
      ? Promise.resolve(null)
      : countAudience(supabase, { ...f, include: "app" }, excluded).then((c) => (c.error ? null : c.total)),
  ]);
  const names = new Map(
    ((campaignsRes.data ?? []) as Array<{ id: string; name: string | null; client_name: string | null }>).map((c) => [
      c.id,
      [c.client_name, c.name].filter(Boolean).join(" – "),
    ])
  );
  const lines = describeAudience(f, names);
  const size = count.error ? null : count.total;
  const justSaved = searchParams.result === "saved";
  const csvHref = `/admin/audiences/export?id=${a.id}`;

  return (
    <div>
      <div className="pb-5">
        <Crumb items={[{ label: "Audiences", href: "/admin/audiences" }, { label: a.name }]} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
              {a.name} {justSaved && <Pill tone="ok">Saved</Pill>}
            </h1>
            <p className="mt-1 text-[13px] text-stone-500">{a.description ?? `Updated ${fmtDay(a.updated_at)}`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LinkBtn href={`/admin/audiences/new?id=${a.id}`}>Edit</LinkBtn>
            <LinkBtn href={csvHref} external primary={searchParams.dl === "1"}>
              Download CSV
            </LinkBtn>
          </div>
        </div>
      </div>

      {searchParams.dl === "1" && (
        <div className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-600">
          Saved. Your CSV is ready:{" "}
          <a href={csvHref} className="font-medium text-[#D73F09] hover:underline">
            download {a.name}.csv
          </a>
        </div>
      )}

      <Tiles
        items={[
          { n: size == null ? "—" : size.toLocaleString("en-US"), l: "Athletes" },
          { n: appCount == null ? "—" : appCount.toLocaleString("en-US"), l: "On the app" },
          { n: size == null || appCount == null ? "—" : Math.max(0, size - appCount).toLocaleString("en-US"), l: "Without the app (invite)" },
          { n: fmtDay(a.created_at), l: "Created" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Top athletes" sub="The 50 biggest by Instagram followers" pad={false}>
          <div className="p-3 md:p-4">
            <AdminTable<any>
              rows={preview}
              rowKey={(r) => r.id}
              emptyLabel="Nobody matches this audience right now."
              columns={[
                {
                  key: "a",
                  header: "Athlete",
                  render: (r) => (
                    <Who name={[r.first_name, r.last_name].filter(Boolean).join(" ") || null} sub={handleText(r.instagram_handle)} href={`/admin/athletes/${r.id}`} />
                  ),
                },
                { key: "l", header: "Level", render: (r) => <LevelPill row={r} /> },
                { key: "s", header: "School", render: (r) => r.college_raw ?? <span className="text-stone-400">—</span> },
                { key: "sp", header: "Sport", secondary: true, render: (r) => r.sport ?? <span className="text-stone-400">—</span> },
                { key: "f", header: "Instagram", align: "right", render: (r) => fmtCount(r.instagram_followers) },
                { key: "app", header: "Postgame app", secondary: true, render: (r) => <AppPill device={r.device} /> },
              ]}
              mobile={{
                title: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
                href: (r) => `/admin/athletes/${r.id}`,
                subtitle: (r) => [handleText(r.instagram_handle), r.college_raw, r.sport].filter(Boolean).join(" · "),
                figure: (r) => fmtCount(r.instagram_followers),
              }}
            />
          </div>
          <CardFoot>
            <span>
              Showing {preview.length} of {size == null ? "—" : size.toLocaleString("en-US")} · the CSV has everyone
            </span>
          </CardFoot>
        </Card>

        <div className="space-y-4">
          <Card title="Built from">
            {lines.length === 0 ? (
              <div className="py-1 text-[13px] text-stone-500">Every active college athlete.</div>
            ) : (
              <Facts rows={lines.map((l) => [l.k, l.v])} />
            )}
          </Card>
          <Card title="Use it to">
            <div className="grid gap-2">
              <a href="/admin/campaigns" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400">
                Invite to a campaign
              </a>
              <a href="/admin/mobile-app/cards" className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400">
                Target an app card
              </a>
              <a href={csvHref} className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400">
                Download the list
              </a>
            </div>
            <p className="mt-2 text-[12px] text-stone-500">Attach it from a campaign&apos;s Athletes card, or pick it on an app card.</p>
          </Card>
          <form action={deleteAudience}>
            <input type="hidden" name="id" value={a.id} />
            <ConfirmSubmit summary={`Delete "${a.name}". Campaigns and app cards using it lose it. The athletes themselves are not touched.`} confirmLabel="Delete" variant="danger">
              Delete audience
            </ConfirmSubmit>
          </form>
        </div>
      </div>

      <Note>The list stays live: new roster athletes who match are added automatically, and anyone archived drops off.</Note>
    </div>
  );
}
