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
  .contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;max-width:1000px;margin:0 auto;}
  .contact-form-wrap{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:40px;}
  .form-title{font-size:24px;font-weight:900;margin-bottom:24px;}
  .field{margin-bottom:20px;}
  .field label{display:block;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;}
  .field input,.field select,.field textarea{width:100%;padding:12px 16px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:var(--text);font-size:14px;font-family:Arial,sans-serif;outline:none;transition:border-color 0.2s;box-sizing:border-box;}
  .field input:focus,.field select:focus,.field textarea:focus{border-color:var(--orange);}
  .field textarea{min-height:120px;resize:vertical;}
  .field select option{background:#1a1a1a;}
  .submit-btn{width:100%;padding:14px;background:var(--orange);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer;transition:background 0.2s;}
  .submit-btn:hover{background:#c43808;}

  .contact-info{padding-top:8px;}
  .info-title{font-size:32px;line-height:1;margin-bottom:16px;}
  .info-desc{font-size:15px;color:var(--text-muted);line-height:1.7;margin-bottom:40px;}
  .info-block{margin-bottom:32px;}
  .info-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--orange);margin-bottom:8px;}
  .info-value{font-size:15px;color:var(--text-muted);line-height:1.6;}
  .info-value a{color:var(--text);text-decoration:none;transition:color 0.2s;}
  .info-value a:hover{color:var(--orange);}
  .office-list{display:flex;flex-direction:column;gap:16px;}
  .office-item{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 24px;}
  .office-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--orange);margin-bottom:6px;}
  .office-city{font-size:16px;font-weight:800;margin-bottom:4px;}
  .office-addr{font-size:13px;color:var(--text-muted);line-height:1.5;}

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
    .contact-grid{grid-template-columns:1fr;gap:40px;}
    .footer-top{grid-template-columns:1fr 1fr;gap:32px;}
  }
`;

export default function ContactPage() {
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
        <div className="eyebrow">Get In Touch</div>
        <h1 className="d hero-title">Let&apos;s Build Something<br />Together</h1>
        <p className="hero-desc">Whether you&apos;re a brand looking to run NIL campaigns or a marketer curious about our network — we&apos;d love to hear from you.</p>
      </section>

      <section className="section">
        <div className="contact-grid">
          {/* Form */}
          <div className="contact-form-wrap">
            <div className="form-title">Send Us a Message</div>
            <form action="mailto:hello@postgame.co" method="get" encType="text/plain">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="field">
                  <label>First Name</label>
                  <input type="text" name="first_name" placeholder="John" />
                </div>
                <div className="field">
                  <label>Last Name</label>
                  <input type="text" name="last_name" placeholder="Smith" />
                </div>
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" name="email" placeholder="john@company.com" />
              </div>
              <div className="field">
                <label>Company</label>
                <input type="text" name="company" placeholder="Your brand or agency" />
              </div>
              <div className="field">
                <label>I&apos;m interested in</label>
                <select name="interest">
                  <option value="">Select an option</option>
                  <option value="nil_campaigns">Running NIL Campaigns</option>
                  <option value="athlete_network">Accessing Our Athlete Network</option>
                  <option value="experiential">Experiential / Events</option>
                  <option value="content">Content Production</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field">
                <label>Message</label>
                <textarea name="message" placeholder="Tell us about your goals, timeline, or any questions you have..." />
              </div>
              <button type="submit" className="submit-btn">Send Message</button>
            </form>
          </div>

          {/* Info */}
          <div className="contact-info">
            <h2 className="d info-title">We&apos;re Ready<br />When You Are</h2>
            <p className="info-desc">Our team moves fast. Most inquiries get a response within 24 hours — often same day.</p>

            <div className="info-block">
              <div className="info-label">Email</div>
              <div className="info-value"><a href="mailto:hello@postgame.co">hello@postgame.co</a></div>
            </div>

            <div className="info-block">
              <div className="info-label">Our Offices</div>
              <div className="office-list">
                {[
                  { badge: "Headquarters", city: "Sarasota, FL", addr: "1570 Boulevard of the Arts, Suite 130-3" },
                  { badge: "East Coast", city: "Philadelphia, PA", addr: "50 South 16th Street" },
                  { badge: "Southeast", city: "Tampa, FL", addr: "1905 North Market Street" },
                ].map((o) => (
                  <div key={o.city} className="office-item">
                    <div className="office-badge">{o.badge}</div>
                    <div className="office-city">{o.city}</div>
                    <div className="office-addr">{o.addr}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
