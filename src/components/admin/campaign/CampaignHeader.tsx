// ============================================================
// Campaign page header: crumb, brand mark (from the brands row, never
// text), name + Active/type pills, the four facts, and the actions
// (Opt-in page · Payouts · More ▾ · Edit campaign).
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { CampaignBundle } from "@/lib/admin/campaigns/queries";
import { brandLogo } from "@/lib/admin/campaigns/queries";
import { campaignTypeLabel, personName } from "@/lib/admin/campaigns/types";
import { Btn, Pill, fmtLongDate, fmtMoney } from "./bits";
import MoreMenu from "./MoreMenu";

export default function CampaignHeader({ bundle }: { bundle: CampaignBundle }) {
  const { campaign: c, extras, extrasPending, brand, manager, assistant } = bundle;
  const id = c.campaign_id;
  const logo = brandLogo(brand, "light");
  const editHref = `/admin/campaigns/${id}/edit`;

  const facts: { k: string; v: string | null; href: string }[] = [
    { k: "Manager", v: personName(manager), href: `${editHref}#general` },
    { k: "Assistant", v: personName(assistant), href: `${editHref}#general` },
    { k: "Created", v: fmtLongDate(c.date_stamp ?? c.created_at), href: editHref },
    { k: "Budget", v: c.total_budget == null ? null : fmtMoney(c.total_budget), href: `${editHref}#budget` },
  ];

  return (
    <div className="pb-4">
      <div className="pb-2 text-[12px] text-stone-500">
        <Link href="/admin/campaigns" className="hover:underline">
          Campaigns
        </Link>
        {brand?.name && <> / {brand.name}</>}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {logo && (
              <img
                src={logo}
                alt={brand?.name ?? ""}
                className="h-7 w-auto max-w-[110px] object-contain"
              />
            )}
            <h1 className="text-xl font-semibold text-stone-900">{c.campaign_name || "Untitled campaign"}</h1>
            <Pill tone={c.is_active ? "ok" : "muted"}>{c.is_active ? "Active" : "Inactive"}</Pill>
            {extrasPending ? (
              <Pill tone="muted">Social campaign</Pill>
            ) : (
              <Pill tone={extras.campaign_type === "event" ? "warn" : "info"}>
                {campaignTypeLabel(extras.campaign_type)}
              </Pill>
            )}
            <span className="text-[12px] text-stone-400">#{id}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            {facts.map((f) => (
              <div key={f.k} className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-stone-500">{f.k}</span>
                {f.v ? (
                  <b className="text-[14px] font-medium text-stone-900">{f.v}</b>
                ) : (
                  <Link href={f.href} className="text-[13px] font-medium text-[#D73F09] hover:underline">
                    + Add
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn href={`/admin/campaigns/${id}/page`}>Opt-in page</Btn>
          <Btn href={`/admin/pay?campaign=${id}`}>Payouts</Btn>
          <MoreMenu
            groups={[
              {
                heading: "Pages",
                items: [
                  { label: "Opt-in page (public link)", href: `/join/${id}`, external: true },
                  { label: "Campaign list", href: "/admin/campaigns" },
                ],
              },
              {
                heading: "Tools",
                items: [
                  { label: "Make an audience", href: "/admin/audiences" },
                  { label: "Affiliate payments", href: "/admin/pay/affiliate" },
                  { label: "Bonus payments", href: "/admin/pay/bonus" },
                  { label: c.is_active ? "Archive campaign" : "Reactivate campaign", href: `${editHref}#archive` },
                ],
              },
            ]}
          />
          <Btn href={editHref} primary>
            Edit campaign
          </Btn>
        </div>
      </div>
    </div>
  );
}
