// Example campaign page. This is a SERVER component (no "use client" at the top),
// so it can fetch from the database, then it hands the data to the cover flow.

import CampaignCoverFlow from "@/components/CampaignCoverFlow";       // ADJUST path if needed
import { getCoverFlowCampaigns } from "@/lib/getCoverFlowCampaigns";  // ADJUST path if needed

export default async function Page() {
  const campaigns = await getCoverFlowCampaigns();

  return (
    <main className="min-h-screen bg-[#08080b] text-[#FAF8F5]">
      {/* The nav is fixed at var(--nav-h) (64px), so a page that starts its
          content at less than that renders its first heading UNDER it — pt-14
          was 56px and clipped this one. Offsetting from the variable keeps the
          two in step if the nav height ever changes. */}
      <section className="max-w-[1180px] mx-auto px-9 pt-[calc(var(--nav-h)+56px)]">
        <h1 className="pg-h1">
          OUR <span className="text-[#D73F09]">WORK</span>
        </h1>
        <p className="pg-body mt-[10px] max-w-[560px]">
          Selected campaigns. Drag, scroll, or swipe through.
        </p>
      </section>

      {/* hrefBase = "/campaign" links each card to /campaign/[slug], the PUBLIC recap page —
          the same destination the public listing at /campaigns links its cards to. */}
      <CampaignCoverFlow campaigns={campaigns} hrefBase="/campaign" />

      <p className="text-center text-[10px] uppercase tracking-[2px] text-white/50 mt-3">
        &larr; drag · scroll · swipe &rarr;
      </p>
    </main>
  );
}
