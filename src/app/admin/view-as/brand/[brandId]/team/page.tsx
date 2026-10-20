// ============================================================
// View as brand · Your team (prototype S["bp-team"]): the brand's own
// portal logins (brand_contacts, via the portal's settings loader) and
// the Postgame people on their campaigns.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadSettings } from "@/lib/portal/pages-data";
import { loadBrandManagers, loadPreviewBrand } from "@/lib/admin/view-as/queries";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { PreviewBtn, PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function BrandTeamPreview({ params }: { params: { brandId: string } }) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();
  const [settings, managers] = await Promise.all([loadSettings(brand.id), loadBrandManagers(brand.id)]);
  const team = settings.team.filter((t) => t.status !== "revoked");

  return (
    <div>
      <PreviewHead
        title="Your team"
        sub={`People at ${brand.name} who can open this portal, and your Postgame contacts.`}
        actions={<PreviewBtn primary>Invite a teammate</PreviewBtn>}
      />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card title={brand.name} sub="Brand logins replace the old private link.">
          {team.length ? (
            team.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 border-t border-stone-100 py-2.5 text-[13px] first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-stone-900">{t.name ?? t.email ?? "Invited"}</div>
                  <div className="truncate text-[12px] text-stone-500">{t.name ? t.email ?? "" : t.status === "active" ? "Signed in" : "Invite sent"}</div>
                </div>
                <Pill tone={t.status === "active" ? "ok" : "warn"}>{t.role === "approver" ? "Approver" : "Viewer"}</Pill>
              </div>
            ))
          ) : (
            <div className="text-[13px] text-stone-500">No one at {brand.name} has a portal login yet. Invite someone who signs off on content, or who only needs reports.</div>
          )}
        </Card>
        <Card title="Postgame">
          {managers.length ? (
            managers.slice(0, 6).map((m) => (
              <div key={m.name} className="flex items-center gap-2.5 border-t border-stone-100 py-2.5 text-[13px] first:border-t-0">
                <span className="min-w-0 flex-1 text-stone-500">Campaign manager{m.live ? " · in flight" : ""}</span>
                <span className="min-w-0 truncate text-right">
                  <span className="block truncate font-medium text-stone-900">{m.name}</span>
                  {m.email && <span className="block truncate text-[12px] text-stone-500">{m.email}</span>}
                </span>
              </div>
            ))
          ) : (
            <div className="text-[13px] text-stone-500">Being assigned.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
