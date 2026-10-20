// ============================================================
// View as brand · Invoices (prototype S["bp-invoices"]).
// There is no brand-invoice table in the database yet (checked
// 2026-10-20: no invoices / brand_invoices), so this shows the table
// header and an honest empty state — no example rows.
// ============================================================

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadPreviewBrand } from "@/lib/admin/view-as/queries";
import { CardFoot } from "@/components/admin/ops-bits";
import { PreviewHead } from "@/components/admin/view-as/bits";

export const dynamic = "force-dynamic";

export default async function BrandInvoicesPreview({ params }: { params: { brandId: string } }) {
  await requireAdmin("staff");
  const brand = await loadPreviewBrand(params.brandId);
  if (!brand) notFound();
  return (
    <div>
      <PreviewHead title="Invoices" sub="What's been billed, what's due, and receipts." />
      <section className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr>
                {["Invoice", "Campaign", "Amount", "Due", "Status", ""].map((h, i) => (
                  <th key={i} className="whitespace-nowrap border-b border-stone-200 bg-[#FAFAFB] px-3.5 py-2 text-left text-[12px] font-medium text-stone-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-stone-500">
                  No invoices to show. Brand invoices aren&rsquo;t connected to the portal yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <CardFoot>
          <span>Invoices fill in once billing is connected (Payments → Invoices on the staff side).</span>
        </CardFoot>
      </section>
    </div>
  );
}
