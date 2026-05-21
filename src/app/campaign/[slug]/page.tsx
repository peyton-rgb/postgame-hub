import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 120;

type Props = { params: Promise<{ slug: string }> };

/* ── Supabase helper ─────────────────────────────────── */
function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/* ── SEO metadata ────────────────────────────────────── */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: c } = await sb()
    .from("campaign_recaps")
    .select("name, client_name, description")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (!c) return { title: "Not Found" };
  return {
    title: `${c.name} — ${c.client_name} | Postgame`,
    description: c.description || `${c.name} campaign by ${c.client_name}`,
  };
}

/* ── styles ──────────────────────────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
:root{--orange:#D73F09;--bg:#0A0A0A;--surface:#141414;--border:rgba(255,255,255,.08);--text:#fff;--muted:rgba(255,255,255,.55);--dim:rgba(255,255,255,.35);}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;}
.d{font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:.02em;}

/* nav */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 48px;background:rgba(10,10,10,.92);backdrop-filter:blur(16px);box-shadow:0 1px 0 var(--border);}
.nav-logo{font-size:22px;font-weight:900;color:var(--orange);text-decoration:none;}
.nav-links{display:flex;align-items:center;gap:32px;}
.nav-links a{color:var(--muted);font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:.05em;transition:color .2s;}
.nav-links a:hover{color:var(--text);}
.btn-outline{padding:8px 20px;border:1.5px solid var(--orange);border-radius:8px;color:var(--orange);font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:.06em;transition:all .2s;}
.btn-outline:hover{background:var(--orange);color:#fff;}
.btn-solid{padding:10px 28px;background:var(--orange);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;transition:background .2s;}
.btn-solid:hover{background:#c43808;}

/* hero */
.c-hero{padding:160px 48px 80px;text-align:center;background:radial-gradient(ellipse at 50% 0%,rgba(215,63,9,.08) 0%,transparent 60%);}
.c-hero-logo{height:64px;width:auto;margin:0 auto 24px;display:block;object-fit:contain;}
.c-hero-title{font-size:clamp(48px,7vw,72px);line-height:.95;margin:0 0 16px;}
.c-hero-tags{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:32px;}
.c-tag{padding:6px 16px;border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);}
.c-hero-desc{font-size:18px;color:var(--muted);line-height:1.7;max-width:640px;margin:0 auto;}

/* stats row */
.c-stats{display:flex;justify-content:center;gap:64px;padding:48px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.c-stat{text-align:center;}
.c-stat-val{font-size:clamp(36px,5vw,56px);line-height:1;color:var(--orange);}
.c-stat-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--dim);margin-top:8px;}

/* featured athletes */
.c-section{padding:80px 48px;}
.c-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.2em;color:var(--orange);margin-bottom:12px;}
.c-section-title{font-size:clamp(32px,4vw,48px);line-height:1;margin:0 0 48px;}
.c-athletes{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:24px;}
.c-athlete{padding:28px 24px;border-radius:16px;border:1px solid var(--border);background:var(--surface);text-align:center;transition:border-color .2s;}
.c-athlete:hover{border-color:rgba(215,63,9,.4);}
.c-athlete-name{font-size:18px;font-weight:800;margin-bottom:4px;}
.c-athlete-school{font-size:13px;color:var(--muted);margin-bottom:2px;}
.c-athlete-sport{font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;}

/* gallery */
.c-gallery{column-count:3;column-gap:16px;}
.c-gallery-item{break-inside:avoid;margin-bottom:16px;border-radius:12px;overflow:hidden;position:relative;}
.c-gallery-item img,.c-gallery-item video{width:100%;display:block;}
.c-gallery-item:hover{transform:scale(1.01);transition:transform .3s;}

/* cta */
.c-cta{text-align:center;padding:100px 24px;background:radial-gradient(ellipse at 50% 100%,rgba(215,63,9,.1) 0%,transparent 60%);}
.c-cta-title{font-size:clamp(36px,5vw,56px);line-height:1;margin:0 0 16px;}
.c-cta-sub{font-size:16px;color:var(--muted);margin:0 0 36px;max-width:480px;display:inline-block;line-height:1.6;}
.c-cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

