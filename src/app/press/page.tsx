import { createPlainSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import type { Metadata } from "next";
import PressContent from "./PressContent";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Press | Postgame",
};


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
{/* Nav */}
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
