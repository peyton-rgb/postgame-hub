export const revalidate = 60;

const BASE = "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/";

const PHOTOS = [
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/85055a34-72d5-4602-b98a-e5d370403e58/1775098564683-160A3009.jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/85055a34-72d5-4602-b98a-e5d370403e58/1775098558696-160A2989.jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/85055a34-72d5-4602-b98a-e5d370403e58/1775098553880-160A2983.jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/85055a34-72d5-4602-b98a-e5d370403e58/1775098549313-160A2975.jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/85055a34-72d5-4602-b98a-e5d370403e58/1775098545639-160A2969.jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/fb95ca44-e29f-49b8-b636-153cad3e8fe8/1775098381580-DSC09853.jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/fb95ca44-e29f-49b8-b636-153cad3e8fe8/1775098376043-DSC09858.jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/ee8357de-5bbe-40ac-b140-3da951139a8c/1775098150024-DSC04010 (1).jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/ee8357de-5bbe-40ac-b140-3da951139a8c/1775098141070-DSC03998 (1).jpg",
  "15ed2d87-731f-4bf6-a5d9-8e6fab5b3462/homepage/1775097916450-DSC09875.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/2d3cbb81-f4fb-4fc6-a53f-4830f3de9518/1775083807532-Labaron_Philon_Jr._EDIT-1.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/2d3cbb81-f4fb-4fc6-a53f-4830f3de9518/1775083804689-Labaron_Philon_Jr._Edit-4.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/4ba4c57e-8d0e-4eda-a465-187e2563ec83/1775083787811-Sayvia_Seller_DSC05093.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/4ba4c57e-8d0e-4eda-a465-187e2563ec83/1775083787138-Sayvia_Seller_DSC05015.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/4ba4c57e-8d0e-4eda-a465-187e2563ec83/1775083786230-Sayvia_Seller_DSC04959.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/692bc58f-7279-4721-8b98-9ba0e287d45d/1775083783182-Saylor_Poffenbarger_IMG_4215.JPG",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/692bc58f-7279-4721-8b98-9ba0e287d45d/1775083782072-Saylor_Poffenbarger_IMG_4214.JPG",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/692bc58f-7279-4721-8b98-9ba0e287d45d/1775083781160-Saylor_Poffenbarger_IMG_4213.JPG",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/692bc58f-7279-4721-8b98-9ba0e287d45d/1775083779011-Saylor_Poffenbarger_IMG_4211.JPG",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/bc97373a-dfdc-465b-bd48-3bcd2df287a5/1775083711221-Dailyn_Swain_Postgame x Dailyn Swain Selects-4.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/bc97373a-dfdc-465b-bd48-3bcd2df287a5/1775083711956-Dailyn_Swain_Postgame x Dailyn Swain Selects-22.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/bc97373a-dfdc-465b-bd48-3bcd2df287a5/1775083713038-Dailyn_Swain_Postgame x Dailyn Swain Selects-31.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/2b58fc76-e2b8-4d26-a3de-b3b8f9bdd5d5/1775081246786-Joyce_Edwards_03.27 - POSTGAME - JOYCE EDWARDS-03215.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/2b58fc76-e2b8-4d26-a3de-b3b8f9bdd5d5/1775081250632-Joyce_Edwards_03.27 - POSTGAME - JOYCE EDWARDS-03241.jpg",
];
// Split into 4 columns
function chunk(arr, n) {
  return Array.from({ length: n }, (_, i) => arr.filter((_, j) => j % n === i));
}
const cols = chunk(PHOTOS, 4);
const SPEEDS = ["32s", "24s", "40s", "28s"];
const DIRS = ["up", "down", "up", "down"];

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
  .hero-wrap{position:relative;height:100vh;min-height:640px;overflow:hidden;display:flex;align-items:center;justify-content:center;}
  .mosaic{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px;pointer-events:none;}
  .mosaic-col{display:flex;flex-direction:column;gap:6px;}
  .mosaic-track{display:flex;flex-direction:column;gap:6px;will-change:transform;}
  .mosaic-track.up{animation:scrollUp var(--dur,28s) linear infinite;}
  .mosaic-track.down{animation:scrollDown var(--dur,28s) linear infinite;}
  .mosaic-img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:8px;flex-shrink:0;}
  @keyframes scrollUp{from{transform:translateY(0)}to{transform:translateY(-50%)}}
  @keyframes scrollDown{from{transform:translateY(-50%)}to{transform:translateY(0)}}
  .mosaic-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,10,0.55) 0%,rgba(10,10,10,0.45) 40%,rgba(10,10,10,0.75) 85%,rgba(10,10,10,1) 100%);}
  .mosaic-overlay-left{position:absolute;inset:0;background:linear-gradient(to right,rgba(10,10,10,0.6) 0%,transparent 30%,transparent 70%,rgba(10,10,10,0.6) 100%);}
  .hero-content{position:relative;z-index:10;text-align:center;padding:0 24px;max-width:860px;}
  .service-tag{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:var(--orange);border:1px solid var(--orange);border-radius:4px;padding:4px 12px;margin-bottom:24px;}
  .hero-title{font-size:clamp(60px,9vw,110px);line-height:0.92;margin:0 0 24px;text-shadow:0 2px 20px rgba(0,0,0,0.5);}
  .hero-desc{font-size:18px;color:rgba(255,255,255,0.8);max-width:520px;line-height:1.6;margin:0 auto 40px;text-shadow:0 1px 8px rgba(0,0,0,0.6);}
  .hero-actions{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
  .section{padding:80px 48px;}
  .section-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:12px;}
  .section-title{font-size:clamp(32px,4vw,48px);line-height:1;margin:0 0 48px;}
  .features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:64px;}
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
  @media(max-width:900px){.nav{padding:14px 24px;}.nav-links{display:none;}.section{padding:60px 24px;}.services-nav{padding:0 24px 32px;}.features-grid{grid-template-columns:1fr;}.footer-top{grid-template-columns:1fr 1fr;gap:32px;}.mosaic{grid-template-columns:repeat(2,1fr);}}
