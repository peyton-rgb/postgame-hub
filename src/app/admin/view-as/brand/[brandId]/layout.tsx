// ============================================================
// /admin/view-as/brand/[brandId] — the brand portal, as one of the
// brand's employees sees it, rendered inside the admin shell (the
// prototype's MODE = "brand": same shell, brand-only left nav).
//
// Read-only preview. The live public /portal routes are untouched;
// the screens below reuse the portal's own loaders so this shows what
// the brand's portal reads. Nothing here writes — see the actor
// attribution note in src/lib/portal/preview.ts.
// ============================================================

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import CopyButton from "@/components/admin/CopyButton";
import NavIcon from "@/components/admin/NavIcon";
import { requireAdmin } from "@/lib/admin/auth";
import { loadAthleteOptions, loadBrandOptions, loadPreviewBrand, loadReviewQueue } from "@/lib/admin/view-as/queries";
import PreviewFrame from "@/components/admin/view-as/PreviewFrame";

export const dynamic = "force-dynamic";

export default async function BrandPreviewLayout({
  params,
  children,
}: {
  params: { brandId: string };
  children: React.ReactNode;
}) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();

  const [brands, athletes, queue] = await Promise.all([
    loadBrandOptions(),
    loadAthleteOptions(),
    loadReviewQueue(brand.id),
  ]);
  const waiting = queue.pieces.filter((p) => p.status === "Needs approval").length;

  // Postgame view vs Brand view (set by PortalModeToggle).
  const portalMode = cookies().get("admin_portal_mode")?.value === "brand" ? "brand" : "postgame";

  // Postgame-only facts for the staff panel: portal link and seats.
  const supabase = createServiceSupabase();
  const [tokenRes, seatsRes] = await Promise.all([
    supabase.from("brands").select("portal_token").eq("id", brand.id).maybeSingle(),
    safeQuery<{ id: string }[]>(() =>
      supabase.from("brand_contacts").select("id").eq("brand_id", brand.id).eq("status", "active") as any
    ),
  ]);
  const portalToken = (tokenRes.data as { portal_token: string | null } | null)?.portal_token ?? null;
  const portalUrl = portalToken ? `/portal/${portalToken}` : null;
  const seats = seatsRes.pending || seatsRes.error ? null : (seatsRes.data ?? []).length;

  const staffPanel = (
    <div className="mb-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[10px] border border-[#E3E5E9] bg-white px-3.5 py-2.5 text-[13px]">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Postgame only</span>
      <span className="text-stone-600">
        Seats <b className="font-semibold text-stone-900 tabular-nums">{seats == null ? "—" : seats}</b>
      </span>
      <Link
        href={`/admin/access?brand=${brand.id}`}
        className="inline-flex items-center gap-1 rounded-md bg-[#D73F09] px-2.5 py-1 text-[12px] font-medium text-white hover:brightness-105"
      >
        <NavIcon name="plus" size={13} />
        Add seat
      </Link>
      {portalUrl ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-stone-600">Portal link</span>
          <CopyButton value={portalUrl} label="Copy link" />
          <a href={portalUrl} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-[#D73F09] hover:underline">
            Open live portal ↗
          </a>
        </span>
      ) : (
        <span className="text-stone-400">No portal link yet</span>
      )}
      <Link href={`/admin/brands/${brand.id}`} className="text-[12px] font-medium text-stone-600 hover:text-stone-900 sm:ml-auto">
        Brand record →
      </Link>
    </div>
  );
  const base = `/admin/view-as/brand/${brand.id}`;
  const options = brands.some((b) => b.id === brand.id) ? brands : [{ id: brand.id, label: brand.name }, ...brands];

  return (
    <PreviewFrame
      mode="brand"
      brands={options}
      athletes={athletes}
      brandId={brand.id}
      portalMode={portalMode}
      staffPanel={staffPanel}
      note={<>{brand.name}&rsquo;s portal. Switch to Brand view to see exactly what their team sees.</>}
      nav={{
        who: brand.name,
        sub: "Brand portal · Confidential",
        logo: brand.logoOnDark,
        items: [
          { href: base, label: "Dashboard", icon: "home", exact: true },
          { href: `${base}/campaigns`, label: "Campaigns", icon: "mega" },
          { href: `${base}/review`, label: "Review & approve", icon: "checkbox", badge: waiting },
          { href: `${base}/assets`, label: "Assets", icon: "image" },
          { href: `${base}/reports`, label: "Reports", icon: "chart" },
          { href: `${base}/invoices`, label: "Invoices", icon: "receipt" },
          { href: `${base}/team`, label: "Your team", icon: "users" },
        ],
        settings: { href: `${base}/settings`, label: "Settings", icon: "cog" },
        footLine: `Viewing as ${brand.name} · Brand`,
      }}
    >
      {children}
    </PreviewFrame>
  );
}
