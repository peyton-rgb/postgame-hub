// Story deal card for the feed (matches postgame-app.html): full-bleed hero,
// brand logo (never the brand name as text), campaign title, a deliverables
// line derived from required_deliverables, and the opt-in CTA. Tapping the
// card opens the deal detail where the FTC ack + opt-in is completed; the CTA
// reflects a locked state once the athlete has opted in.

import Link from "next/link";
import type { Deal, MyOptin } from "@/lib/athlete-deals";
import { getRequiredSlots, slotLabel } from "@/lib/deliverable-status";

function deliverablesLine(deal: Deal): string {
  return getRequiredSlots(deal.required_deliverables).map(slotLabel).join(" + ");
}

export default function DealCard({ deal, optin }: { deal: Deal; optin?: MyOptin | null }) {
  const optedIn = !!optin;
  const brandLogo = deal.brand?.logo_url || deal.brand?.logo_white_url || null;

  return (
    <Link href={`/athlete/deals/${deal.slug}`} className="a-story">
      {deal.hero_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="a-story-bg" src={deal.hero_image_url} alt="" />
      ) : (
        <div className="a-story-bg" style={{ background: "#0e0e11" }} />
      )}

      <div className="a-story-top">
        {brandLogo ? (
          <span className="a-story-logochip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogo} alt={deal.brand?.name || "brand"} />
          </span>
        ) : (
          <span />
        )}
      </div>

      <div className="a-story-bottom">
        {deal.brand?.name && <div className="a-story-brand">{deal.brand.name}</div>}
        <div className="a-story-title">{deal.title}</div>
        <div className="a-story-meta">{deliverablesLine(deal)}</div>

        <div className={`a-optin${optedIn ? " locked" : ""}`}>
          <span className="lbl">{optedIn ? "OPTED IN" : "CLICK TO OPT IN"}</span>
          <span className="chev">›</span>
          <span className="check">✓</span>
        </div>
      </div>
    </Link>
  );
}
