import { createPlainSupabase } from "@/lib/supabase";
import type { CaseStudy } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createPlainSupabase();
  const { data } = await supabase.from("case_studies").select("title, brand_name").eq("slug", params.slug).single();
  return { title: data ? `${data.title} | ${data.brand_name} - Postgame` : "Case Study | Postgame" };
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  :root{--orange:#D73F09;--bg:#0A0A0A;--surface:#141414;--border:rgba(255,255,255,0.08);--text:#fff;--text-muted:rgba(255,255,255,0.55);--text-dim:rgba(255,255,255,0.35);}
  *{box-sizing:border-box;}
  .back-bar{border-bottom:1px solid var(--border);padding:16px 48px;}
  .back-link{color:var(--text-muted);font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;transition:color 0.2s;}
  .back-link:hover{color:var(--orange);}
  .hero{max-width:860px;margin:0 auto;padding:64px 48px 48px;}
  .hero-meta{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
  .hero-brand{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:var(--orange);}
  .hero-dot{color:var(--text-dim);}
  .hero-cat{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-dim);}
  .hero-title{font-size:clamp(40px,6vw,72px);line-height:0.95;margin:0 0 24px;font-family:'Bebas Neue',Arial,sans-serif;}
  .hero-stat{font-size:clamp(48px,7vw,80px);font-family:'Bebas Neue',Arial,sans-serif;color:var(--orange);line-height:1;}
  .hero-stat-label{font-size:16px;color:var(--text-muted);margin-left:12px;}
  .hero-img{max-width:1000px;margin:0 auto;padding:0 48px 48px;}
  .hero-img img{width:100%;border-radius:20px;border:1px solid var(--border);display:block;}
  .content{max-width:860px;margin:0 auto;padding:0 48px 80px;}
  .cs-section{margin-bottom:48px;}
  .cs-section-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:var(--orange);margin-bottom:16px;}
  .cs-section-body{font-size:16px;color:var(--text-muted);line-height:1.8;white-space:pre-line;}
  .cs-block{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px;margin-bottom:16px;}
  .highlights-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .highlight-item{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 24px;display:flex;align-items:flex-start;gap:16px;}
  .highlight-num{width:32px;height:32px;border-radius:50%;background:rgba(215,63,9,0.15);color:var(--orange);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;}
  .highlight-text{font-size:14px;color:var(--text-muted);line-height:1.6;}
  .cta-bar{padding-top:32px;border-top:1px solid var(--border);display:flex;gap:16px;}
  .btn-back{padding:10px 24px;border:1.5px solid rgba(255,255,255,0.15);border-radius:8px;color:var(--text-muted);font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;}
  .btn-cta{padding:10px 24px;background:var(--orange);border-radius:8px;color:#fff;font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;}
`;

export default async function CaseStudyDetailPage({ params }: Props) {
  const supabase = createPlainSupabase();
  const { data } = await supabase.from("case_studies").select("*").eq("slug", params.slug).eq("published", true).single();
  if (!data) notFound();
  const s = data as CaseStudy;

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
<div style={{ paddingTop: 80 }}>
        <div className="back-bar">
          <Link href="/case-studies" className="back-link">← All Case Studies</Link>
        </div>

        <div className="hero">
          <div className="hero-meta">
            <span className="hero-brand">{s.brand_name}</span>
            {s.category && <><span className="hero-dot">·</span><span className="hero-cat">{s.category}</span></>}
          </div>
          <h1 className="hero-title">{s.title}</h1>
          {s.hero_stat && (
            <div style={{ marginBottom: 16 }}>
              <span className="hero-stat">{s.hero_stat}</span>
              {s.hero_stat_label && <span className="hero-stat-label">{s.hero_stat_label}</span>}
            </div>
          )}
        </div>

        {s.image_url && (
          <div className="hero-img">
            <img src={s.image_url} alt={s.title} />
          </div>
        )}

        <div className="content">
          {s.overview && (
            <div className="cs-section">
              <div className="cs-section-title">Overview</div>
              <p className="cs-section-body">{s.overview}</p>
            </div>
          )}
          {s.challenge && (
            <div className="cs-section">
              <div className="cs-block">
                <div className="cs-section-title">The Challenge</div>
                <p className="cs-section-body">{s.challenge}</p>
              </div>
            </div>
          )}
          {s.solution && (
            <div className="cs-section">
              <div className="cs-block">
                <div className="cs-section-title">The Solution</div>
                <p className="cs-section-body">{s.solution}</p>
              </div>
            </div>
          )}
          {s.results && (
            <div className="cs-section">
              <div className="cs-block">
                <div className="cs-section-title">Results</div>
                <p className="cs-section-body">{s.results}</p>
              </div>
            </div>
          )}
          {s.highlights && s.highlights.length > 0 && (
            <div className="cs-section">
              <div className="cs-section-title">Highlights</div>
              <div className="highlights-grid">
                {s.highlights.map((h: string, i: number) => (
                  <div key={i} className="highlight-item">
                    <div className="highlight-num">{i + 1}</div>
                    <p className="highlight-text">{h}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="cta-bar">
            <Link href="/case-studies" className="btn-back">← All Case Studies</Link>
            <Link href="/contact" className="btn-cta">Work With Us</Link>
          </div>
        </div>
      </div>

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
    </div>
  );
}
