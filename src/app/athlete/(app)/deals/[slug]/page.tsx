// ============================================================
// Deal detail / opt-in (mockup screen 2)
//
// Hero + brand, quick facts, deliverables ("what you'll create"), the deal
// goal, and the FTC ack + opt-in CTA. If the athlete is already opted in we
// show an "already in" state instead of the opt-in form.
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAthlete } from "@/lib/athlete-auth";
import { getDealBySlug, getMyOptin } from "@/lib/athlete-deals";
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
  const platforms = (deal.social_platforms || []).filter(Boolean);

  return (
    <div>
      {/* Hero */}
      <div className="a-hero" style={{ height: 190 }}>
        {deal.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="a-heroimg" src={deal.hero_image_url} alt={`${deal.title} hero`} />
        )}
        <Link
          href="/athlete"
          style={{ position: "absolute", top: 14, left: 14, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: "#fff", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        {brandLogo && (
          <div className="a-logochip" style={{ top: 14, right: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogo} alt={brandName} />
          </div>
        )}
        <div className="a-overlay" style={{ display: "block" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,245,0.7)" }}>New NIL opportunity</div>
          <div className="a-d" style={{ fontSize: 24, textTransform: "uppercase" }}>{deal.title}</div>
        </div>
      </div>

      <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Quick facts */}
        <div style={{ display: "flex", gap: 9 }}>
          <div className="a-card" style={{ flex: 1, textAlign: "center", padding: 10, border: "none", background: "rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 12, color: "var(--a-off)", marginTop: 2 }}>{deal.payout || "Paid deal"}</div>
            <div className="a-muted" style={{ fontSize: 11 }}>Reward</div>
          </div>
          {platforms.length > 0 && (
            <div className="a-card" style={{ flex: 1, textAlign: "center", padding: 10, border: "none", background: "rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 12, color: "var(--a-off)", marginTop: 2, textTransform: "capitalize" }}>{platforms.join(" · ")}</div>
              <div className="a-muted" style={{ fontSize: 11 }}>Where</div>
            </div>
          )}
          {deal.deadline && (
            <div className="a-card" style={{ flex: 1, textAlign: "center", padding: 10, border: "none", background: "rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 12, color: "var(--a-off)", marginTop: 2 }}>
                {new Date(deal.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <div className="a-muted" style={{ fontSize: 11 }}>Due</div>
            </div>
          )}
        </div>

        {/* What you'll create */}
        {lines.length > 0 && (
          <div className="a-card" style={{ textAlign: "left" }}>
            <div className="a-d" style={{ fontSize: 16, marginBottom: 9 }}>WHAT YOU&rsquo;LL CREATE</div>
            {lines.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i < lines.length - 1 ? 7 : 0 }}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "var(--a-green)", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", flex: "none", marginTop: 1 }}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8.5 12.5l2.5 2.5 4.5-5" />
                </svg>
                <span style={{ fontSize: 13, color: "rgba(250,248,245,0.85)" }}>{line}</span>
              </div>
            ))}
          </div>
        )}

        {/* About this deal */}
        {(deal.goal || deal.headline) && (
          <div className="a-card" style={{ textAlign: "left" }}>
            <div className="a-d" style={{ fontSize: 16, marginBottom: 6 }}>ABOUT THIS DEAL</div>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(250,248,245,0.7)" }}>{deal.goal || deal.headline}</span>
          </div>
        )}

        {/* Opt-in / already in */}
        {optin ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="a-card" style={{ display: "flex", alignItems: "center", gap: 10, borderColor: "rgba(52,199,89,0.3)" }}>
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "var(--a-green)", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }}>
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 12.5l2.5 2.5 4.5-5" />
              </svg>
              <span style={{ fontSize: 13, color: "rgba(250,248,245,0.85)" }}>You&rsquo;re in on this deal.</span>
            </div>
            <Link href="/athlete/my-deals" className="a-cta" style={{ textDecoration: "none" }}>
              <span className="a-d" style={{ fontSize: 18 }}>VIEW IN MY DEALS</span>
            </Link>
          </div>
        ) : (
          <OptInForm campaignId={deal.id} slug={deal.slug} brandName={brandName} />
        )}
      </div>
    </div>
  );
}
