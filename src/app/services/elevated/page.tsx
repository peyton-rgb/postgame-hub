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
  .hero-wrap{position:relative;min-height:100vh;display:flex;align-items:center;padding:100px 48px 80px;overflow:hidden;}
  .carousel-bg{position:absolute;inset:0;z-index:0;}
  .carousel-slide{position:absolute;inset:0;opacity:0;transition:opacity 1.2s ease;}
  .carousel-slide.active{opacity:1;}
  .carousel-slide img{width:100%;height:100%;object-fit:cover;object-position:50% 20%;}
  .carousel-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(5,5,5,0.92) 0%,rgba(5,5,5,0.7) 45%,rgba(5,5,5,0.2) 75%,rgba(5,5,5,0.05) 100%);}
  .carousel-overlay-top{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,10,0.5) 0%,transparent 20%,transparent 80%,rgba(10,10,10,1) 100%);}
  .carousel-dots{position:absolute;bottom:32px;left:48px;display:flex;gap:8px;z-index:10;}
  .dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.3);transition:all 0.3s;cursor:pointer;border:none;padding:0;}
  .dot.active{width:24px;border-radius:3px;background:var(--orange);}
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

export default function ServicesElevatedPage() {
  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
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
          <div className="carousel-slide active">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("558aee46-8516-47ac-87d9-d959c4ccaedb/2c9f7a9e-460c-4846-b877-906a7e6a855e/1775073479874-DSC05557.jpg")}`} alt="" />
          </div>
          <div className="carousel-slide">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("4abbddb5-9635-4db4-9892-e8e85b1c3631/8cc333d8-df36-435d-a39b-6809b8d475c1/1772603819513-IND05834.jpg")}`} alt="" />
          </div>
          <div className="carousel-slide">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("0575994d-2d89-4122-915e-623de201d00f/ae03b6f2-3584-4765-ae73-14c63cff4123/1772646016393-StellaAllen_Adidas-10 - Stella Allen.jpg")}`} alt="" />
          </div>
          <div className="carousel-slide">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("5b035be0-7d17-499d-b512-ddb3f900b68f/d5b449d2-ed5e-4d19-915d-a319a7aa7daa/1775083675731-Braden_Smith_-_Purdue_7B3A0113.jpg")}`} alt="" />
          </div>
          <div className="carousel-slide">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("cc84b3b9-aef5-48bf-882c-24782a8432bf/02d49608-c9a1-47de-bbc9-62248efe270a/1774482933543-Jaala_Thymes_3.jpg")}`} alt="" />
          </div>
          <div className="carousel-slide">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("17b9fca8-e5b6-4917-8f05-7b6b8dfcca27/8423a2ff-e7cc-47ed-b714-0448c3732b03/1775061177515-Nimari_Burnette_DSC03969.jpg")}`} alt="" />
          </div>
          <div className="carousel-slide">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("64a31cb4-1bee-4456-b3fc-3d7d0f81b077/c5c17d0c-ca40-496a-a81f-fa40fa8f5354/1773871398391-Eliza LaBelle.jpeg")}`} alt="" />
          </div>
          <div className="carousel-slide">
            <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${encodeURIComponent("fb31741a-195c-4308-82f5-26fed242b39e/86cc00d4-e6a9-495a-8cca-88e0e02cc8d9/1774382093716-DSC09290.jpg")}`} alt="" />
          </div>
          <div className="carousel-overlay" />
          <div className="carousel-overlay-top" />
        </div>
        <div className="carousel-dots">
          <button className="dot active" aria-label="Slide 1" />
          <button className="dot" aria-label="Slide 2" />
          <button className="dot" aria-label="Slide 3" />
          <button className="dot" aria-label="Slide 4" />
          <button className="dot" aria-label="Slide 5" />
          <button className="dot" aria-label="Slide 6" />
          <button className="dot" aria-label="Slide 7" />
          <button className="dot" aria-label="Slide 8" />
        </div>
        <div className="hero-glass-card">
          <div className="service-tag">Elevated NIL</div>
          <h1 className="d hero-title">Premium.<br />Cinematic.<br />Unforgettable.</h1>
          <p className="hero-desc">Elevated campaigns pair your brand with elite college athletes for high-production content that looks and feels like a national ad campaign.</p>
          <div className="hero-actions">
            <a href="/contact" className="btn-solid">Start a Campaign</a>
            <a href="/campaigns" className="btn-outline">See Examples</a>
          </div>
          <div className="hero-stats">
            <div><div className="stat-num">50<span>+</span></div><div className="stat-label">Headliner Athletes</div></div>
            <div><div className="stat-num">4K</div><div className="stat-label">Production Standard</div></div>
            <div><div className="stat-num">48<span>hr</span></div><div className="stat-label">Turnaround</div></div>
            <div><div className="stat-num">100<span>%</span></div><div className="stat-label">Brand Approved</div></div>
          </div>
        </div>
      </div>

      <div className="services-nav">
        <a href="/services/elevated" className="svc-link active">Elevated</a>
        <a href="/services/scaled" className="svc-link">Scaled</a>
        <a href="/services/always-on" className="svc-link">Always On</a>
        <a href="/services/experiential" className="svc-link">Experiential</a>
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">What&apos;s Included</div>
        <h2 className="d section-title">The Elevated Package</h2>
        <div className="features-grid">
          {[
            { num: "01", title: "Headliner Athletes", desc: "We match your brand with the most recognizable names in college sports — athletes with massive followings and authentic audiences." },
            { num: "02", title: "Premium Production", desc: "Professional videographers, styled shoots, and cinematic editing. Content that looks like a national brand campaign." },
            { num: "03", title: "Creative Direction", desc: "Our team handles the full creative brief — concept, styling, shot list, and delivery. You approve, we execute." },
            { num: "04", title: "Multi-Platform Content", desc: "Deliverables optimized for Instagram, TikTok, YouTube, and paid media. Every format, every placement." },
            { num: "05", title: "Full Rights Licensing", desc: "You own the content. Use it anywhere — organic, paid, OOH, retail. No usage restrictions." },
            { num: "06", title: "White-Glove Management", desc: "Dedicated campaign manager handles everything from athlete contracting to final delivery." },
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
        <h2 className="d cta-title">Ready to Make<br />Something Great?</h2>
        <p className="cta-sub">Let&apos;s build a campaign that actually looks like your brand deserves.</p>
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
