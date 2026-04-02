export const revalidate = 60;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  :root { --orange:#D73F09; --bg:#0A0A0A; --surface:#141414; --border:rgba(255,255,255,0.08); --text:#fff; --text-muted:rgba(255,255,255,0.55); --text-dim:rgba(255,255,255,0.35); }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;}
  .d{font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:0.02em;}

  /* Nav */
  .nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 48px;background:rgba(10,10,10,0.92);backdrop-filter:blur(16px);box-shadow:0 1px 0 var(--border);}
  .nav-logo{font-size:22px;font-weight:900;color:var(--orange);text-decoration:none;}
  .nav-links{display:flex;align-items:center;gap:32px;}
  .nav-links a{color:var(--text-muted);font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;transition:color 0.2s;}
  .nav-links a:hover{color:var(--text);}
  .btn-outline{padding:8px 20px;border:1.5px solid var(--orange);border-radius:8px;color:var(--orange);font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;transition:all 0.2s;}
  .btn-outline:hover{background:var(--orange);color:#fff;}
  .btn-solid{padding:10px 28px;background:var(--orange);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;transition:background 0.2s;}
  .btn-solid:hover{background:#c43808;}

  /* Hero */
  .hero{padding:160px 48px 80px;background:radial-gradient(ellipse at 50% 0%,rgba(215,63,9,0.1) 0%,transparent 60%);text-align:center;}
  .eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:20px;}
  .hero-title{font-size:clamp(48px,8vw,80px);line-height:0.95;margin:0 0 20px;}
  .hero-desc{font-size:18px;color:var(--text-muted);max-width:560px;line-height:1.6;margin:0 auto;}

  /* Team grid */
  .section{padding:80px 48px;}
  .section-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:12px;}
  .section-title{font-size:clamp(32px,4vw,48px);line-height:1;margin:0 0 48px;}
  .team-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;}
  .team-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:border-color 0.2s,transform 0.25s;}
  .team-card:hover{border-color:var(--orange);transform:translateY(-4px);}
  .team-photo{aspect-ratio:3/4;overflow:hidden;background:#1a1a1a;}
  .team-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;}
  .team-photo-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:900;color:var(--orange);}
  .team-info{padding:20px;}
  .team-role{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--orange);margin-bottom:4px;}
  .team-name{font-size:18px;font-weight:800;margin-bottom:2px;}
  .team-school{font-size:13px;color:var(--text-muted);margin-bottom:12px;}
  .team-socials{display:flex;gap:10px;}
  .team-social{color:var(--text-dim);transition:color 0.2s;display:flex;}
  .team-social:hover{color:var(--orange);}
  .team-social svg{width:16px;height:16px;fill:currentColor;}

  /* Values */
  .values-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;}
  .value-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px 24px;transition:border-color 0.2s;}
  .value-card:hover{border-color:var(--orange);}
  .value-num{font-size:36px;line-height:1;color:var(--orange);margin-bottom:12px;font-family:'Bebas Neue',Arial,sans-serif;}
  .value-title{font-size:16px;font-weight:800;margin-bottom:8px;}
  .value-desc{font-size:14px;color:var(--text-muted);line-height:1.6;}

  /* Offices */
  .offices-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
  .office-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px 28px;transition:border-color 0.2s;}
  .office-card:hover{border-color:var(--orange);}
  .office-badge{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--orange);border:1px solid var(--orange);border-radius:4px;padding:3px 8px;margin-bottom:16px;}
  .office-city{font-size:24px;font-weight:900;margin-bottom:8px;}
  .office-address{font-size:14px;color:var(--text-muted);line-height:1.7;}

  /* CTA */
  .cta{text-align:center;padding:100px 24px;background:radial-gradient(ellipse at 50% 100%,rgba(215,63,9,0.1) 0%,transparent 60%);}
  .cta-title{font-size:clamp(36px,5vw,64px);line-height:1;margin:0 0 16px;}
  .cta-sub{font-size:16px;color:var(--text-muted);margin:0 0 36px;max-width:480px;display:inline-block;line-height:1.6;}
  .cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

  /* Footer */
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
    .team-grid{grid-template-columns:repeat(2,1fr);}
    .values-grid{grid-template-columns:repeat(2,1fr);}
    .offices-grid{grid-template-columns:1fr;}
    .footer-top{grid-template-columns:1fr 1fr;gap:32px;}
  }
  @media(max-width:600px){
    .team-grid{grid-template-columns:1fr;}
    .values-grid{grid-template-columns:1fr;}
    .footer-top{grid-template-columns:1fr;}
  }
