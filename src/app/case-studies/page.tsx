import { createPlainSupabase } from "@/lib/supabase";
import type { CaseStudy } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 60;

export const metadata: Metadata = { title: "Case Studies | Postgame" };

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  :root{--orange:#D73F09;--bg:#0A0A0A;--surface:#141414;--border:rgba(255,255,255,0.08);--text:#fff;--text-muted:rgba(255,255,255,0.55);--text-dim:rgba(255,255,255,0.35);}
  *{box-sizing:border-box;}
  .hero{padding:140px 48px 64px;text-align:center;background:radial-gradient(ellipse at 50% 0%,rgba(215,63,9,0.1) 0%,transparent 60%);}
  .hero-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:20px;}
  .hero-title{font-size:clamp(48px,8vw,80px);line-height:0.95;margin:0;font-family:'Bebas Neue',Arial,sans-serif;color:var(--text);}
  .hero-divider{width:48px;height:3px;background:var(--orange);margin:32px auto 0;}
  .section{max-width:1100px;margin:0 auto;padding:0 48px 80px;}
  .featured-card{display:grid;grid-template-columns:1fr 1fr;border-radius:20px;overflow:hidden;border:1px solid var(--border);background:var(--surface);text-decoration:none;color:inherit;transition:border-color 0.2s;}
  .featured-card:hover{border-color:rgba(215,63,9,0.5);}
  .featured-img{aspect-ratio:16/10;overflow:hidden;}
  .featured-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.5s;}
  .featured-card:hover .featured-img img{transform:scale(1.05);}
  .featured-info{padding:40px;}
  .featured-tag{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:var(--orange);margin-bottom:8px;}
  .featured-category{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-dim);margin-left:12px;}
  .featured-title{font-size:clamp(22px,2.5vw,32px);font-weight:900;line-height:1.2;margin:12px 0 6px;color:var(--text);font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:0.02em;}
  .featured-brand{font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:16px;}
  .featured-stat{font-size:40px;font-family:'Bebas Neue',Arial,sans-serif;color:var(--orange);line-height:1;}
  .featured-stat-label{font-size:13px;color:var(--text-muted);margin-left:8px;}
  .featured-overview{font-size:15px;color:var(--text-muted);line-height:1.7;margin-top:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:48px;}
  .card{border-radius:16px;overflow:hidden;border:1px solid var(--border);background:var(--surface);text-decoration:none;color:inherit;display:block;transition:border-color 0.2s,transform 0.25s;}
  .card:hover{border-color:rgba(215,63,9,0.4);transform:translateY(-4px);}
  .card-img{aspect-ratio:16/10;overflow:hidden;}
  .card-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.5s;}
  .card:hover .card-img img{transform:scale(1.05);}
  .card-info{padding:20px 24px 24px;}
  .card-cat{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--orange);margin-bottom:6px;}
  .card-title{font-size:20px;font-weight:900;line-height:1.2;margin:0 0 4px;font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:0.02em;}
  .card-brand{font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:12px;}
  .card-stat{font-size:28px;font-family:'Bebas Neue',Arial,sans-serif;color:var(--orange);line-height:1;}
  .card-stat-label{font-size:11px;color:var(--text-muted);margin-left:6px;}
  .card-overview{font-size:13px;color:var(--text-muted);line-height:1.6;margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .empty{text-align:center;padding:80px 24px;color:var(--text-muted);}
  @media(max-width:600px){.grid{grid-template-columns:1fr;}}
`;

export default async function CaseStudiesPage() {
  const supabase = createPlainSupabase();
  const { data: studies } = await supabase
    .from("case_studies")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("published_date", { ascending: false });

  const all = (studies || []) as CaseStudy[];
  const featured = all.find((s) => s.featured);
  const rest = all.filter((s) => s.id !== featured?.id);

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
<div className="hero">
        <div className="hero-eyebrow">Postgame</div>
        <h1 className="hero-title">Case Studies</h1>
        <div className="hero-divider" />
      </div>

      <div className="section">
        {featured && (
          <Link href={`/case-studies/${featured.slug}`} className="featured-card">
            {featured.image_url && (
              <div className="featured-img"><img src={featured.image_url} alt={featured.title} /></div>
            )}
            <div className="featured-info">
              <div style={{ display: "flex", alignItems: "center" }}>
                <span className="featured-tag">Featured</span>
                {featured.category && <span className="featured-category">{featured.category}</span>}
              </div>
              <h2 className="featured-title">{featured.title}</h2>
              <p className="featured-brand">{featured.brand_name}</p>
              {featured.hero_stat && (
                <div>
                  <span className="featured-stat">{featured.hero_stat}</span>
                  {featured.hero_stat_label && <span className="featured-stat-label">{featured.hero_stat_label}</span>}
                </div>
              )}
              {featured.overview && <p className="featured-overview">{featured.overview}</p>}
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="grid">
            {rest.map((s) => (
              <Link key={s.id} href={`/case-studies/${s.slug}`} className="card">
                {s.image_url && <div className="card-img"><img src={s.image_url} alt={s.title} /></div>}
                <div className="card-info">
                  {s.category && <div className="card-cat">{s.category}</div>}
                  <h3 className="card-title">{s.title}</h3>
                  <p className="card-brand">{s.brand_name}</p>
                  {s.hero_stat && (
                    <div>
                      <span className="card-stat">{s.hero_stat}</span>
                      {s.hero_stat_label && <span className="card-stat-label">{s.hero_stat_label}</span>}
                    </div>
                  )}
                  {s.overview && <p className="card-overview">{s.overview}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {all.length === 0 && <div className="empty">No case studies published yet.</div>}
      </div>

      <footer>
        <div className="pg-footer">
          <div>
            <a href="/homepage"><img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} /></a>
            <p className="pg-footer-brand-desc">The #1 NIL agency in the country. Connecting elite college athletes with the world's most ambitious brands.</p>
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
