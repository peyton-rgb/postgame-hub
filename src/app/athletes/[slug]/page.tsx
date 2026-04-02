import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

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

  .hero{padding-top:80px;min-height:60vh;display:grid;grid-template-columns:1fr 1fr;align-items:end;}
  .hero-content{padding:80px 48px 80px;background:radial-gradient(ellipse at 0% 50%,rgba(215,63,9,0.1) 0%,transparent 60%);}
  .back-link{display:inline-flex;align-items:center;gap:8px;color:var(--text-muted);font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:32px;transition:color 0.2s;}
  .back-link:hover{color:var(--orange);}
  .sport-tag{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:16px;}
  .athlete-name{font-size:clamp(52px,8vw,88px);line-height:0.9;margin:0 0 12px;}
  .athlete-school{font-size:20px;color:var(--text-muted);margin-bottom:32px;}
  .athlete-stats{display:flex;gap:32px;flex-wrap:wrap;}
  .stat{text-align:left;}
  .stat-num{font-size:28px;line-height:1;color:var(--orange);font-family:'Bebas Neue',Arial,sans-serif;}
  .stat-label{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-top:4px;}
  .hero-photo{height:100%;min-height:500px;overflow:hidden;background:var(--surface);}
  .hero-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;}
  .hero-photo-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:80px;font-weight:900;color:var(--orange);}

  .section{padding:80px 48px;}
  .section-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:12px;}
  .section-title{font-size:clamp(28px,4vw,40px);line-height:1;margin:0 0 32px;}

  .campaigns-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
  .camp-card{border-radius:12px;overflow:hidden;border:1px solid var(--border);background:var(--surface);transition:transform 0.25s,border-color 0.2s;text-decoration:none;display:block;color:inherit;}
  .camp-card:hover{transform:translateY(-4px);border-color:rgba(215,63,9,0.4);}
  .camp-thumb{aspect-ratio:16/9;overflow:hidden;background:var(--surface);}
  .camp-thumb img{width:100%;height:100%;object-fit:cover;}
  .camp-info{padding:16px 20px;}
  .camp-brand{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--orange);margin-bottom:4px;}
  .camp-name{font-size:16px;font-weight:800;}

  .bio-block{max-width:640px;}
  .bio-text{font-size:16px;color:var(--text-muted);line-height:1.8;margin-bottom:24px;}

  .cta{text-align:center;padding:100px 24px;background:radial-gradient(ellipse at 50% 100%,rgba(215,63,9,0.1) 0%,transparent 60%);}
  .cta-title{font-size:clamp(36px,5vw,64px);line-height:1;margin:0 0 16px;}
  .cta-sub{font-size:16px;color:var(--text-muted);margin:0 0 36px;max-width:480px;display:inline-block;line-height:1.6;}
  .cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

  .footer{border-top:1px solid var(--border);padding:48px 48px 40px;}
  .footer-inner{max-width:1200px;margin:0 auto;}
  .footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:48px;margin-bottom:40px;}
  .footer-brand-desc{font-size:13px;color:var(--text-muted);line-height:1.6;max-width:240px;}
  .footer-col-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-dim);margin-bottom:16px;}
  .footer-links{list-style:none;} .footer-links li{margin-bottom:10px;}
  .footer-links a{font-size:14px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;} .footer-links a:hover{color:var(--text);}
  .footer-bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:24px;}
  .footer-copy{font-size:12px;color:var(--text-dim);}
  .footer-socials{display:flex;gap:24px;}
  .footer-socials a{font-size:12px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;} .footer-socials a:hover{color:var(--text);}

  @media(max-width:900px){
    .nav{padding:14px 24px;} .nav-links{display:none;}
    .hero{grid-template-columns:1fr;}
    .hero-content{padding:100px 24px 48px;}
    .hero-photo{min-height:300px;}
    .section{padding:60px 24px;}
    .campaigns-grid{grid-template-columns:repeat(2,1fr);}
    .footer-top{grid-template-columns:1fr 1fr;gap:32px;}
  }
  @media(max-width:600px){.campaigns-grid{grid-template-columns:1fr;}}
`;

async function getAthlete(slug: string) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("deals")
      .select("*, brands(name, logo_url, logo_light_url)")
      .eq("slug", slug)
      .eq("published", true)
      .single();
    return data;
  } catch {
    return null;
  }
}

export default async function PlayerSpotlightPage({ params }: { params: { slug: string } }) {
  const athlete = await getAthlete(params.slug);
  if (!athlete) notFound();

  const name = athlete.athlete_name || athlete.name || "Athlete";
  const school = athlete.school || "";
  const sport = athlete.sport || "";
  const photo = athlete.athlete_image_url || athlete.image_url || "";
  const bio = athlete.bio || athlete.description || "";
  const brand = athlete.brands?.name || athlete.brand_name || "";
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <nav className="nav">
        <a href="/homepage" className="nav-logo">POSTGAME</a>
        <div className="nav-links">
          <a href="/clients">Clients</a><a href="/campaigns">Campaigns</a><a href="/about/team">About</a>
          <a href="/contact" className="btn-outline">Contact</a>
          <a href="/deals" className="btn-solid">Deal Tracker</a>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-content">
          <a href="/deals" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to Tracker
          </a>
          {sport && <div className="sport-tag">{sport}</div>}
          <h1 className="d athlete-name">{name}</h1>
          {school && <div className="athlete-school">{school}</div>}
          {brand && (
            <div className="athlete-stats">
              <div className="stat">
                <div className="stat-label">Brand Partner</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{brand}</div>
              </div>
            </div>
          )}
        </div>
        <div className="hero-photo">
          {photo
            ? <img src={photo} alt={name} />
            : <div className="hero-photo-placeholder">{initials}</div>
          }
        </div>
      </div>

      {bio && (
        <section className="section">
          <div className="section-eyebrow">About</div>
          <h2 className="d section-title">The Athlete</h2>
          <div className="bio-block">
            <p className="bio-text">{bio}</p>
          </div>
        </section>
      )}

      <section className="cta">
        <h2 className="d cta-title">Work With<br />Top Athletes.</h2>
        <p className="cta-sub">Ready to activate athletes like {name.split(" ")[0]}? Let&apos;s build your campaign.</p>
        <div className="cta-btns">
          <a href="/contact" className="btn-solid">Get In Touch</a>
          <a href="/deals" className="btn-outline">View Deal Tracker</a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div><a href="/homepage" style={{ display: "inline-block", marginBottom: 16 }}><img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} /></a><p className="footer-brand-desc">The #1 NIL agency in the country.</p></div>
            <div><div className="footer-col-title">Company</div><ul className="footer-links"><li><a href="/about/team">About</a></li><li><a href="/services/elevated">Services</a></li><li><a href="/contact">Contact</a></li></ul></div>
            <div><div className="footer-col-title">Network</div><ul className="footer-links"><li><a href="/clients">Clients</a></li><li><a href="/campaigns">Campaigns</a></li><li><a href="/deals">Deal Tracker</a></li></ul></div>
            <div><div className="footer-col-title">Connect</div><ul className="footer-links"><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li><li><a href="#">Twitter / X</a></li><li><a href="#">LinkedIn</a></li></ul></div>
          </div>
          <div className="footer-bottom"><div className="footer-copy">&copy; {new Date().getFullYear()} Postgame. All rights reserved.</div><div className="footer-socials"><a href="#">Privacy</a><a href="#">Terms</a><a href="/contact">Contact</a></div></div>
        </div>
      </footer>
    </div>
  );
}
