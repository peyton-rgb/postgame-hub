
export const dynamic = "force-dynamic";

const BASE = "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DEFAULT_PHOTOS = [

];

type CarouselPhoto = { path: string; brand_logo_url?: string };

function toPhotos(raw: unknown[]): CarouselPhoto[] {
  return raw.map(p => typeof p === "string" ? { path: p } : p as CarouselPhoto);
}

const SHARED_STYLES = `
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
  .hero-wrap{position:relative;min-height:100vh;display:flex;align-items:center;padding:100px 48px 80px;overflow:hidden;}
  .carousel-bg{position:absolute;inset:0;z-index:0;}
  .carousel-slide{position:absolute;inset:0;opacity:0;transition:opacity 1.2s ease;}
  .carousel-slide.active{opacity:1;}
  .carousel-slide img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;}
  .carousel-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(5,5,5,0.92) 0%,rgba(5,5,5,0.7) 45%,rgba(5,5,5,0.2) 75%,rgba(5,5,5,0.05) 100%);}
  .carousel-overlay-top{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,10,0.5) 0%,transparent 20%,transparent 80%,rgba(10,10,10,1) 100%);}
  .carousel-dots{position:absolute;bottom:32px;left:48px;display:flex;gap:8px;z-index:10;}
  .dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.3);transition:all 0.3s;cursor:pointer;border:none;padding:0;}
  .dot.active{width:24px;border-radius:3px;background:var(--orange);}
  .slide-brand-logo{position:absolute;bottom:16px;right:16px;height:32px;width:auto;max-width:80px;object-fit:contain;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.6));}
  .hero-glass-card{position:relative;z-index:10;max-width:620px;background:rgba(10,10,10,0.45);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:52px 56px;box-shadow:0 24px 80px rgba(0,0,0,0.5);animation:fadeUp 0.8s ease 0.3s both;}
  .service-tag{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:var(--orange);background:#fff;border:1.5px solid var(--orange);border-radius:4px;padding:4px 12px;margin-bottom:20px;}
  .hero-title{font-size:clamp(44px,6vw,76px);line-height:0.95;margin:0 0 20px;animation:fadeUp 0.7s ease 0.5s both;}
  .hero-desc{font-size:17px;color:rgba(255,255,255,0.75);line-height:1.65;margin:0 0 36px;animation:fadeUp 0.7s ease 0.7s both;}
  .hero-actions{display:flex;gap:14px;flex-wrap:wrap;animation:fadeUp 0.7s ease 0.9s both;}
  .hero-stats{display:grid;grid-template-columns:1fr 1fr;gap:20px 32px;margin-top:40px;padding-top:32px;border-top:1px solid rgba(255,255,255,0.1);animation:fadeUp 0.7s ease 1.1s both;}
  .stat-num{font-family:'Bebas Neue',Arial,sans-serif;font-size:42px;color:#fff;line-height:1;}
  .stat-num span{color:var(--orange);}
  .stat-label{font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  .section{padding:80px 48px;}
  .section-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:12px;}
  .section-title{font-size:clamp(32px,4vw,48px);line-height:1;margin:0 0 48px;}
  .features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
  .feature{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px 28px;transition:border-color 0.25s;}
  .feature:hover{border-color:var(--orange);}
  .feature-num{font-size:11px;font-weight:800;color:var(--text-dim);letter-spacing:0.1em;margin-bottom:16px;}
  .feature-title{font-size:18px;font-weight:800;margin-bottom:10px;}
  .feature-desc{font-size:14px;color:var(--text-muted);line-height:1.6;}
  .services-nav{display:flex;gap:12px;flex-wrap:wrap;padding:0 48px 48px;}
  .svc-link{padding:10px 20px;border-radius:8px;border:1px solid var(--border);color:var(--text-muted);font-size:13px;font-weight:700;text-decoration:none;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.05em;}
  .svc-link:hover,.svc-link.active{border-color:var(--orange);color:var(--orange);}
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
  .footer-links a{font-size:14px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;}
  .footer-links a:hover{color:var(--text);}
  .footer-bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:24px;}
  .footer-copy{font-size:12px;color:var(--text-dim);}
  .footer-socials{display:flex;gap:24px;}
  .footer-socials a{font-size:12px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;}
  .footer-socials a:hover{color:var(--text);}
  @media(max-width:900px){.nav{padding:14px 24px;}.nav-links{display:none;}.hero-wrap{padding:100px 24px 60px;}.hero-glass-card{padding:36px 28px;}.section{padding:60px 24px;}.services-nav{padding:0 24px 32px;}.features-grid{grid-template-columns:1fr;}.footer-top{grid-template-columns:1fr 1fr;gap:32px;}.carousel-dots{left:24px;}.hero-stats{grid-template-columns:1fr 1fr;}}
`;

