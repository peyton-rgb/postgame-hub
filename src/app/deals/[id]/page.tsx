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
      const { data } = await supabase
        .from("deals")
        .select("*, brands(name, logo_url, logo_light_url, primary_color)")
        .eq("id", id)
        .eq("published", true)
        .single();
      setDeal(data as Deal | null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.4)", fontFamily:"Arial,sans-serif", fontSize:14 }}>
      Loading...
    </div>
  );

  if (!deal) return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.4)", fontFamily:"Arial,sans-serif", fontSize:14, gap:16 }}>
      <p>Deal not found.</p>
      <Link href="/deals" style={{ color:"#D73F09", fontWeight:700 }}>← Back to Deal Tracker</Link>
    </div>
  );

  const brand = (deal as any).brands;
  const brandLogo = brand?.logo_light_url || brand?.logo_url || "";
  const brandColor = brand?.primary_color || "#D73F09";
  const isVideo = deal.media_type === "video" || (deal.image_url && deal.image_url.includes(".mp4"));

  return (
    <div style={{ minHeight:"100vh", background:"#000", color:"#fff", fontFamily:"Arial,Helvetica,sans-serif" }}>
      <style>{`
        .deal-hero{position:relative;width:100%;background:#0a0a0a;overflow:hidden;}
        .deal-hero-media{width:100%;max-height:70vh;object-fit:cover;display:block;}
        .deal-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.2) 40%,transparent 100%);}
        .deal-hero-content{position:absolute;bottom:0;left:0;right:0;padding:48px;}
        .deal-body{max-width:800px;margin:0 auto;padding:48px 48px 80px;}
        .deal-tag{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);margin-bottom:8px;}
        .deal-brand-row{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
        .deal-brand-logo{height:28px;max-width:100px;object-fit:contain;filter:brightness(0) invert(1);opacity:0.85;}
        .deal-brand-name{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.6);}
        .deal-name{font-size:clamp(36px,6vw,64px);line-height:0.95;margin:0 0 12px;font-family:var(--font-bebas),'Bebas Neue',Arial,sans-serif;letter-spacing:0.02em;}
        .deal-meta{font-size:18px;line-height:1.2;color:rgba(255,255,255,0.55);display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
        .deal-tags{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0;}
        .deal-tag-pill{font-size:13px;padding:7px 16px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.55);background:rgba(255,255,255,0.03);}
        .deal-section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:rgba(255,255,255,0.35);margin-bottom:12px;}
        .deal-desc{font-size:24px;line-height:1.4;color:rgba(255,255,255,0.72);}
        .deal-divider{border:none;border-top:1px solid rgba(255,255,255,0.08);margin:36px 0;}
        .deal-cta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:48px;}
        @media(max-width:600px){
          .deal-hero-content{padding:24px;}
          .deal-body{padding:32px 20px 60px;}
          .deal-desc{font-size:14px;}
          .deal-meta{font-size:14px;}
        }
      `}</style>

      {/* Back bar */}
      <div style={{ paddingTop:64, borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"14px 48px" }}>
          <Link href="/deals" style={{ color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:700, textDecoration:"none", textTransform:"uppercase", letterSpacing:"0.06em" }}>
            ← Deal Tracker
          </Link>
        </div>
      </div>

      {/* Hero media */}
      {deal.image_url && (
        <div className="deal-hero">
          {isVideo ? (
            <video
              className="deal-hero-media"
              src={deal.image_url}
              autoPlay muted loop playsInline
              style={{ maxHeight:"70vh", objectPosition:(deal as any).focal_point || "center 15%" }}
            />
          ) : (
            <img
              className="deal-hero-media"
              src={deal.image_url}
              alt={deal.athlete_name || ""}
              style={{ maxHeight:"70vh", objectPosition:(deal as any).focal_point || "center 15%" }}
            />
          )}
          <div className="deal-hero-overlay" />
          <div className="deal-hero-content">
            {/* Brand logo or name */}
            <div className="deal-brand-row">
              {brandLogo
                ? <img src={brandLogo} alt={deal.brand_name} className="deal-brand-logo" />
                : <span className="deal-brand-name">{deal.brand_name}</span>
              }
            </div>
            <h1 className="deal-name">{deal.athlete_name || "Team Campaign"}</h1>
            <div className="deal-meta">
              {deal.athlete_school && <span>{deal.athlete_school}</span>}
              {deal.athlete_sport && <span style={{ color:"rgba(255,255,255,0.35)" }}>·</span>}
              {deal.athlete_sport && <span>{deal.athlete_sport}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="deal-body">
        {/* Show header if no media */}
        {!deal.image_url && (
          <>
            <div className="deal-brand-row">
              {brandLogo
                ? <img src={brandLogo} alt={deal.brand_name} className="deal-brand-logo" style={{ filter:"none", opacity:1 }} />
                : <span className="deal-brand-name">{deal.brand_name}</span>
              }
            </div>
            <h1 className="deal-name">{deal.athlete_name || "Team Campaign"}</h1>
            <div className="deal-meta">
              {deal.athlete_school && <span>{deal.athlete_school}</span>}
              {deal.athlete_sport && <><span style={{ color:"rgba(255,255,255,0.35)" }}>·</span><span>{deal.athlete_sport}</span></>}
            </div>
          </>
        )}

        {/* Tags */}
        {deal.deal_type && (
          <div className="deal-tags">
            {deal.deal_type.split(",").map((t: string) => (
              <span key={t.trim()} className="deal-tag-pill">{t.trim()}</span>
            ))}
            {deal.date_announced && (
              <span className="deal-tag-pill" style={{ color:"rgba(255,255,255,0.35)" }}>
                {new Date(deal.date_announced + "T00:00:00").toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}
              </span>
            )}
          </div>
        )}

        <hr className="deal-divider" />

        {/* Campaign write-up */}
        {deal.description && (
          <>
            <div className="deal-section-title">About This Campaign</div>
            <div className="deal-desc">
              {deal.description.split("\n").map((para: string, i: number) => (
                <p key={i} style={{ marginBottom:16 }}>{para}</p>
              ))}
            </div>
          </>
        )}

        {/* Bio / athlete info if available */}
        {(deal as any).bio && (
          <>
            <hr className="deal-divider" />
            <div className="deal-section-title">About the Athlete</div>
            <div className="deal-desc">
              {String((deal as any).bio).split("\n").map((para: string, i: number) => (
                <p key={i} style={{ marginBottom:16 }}>{para}</p>
              ))}
            </div>
          </>
        )}

        {/* CTA */}
        <div className="deal-cta-row">
          <Link href="/deals" className="btn-secondary">← All Deals</Link>
          <Link href="/contact" className="btn-primary">Work With Us</Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
