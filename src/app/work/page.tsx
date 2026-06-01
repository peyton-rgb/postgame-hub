// Example campaign page. This is a SERVER component (no "use client" at the top),
// so it can fetch from the database, then it hands the data to the cover flow.

import CampaignCoverFlow from "@/components/CampaignCoverFlow";       // ADJUST path if needed
import { getCoverFlowCampaigns } from "@/lib/getCoverFlowCampaigns";  // ADJUST path if needed

export default async function Page() {
  const campaigns = await getCoverFlowCampaigns();

  return (
    <main className="min-h-screen bg-[#08080b] text-[#FAF8F5]">
      <section className="max-w-[1180px] mx-auto px-9 pt-14">
        <h1
          className="text-[46px] leading-[.95] tracking-[1px]"
          style={{ fontFamily: "var(--font-bebas), sans-serif" }}
        >
          OUR <span className="text-[#D73F09]">WORK</span>
        </h1>
        <p className="text-[13px] text-white/60 mt-[10px] max-w-[560px] leading-relaxed">
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
