// ============================================================
// /admin/content/recaps — Recap builder list.
// Matches prototype S.recaps: search + brand + status, card grid with
// a Published / Draft pill and Edit. Source: campaign_recaps.
//
// The recap EDITOR itself is the existing v4 editor at /dashboard/[id]
// (2,000+ lines, drives the live client-facing recap renderer); it is
// linked, not rebuilt here. "New recap" opens the Hub's recap list,
// which owns creation.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { sanitizeFilterValue } from "@/lib/admin/db";
import { RECAP_PAGE, loadRecaps } from "@/lib/admin/content/queries";
import { ErrorNote, PageHeader, Paginator } from "@/components/admin/ui";
import { Toolbar } from "@/components/admin/ops-bits";
import { BtnLink, Card } from "@/components/admin/content/bits";
import { RecapGrid } from "@/components/admin/content/RecapGrid";
import { cookies } from "next/headers";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView, listViewCookie, type ListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** This list was a grid before the Rows / Cards toggle: keep Cards as its default until someone picks. */
function viewDefaultCards(listKey: string, sp: Record<string, string | undefined>): ListView {
  if (sp.view === "rows" || sp.view === "cards") return sp.view;
  let saved: string | undefined;
  try {
    saved = cookies().get(listViewCookie(listKey))?.value;
  } catch {
    /* outside a request */
  }
  return saved === "rows" || saved === "cards" ? getListView(listKey, sp) : "cards";
}

export default async function RecapsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const brand = UUID.test(searchParams.brand ?? "") ? searchParams.brand : undefined;
  const status = ["published", "draft", "archived"].includes(searchParams.status ?? "") ? searchParams.status : undefined;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const view = viewDefaultCards("content-recaps", searchParams);

  const res = await loadRecaps(createServiceSupabase(), { q, brand, status, page });

  return (
    <div>
      <PageHeader
        title="Recap builder"
        subtitle="Campaign results pages for brands."
        actions={
          <BtnLink href="/dashboard/recaps" primary>
            + New recap
          </BtnLink>
        }
      />
      {res.error && (
        <div className="mb-4">
          <ErrorNote message={res.error} />
        </div>
      )}
      <Card>
        <Toolbar
          action="/admin/content/recaps"
          placeholder="Search recaps by campaign or brand"
          q={q}
          selects={[
            {
              name: "brand",
              label: "Brand",
              value: brand ?? "",
              options: [{ value: "", label: "All brands" }, ...res.brands.map((b) => ({ value: b.id, label: b.name }))],
            },
            {
              name: "status",
              label: "Status",
              value: status ?? "",
              options: [
                { value: "", label: "Any status" },
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
                { value: "archived", label: "Archived" },
              ],
            },
          ]}
          hidden={{ view: searchParams.view }}
          right={
            <>
              <span className="text-[12px] text-stone-500">
                {res.readyCount !== null && `${res.readyCount} campaigns ready for a recap · `}
                {res.total.toLocaleString()} of {res.all.toLocaleString()} recaps
              </span>
              <ViewToggle listKey="content-recaps" view={view} />
            </>
          }
        />
        <RecapGrid view={view} cards={res.cards} emptyLabel={q ? `No recaps match “${q}”.` : "No recaps match these filters."} />
        <div className="border-t border-stone-200 px-3">
          <Paginator
            page={page}
            total={res.total}
            pageSize={RECAP_PAGE}
            basePath="/admin/content/recaps"
            params={{ q: q || undefined, brand, status, view: searchParams.view }}
          />
        </div>
      </Card>
    </div>
  );
}
