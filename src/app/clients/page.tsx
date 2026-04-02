import { getBrands } from "@/lib/public-site";

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

  .stats-bar{display:flex;justify-content:center;gap:64px;padding:48px 24px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
  .stat-num{font-size:42px;line-height:1;color:var(--orange);font-family:'Bebas Neue',Arial,sans-serif;}
  .stat-label{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-top:6px;}

  .section{padding:80px 48px;}
  .section-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:12px;}
  .section-title{font-size:clamp(32px,4vw,48px);line-height:1;margin:0 0 48px;}

  .clients-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}
  .client-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:4/3;transition:border-color 0.2s,transform 0.25s;text-decoration:none;}
  .client-card:hover{border-color:var(--orange);transform:translateY(-4px);}
  .client-logo{max-width:120px;max-height:48px;object-fit:contain;filter:grayscale(1) brightness(2);opacity:0.6;transition:opacity 0.2s,filter 0.2s;}
  .client-card:hover .client-logo{opacity:1;filter:none;}
  .client-placeholder{font-size:16px;font-weight:900;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;}

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
    .clients-grid{grid-template-columns:repeat(2,1fr);}
    .stats-bar{gap:32px;flex-wrap:wrap;}
    .footer-top{grid-template-columns:1fr 1fr;gap:32px;}
  }
  @media(max-width:600px){
    .clients-grid{grid-template-columns:repeat(2,1fr);}
  }
`;

export default async function ClientsPage() {
  let brands: { id: string; name: string; logo_url?: string; logo_light_url?: string; industry?: string }[] = [];
  try {
    brands = await getBrands();
  } catch { /* fallback */ }

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
        <div className="eyebrow">Our Client Network</div>
        <h1 className="d hero-title">The Brands That<br />Trust Postgame</h1>
        <p className="hero-desc">From Fortune 500s to emerging challenger brands — we&apos;ve run campaigns for the most ambitious companies in the game.</p>
      </section>

      <div className="stats-bar">
        {[
          { value: "69+", label: "Brand Partners" },
          { value: "394+", label: "Campaigns Run" },
          { value: "2,000+", label: "Athletes Activated" },
          { value: "All 50", label: "States Covered" },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div className="stat-num">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-eyebrow">Our Partners</div>
        <h2 className="d section-title">Brand Clients</h2>
        <div className="clients-grid">
          {brands.length > 0 ? brands.map((brand) => {
            const logo = brand.logo_light_url || brand.logo_url;
            return (
              <div key={brand.id} className="client-card">
                {logo
                  ? <img src={logo} alt={brand.name} className="client-logo" />
                  : <div className="client-placeholder">{brand.name}</div>
                }
              </div>
            );
          }) : Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="client-card">
              <div className="client-placeholder">Brand {i + 1}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta">
        <h2 className="d cta-title">Ready to Run<br />Your Campaign?</h2>
        <p className="cta-sub">Join the brands already winning with Postgame. Let&apos;s build your NIL strategy together.</p>
        <div className="cta-btns">
          <a href="/contact" className="btn-solid">Get In Touch</a>
          <a href="/campaigns" className="btn-outline">See Our Work</a>
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
