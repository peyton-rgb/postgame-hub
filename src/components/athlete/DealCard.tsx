// Deal card for the deals home (mockup screen 1). Live deals link to the
// opt-in detail; drafts render as a dimmed "coming soon" tile.

import Link from "next/link";
import type { Deal, MyOptin } from "@/lib/athlete-deals";

export default function DealCard({ deal, optin }: { deal: Deal; optin?: MyOptin | null }) {
  const isLive = deal.status === "live";
  const optedIn = !!optin;
  const brandLogo = deal.brand?.logo_url || deal.brand?.logo_white_url || null;
  const subtitle = deal.payout || (isLive ? "Tap for details" : "Details soon");

  const card = (
    <div className="a-dealcard" style={{ borderColor: isLive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.08)" }}>
      <div className="a-hero">
        {deal.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={`a-heroimg${isLive ? "" : " a-dim"}`} src={deal.hero_image_url} alt={`${deal.title} hero`} />
        ) : (
          <div className="a-heroimg" style={{ background: "rgba(255,255,255,0.06)" }} />
        )}

        {/* eyebrow chip */}
        <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "5px 9px" }}>
          <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: isLive ? "#fff" : "rgba(255,255,255,0.7)" }}>
            New NIL opportunity
          </span>
        </div>

        {brandLogo && (
          <div className="a-logochip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogo} alt={deal.brand?.name || "brand"} />
          </div>
        )}

        <div className="a-overlay" style={{ background: isLive ? "rgba(7,7,10,0.62)" : "rgba(7,7,10,0.66)" }}>
          <div style={{ textAlign: "left" }}>
            <div className="a-d" style={{ fontSize: 20, textTransform: "uppercase", color: isLive ? "var(--a-off)" : "rgba(250,248,245,0.85)" }}>
              {deal.title}
            </div>
            <div style={{ fontSize: 12, color: isLive ? "rgba(250,248,245,0.78)" : "rgba(250,248,245,0.5)" }}>{subtitle}</div>
          </div>
          {optedIn ? (
            <div className="a-ctapill" style={{ background: "rgba(52,199,89,0.16)", color: "var(--a-green)" }}>Opted in</div>
          ) : isLive ? (
            <div className="a-ctapill" style={{ background: "var(--a-green)", color: "#0a3d1c" }}>Opt in now</div>
          ) : (
            <div className="a-ctapill" style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(250,248,245,0.7)" }}>Coming soon</div>
          )}
        </div>
      </div>
    </div>
  );

  // Only live deals are tappable.
  if (!isLive) return card;
  return (
    <Link href={`/athlete/deals/${deal.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      {card}
    </Link>
  );
}
