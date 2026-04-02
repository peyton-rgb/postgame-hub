import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  :root{--orange:#D73F09;--bg:#0A0A0A;--surface:#141414;--border:rgba(255,255,255,0.08);--text:#fff;--text-muted:rgba(255,255,255,0.55);--text-dim:rgba(255,255,255,0.35);}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;}
  .d{font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:0.02em;}
  .nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 48px;background:rgba(10,10,10,0.92);backdrop-filter:blur(16px);box-shadow:0 1px 0 var(--border);}
  .nav-logo{font-size:22px;font-weight:900;color:var(--orange);text-decoration:none;}
  .nav-links{display:flex;align-items:center;gap:32px;}
  .nav-links a{color:var(--text-muted);font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;transition:color 0.2s;}
  .nav-links a:hover{color:var(--text);}
  .btn-outline{padding:8px 20px;border:1.5px solid var(--orange);border-radius:8px;color:var(--orange);font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;transition:all 0.2s;}
  .btn-outline:hover{background:var(--orange);color:#fff;}
  .btn-solid{padding:10px 28px;background:var(--orange);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;transition:background 0.2s;}
  .btn-solid:hover{background:#c43808;}

  .hero{padding:160px 48px 80px;background:radial-gradient(ellipse at 50% 0%,rgba(215,63,9,0.1) 0%,transparent 60%);text-align:center;}
  .eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:20px;}
  .hero-title{font-size:clamp(48px,8vw,80px);line-height:0.95;margin:0 0 20px;}
  .hero-desc{font-size:18px;color:var(--text-muted);max-width:560px;line-height:1.6;margin:0 auto;}

  .section{padding:80px 48px;}
  .section-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:12px;}
  .section-title{font-size:clamp(32px,4vw,48px);line-height:1;margin:0 0 48px;}

  .campaigns-masonry{column-count:3;column-gap:20px;}
  .camp-card{break-inside:avoid;margin-bottom:20px;border-radius:16px;overflow:hidden;border:1px solid var(--border);background:var(--surface);transition:transform 0.25s,box-shadow 0.25s;text-decoration:none;display:block;color:inherit;}
  .camp-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.4);border-color:rgba(215,63,9,0.4);}
  .camp-media{width:100%;display:block;}
  .camp-media img,.camp-media video{width:100%;height:auto;display:block;}
  .camp-no-media{min-height:200px;display:flex;flex-direction:column;justify-content:flex-end;padding:28px;}
  .camp-info{padding:20px 24px 24px;}
  .camp-brand{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--orange);margin-bottom:4px;}
  .camp-name{font-size:22px;line-height:1.05;font-weight:800;margin-bottom:4px;}
  .camp-meta{font-size:12px;color:var(--text-muted);}
  .rc-1{background:linear-gradient(135deg,#1a1a2e,#0f3460);}
  .rc-2{background:linear-gradient(135deg,#1a1a1a,#3d1f14);}
  .rc-3{background:linear-gradient(135deg,#141414,#1e3a1e);}
  .rc-4{background:linear-gradient(135deg,#1a1a1a,#3a1e3d);}
  .rc-5{background:linear-gradient(135deg,#1a1a1a,#1e3a3a);}

  .empty{text-align:center;padding:80px 24px;color:var(--text-muted);}

  .cta{text-align:center;padding:100px 24px;background:radial-gradient(ellipse at 50% 100%,rgba(215,63,9,0.1) 0%,transparent 60%);}
  .cta-title{font-size:clamp(36px,5vw,64px);line-height:1;margin:0 0 16px;}
  .cta-sub{font-size:16px;color:var(--text-muted);margin:0 0 36px;max-width:480px;display:inline-block;line-height:1.6;}
  .cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

  .footer{border-top:1px solid var(--border);padding:48px 48px 40px;}
  .footer-inner{max-width:1200px;margin:0 auto;}
  .footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:48px;margin-bottom:40px;}
  .footer-brand-desc{font-size:13px;color:var(--text-muted);line-height:1.6;max-width:240px;}
  .footer-col-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-dim);margin-bottom:16px;}
  .footer-links{list-style:none;}
  .footer-links li{margin-bottom:10px;}
  .footer-links a{font-size:14px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;}
  .footer-links a:hover{color:var(--text);}
  .footer-bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:24px;}
  .footer-copy{font-size:12px;color:var(--text-dim);}
  .footer-socials{display:flex;gap:24px;}
  .footer-socials a{font-size:12px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;}
  .footer-socials a:hover{color:var(--text);}

  @media(max-width:900px){
    .nav{padding:14px 24px;} .nav-links{display:none;}
    .hero{padding:120px 24px 60px;}
    .section{padding:60px 24px;}
    .campaigns-masonry{column-count:2;}
    .footer-top{grid-template-columns:1fr 1fr;gap:32px;}
  }
  @media(max-width:600px){.campaigns-masonry{column-count:1;}}
`;

const GRADIENTS = ["rc-1", "rc-2", "rc-3", "rc-4", "rc-5"];

async function getCampaigns() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("campaigns")
      .select("id, name, slug, brand_id, brands(name, logo_url, logo_light_url), thumbnail_url, media_type, status")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(60);
    return data || [];
  } catch {
    return [];
  }
}

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

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

      <section className="hero">
        <div className="eyebrow">Our Work</div>
        <h1 className="d hero-title">394+ Campaigns.<br />One Playbook.</h1>
        <p className="hero-desc">From single-athlete posts to full-scale, multi-school activations — this is what athlete-powered marketing looks like at scale.</p>
      </section>

      <section className="section">
        <div className="section-eyebrow">Campaign Archive</div>
        <h2 className="d section-title">All Campaigns</h2>

        {campaigns.length > 0 ? (
          <div className="campaigns-masonry">
            {campaigns.map((c: any, i: number) => {
              const brand = c.brands?.name || "";
              const logo = c.brands?.logo_light_url || c.brands?.logo_url || "";
              const hasMedia = !!c.thumbnail_url;
              const isVideo = c.media_type === "video";
              const gradient = GRADIENTS[i % 5];
              const href = c.slug ? `/recap/${c.slug}` : "#";

              return (
                <a key={c.id} className={`camp-card${!hasMedia ? ` ${gradient}` : ""}`} href={href}>
                  {hasMedia && (
                    <div className="camp-media">
                      {isVideo
                        ? <video src={c.thumbnail_url} muted playsInline preload="none" />
                        : <img src={c.thumbnail_url} alt={c.name} loading="lazy" />
                      }
                    </div>
                  )}
                  <div className={hasMedia ? "camp-info" : "camp-no-media"}>
                    {brand && <div className="camp-brand">{brand}</div>}
                    <div className="camp-name">{c.name}</div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <p style={{ fontSize: 18, marginBottom: 8 }}>Campaigns coming soon.</p>
            <p style={{ fontSize: 14 }}>Check back shortly or <a href="/contact" style={{ color: "var(--orange)" }}>reach out directly</a>.</p>
          </div>
        )}
      </section>

      <section className="cta">
        <h2 className="d cta-title">Want Your Brand<br />In the Mix?</h2>
        <p className="cta-sub">We&apos;ve built the playbook. Now let&apos;s run it for your brand.</p>
        <div className="cta-btns">
          <a href="/contact" className="btn-solid">Work With Us</a>
          <a href="/clients" className="btn-outline">Our Clients</a>
        </div>
      </section>

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
