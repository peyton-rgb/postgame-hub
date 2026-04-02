"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";
import Link from "next/link";


const SharedNav = () => (
);

const SharedFooter = () => (
  <footer>
    <div className="pg-footer">
      <div>
        <a href="/homepage"><img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} /></a>
        <p className="pg-footer-brand-desc">The #1 NIL agency in the country. Connecting elite college athletes with the world&apos;s most ambitious brands.</p>
      </div>
      <div><div className="pg-footer-col-title">Company</div><ul className="pg-footer-links"><li><a href="/about/team">About</a></li><li><a href="/services/elevated">Services</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><div className="pg-footer-col-title">Network</div><ul className="pg-footer-links"><li><a href="/clients">Clients</a></li><li><a href="/campaigns">Campaigns</a></li><li><a href="/deals">Deal Tracker</a></li></ul></div>
      <div><div className="pg-footer-col-title">Connect</div><ul className="pg-footer-links"><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li><li><a href="#">Twitter / X</a></li><li><a href="#">LinkedIn</a></li></ul></div>
    </div>
    <div className="pg-footer-bottom">
      <div className="pg-footer-copy">&copy; {new Date().getFullYear()} Postgame. All rights reserved.</div>
      <div className="pg-footer-socials"><a href="#">Privacy</a><a href="#">Terms</a><a href="/contact">Contact</a></div>
    </div>
  </footer>
);

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.from("deals").select("*").eq("id", id).eq("published", true).single();
      setDeal(data as Deal | null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontFamily: "Arial, sans-serif" }}>
<SharedNav />
      Loading...
    </div>
  );

  if (!deal) return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontFamily: "Arial, sans-serif" }}>
<SharedNav />
      <p style={{ fontSize: 18, marginBottom: 16 }}>Deal not found.</p>
      <Link href="/deals" style={{ color: "#D73F09", fontWeight: 700 }}>← Back to Deal Tracker</Link>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}>
<SharedNav />

      <div style={{ paddingTop: 80 }}>
        {/* Back link */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 48px" }}>
          <Link href="/deals" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em", transition: "color 0.2s" }}>
            ← Back to Deal Tracker
          </Link>
        </div>

        {/* Hero image */}
        {deal.image_url && (
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 48px 0" }}>
            <div style={{ aspectRatio: "4/5", maxHeight: 600, overflow: "hidden", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
              <img src={deal.image_url} alt={deal.athlete_name || deal.brand_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 48px 80px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#D73F09", marginBottom: 16 }}>
            {deal.brand_name}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(40px,6vw,64px)", lineHeight: 0.95, margin: "0 0 24px", color: "#fff" }}>
            {deal.athlete_name || "Team Campaign"}
          </h1>

          {/* Meta */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
            {(deal.athlete_school || deal.athlete_sport) && (
              <span style={{ fontSize: 15, color: "rgba(255,255,255,0.55)" }}>
                {[deal.athlete_school, deal.athlete_sport].filter(Boolean).join(" · ")}
              </span>
            )}
            {deal.date_announced && (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
                {new Date(deal.date_announced + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          {/* Tags */}
          {deal.deal_type && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
              {deal.deal_type.split(",").map((t) => (
                <span key={t.trim()} style={{ fontSize: 12, padding: "6px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.03)" }}>
                  {t.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {deal.description ? (
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 1.8 }}>
              {deal.description.split("\n").map((para, i) => <p key={i} style={{ marginBottom: 16 }}>{para}</p>)}
            </div>
          ) : (
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.35)" }}>More details coming soon.</p>
          )}

          {/* CTA */}
          <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 16 }}>
            <Link href="/deals" style={{ padding: "10px 24px", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              ← All Deals
            </Link>
            <Link href="/contact" style={{ padding: "10px 24px", background: "#D73F09", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Work With Us
            </Link>
          </div>
        </div>
      </div>

      <SharedFooter />
    </div>
  );
}
