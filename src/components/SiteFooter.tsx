export default function SiteFooter() {
  return (
    <footer className="pg-footer">
      <div className="pg-footer-grid">
        <div>
          <a href="/homepage">
            <img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} />
          </a>
          <p className="pg-footer-brand-desc">
            The #1 NIL agency in the country. Connecting elite college athletes with the world&apos;s most ambitious brands.
          </p>
        </div>
        <div>
          <div className="pg-footer-col-title">Company</div>
          <ul className="pg-footer-links">
            <li><a href="/about/team">About</a></li>
            <li><a href="/services/elevated">Services</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <div className="pg-footer-col-title">Network</div>
          <ul className="pg-footer-links">
            <li><a href="/clients">Clients</a></li>
            <li><a href="/campaigns">Campaigns</a></li>
            <li><a href="/deals">Deal Tracker</a></li>
          </ul>
        </div>
        <div>
          <div className="pg-footer-col-title">Connect</div>
          <ul className="pg-footer-links">
            <li><a href="#">Instagram</a></li>
            <li><a href="#">TikTok</a></li>
            <li><a href="#">Twitter / X</a></li>
            <li><a href="#">LinkedIn</a></li>
          </ul>
        </div>
      </div>
      <div className="pg-footer-bottom">
        <span className="pg-footer-copy">&copy; {new Date().getFullYear()} Postgame. All rights reserved.</span>
        <div className="pg-footer-legal">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="/contact">Contact</a>
        </div>
      </div>
    </footer>
  );
}