export default async function ServicesScaledPage() {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, ANON_KEY);
  const { data: row } = await sb.from("pages").select("settings").eq("slug","services").single();
  const raw: unknown[] = (row?.settings as Record<string,{carousel_photos?:unknown[]}>)?.["scaled"]?.carousel_photos ?? DEFAULT_PHOTOS;
  const photos = toPhotos(raw);

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: SHARED_STYLES }} />
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('DOMContentLoaded', function() {
          var slides = document.querySelectorAll('.carousel-slide');
          var dots = document.querySelectorAll('.dot');
          var current = 0;
          function go(n) {
            slides[current].classList.remove('active');
            dots[current].classList.remove('active');
            current = (n + slides.length) % slides.length;
            slides[current].classList.add('active');
            dots[current].classList.add('active');
          }
          dots.forEach(function(d, i) { d.addEventListener('click', function() { go(i); }); });
          setInterval(function() { go(current + 1); }, 4000);
        });
      ` }} />

      <nav className="nav">
        <a href="/homepage" className="nav-logo">POSTGAME</a>
        <div className="nav-links">
          <a href="/clients">Clients</a><a href="/campaigns">Campaigns</a><a href="/about/team">About</a>
          <a href="/contact" className="btn-outline">Contact</a>
          <a href="/deals" className="btn-solid">Deal Tracker</a>
        </div>
      </nav>

      <div className="hero-wrap">
        <div className="carousel-bg">
          {photos.map((photo, i) => (
            <div key={i} className={`carousel-slide${i === 0 ? " active" : ""}`} style={{ position:"absolute", inset:0 }}>
              <img src={`${BASE}${encodeURIComponent(photo.path)}`} alt="" />
              {photo.brand_logo_url && (
                <img src={photo.brand_logo_url} className="slide-brand-logo" alt="" />
              )}
            </div>
          ))}
          <div className="carousel-overlay" />
          <div className="carousel-overlay-top" />
        </div>

        <div className="hero-glass-card">
          <div className="service-tag">Scaled NIL</div>
          <h1 className="d hero-title">More Athletes.<br />More Markets.<br />More Reach.</h1>
          <p className="hero-desc">Scaled campaigns activate 10–500+ athletes simultaneously across every major conference, giving your brand authentic presence at every school that matters to you.</p>
          <div className="hero-actions">
            <a href="/contact" className="btn-solid">Start a Campaign</a>
            <a href="/campaigns" className="btn-outline">See Examples</a>
          </div>
          <div className="hero-stats">
            <div><div className="stat-num">500<span>+</span></div><div className="stat-label">Athletes Per Campaign</div></div>
            <div><div className="stat-num">100<span>+</span></div><div className="stat-label">Brand Partners</div></div>
            <div><div className="stat-num">4<span>yrs</span></div><div className="stat-label">In The NIL Space</div></div>
            <div><div className="stat-num">70K<span>+</span></div><div className="stat-label">Athlete Network</div></div>
          </div>
        </div>

        <div className="carousel-dots">
          {photos.map((_, i) => (
            <button key={i} className={`dot${i === 0 ? " active" : ""}`} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      </div>

      <div className="services-nav">
        <a href="/services/elevated" className="svc-link">Elevated</a>
        <a href="/services/scaled" className="svc-link active">Scaled</a>
        <a href="/services/always-on" className="svc-link">Always On</a>
        <a href="/services/experiential" className="svc-link">Experiential</a>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">What&apos;s Included</div>
        <h2 className="d section-title">The Scaled Package</h2>
        <div className="features-grid">
          {[
            { num:"01", title:"Multi-School Activation", desc:"We simultaneously activate athletes across 5 to 500+ schools — Power 4, G5, or any combination that matches your distribution goals." },
            { num:"02", title:"Centralized Creative", desc:"One brief, one approval cycle, deployed across every athlete. Consistent brand messaging at any volume." },
            { num:"03", title:"Automated Athlete Coordination", desc:"Our platform handles contracting, payments, briefs, and deadline tracking for every single athlete. No manual chasing." },
            { num:"04", title:"Geographic Targeting", desc:"Want to hit every market in the SEC? Every school in Ohio? Every Power 4 basketball program? We can build that roster." },
            { num:"05", title:"Aggregated Reporting", desc:"One unified dashboard showing total reach, impressions, and engagement across all athletes and posts." },
            { num:"06", title:"Volume Pricing", desc:"The more athletes you activate, the lower your cost per post. Scaled is built for efficiency without sacrificing quality." },
          ].map((f) => (
            <div key={f.num} className="feature">
              <div className="feature-num">{f.num}</div>
              <div className="feature-title">{f.title}</div>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta">
        <h2 className="d cta-title">Ready to Go<br />Nationwide?</h2>
        <p className="cta-sub">We&apos;ve run campaigns across every major conference. Let&apos;s build your footprint.</p>
        <div className="cta-btns">
          <a href="/contact" className="btn-solid">Get In Touch</a>
          <a href="/campaigns" className="btn-outline">See Our Work</a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div><p className="footer-brand-desc">The #1 NIL agency in the country. Connecting elite college athletes with the world&apos;s most ambitious brands.</p></div>
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
