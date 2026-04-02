import { createPlainSupabase } from "@/lib/supabase";
import type { CaseStudy } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const revalidate = 60;
export const metadata: Metadata = { title: "Case Studies | Postgame" };

export default async function CaseStudiesPage() {
  const supabase = createPlainSupabase();
  const { data: studies } = await supabase
    .from("case_studies").select("*").eq("published", true)
    .order("sort_order", { ascending: true })
    .order("published_date", { ascending: false });

  const all = (studies || []) as CaseStudy[];
  const featured = all.find((s) => s.featured);
  const rest = all.filter((s) => s.id !== featured?.id);

  const T = { muted: "rgba(255,255,255,0.55)", dim: "rgba(255,255,255,0.35)", orange: "#D73F09", surface: "#111", border: "rgba(255,255,255,0.08)" };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style>{`
        .cs-feat{display:grid;grid-template-columns:1fr 1fr;border-radius:20px;overflow:hidden;border:1px solid ${T.border};background:${T.surface};text-decoration:none;color:inherit;transition:border-color 0.2s;}
        .cs-feat:hover{border-color:rgba(215,63,9,0.5);}
        .cs-feat-img{aspect-ratio:16/10;overflow:hidden;}
        .cs-feat-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.5s;}
        .cs-feat:hover .cs-feat-img img{transform:scale(1.05);}
        .cs-feat-info{padding:40px;}
        .cs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:48px;}
        .cs-card{border-radius:16px;overflow:hidden;border:1px solid ${T.border};background:${T.surface};text-decoration:none;color:inherit;display:block;transition:border-color 0.2s,transform 0.25s;}
        .cs-card:hover{border-color:rgba(215,63,9,0.4);transform:translateY(-4px);}
        .cs-card-img{aspect-ratio:16/10;overflow:hidden;}
        .cs-card-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.5s;}
        .cs-card:hover .cs-card-img img{transform:scale(1.05);}
        .cs-card-info{padding:20px 24px 24px;}
        @media(max-width:900px){.cs-feat{grid-template-columns:1fr;}.cs-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:600px){.cs-grid{grid-template-columns:1fr;}}
      `}</style>

      {/* Hero */}
      <div style={{ paddingTop: 140, paddingBottom: 64, paddingLeft: 48, paddingRight: 48, textAlign: "center", background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(215,63,9,0.12) 0%, transparent 60%)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.22em", color: T.orange, marginBottom: 20 }}>Postgame</div>
        <h1 className="d" style={{ fontSize: "clamp(56px,8vw,96px)", lineHeight: 0.92, margin: "0 0 0", letterSpacing: "0.02em" }}>Case Studies</h1>
        <div style={{ width: 48, height: 3, background: T.orange, margin: "32px auto 0" }} />
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px 80px" }}>
        {featured && (
          <Link href={`/case-studies/${featured.slug}`} className="cs-feat" style={{ marginBottom: 48, display: "grid" }}>
            {featured.image_url && <div className="cs-feat-img"><img src={featured.image_url} alt={featured.title} /></div>}
            <div className="cs-feat-info">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: T.orange }}>Featured</span>
                {featured.category && <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.dim }}>{featured.category}</span>}
              </div>
              <h2 className="d" style={{ fontSize: "clamp(24px,2.5vw,36px)", lineHeight: 1.1, margin: "0 0 8px" }}>{featured.title}</h2>
              <p style={{ fontSize: 18, lineHeight: 1.2, color: T.muted, marginBottom: 20 }}>{featured.brand_name}</p>
              {featured.hero_stat && (
                <div style={{ marginBottom: 16 }}>
                  <span className="d" style={{ fontSize: 44, color: T.orange, lineHeight: 1 }}>{featured.hero_stat}</span>
                  {featured.hero_stat_label && <span style={{ fontSize: 18, lineHeight: 1.2, color: T.muted, marginLeft: 8 }}>{featured.hero_stat_label}</span>}
                </div>
              )}
              {featured.overview && <p style={{ fontSize: 24, lineHeight: 1.4, color: T.muted, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{featured.overview}</p>}
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="cs-grid">
            {rest.map((s) => (
              <Link key={s.id} href={`/case-studies/${s.slug}`} className="cs-card">
                {s.image_url && <div className="cs-card-img"><img src={s.image_url} alt={s.title} /></div>}
                <div className="cs-card-info">
                  {s.category && <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.orange, marginBottom: 6 }}>{s.category}</div>}
                  <h3 className="d" style={{ fontSize: 24, lineHeight: 1.1, margin: "0 0 4px" }}>{s.title}</h3>
                  <p style={{ fontSize: 18, lineHeight: 1.2, color: T.muted, marginBottom: 12 }}>{s.brand_name}</p>
                  {s.hero_stat && (
                    <div>
                      <span className="d" style={{ fontSize: 28, color: T.orange, lineHeight: 1 }}>{s.hero_stat}</span>
                      {s.hero_stat_label && <span style={{ fontSize: 11, color: T.muted, marginLeft: 6 }}>{s.hero_stat_label}</span>}
                    </div>
                  )}
                  {s.overview && <p style={{ fontSize: 18, lineHeight: 1.4, color: T.muted, marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.overview}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {all.length === 0 && <div style={{ textAlign: "center", padding: "80px 24px", color: T.muted, fontSize: 24 }}>No case studies published yet.</div>}
      </div>

      <SiteFooter />
    </div>
  );
}