/* back link */
.c-back{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:.06em;margin-bottom:24px;transition:color .2s;}
.c-back:hover{color:var(--text);}

/* footer */
.footer{border-top:1px solid var(--border);padding:48px 48px 40px;}
.footer-inner{max-width:1200px;margin:0 auto;}
.footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:48px;margin-bottom:40px;}
.footer-brand-desc{font-size:13px;color:var(--muted);line-height:1.6;max-width:240px;}
.footer-col-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--dim);margin-bottom:16px;}
.footer-links{list-style:none;}
.footer-links li{margin-bottom:10px;}
.footer-links a{font-size:14px;color:var(--muted);text-decoration:none;transition:color .2s;}
.footer-links a:hover{color:var(--text);}
.footer-bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:24px;}
.footer-copy{font-size:12px;color:var(--dim);}
.footer-socials{display:flex;gap:24px;}
.footer-socials a{font-size:12px;color:var(--muted);text-decoration:none;transition:color .2s;}
.footer-socials a:hover{color:var(--text);}

@media(max-width:900px){
  .nav{padding:14px 24px;} .nav-links{display:none;}
  .c-hero{padding:120px 24px 60px;}
  .c-stats{gap:32px;padding:32px 24px;}
  .c-section{padding:60px 24px;}
  .c-gallery{column-count:2;}
  .c-athletes{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));}
  .footer-top{grid-template-columns:1fr 1fr;gap:32px;}
}
@media(max-width:600px){
  .c-gallery{column-count:1;}
  .c-stats{flex-direction:column;gap:24px;}
}
`;

/* ── page component ──────────────────────────────────── */
export default async function CampaignShowcasePage({ params }: Props) {
  const { slug } = await params;
  const supabase = sb();

  // Fetch campaign (public fields only — no metrics)
  const { data: campaign } = await supabase
    .from("campaign_recaps")
    .select("id, name, slug, description, hero_image_url, client_name, brand_id, settings, tags, public_sections")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!campaign) notFound();

  // Fetch brand info
  const { data: brand } = await supabase
    .from("brands")
    .select("name, logo_url, logo_light_url")
    .eq("id", campaign.brand_id)
    .single();

  // Fetch athletes — only name, school, sport (NO metrics, NO follower counts)
  const { data: allAthletes } = await supabase
    .from("athletes")
    .select("id, name, school, sport, is_featured, featured_order")
    .eq("campaign_id", campaign.id)
    .order("sort_order");

  // Fetch media for gallery
  const { data: allMedia } = await supabase
    .from("media")
    .select("id, file_url, thumbnail_url, type, is_video_thumbnail")
    .eq("campaign_id", campaign.id)
    .order("sort_order")
    .limit(30);

  const athletes = allAthletes || [];
  const media = (allMedia || []).filter((m: any) => !m.is_video_thumbnail);
  const featuredAthletes = athletes
    .filter((a: any) => a.is_featured)
    .sort((a: any, b: any) => (a.featured_order || 99) - (b.featured_order || 99));

  const brandName = brand?.name || campaign.client_name || "";
  const brandLogo = brand?.logo_light_url || brand?.logo_url || "";
  const description = campaign.description || "";
  const tags: string[] = campaign.settings?.tags || campaign.tags || [];
  const athleteCount = athletes.length;
  const schoolCount = new Set(athletes.map((a: any) => a.school).filter(Boolean)).size;
  const sportCount = new Set(athletes.map((a: any) => a.sport).filter(Boolean)).size;

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Nav */}
      <nav className="nav">
        <a href="/homepage" className="nav-logo">POSTGAME</a>
        <div className="nav-links">
          <a href="/clients">Clients</a>
          <a href="/campaigns">Campaigns</a>
          <a href="/about/team">About</a>
          <a href="/contact" className="btn-outline">Contact</a>
          <a href="/deals" className="btn-solid">Deal Tracker</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="c-hero">
        {brandLogo && (
          <img src={brandLogo} alt={brandName} className="c-hero-logo" />
        )}
        <h1 className="d c-hero-title">{campaign.name}</h1>
        {tags.length > 0 && (
          <div className="c-hero-tags">
            {tags.slice(0, 5).map((tag: string, i: number) => (
              <span key={i} className="c-tag">{tag}</span>
            ))}
          </div>
        )}
        {description && <p className="c-hero-desc">{description}</p>}
      </section>

      {/* Stats — safe numbers only: athlete count, schools, sports */}
      <section className="c-stats">
        <div className="c-stat">
          <div className="d c-stat-val">{athleteCount}</div>
          <div className="c-stat-label">Athletes</div>
        </div>
        {schoolCount > 1 && (
          <div className="c-stat">
            <div className="d c-stat-val">{schoolCount}</div>
            <div className="c-stat-label">Universities</div>
          </div>
        )}
        {sportCount > 1 && (
          <div className="c-stat">
            <div className="d c-stat-val">{sportCount}</div>
            <div className="c-stat-label">Sports</div>
          </div>
        )}
      </section>

      {/* Featured Athletes */}
      {featuredAthletes.length > 0 && (
        <section className="c-section">
          <div className="c-eyebrow">Standout Players</div>
          <h2 className="d c-section-title">Campaign Highlights</h2>
          <div className="c-athletes">
            {featuredAthletes.map((a: any) => (
              <div key={a.id} className="c-athlete">
                <div className="c-athlete-name">{a.name}</div>
                {a.school && <div className="c-athlete-school">{a.school}</div>}
                {a.sport && <div className="c-athlete-sport">{a.sport}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Content Gallery */}
      {media.length > 0 && (
        <section className="c-section">
          <div className="c-eyebrow">The Work</div>
          <h2 className="d c-section-title">Campaign Content</h2>
          <div className="c-gallery">
            {media.map((m: any) => (
              <div key={m.id} className="c-gallery-item">
                {m.type === "video" ? (
                  <video
                    src={m.file_url}
                    poster={m.thumbnail_url || undefined}
                    controls
                    playsInline
                    preload="none"
                    style={{ width: "100%", display: "block" }}
                  />
                ) : (
                  <img
                    src={m.file_url}
                    alt="Campaign content"
                    loading="lazy"
                    style={{ width: "100%", display: "block" }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="c-cta">
        <a href="/campaigns" className="c-back">&larr; All Campaigns</a>
        <h2 className="d c-cta-title">Want Results<br />Like These?</h2>
        <p className="c-cta-sub">Postgame builds campaigns that put your brand in the hands of the most influential athletes in college sports.</p>
        <div className="c-cta-btns">
          <a href="/contact" className="btn-solid">Work With Us</a>
          <a href="/campaigns" className="btn-outline">More Campaigns</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <a href="/homepage" style={{ display: "inline-block", marginBottom: 16 }}>
                <img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} />
              </a>
              <p className="footer-brand-desc">The #1 NIL agency in the country. Connecting elite college athletes with the world&apos;s most ambitious brands.</p>
            </div>
            <div><div className="footer-col-title">Company</div><ul className="footer-links"><li><a href="/about/team">About</a></li><li><a href="/services/elevated">Services</a></li><li><a href="/contact">Contact</a></li></ul></div>
            <div><div className="footer-col-title">Network</div><ul className="footer-links"><li><a href="/clients">Clients</a></li><li><a href="/campaigns">Campaigns</a></li><li><a href="/deals">Deal Tracker</a></li></ul></div>
            <div><div className="footer-col-title">Connect</div><ul className="footer-links"><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li><li><a href="#">Twitter / X</a></li><li><a href="#">LinkedIn</a></li></ul></div>
          </div>
          <div className="footer-bottom">
            <div className="footer-copy">&copy; {new Date().getFullYear()} Postgame. All rights reserved.</div>
            <div className="footer-socials"><a href="#">Privacy</a><a href="#">Terms</a><a href="/contact">Contact</a></div>
          </div>
        </div>
      </footer>
    </div>
  );
}

