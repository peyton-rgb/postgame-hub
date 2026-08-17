// ============================================================
// /admin/campaigns — Campaigns list (CF campaigns.cfm rebuilt).
//
// Canonical table: campaign_recaps (618 rows). brand_campaigns is
// a dead snapshot and admin_campaigns is the CF sync cache — never
// wired here.
//
// Completeness flags read REAL columns (honest flags only):
//   Brief    -> brief_url / brief_doc_id
//   Tracker  -> tracker_url / tracker_sheet_id
//   Opt-in   -> optin_campaigns.admin_campaign_id match (canonical
//               opt-in table; athlete_campaign_optins FKs to it)
//   Instr.   -> campaign_instructions by brand_id (no campaign link
//               column exists yet — brand-level match, tooltip says so)
//   Tags     -> tags array non-empty
//   Contract -> contracts.campaign_id rows
//   Signed   -> COUNT of contracts with signed_at (shown as count)
//
// Server-side pagination, 50/page. Filter popover: keyword, brand,
// industry, sport, college, status, "missing setup only".
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, FlagCell, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import FilterPopover from "@/components/admin/FilterPopover";
import { KNOWN_SPORTS } from "@/lib/team-folders";

export const dynamic = "force-dynamic";

interface CampaignRow {
  id: string;
  name: string | null;
  client_name: string | null;
  status: string | null;
  created_at: string | null;
  admin_campaign_id: string | null;
  brand_id: string | null;
  brief_url: string | null;
  brief_doc_id: string | null;
  tracker_url: string | null;
  tracker_sheet_id: string | null;
  drive_folder_id: string | null;
  tags: string[] | null;
  brands: { name: string | null; industry: string | null } | null;
}

interface Flags {
  brief: boolean;
  tracker: boolean;
  optin: boolean;
  instr: boolean;
  tags: boolean;
  contract: boolean;
  signed: number;
}

