import type { Metadata } from "next";
import PortalShell, { TileEmpty } from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadReports } from "@/lib/portal/pages-data";

// Reports (Phase 3b): the recap library, grouped by quarter.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Reports — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview } = await resolveSessionPortal(searchParams.brand);
  const [icon, data] = await Promise.all([getPostgameIcon(), loadReports(brand.id)]);

  return (
    <PortalShell
      active="reports"
      postgameIcon={icon}
      preview={preview}
      title="Reports"
      subtitle={data.total > 0 ? `${data.total} wrapped campaigns` : null}
    >
      <div className="pgd-page">
        {data.total === 0 ? (
          <div className="pgd-panel">
            <TileEmpty
              line="No recaps yet"
              note="Wrapped campaigns and their recaps will be listed here."
            />
          </div>
        ) : (
          data.groups.map(([quarter, items]) => (
            <section key={quarter}>
              <h2 className="pgd-group-h">{quarter}</h2>
              <div className="pgd-cards">
                {items.map((c) => (
                  <div className="pgd-card" key={c.id}>
                    {c.heroUrl ? (
                      <span className="pgd-card-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.heroUrl} alt="" />
                      </span>
                    ) : null}
                    <span className="pgd-card-body">
                      <span className="pgd-card-name">{c.name}</span>
                      {c.quarter ? <span className="pgd-card-meta">{c.quarter}</span> : null}
                      <span className="pgd-card-foot">
                        {c.figures.map((f) => (
                          <span className="pgd-stat" key={f.label}>
                            <b>{f.value}</b>
                            <span>{f.label}</span>
                          </span>
                        ))}
                        {/* "Open recap" only where a slug exists to open. The
                            public recap route is /recap/[slug]. */}
                        {c.slug ? (
                          <a
                            className="pgd-btn"
                            href={`/recap/${c.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginLeft: "auto" }}
                          >
                            Open recap
                          </a>
                        ) : null}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </PortalShell>
  );
}
