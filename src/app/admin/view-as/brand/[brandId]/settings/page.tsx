// ============================================================
// View as brand · Settings (prototype S["bp-settings"]): profile and
// email notifications. Shown disabled in preview — these are the
// brand user's own settings, not something staff change from here.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadSettings } from "@/lib/portal/pages-data";
import { loadPreviewBrand } from "@/lib/admin/view-as/queries";
import { Card } from "@/components/admin/campaign/bits";
import { PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

const NOTIFY = ["Content is waiting for my approval", "A campaign goes live", "A recap is ready", "An invoice is due"];

export default async function BrandSettingsPreview({ params }: { params: { brandId: string } }) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();
  const settings = await loadSettings(brand.id);
  const me = settings.team.find((t) => t.status === "active") ?? settings.team[0] ?? null;
  const input = "h-9 w-full rounded-md border border-stone-300 bg-stone-50 px-2.5 text-[13px] text-stone-700";

  return (
    <div>
      <PreviewHead title="Settings" sub="Your profile and notifications." />
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-[13px]">
            <span className="font-medium text-stone-700">Name</span>
            <input className={input} defaultValue={me?.name ?? ""} disabled />
          </label>
          <label className="grid gap-1.5 text-[13px]">
            <span className="font-medium text-stone-700">Email</span>
            <input className={input} defaultValue={me?.email ?? ""} placeholder="No portal login yet" disabled />
          </label>
          <div className="grid gap-1.5 text-[13px] md:col-span-2">
            <span className="font-medium text-stone-700">Email me when</span>
            <div className="grid gap-1.5">
              {NOTIFY.map((t) => (
                <label key={t} className="flex items-center gap-2 text-stone-700">
                  <input type="checkbox" defaultChecked disabled /> {t}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 text-[12px] text-stone-500">
          {me ? `Showing ${me.name ?? me.email ?? "the first login"} from ${brand.name}'s team.` : `${brand.name} has no portal logins yet.`} Read-only in preview.
        </div>
      </Card>
    </div>
  );
}
