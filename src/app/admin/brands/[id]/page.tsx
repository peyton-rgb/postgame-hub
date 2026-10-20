// ============================================================
// /admin/brands/[id] — Brand detail (the prototype's "brand-detail"
// screen). One place for a brand's campaigns, contacts, portal and
// logos, with links out to the edit page and to a new campaign.
//
// Sources: brands (header, logos, colours, legacy portal_token),
// campaigns (migration 083 — the brand's campaigns and the three
// stat tiles), brand_contacts + postgame_contacts (contacts card),
// brand_portal_links (083 — portal card). Every 083 read goes
// through safeQuery and shows an honest empty state until the
// migration is applied. Logos always render from the brands row's
// logo columns — never typed as text.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatDate, safeQuery } from "@/lib/admin/db";
import { PageHeader, StatTile, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import CopyButton from "@/components/admin/CopyButton";
import { BrandMark, PortalPill, portalState, type PortalLinkRow } from "@/components/admin/brand-bits";

export const dynamic = "force-dynamic";

interface Brand {
  id: string;
  admin_brand_id: string | null;
  name: string | null;
  industry: string | null;
  website: string | null;
  archived: boolean | null;
  created_at: string | null;
  slug: string | null;
  portal_token: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_primary_url: string | null;
  logo_mark_url: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  logo_white_url: string | null;
}

interface CampaignRow {
  campaign_id: number;
  campaign_name: string | null;
  is_active: boolean | null;
  total_opt_in: number | null;
  total_is_selected: number | null;
  total_contract_signed: number | null;
  total_paid: number | null;
  total_budget: number | null;
  date_stamp: string | null;
  created_at: string | null;
}

interface ContactRow {
  id: string;
  role: string | null;
  status: string;
  invited_email: string | null;
  signup_email: string | null;
  contact: { name: string | null; email: string | null } | null;
}

interface PortalLinkFull extends PortalLinkRow {
  created_at: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const num = (v: number | null) =>
  v == null ? <span className="text-stone-400">—</span> : Number(v).toLocaleString();

const dollars = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Sum a numeric column, or null when no row carries a value (so the tile can say "—"). */
function sumOrNull(rows: CampaignRow[], pick: (r: CampaignRow) => number | null): number | null {
  let seen = false;
  let total = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v == null) continue;
    seen = true;
    total += Number(v);
  }
  return seen ? total : null;
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-stone-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardEmpty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-5 text-[12px] leading-5 text-stone-500">{children}</div>;
}

function StatusPill({ archived }: { archived: boolean | null }) {
  return archived ? (
    <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
      Archived
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-status-ok">
      Active
    </span>
  );
}

const btn =
  "inline-flex items-center rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400";
const btnPrimary =
  "inline-flex items-center rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:brightness-105";

