export const revalidate = 60;

const BASE = "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/";

const PHOTOS = [
  "558aee46-8516-47ac-87d9-d959c4ccaedb/2c9f7a9e-460c-4846-b877-906a7e6a855e/1775073479874-DSC05557.jpg",
  "4abbddb5-9635-4db4-9892-e8e85b1c3631/8cc333d8-df36-435d-a39b-6809b8d475c1/1772603819513-IND05834.jpg",
  "4abbddb5-9635-4db4-9892-e8e85b1c3631/0ab2f8b5-9b46-40ed-88a7-3a8e50579950/1772603338971-_DSC3513.jpg",
  "4abbddb5-9635-4db4-9892-e8e85b1c3631/b3581698-d4eb-40b1-8e71-afb1d960ca1f/1774033863405-DSC05627-Enhanced-NR.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/d5b449d2-ed5e-4d19-915d-a319a7aa7daa/1775083675731-Braden_Smith_-_Purdue_7B3A0113.jpg",
  "558aee46-8516-47ac-87d9-d959c4ccaedb/e23e7217-a077-457d-a80a-256452927a4f/1775073000950-Sam_Hoiberg_Sam Hoiberg Papatui.jpeg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/02d49608-c9a1-47de-bbc9-62248efe270a/1774482933543-Jaala_Thymes_3.jpg",
  "0575994d-2d89-4122-915e-623de201d00f/ae03b6f2-3584-4765-ae73-14c63cff4123/1772646016393-StellaAllen_Adidas-10 - Stella Allen.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/2b58fc76-e2b8-4d26-a3de-b3b8f9bdd5d5/1775081194098-Mikaylah_Williams_re1.jpg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/df3afeca-89e8-49b0-bd6a-8b00ea7b5ea4/1774483497066-Makhi_Falkquay_4.jpg",
  "64a31cb4-1bee-4456-b3fc-3d7d0f81b077/c5c17d0c-ca40-496a-a81f-fa40fa8f5354/1773871398391-Eliza LaBelle.jpeg",
  "64a31cb4-1bee-4456-b3fc-3d7d0f81b077/548dc126-a5c2-464a-8bce-a650c30831a5/1773871942997-Kamron Dillard 4.jpeg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/f84806a8-2e1e-44a3-a577-21f0a6a26ed5/1774483281049-Paris_Clark_5.jpg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/60808b45-8f21-4209-9604-bdeb9d5e6084/1774481198080-kennedi_bailey.jpg",
  "4abbddb5-9635-4db4-9892-e8e85b1c3631/0ab2f8b5-9b46-40ed-88a7-3a8e50579950/1772603357088-_DSC4032-2.jpg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/d4bbb7da-9d1e-423d-9ee3-df4a5e18a82b/1774481848368-Donovan_Whitfield.jpg",
  "b924229b-3a33-431a-aa2a-4332c4daae22/bdbafdd8-202d-441a-920c-47cfc70be586/1775071192894-2026 Darius Sams8.jpg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/c007234a-a7e4-44f8-a8cf-af19b9769319/1774471458731-1N3A5910 - Alisha Nunley.jpeg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/98324e14-f286-4024-b63b-71408b0da0b2/1774481851889-Maya_Robinson.jpg",
  "17b9fca8-e5b6-4917-8f05-7b6b8dfcca27/e2206a9d-11c3-4e50-afdf-e2eecebea35a/1775061169902-Maliq_Brown_IMG_3713.JPG",
  "17b9fca8-e5b6-4917-8f05-7b6b8dfcca27/8423a2ff-e7cc-47ed-b714-0448c3732b03/1775061177515-Nimari_Burnette_DSC03969.jpg",
  "17b9fca8-e5b6-4917-8f05-7b6b8dfcca27/00e0ac24-2426-421e-9450-934a48a7e38f/1775060559403-Adrian_Wooley_DSC01325-Enhanced-NR.jpg",
  "4abbddb5-9635-4db4-9892-e8e85b1c3631/0ab2f8b5-9b46-40ed-88a7-3a8e50579950/1772603363497-_DSC4127.jpg",
  "64a31cb4-1bee-4456-b3fc-3d7d0f81b077/37a17fe0-1b5a-4175-b784-878181b54854/1774465519790-SnapInsta.to_642585191_18569826502027136_3154976104383892850_n.jpg",
  "fb31741a-195c-4308-82f5-26fed242b39e/23ad0e1d-a8a6-4f8a-9a35-ee2745fb1f96/1774381066061-IMG_6239 - gemma Morris.jpeg",
  "4abbddb5-9635-4db4-9892-e8e85b1c3631/967b6f6a-ff21-495c-9d85-99d963a8c058/1774033456259-IND05028-Enhanced-NR.jpg",
  "64a31cb4-1bee-4456-b3fc-3d7d0f81b077/d695e4e8-2189-4aab-999d-7a63d6b1781c/1773871962931-Savannah Moore.jpeg",
  "d316c412-1782-46ca-906c-d6246bca71d6/c587e24a-d0e6-4966-a280-51899a4beb74/1773766326659-DSC00276.jpg",
  "558aee46-8516-47ac-87d9-d959c4ccaedb/ede0926f-f22e-4aaf-8299-476c5fa6eb10/1775072988466-Jeremy_Fears_Jr._IMG_8137.jpg",
  "5b035be0-7d17-499d-b512-ddb3f900b68f/3bd7fd8c-3c19-4508-b84a-75e6fa4c71d4/1775083743804-Labaron_Philon_Jr._Edit-2.jpg",
  "558aee46-8516-47ac-87d9-d959c4ccaedb/18e921de-d731-4bbf-85cd-c64682ef8546/1775073507844-DSC05905.jpg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/f84806a8-2e1e-44a3-a577-21f0a6a26ed5/1774483481755-Paris_Clark_3.jpg",
  "fb31741a-195c-4308-82f5-26fed242b39e/86cc00d4-e6a9-495a-8cca-88e0e02cc8d9/1774382093716-DSC09290.jpg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/d3d4538b-fcba-4b29-b0a4-d6f03356c891/1774483466467-Maria_Pena_1.jpeg",
  "cc84b3b9-aef5-48bf-882c-24782a8432bf/c5556bb1-67e7-4e0c-9fc4-b14fad41aa09/1774483477347-Liron_Thomas_1.jpg",
];

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

  /* HERO */
  .hero-wrap{position:relative;min-height:100vh;display:flex;align-items:center;padding:100px 48px 80px;overflow:hidden;}

  /* Carousel background */
  .carousel-bg{position:absolute;inset:0;z-index:0;}
  .carousel-track{display:flex;height:100%;transition:opacity 0.8s ease;}
  .carousel-slide{position:absolute;inset:0;opacity:0;transition:opacity 1.2s ease;}
  .carousel-slide.active{opacity:1;}
  .carousel-slide img{width:100%;height:100%;object-fit:cover;}
  .carousel-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(5,5,5,0.92) 0%,rgba(5,5,5,0.7) 45%,rgba(5,5,5,0.2) 75%,rgba(5,5,5,0.05) 100%);}
  .carousel-overlay-top{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,10,0.5) 0%,transparent 20%,transparent 80%,rgba(10,10,10,1) 100%);}

  /* Dots */
  .carousel-dots{position:absolute;bottom:32px;left:48px;display:flex;gap:8px;z-index:10;}
  .dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.3);transition:all 0.3s;cursor:pointer;border:none;padding:0;}
  .dot.active{width:24px;border-radius:3px;background:var(--orange);}

  /* Glass card */
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

const CAROUSEL = PHOTOS.slice(0, 8);

export default function ServicesScaledPage() {
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
      `}} />

      <nav className="nav">
        <a href="/homepage" className="nav-logo">POSTGAME</a>
        <div className="nav-links">
          <a href="/clients">Clients</a><a href="/campaigns">Campaigns</a><a href="/about/team">About</a>
          <a href="/contact" className="btn-outline">Contact</a>
          <a href="/deals" className="btn-solid">Deal Tracker</a>
        </div>
      </nav>

      <div className="hero-wrap">
        {/* Carousel background */}
        <div className="carousel-bg">
          {CAROUSEL.map((src, i) => (
            <div key={i} className={"carousel-slide" + (i === 0 ? " active" : "")}>
              <img src={BASE + encodeURIComponent(src)} alt="" />
            </div>
          ))}
          <div className="carousel-overlay" />
          <div className="carousel-overlay-top" />
        </div>

        {/* Glass card */}
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

        {/* Carousel dots */}
        <div className="carousel-dots">
          {CAROUSEL.map((_, i) => (
            <button key={i} className={"dot" + (i === 0 ? " active" : "")} aria-label={"Slide " + (i+1)} />
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
