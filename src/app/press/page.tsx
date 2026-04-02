import { createPlainSupabase } from "@/lib/supabase";
import type { PressArticle } from "@/lib/types";
import type { Metadata } from "next";
import PressContent from "./PressContent";
import SiteFooter from "@/components/SiteFooter";

export const revalidate = 60;

export const metadata: Metadata = { title: "Press | Postgame" };

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
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Hero */}
      <div style={{
        paddingTop: 140,
        paddingBottom: 64,
        paddingLeft: 48,
        paddingRight: 48,
        textAlign: "center",
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(215,63,9,0.15) 0%, transparent 60%)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.22em", color: "#D73F09", marginBottom: 20, fontFamily: "Arial, sans-serif" }}>
          Media &amp; Coverage
        </div>
        <h1 className="d" style={{ fontSize: "clamp(56px, 8vw, 96px)", lineHeight: 0.92, margin: "0 0 20px", letterSpacing: "0.02em" }}>
          Press &amp; News
        </h1>
        <p style={{ fontSize: 24, lineHeight: 1.4, color: "rgba(255,255,255,0.55)", maxWidth: 540, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
          The latest press coverage and media highlights from Postgame NIL campaigns.
        </p>
        <div style={{ width: 48, height: 3, background: "#D73F09", margin: "32px auto 0" }} />
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px 80px" }}>
        <PressContent articles={allArticles} />
      </div>

      <SiteFooter />
    </div>
  );
}