`;

export default function ServicesScaledPage() {
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

      <div className="hero-wrap">
        <div className="mosaic" aria-hidden="true">
          {cols.map((col, ci) => (
            <div key={ci} className="mosaic-col">
              <div className={"mosaic-track " + DIRS[ci]} style={{ "--dur": SPEEDS[ci] }}>
                {[...col, ...col].map((src, i) => (
                  <img key={i} src={BASE + encodeURIComponent(src)} alt="" className="mosaic-img" loading={i < 4 ? "eager" : "lazy"} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mosaic-overlay" />
        <div className="mosaic-overlay-left" />
        <div className="hero-content">
          <div className="service-tag">Scaled NIL</div>
          <h1 className="d hero-title">More Athletes.<br />More Markets.<br />More Reach.</h1>
          <p className="hero-desc">Scaled campaigns activate 10–50+ athletes simultaneously across every major conference, giving your brand authentic presence at every school that matters to you.</p>
          <div className="hero-actions">
            <a href="/contact" className="btn-solid">Start a Campaign</a>
            <a href="/campaigns" className="btn-outline">See Examples</a>
          </div>
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
            { num: "01", title: "Multi-School Activation", desc: "We simultaneously activate athletes across 5 to 500+ schools — Power 4, G5, or any combination that matches your distribution goals." },
            { num: "02", title: "Centralized Creative", desc: "One brief, one approval cycle, deployed across every athlete. Consistent brand messaging at any volume." },
            { num: "03", title: "Automated Athlete Coordination", desc: "Our platform handles contracting, payments, briefs, and deadline tracking for every single athlete. No manual chasing." },
            { num: "04", title: "Geographic Targeting", desc: "Want to hit every market in the SEC? Every school in Ohio? Every Power 4 basketball program? We can build that roster." },
            { num: "05", title: "Aggregated Reporting", desc: "One unified dashboard showing total reach, impressions, and engagement across all athletes and posts." },
            { num: "06", title: "Volume Pricing", desc: "The more athletes you activate, the lower your cost per post. Scaled is built for efficiency without sacrificing quality." },
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
            <div><a href="/homepage" style={{ display: "inline-block", marginBottom: 16 }}><img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} /></a><p className="footer-brand-desc">The #1 NIL agency in the country. Connecting elite college athletes with the world&apos;s most ambitious brands.</p></div>
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