export default async function BrandDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  if (!UUID_RE.test(params.id)) {
    return (
      <div>
        <PageHeader title="Brand" />
        <ErrorNote message="Brand not found." />
      </div>
    );
  }

  const { data: brandData, error } = await supabase
    .from("brands")
    .select(
      "id, admin_brand_id, name, industry, website, archived, created_at, slug, portal_token, primary_color, secondary_color, logo_primary_url, logo_mark_url, logo_dark_url, logo_light_url, logo_white_url"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !brandData) {
    return (
      <div>
        <PageHeader title="Brand" />
        <ErrorNote message={error ? error.message : "Brand not found."} />
      </div>
    );
  }
  const brand = brandData as Brand;

  // ---- Side reads. Each degrades on its own. ----
  const [campRes, contactRes, portalRes] = await Promise.all([
    safeQuery<CampaignRow[]>(() =>
      supabase
        .from("campaigns")
        .select(
          "campaign_id, campaign_name, is_active, total_opt_in, total_is_selected, total_contract_signed, total_paid, total_budget, date_stamp, created_at"
        )
        .eq("brand_id", brand.id)
        .order("date_stamp", { ascending: false, nullsFirst: false })
        .order("campaign_id", { ascending: false })
    ),
    safeQuery<ContactRow[]>(
      () =>
        supabase
          .from("brand_contacts")
          .select("id, role, status, invited_email, signup_email, contact:postgame_contacts!contact_id(name, email)")
          .eq("brand_id", brand.id)
          .order("created_at", { ascending: true }) as any
    ),
    safeQuery<PortalLinkFull | null>(() =>
      supabase.from("brand_portal_links").select("brand_id, active, created_at").eq("brand_id", brand.id).maybeSingle()
    ),
  ]);

  const campaigns = campRes.data ?? [];
  const activeCount = campaigns.filter((c) => c.is_active).length;
  const athletesPaid = sumOrNull(campaigns, (c) => c.total_paid);
  const totalBudget = sumOrNull(campaigns, (c) => c.total_budget);
  const campaignsUnavailable = campRes.pending || Boolean(campRes.error);

  const contacts = (contactRes.data ?? []).filter((c) => c.status !== "revoked");
  const portalLink = portalRes.data ?? undefined;
  const portal = portalState(portalLink, brand.portal_token);
  const portalPath = brand.portal_token ? `/portal/${brand.portal_token}` : null;
  const previewPath = `/portal/preview?brand=${encodeURIComponent(brand.slug || brand.id)}`;

  const logos: { role: string; note: string; url: string | null; dark?: boolean }[] = [
    { role: "Primary", note: "Full lockup", url: brand.logo_primary_url },
    { role: "Mark", note: "Icon only", url: brand.logo_mark_url },
    { role: "Dark ink", note: "For light backgrounds", url: brand.logo_dark_url },
    { role: "Light ink", note: "For dark backgrounds", url: brand.logo_light_url, dark: true },
    { role: "White", note: "For dark backgrounds", url: brand.logo_white_url, dark: true },
  ];
  const logosOnFile = logos.filter((l) => l.url);
  const colors = [
    { label: "Primary", hex: brand.primary_color },
    { label: "Secondary", hex: brand.secondary_color },
  ].filter((c) => c.hex);

  const website = brand.website
    ? { href: brand.website, label: brand.website.replace(/^https?:\/\//, "").replace(/\/$/, "") }
    : null;

  return (
    <div>
      <div className="pb-1 text-[12px] text-stone-500">
        <Link href="/admin/brands" className="hover:text-stone-900">
          Brands
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-stone-700">{brand.name ?? "Brand"}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <BrandMark src={brand.logo_mark_url ?? brand.logo_primary_url ?? null} name={brand.name} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-stone-900">{brand.name ?? "Brand"}</h1>
              <StatusPill archived={brand.archived} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-stone-500">
              <span>{brand.industry ?? "No industry set"}</span>
              {website && (
                <>
                  <span className="text-stone-300">·</span>
                  <a href={website.href} target="_blank" rel="noreferrer" className="text-[#D73F09] hover:underline">
                    {website.label}
                  </a>
                </>
              )}
              <span className="text-stone-300">·</span>
              <span>ID {brand.admin_brand_id ?? brand.id.slice(0, 8)}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {portalPath && (
            <a href={portalPath} target="_blank" rel="noreferrer" className={btn}>
              Brand portal ↗
            </a>
          )}
          <Link href={`/admin/campaigns/new?brand=${brand.id}`} className={btn}>
            + New campaign
          </Link>
          <Link href={`/admin/brands/${brand.id}/edit`} className={btnPrimary}>
            Edit brand
          </Link>
        </div>
      </div>

      {searchParams.result === "created" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Brand created. Add contacts and a first campaign when you&rsquo;re ready.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 pb-5 sm:grid-cols-3">
        <StatTile
          label={campaignsUnavailable ? "Campaigns" : `Campaigns · ${activeCount.toLocaleString()} active`}
          value={campaignsUnavailable ? "—" : campaigns.length.toLocaleString()}
        />
        <StatTile label="Athletes paid" value={athletesPaid == null ? "—" : athletesPaid.toLocaleString()} />
        <StatTile label="Total budget" value={totalBudget == null ? "—" : dollars(totalBudget)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---- Left: campaigns ---- */}
        <div className="min-w-0">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-[13px] font-semibold text-stone-900">
              Campaigns
              {!campaignsUnavailable && (
                <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 text-[11px] font-medium text-stone-500">
                  {campaigns.length}
                </span>
              )}
            </h2>
            <Link href={`/admin/campaigns/new?brand=${brand.id}`} className="text-[12px] text-stone-500 hover:text-stone-900">
              + New campaign
            </Link>
          </div>

          {campRes.pending ? (
            <div className="rounded-lg border border-stone-200 bg-white">
              <CardEmpty>
                The campaigns table (migration 083) is not applied on this database yet, so this brand&rsquo;s
                campaigns can&rsquo;t be listed here.
              </CardEmpty>
            </div>
          ) : campRes.error ? (
            <ErrorNote message={`Could not load campaigns: ${campRes.error}`} />
          ) : (
            <AdminTable<CampaignRow>
              rows={campaigns}
              rowKey={(c) => String(c.campaign_id)}
              emptyLabel="No campaigns for this brand yet."
              columns={[
                {
                  key: "campaign",
                  header: "Campaign",
                  render: (c) => <NameLink href={`/admin/campaigns/${c.campaign_id}`}>{c.campaign_name || "—"}</NameLink>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (c) => (
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        (c.is_active ? "bg-green-50 text-status-ok" : "bg-stone-100 text-stone-500")
                      }
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  ),
                },
                { key: "optins", header: "Opt-ins", align: "right", render: (c) => num(c.total_opt_in) },
                { key: "selected", header: "Selected", align: "right", render: (c) => num(c.total_is_selected) },
                { key: "signed", header: "Signed", align: "right", secondary: true, render: (c) => num(c.total_contract_signed) },
                { key: "paid", header: "Paid", align: "right", render: (c) => num(c.total_paid) },
                {
                  key: "created",
                  header: "Created",
                  align: "right",
                  secondary: true,
                  render: (c) => <span className="text-stone-500">{formatDate(c.date_stamp ?? c.created_at)}</span>,
                },
              ]}
              mobile={{
                title: (c) => c.campaign_name || "—",
                href: (c) => `/admin/campaigns/${c.campaign_id}`,
                subtitle: (c) => formatDate(c.date_stamp ?? c.created_at),
                strip: (c) => (
                  <>
                    <span className={c.is_active ? "text-status-ok" : "text-stone-500"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-stone-400">·</span>
                    <span className="text-stone-500">{num(c.total_opt_in)} opt-ins</span>
                  </>
                ),
                figure: (c) => (
                  <>
                    {num(c.total_is_selected)} <span className="font-normal text-stone-500">selected</span>
                  </>
                ),
              }}
            />
          )}
        </div>

        {/* ---- Right: contacts, portal, assets ---- */}
        <div className="space-y-4">
          <Card
            title="Contacts"
            action={
              <Link href={`/admin/access?brand=${brand.id}`} className="text-[12px] text-stone-500 hover:text-stone-900">
                Manage →
              </Link>
            }
          >
            {contactRes.pending ? (
              <CardEmpty>Contacts arrive with migration 028 (brand_contacts). Nothing to show yet.</CardEmpty>
            ) : contactRes.error ? (
              <CardEmpty>Could not load contacts: {contactRes.error}</CardEmpty>
            ) : contacts.length === 0 ? (
              <CardEmpty>No contacts on file for this brand.</CardEmpty>
            ) : (
              <ul className="divide-y divide-stone-100">
                {contacts.map((c) => {
                  const email = c.contact?.email ?? c.signup_email ?? c.invited_email;
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-stone-900">{c.contact?.name ?? email ?? "—"}</div>
                        {email && <div className="truncate text-[12px] text-stone-500">{email}</div>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-medium capitalize text-stone-700">{c.role ?? "viewer"}</div>
                        <div className="text-[11px] capitalize text-stone-400">{c.status.replace(/_/g, " ")}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Portal" action={<PortalPill state={portal} />}>
            {portal === "none" ? (
              <CardEmpty>
                No portal link yet.{" "}
                <Link href={previewPath} className="text-[#D73F09] hover:underline">
                  Preview as this brand
                </Link>{" "}
                while signed in.
              </CardEmpty>
            ) : (
              <div className="space-y-2 px-4 py-3 text-[12px]">
                {portalPath ? (
                  <>
                    <div className="truncate rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 font-mono text-[11px] text-stone-700">
                      {portalPath}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton value={portalPath} label="Copy link" />
                      <a href={portalPath} target="_blank" rel="noreferrer" className="text-stone-500 hover:text-stone-900">
                        Open ↗
                      </a>
                      <Link href={previewPath} className="text-stone-500 hover:text-stone-900">
                        Preview
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="leading-5 text-stone-500">
                    A portal link row exists (migration 083)
                    {portalLink?.created_at ? ` since ${formatDate(portalLink.created_at)}` : ""}, but no Hub route
                    reads it yet, so there is no URL to copy.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card
            title="Brand assets"
            action={
              <Link href={`/admin/brands/${brand.id}/edit`} className="text-[12px] text-stone-500 hover:text-stone-900">
                Edit brand →
              </Link>
            }
          >
            {logosOnFile.length === 0 && colors.length === 0 ? (
              <CardEmpty>No logos or colours on file. They are added from the brand kit.</CardEmpty>
            ) : (
              <div className="px-4 py-3">
                {logosOnFile.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2">
                    {logosOnFile.map((l) => (
                      <li key={l.role} className="min-w-0">
                        <a
                          href={l.url!}
                          target="_blank"
                          rel="noreferrer"
                          className={
                            "grid h-16 place-items-center rounded-md border border-stone-200 p-2 " +
                            (l.dark ? "bg-stone-900" : "bg-white")
                          }
                          title={`Open ${l.role.toLowerCase()} logo`}
                        >
                          <img src={l.url!} alt={`${brand.name ?? "Brand"} ${l.role.toLowerCase()} logo`} className="max-h-full max-w-full object-contain" />
                        </a>
                        <div className="mt-1 text-[11px] font-medium text-stone-700">{l.role}</div>
                        <div className="text-[11px] text-stone-400">{l.note}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-stone-500">No logos on file.</p>
                )}
                {colors.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-3 border-t border-stone-100 pt-3">
                    {colors.map((c) => (
                      <li key={c.label} className="flex items-center gap-2 text-[11px]">
                        <span
                          className="inline-block h-5 w-5 rounded border border-stone-200"
                          style={{ backgroundColor: c.hex! }}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-stone-700">{c.label}</span>
                          <span className="ml-1 font-mono uppercase text-stone-400">{c.hex}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
