"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const HIDDEN_ROUTES = ["/dashboard", "/login", "/reset-password", "/media-library", "/brief/", "/run-of-show/", "/recap/"];

export default function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null;

  const isHome = pathname === "/homepage" || pathname === "/";
  const navClass = `pg-nav${!isHome || scrolled ? " solid" : ""}`;

  const Chevron = () => (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  );

  return (
    <>
      <nav className={navClass}>
        <a href="/homepage" className="pg-nav-logo"><img src="/postgame-logo.png" alt="Postgame" style={{ height: 24, width: "auto", display: "block" }} /></a>

        <div className="pg-nav-links">
          <div className="pg-nav-item">
            <button>Network <Chevron /></button>
            <div className="pg-nav-dropdown">
              <a href="/clients">Clients</a>
              <a href="/campaigns">Campaigns</a>
              <a href="/deals">Deal Tracker</a>
            </div>
          </div>
          <div className="pg-nav-item">
            <button>Services <Chevron /></button>
            <div className="pg-nav-dropdown">
              <a href="/services/elevated">Elevated</a>
              <a href="/services/scaled">Scaled</a>
              <a href="/services/always-on">Always On</a>
              <a href="/services/experiential">Experiential</a>
            </div>
          </div>
          <div className="pg-nav-item">
            <button>About <Chevron /></button>
            <div className="pg-nav-dropdown">
              <a href="/about/team">Our Team</a>
              <a href="/press">Press</a>
              <a href="/case-studies">Case Studies</a>
            </div>
          </div>
        </div>

        <div className="pg-nav-actions">
          <a href="/contact" className="pg-btn-ghost">Contact</a>
          <a href="/deals" className="pg-btn-primary">Deal Tracker</a>
        </div>

        <button className="pg-nav-mobile-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
          {mobileOpen
            ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          }
        </button>
      </nav>

      <div className={`pg-mobile-menu${mobileOpen ? " open" : ""}`}>
        <div className="pg-mobile-section">Network</div>
        <a href="/clients" className="pg-mobile-link">Clients</a>
        <a href="/campaigns" className="pg-mobile-link">Campaigns</a>
        <a href="/deals" className="pg-mobile-link">Deal Tracker</a>

        <div className="pg-mobile-section">Services</div>
        <a href="/services/elevated" className="pg-mobile-link">Elevated</a>
        <a href="/services/scaled" className="pg-mobile-link">Scaled</a>
        <a href="/services/always-on" className="pg-mobile-link">Always On</a>
        <a href="/services/experiential" className="pg-mobile-link">Experiential</a>

        <div className="pg-mobile-section">About</div>
        <a href="/about/team" className="pg-mobile-link">Our Team</a>
        <a href="/press" className="pg-mobile-link">Press</a>
        <a href="/case-studies" className="pg-mobile-link">Case Studies</a>

        <div className="pg-mobile-actions">
          <a href="/contact" className="pg-btn-ghost" style={{ textAlign: "center" }}>Contact</a>
          <a href="/deals" className="pg-btn-primary" style={{ textAlign: "center" }}>Deal Tracker</a>
        </div>
      </div>
    </>
  );
}