`;

const TEAM = [
  { role: "CEO & Founder", name: "Bill Jula", school: "Penn State University", photo: "/drafts/bill-jula.png", ig: "https://www.instagram.com/billjula/", li: "https://www.linkedin.com/in/billjula/" },
  { role: "President", name: "Peyton Jula", school: "Penn State University", photo: "/drafts/peyton-jula.png", ig: "https://www.instagram.com/peytonjula/", li: "https://www.linkedin.com/in/peytonjula/" },
  { role: "Director of Operations", name: "Jake Taraska", school: "Penn State University", photo: "/drafts/jake-taraska.png", ig: null, li: null },
  { role: "Creative Director", name: "Danny Morrissey", school: "Penn State University", photo: "/drafts/danny-morrissey.png", ig: null, li: null },
  { role: "Brand Partnerships", name: "Rich Swier", school: "Penn State University", photo: "/drafts/rich-swier.png", ig: null, li: null },
  { role: "Athlete Relations", name: "Desmond Lindsay", school: "Ohio State University", photo: "/drafts/desmond-lindsay.png", ig: null, li: null },
  { role: "Marketing Manager", name: "Nicole Leffingwell", school: "Penn State University", photo: "/drafts/nicole-leffingwell.png", ig: null, li: null },
  { role: "Content Strategist", name: "Abby Boustead", school: "Penn State University", photo: "/drafts/abby-boustead.png", ig: null, li: null },
  { role: "Account Manager", name: "Olivia Prock", school: "Penn State University", photo: "/drafts/olivia-prock.png", ig: null, li: null },
  { role: "Account Manager", name: "Katie Beiler", school: "Penn State University", photo: "/drafts/katie-beiler.png", ig: null, li: null },
  { role: "Account Manager", name: "Aaron Hackett", school: "Penn State University", photo: "/drafts/aaron-hackett.png", ig: null, li: null },
  { role: "Business Development", name: "Tara Ryan", school: "Syracuse University", photo: "/drafts/tara-ryan.png", ig: "https://www.instagram.com/tararyan_/", li: "http://linkedin.com/in/tararyan1" },
];

const VALUES = [
  { num: "01", title: "Athletes First", desc: "Every team member is a former college athlete. We understand the grind, the schedule, and the opportunity." },
  { num: "02", title: "Execute at Scale", desc: "394 campaigns across 69 brands. We've built the playbook for NIL at a level nobody else can match." },
  { num: "03", title: "Brand Obsessed", desc: "We treat every brand partner's reputation like our own. Quality content, on time, on brand, every time." },
  { num: "04", title: "Move Fast", desc: "College sports don't wait. We operate on game-speed timelines and pride ourselves on speed to market." },
];

const OFFICES = [
  { badge: "Headquarters", city: "Sarasota, FL", address: "1570 Boulevard of the Arts\nSuite 130-3\nSarasota, FL 34236" },
  { badge: "East Coast", city: "Philadelphia, PA", address: "50 South 16th Street\nPhiladelphia, PA 19102" },
  { badge: "Southeast", city: "Tampa, FL", address: "1905 North Market Street\nTampa, FL 33602" },
];

const IGIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
);

const LIIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
);

export default function TeamPage() {
  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

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
      <section className="hero">
        <div className="eyebrow">The Postgame Team</div>
        <h1 className="d hero-title">Built by Athletes,<br />Run for Athletes</h1>
        <p className="hero-desc">Every person on our team played college sports. We know what it takes — and we use that to build campaigns that actually connect.</p>
      </section>

      {/* Team Grid */}
      <section className="section">
        <div className="section-eyebrow">Who We Are</div>
        <h2 className="d section-title">Meet the Team</h2>
        <div className="team-grid">
          {TEAM.map((member) => (
            <div key={member.name} className="team-card">
              <div className="team-photo">
                <img src={member.photo} alt={member.name} />
              </div>
              <div className="team-info">
                <div className="team-role">{member.role}</div>
                <div className="team-name">{member.name}</div>
                <div className="team-school">{member.school}</div>
                <div className="team-socials">
                  {member.ig && (
                    <a href={member.ig} target="_blank" rel="noopener noreferrer" className="team-social" title="Instagram">
                      <IGIcon />
                    </a>
                  )}
                  {member.li && (
                    <a href={member.li} target="_blank" rel="noopener noreferrer" className="team-social" title="LinkedIn">
                      <LIIcon />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">What Drives Us</div>
        <h2 className="d section-title">Our Values</h2>
        <div className="values-grid">
          {VALUES.map((v) => (
            <div key={v.num} className="value-card">
              <div className="value-num">{v.num}</div>
              <div className="value-title">{v.title}</div>
              <p className="value-desc">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Offices */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">Where We Work</div>
        <h2 className="d section-title">Offices</h2>
        <div className="offices-grid">
          {OFFICES.map((o) => (
            <div key={o.city} className="office-card">
              <div className="office-badge">{o.badge}</div>
              <div className="office-city">{o.city}</div>
              <div className="office-address">{o.address.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <h2 className="d cta-title">Want to Join<br />the Team?</h2>
        <p className="cta-sub">We&apos;re always looking for former athletes and sports marketers who want to build the future of NIL.</p>
        <div className="cta-btns">
          <a href="/contact" className="btn-solid">Get In Touch</a>
          <a href="/campaigns" className="btn-outline">See Our Work</a>
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
            <div>
              <div className="footer-col-title">Company</div>
              <ul className="footer-links">
                <li><a href="/about/team">About</a></li>
                <li><a href="/services/elevated">Services</a></li>
                <li><a href="/contact">Contact</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Network</div>
              <ul className="footer-links">
                <li><a href="/clients">Clients</a></li>
                <li><a href="/campaigns">Campaigns</a></li>
                <li><a href="/deals">Deal Tracker</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Connect</div>
              <ul className="footer-links">
                <li><a href="#">Instagram</a></li>
                <li><a href="#">TikTok</a></li>
                <li><a href="#">Twitter / X</a></li>
                <li><a href="#">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-copy">&copy; {new Date().getFullYear()} Postgame. All rights reserved.</div>
            <div className="footer-socials">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="/contact">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
