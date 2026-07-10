// ============================================================
// Deal detail / opt-in (postgame-app.html — dealdetail)
//
// Rounded hero + brand, a compensation strip, "what you'll create" and
// "about this deal" boxes, then the FTC ack + opt-in CTA. If the athlete is
// already opted in we show an "already in" state consistent with the feed.
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAthlete } from "@/lib/athlete-auth";
import { getDealBySlug, getMyOptin } from "@/lib/athlete-deals";
import { getRequiredSlots, slotLabel } from "@/lib/deliverable-status";
import OptInForm from "@/components/athlete/OptInForm";

export const dynamic = "force-dynamic";

// Turn a free-text requirements string into bullet lines, splitting on the
// common "OR" / newline separators used in the campaign data.
function deliverableLines(requirements: string | null): string[] {
  if (!requirements) return [];
  return requirements
    .split(/\n|(?:\s+OR\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function DealDetailPage({ params }: { params: { slug: string } }) {
  const profile = await requireAthlete();
  const deal = await getDealBySlug(params.slug);
  if (!deal) notFound();

  const optin = await getMyOptin(profile.id, deal.id);
  const brandName = deal.brand?.name || "the brand";
  const brandLogo = deal.brand?.logo_url || deal.brand?.logo_white_url || null;
  const lines = deliverableLines(deal.requirements);
  const youMake = getRequiredSlots(deal.required_deliverables).map(slotLabel).join(" + ");
  const dueLabel = deal.deadline
    ? new Date(deal.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <div style={{ padding: "16px 18px 0" }}>
      <Link href="/athlete" className="a-backlink">‹ ALL DEALS</Link>

      {/* Hero */}
      <div className="a-dhero" style={{ marginTop: 12 }}>
        {deal.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bg" src={deal.hero_image_url} alt="" />
        )}
        <div className="a-dhero-fade" />
        {brandLogo && (
          <div className="a-dhero-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogo} alt={brandName} />
          </div>
        )}
        <div className="a-dhero-txt">
          {deal.brand?.name && <div className="a-dhero-brand">{deal.brand.name}</div>}
          <div className="a-dhero-title">{deal.title}</div>
        </div>
      </div>

      {/* Compensation strip */}
      <div className="a-compstrip">
        <div className="a-comp" style={{ flex: "1 1 44%", minWidth: 0 }}>
          <span className="a-clab">Reward</span>
          <span className="a-camt" style={{ fontSize: 22, wordBreak: "break-word" }}>
            {deal.payout || "Paid deal"}
          </span>
        </div>
        <div className="a-compdiv" />
        <div className="a-compside">
          <div className="a-crow"><span>You make</span><b>{youMake}</b></div>
          {dueLabel && <div className="a-crow"><span>Content due</span><b>{dueLabel}</b></div>}
          <div className="a-crow"><span>Paid via</span><b>PayPal</b></div>
        </div>
      </div>

      {/* What you'll create */}
      {lines.length > 0 && (
        <div className="a-ibox" style={{ marginTop: 14 }}>
          <div className="a-ilabel">What you&rsquo;re making</div>
          {lines.map((line, i) => (
            <div key={i} className="a-irow">
              <span className="a-inum">{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: 13, color: "rgba(250,248,245,0.85)", lineHeight: 1.45 }}>{line}</span>
            </div>
          ))}
        </div>
      )}

      {/* About this deal */}
      {(deal.goal || deal.headline) && (
        <div className="a-ibox" style={{ marginTop: 8, padding: "12px 14px 14px" }}>
          <div className="a-ilabel" style={{ padding: "0 0 6px" }}>About this deal</div>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(250,248,245,0.7)" }}>
            {deal.goal || deal.headline}
          </span>
        </div>
      )}

      {/* Opt-in / already in */}
      <div style={{ marginTop: 16 }}>
        {optin ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="a-card" style={{ display: "flex", alignItems: "center", gap: 10, borderColor: "rgba(9,215,63,0.3)" }}>
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "var(--a-green)", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }}>
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 12.5l2.5 2.5 4.5-5" />
              </svg>
              <span style={{ fontSize: 13, color: "rgba(250,248,245,0.85)" }}>You&rsquo;re in on this deal.</span>
            </div>
            <Link href="/athlete/my-deals" className="a-cta" style={{ textDecoration: "none" }}>
              <span className="a-anton" style={{ fontSize: 15 }}>VIEW IN MY DEALS</span>
            </Link>
          </div>
        ) : (
          <OptInForm campaignId={deal.id} slug={deal.slug} brandName={brandName} />
        )}
      </div>
    </div>
  );
}
