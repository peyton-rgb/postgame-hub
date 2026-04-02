"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

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
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontFamily: "Arial, sans-serif" }}>
      Loading...
    </div>
  );

  if (!deal) return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontFamily: "Arial, sans-serif" }}>
      <p style={{ fontSize: 18, marginBottom: 16 }}>Deal not found.</p>
      <Link href="/deals" style={{ color: "#D73F09", fontWeight: 700 }}>← Back to Deal Tracker</Link>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ paddingTop: 64 }}>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 48px" }}>
          <Link href="/deals" style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            ← Back to Deal Tracker
          </Link>
        </div>

        {deal.image_url && (
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 48px 0" }}>
            <div style={{ aspectRatio: "4/5", maxHeight: 600, overflow: "hidden", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
              <img src={deal.image_url} alt={deal.athlete_name || deal.brand_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        )}

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 48px 80px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#D73F09", marginBottom: 16 }}>
            {deal.brand_name}
          </div>
          <h1 className="d" style={{ fontSize: "clamp(40px,6vw,64px)", lineHeight: 0.95, margin: "0 0 24px" }}>
            {deal.athlete_name || "Team Campaign"}
          </h1>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
            {(deal.athlete_school || deal.athlete_sport) && (
              <span style={{ fontSize: 24, lineHeight: 1.4, color: "rgba(255,255,255,0.55)" }}>
                {[deal.athlete_school, deal.athlete_sport].filter(Boolean).join(" · ")}
              </span>
            )}
            {deal.date_announced && (
              <span style={{ fontSize: 18, lineHeight: 1.2, color: "rgba(255,255,255,0.35)" }}>
                {new Date(deal.date_announced + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          {deal.deal_type && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
              {deal.deal_type.split(",").map((t) => (
                <span key={t.trim()} style={{ fontSize: 18, lineHeight: 1.2, padding: "6px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.03)" }}>
                  {t.trim()}
                </span>
              ))}
            </div>
          )}

          {deal.description ? (
            <div style={{ fontSize: 24, lineHeight: 1.4, color: "rgba(255,255,255,0.7)" }}>
              {deal.description.split("\n").map((para, i) => <p key={i} style={{ marginBottom: 16 }}>{para}</p>)}
            </div>
          ) : (
            <p style={{ fontSize: 24, lineHeight: 1.4, color: "rgba(255,255,255,0.35)" }}>More details coming soon.</p>
          )}

          <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href="/deals" className="btn-secondary">← All Deals</Link>
            <Link href="/contact" className="btn-primary">Work With Us</Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
