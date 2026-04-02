import { createPlainSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import type { Metadata } from "next";
import PressContent from "./PressContent";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Press | Postgame",
};

const navStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  :root{--orange:#D73F09;--bg:#0A0A0A;--surface:#141414;--border:rgba(255,255,255,0.08);--text:#fff;--text-muted:rgba(255,255,255,0.55);--text-dim:rgba(255,255,255,0.35);}
  *{box-sizing:border-box;}
  .pg-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:16px 48px;background:rgba(10,10,10,0.92);backdrop-filter:blur(16px);box-shadow:0 1px 0 var(--border);}
  .pg-nav-logo{font-size:22px;font-weight:900;color:var(--orange);text-decoration:none;font-family:Arial,sans-serif;}
  .pg-nav-links{display:flex;align-items:center;gap:32px;}
  .pg-nav-links a{color:var(--text-muted);font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;transition:color 0.2s;}
  .pg-nav-links a:hover{color:var(--text);}
  .pg-btn-outline{padding:8px 20px;border:1.5px solid var(--orange);border-radius:8px;color:var(--orange);font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;}
  .pg-btn-solid{padding:10px 28px;background:var(--orange);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.06em;}
  .press-hero{padding:140px 48px 64px;text-align:center;background:radial-gradient(ellipse at 50% 0%,rgba(215,63,9,0.1) 0%,transparent 60%);}
  .press-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;color:var(--orange);margin-bottom:20px;}
  .press-title{font-size:clamp(48px,8vw,80px);line-height:0.95;margin:0 0 20px;font-family:'Bebas Neue',Arial,sans-serif;color:var(--text);}
  .press-desc{font-size:18px;color:var(--text-muted);max-width:560px;line-height:1.6;margin:0 auto;}
  .press-divider{width:48px;height:3px;background:var(--orange);margin:32px auto 0;}
  .pg-footer{border-top:1px solid var(--border);padding:48px;display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:48px;}
  .pg-footer-brand-desc{font-size:13px;color:var(--text-muted);line-height:1.6;max-width:240px;margin-top:12px;}
  .pg-footer-col-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-dim);margin-bottom:16px;}
  .pg-footer-links{list-style:none;padding:0;margin:0;}
  .pg-footer-links li{margin-bottom:10px;}
  .pg-footer-links a{font-size:14px;color:var(--text-muted);text-decoration:none;transition:color 0.2s;}
  .pg-footer-links a:hover{color:var(--text);}
  .pg-footer-bottom{border-top:1px solid var(--border);padding:24px 48px;display:flex;align-items:center;justify-content:space-between;}
  .pg-footer-copy{font-size:12px;color:var(--text-dim);}
  .pg-footer-socials{display:flex;gap:24px;}
  .pg-footer-socials a{font-size:12px;color:var(--text-muted);text-decoration:none;}
  @media(max-width:900px){.pg-nav{padding:14px 24px;}.pg-nav-links{display:none;}.press-hero{padding:110px 24px 48px;}.pg-footer{grid-template-columns:1fr 1fr;gap:32px;padding:32px 24px;}.pg-footer-bottom{padding:20px 24px;flex-direction:column;gap:12px;}}
`;

export default async function PressPage() {
  const supabase = createPlainSupabase();
  const { data: articles } = await supabase
    .from("press_articles")
    .select("*")
    .eq("published", true)
    .eq("archived", false)
    .order("published_date", { ascending: false });

  const allArticles = (articles || []) as PressArticle[];

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: navStyles }} />

      {/* Nav */}
      <nav className="pg-nav">
        <a href="/homepage" className="pg-nav-logo">POSTGAME</a>
        <div className="pg-nav-links">
          <a href="/clients">Clients</a>
          <a href="/campaigns">Campaigns</a>
          <a href="/about/team">About</a>
          <a href="/contact" className="pg-btn-outline">Contact</a>
          <a href="/deals" className="pg-btn-solid">Deal Tracker</a>
        </div>
      </nav>

      {/* Hero */}
      <div className="press-hero">
        <div className="press-eyebrow">Media & Coverage</div>
        <h1 className="press-title">Press & News</h1>
        <p className="press-desc">The latest press coverage and media highlights from Postgame NIL campaigns.</p>
        <div className="press-divider" />
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px 80px" }}>
        <PressContent articles={allArticles} />
      </div>

      {/* Footer */}
      <footer>
        <div className="pg-footer">
          <div>
            <a href="/homepage"><img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} /></a>
            <p className="pg-footer-brand-desc">The #1 NIL agency in the country. Connecting elite college athletes with the world&apos;s most ambitious brands.</p>
          </div>
          <div>
            <div className="pg-footer-col-title">Company</div>
            <ul className="pg-footer-links"><li><a href="/about/team">About</a></li><li><a href="/services/elevated">Services</a></li><li><a href="/contact">Contact</a></li></ul>
          </div>
          <div>
            <div className="pg-footer-col-title">Network</div>
            <ul className="pg-footer-links"><li><a href="/clients">Clients</a></li><li><a href="/campaigns">Campaigns</a></li><li><a href="/deals">Deal Tracker</a></li></ul>
          </div>
          <div>
            <div className="pg-footer-col-title">Connect</div>
            <ul className="pg-footer-links"><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li><li><a href="#">Twitter / X</a></li><li><a href="#">LinkedIn</a></li></ul>
          </div>
        </div>
        <div className="pg-footer-bottom">
          <div className="pg-footer-copy">&copy; {new Date().getFullYear()} Postgame. All rights reserved.</div>
          <div className="pg-footer-socials"><a href="#">Privacy</a><a href="#">Terms</a><a href="/contact">Contact</a></div>
        </div>
      </footer>
    </div>
  );
}