function missingAny(f: Flags): boolean {
  return !(f.brief && f.tracker && f.optin && f.instr && f.tags && f.contract);
}

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const brandId = (searchParams.brand ?? "").trim();
  const industry = sanitizeFilterValue(searchParams.industry ?? "");
  const sport = sanitizeFilterValue(searchParams.sport ?? "");
  const college = sanitizeFilterValue(searchParams.college ?? "");
  const status = sanitizeFilterValue(searchParams.status ?? "");
  const missingOnly = searchParams.missing === "1";

  const needsAthleteJoin = Boolean(sport || college);

  // industry filter needs brands!inner; swap embed form when filtering on it
  const selectBrands = industry ? "brands!inner(name, industry)" : "brands(name, industry)";

  const { from, to } = pageRange(page);
  const listSelect =
    "id, name, client_name, status, created_at, admin_campaign_id, brand_id, brief_url, brief_doc_id, tracker_url, tracker_sheet_id, drive_folder_id, tags, " +
    selectBrands +
    (needsAthleteJoin ? ", athletes!inner(id)" : "");

  let listQuery = supabase.from("campaign_recaps").select(listSelect);
  let countQuery = supabase
    .from("campaign_recaps")
    .select(
      "id" + (industry ? ", brands!inner(industry)" : "") + (needsAthleteJoin ? ", athletes!inner(id)" : ""),
      { count: "exact", head: true }
    );

  for (const apply of [
    (query: any) => (q ? query.or(`name.ilike.%${q}%,client_name.ilike.%${q}%`) : query),
    (query: any) => (brandId ? query.eq("brand_id", brandId) : query),
    (query: any) => (industry ? query.eq("brands.industry", industry) : query),
    (query: any) => (status ? query.eq("status", status) : query),
    (query: any) => (sport ? query.ilike("athletes.sport", `%${sport}%`) : query),
    (query: any) => (college ? query.ilike("athletes.school", `%${college}%`) : query),
    (query: any) =>
      missingOnly
        ? query.or(
            [
              "and(brief_url.is.null,brief_doc_id.is.null)",
              "and(tracker_url.is.null,tracker_sheet_id.is.null)",
              "tags.is.null",
              "tags.eq.{}",
            ].join(",")
          )
        : query,
  ]) {
    listQuery = apply(listQuery);
    countQuery = apply(countQuery);
  }

  const [{ data: rowsRaw, error: listError }, { count: total, error: countError }] =
    await Promise.all([
      listQuery.order("created_at", { ascending: false }).range(from, to),
      countQuery,
    ]);

  if (listError || countError) {
    return (
      <div>
        <PageHeader title="Campaigns" />
        <ErrorNote message={(listError ?? countError)?.message ?? "Query failed"} />
      </div>
    );
  }

  const rows = (rowsRaw ?? []) as unknown as CampaignRow[];

  // ---- Flag sub-lookups for just this page of rows (batched IN queries) ----
  const ids = rows.map((r) => r.id);
  const adminIds = rows.map((r) => r.admin_campaign_id).filter(Boolean) as string[];
  const brandIds = Array.from(new Set(rows.map((r) => r.brand_id).filter(Boolean))) as string[];

  const [contractsRes, optinsRes, instrRes] = await Promise.all([
    ids.length
      ? supabase.from("contracts").select("campaign_id, signed_at").in("campaign_id", ids)
      : Promise.resolve({ data: [], error: null } as any),
    adminIds.length
      ? supabase
          .from("optin_campaigns")
          .select("admin_campaign_id")
          .in("admin_campaign_id", adminIds.map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n)))
      : Promise.resolve({ data: [], error: null } as any),
    brandIds.length
      ? supabase.from("campaign_instructions").select("brand_id").in("brand_id", brandIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const contractCounts = new Map<string, { total: number; signed: number }>();
  for (const c of (contractsRes.data ?? []) as { campaign_id: string; signed_at: string | null }[]) {
    const cur = contractCounts.get(c.campaign_id) ?? { total: 0, signed: 0 };
    cur.total += 1;
    if (c.signed_at) cur.signed += 1;
    contractCounts.set(c.campaign_id, cur);
  }
  const optinAdminIds = new Set(
    ((optinsRes.data ?? []) as { admin_campaign_id: number | null }[]).map((o) =>
      String(o.admin_campaign_id)
    )
  );
  const instrBrandIds = new Set(
    ((instrRes.data ?? []) as { brand_id: string | null }[]).map((i) => i.brand_id)
  );

  function flagsFor(r: CampaignRow): Flags {
    const contract = contractCounts.get(r.id);
    return {
      brief: Boolean(r.brief_url || r.brief_doc_id),
      tracker: Boolean(r.tracker_url || r.tracker_sheet_id),
      optin: r.admin_campaign_id ? optinAdminIds.has(r.admin_campaign_id) : false,
      instr: r.brand_id ? instrBrandIds.has(r.brand_id) : false,
      tags: Boolean(r.tags && r.tags.length > 0),
      contract: Boolean(contract && contract.total > 0),
      signed: contract?.signed ?? 0,
    };
  }

  // ---- Filter options ----
  const { data: brandRows } = await supabase
    .from("brands")
    .select("id, name, industry")
    .eq("archived", false)
    .order("name");
  const brandOptions = (brandRows ?? []).map((b) => ({ value: b.id, label: b.name ?? "—" }));
  const industryOptions = Array.from(
    new Set((brandRows ?? []).map((b) => b.industry).filter(Boolean) as string[])
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const params: Record<string, string | undefined> = {
    q: q || undefined,
    brand: brandId || undefined,
    industry: industry || undefined,
    sport: sport || undefined,
    college: college || undefined,
    status: status || undefined,
    missing: missingOnly ? "1" : undefined,
  };

  const flagHeader = (label: string, title?: string) => (
    <span title={title}>{label}</span>
  );

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle={`${(total ?? 0).toLocaleString()} campaigns · flags read live setup columns`}
      />
      <div className="pb-4">
        <FilterPopover
          fields={[
            { key: "q", label: "Keyword", type: "text", placeholder: "Name or client" },
            { key: "brand", label: "Brand", type: "select", options: brandOptions },
            { key: "industry", label: "Industry", type: "select", options: industryOptions },
            {
              key: "sport",
              label: "Sport",
              type: "select",
              options: KNOWN_SPORTS.map((s: string) => ({ value: s, label: s })),
            },
            { key: "college", label: "College", type: "text", placeholder: "School name" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: [
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ],
            },
            { key: "missing", label: "Missing setup only", type: "checkbox" },
          ]}
        />
      </div>

      <AdminTable<CampaignRow>
        rows={rows}
        rowKey={(r) => r.id}
        rowWarn={(r) => missingAny(flagsFor(r))}
        emptyLabel="No campaigns match these filters."
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => (
              <span className="text-stone-500 tabular-nums">
                {r.admin_campaign_id ?? r.id.slice(0, 8)}
              </span>
            ),
          },
          {
            key: "name",
            header: "Campaign",
            render: (r) => (
              <span>
                <NameLink href={`/admin/campaigns/${r.id}`}>{r.name ?? "Untitled"}</NameLink>
                <span className="ml-2 text-stone-500">
                  {r.brands?.name ?? r.client_name ?? ""}
                </span>
              </span>
            ),
          },
          {
            key: "brief",
            header: flagHeader("Brief"),
            align: "center",
            render: (r) => (
              <FlagCell
                state={flagsFor(r).brief ? "set" : "missing"}
                href={r.brief_url}
                title={flagsFor(r).brief ? "Brief linked" : "No brief"}
              />
            ),
          },
          {
            key: "tracker",
            header: flagHeader("Tracker"),
            align: "center",
            render: (r) => (
              <FlagCell
                state={flagsFor(r).tracker ? "set" : "missing"}
                href={r.tracker_url}
                title={flagsFor(r).tracker ? "Tracker linked" : "No tracker"}
              />
            ),
          },
          {
            key: "optin",
            header: flagHeader("Opt-in"),
            align: "center",
            render: (r) => (
              <FlagCell
                state={flagsFor(r).optin ? "done" : "missing"}
                title={flagsFor(r).optin ? "Opt-in page exists" : "No opt-in page"}
              />
            ),
          },
          {
            key: "instr",
            header: flagHeader("Instr.", "Brand-level match — campaign_instructions has no campaign link column yet"),
            align: "center",
            render: (r) => (
              <FlagCell
                state={flagsFor(r).instr ? "set" : "missing"}
                title={
                  flagsFor(r).instr
                    ? "Instructions exist for this brand (brand-level match)"
                    : "No instructions for this brand"
                }
              />
            ),
          },
          {
            key: "tags",
            header: flagHeader("Tags"),
            align: "center",
            render: (r) => (
              <FlagCell
                state={flagsFor(r).tags ? "done" : "missing"}
                title={r.tags?.join(", ") || "No tags"}
              />
            ),
          },
          {
            key: "contract",
            header: flagHeader("Contract"),
            align: "center",
            render: (r) => (
              <FlagCell
                state={flagsFor(r).contract ? "set" : "missing"}
                title={flagsFor(r).contract ? "Contracts on file" : "No contracts"}
              />
            ),
          },
          {
            key: "signed",
            header: "Signed",
            align: "center",
            render: (r) => <span className="tabular-nums">{flagsFor(r).signed}</span>,
          },
          {
            key: "status",
            header: "Status",
            secondary: true,
            render: (r) => <span className="capitalize text-stone-600">{r.status ?? "—"}</span>,
          },
          {
            key: "created",
            header: "Created On",
            secondary: true,
            render: (r) => <span className="text-stone-500">{formatDate(r.created_at)}</span>,
          },
        ]}
        mobile={{
          title: (r) => r.name ?? "Untitled",
          href: (r) => `/admin/campaigns/${r.id}`,
          subtitle: (r) => r.brands?.name ?? r.client_name ?? "",
          figure: (r) => <span className="capitalize">{r.status ?? ""}</span>,
          strip: (r) => {
            const f = flagsFor(r);
            return (
              <>
                <FlagCell state={f.brief ? "set" : "missing"} title="Brief" />
                <FlagCell state={f.tracker ? "set" : "missing"} title="Tracker" />
                <FlagCell state={f.optin ? "done" : "missing"} title="Opt-in" />
                <FlagCell state={f.instr ? "set" : "missing"} title="Instr." />
                <FlagCell state={f.tags ? "done" : "missing"} title="Tags" />
                <FlagCell state={f.contract ? "set" : "missing"} title="Contract" />
                <span className="ml-auto text-stone-500">Signed {f.signed}</span>
              </>
            );
          },
        }}
      />

      <Paginator
        page={page}
        total={total ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/campaigns"
        params={params}
      />
    </div>
  );
}
