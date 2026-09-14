import { createPlainSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";

export const revalidate = 60;

interface Props { params: { slug: string } }

export default async function CampaignInstructionsPublicPage({ params }: Props) {
  const supabase = createPlainSupabase();
  const { data } = await supabase.from("campaign_instructions").select("*").eq("slug", params.slug).single();
  if (!data) notFound();

  const d = data as any;
  const brandColor = d.brand_color || "#D73F09";

  return (
    <div style={{ minHeight:"100vh", background:"#000", color:"#fff", fontFamily:"Arial,Helvetica,sans-serif" }}>
      <style>{`
        :root { --brand: ${brandColor}; }
        .ci-hero { position:relative; width:100%; min-height:50vh; display:flex; align-items:flex-end; overflow:hidden; background:#0a0a0a; }
        .ci-hero-media { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 20%; }
        .ci-hero-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%); }
        .ci-hero-content { position:relative; z-index:1; padding:48px; width:100%; }
        .ci-brand { color:var(--brand); margin-bottom:12px;}
        .ci-title { margin:0 0 12px;}
        .ci-body { max-width:860px; margin:0 auto; padding:48px 48px 80px; }
        .ci-tabs { display:flex; gap:4; margin-bottom:40px; border-bottom:1px solid rgba(255,255,255,0.08); }
        .ci-tab { padding:12px 24px; border:none; background:none; color:rgba(255,255,255,0.4); cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; transition:all 0.15s;}
        .ci-tab.active { color:#fff; border-bottom-color:var(--brand); }
        .ci-section { margin-bottom:40px; }
        .ci-section-label { color:var(--brand); margin-bottom:16px;}
        .ci-text { white-space:pre-wrap;}
        .ci-deliverable { display:flex; align-items:flex-start; gap:12px; padding:14px 18px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; margin-bottom:8px; }
        .ci-deliverable-dot { width:8px; height:8px; border-radius:50%; background:var(--brand); flex-shrink:0; margin-top:6px; }
        .ci-deliverable-req { color:var(--brand);}
        .ci-dos-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .ci-do-list, .ci-dont-list { display:flex; flex-direction:column; gap:8px; }
        .ci-do-item { padding:10px 14px; background:rgba(74,222,128,0.06); border:1px solid rgba(74,222,128,0.15); border-radius:8px; font-size:16px; color:rgba(255,255,255,0.8); display:flex; align-items:flex-start; gap:10px; }
        .ci-dont-item { padding:10px 14px; background:rgba(248,113,113,0.06); border:1px solid rgba(248,113,113,0.15); border-radius:8px; font-size:16px; color:rgba(255,255,255,0.8); display:flex; align-items:flex-start; gap:10px; }
        .ci-contact { padding:28px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; }
        .ci-contact-name { margin-bottom:8px;}
        .ci-contact-detail { margin-bottom:4px;}
        .ci-contact-detail a { color:var(--brand); text-decoration:none; }
        @media(max-width:600px){
          .ci-hero-content{padding:24px;}
          .ci-body{padding:24px 20px 60px;}
          .ci-dos-grid{grid-template-columns:1fr;}
          .ci-text,.ci-deliverable-text,.ci-do-item,.ci-dont-item,
        }
      `}</style>

      {/* Nav just shows logo */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, padding:"16px 48px", background:"rgba(0,0,0,0.8)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <a href="/homepage"><img src="/postgame-logo.png" alt="Postgame" style={{ height:24, width:"auto" }} /></a>
        {d.brand_logo && <img src={d.brand_logo} alt={d.brand_name} style={{ height:24, objectFit:"contain", filter:"brightness(0) invert(1)", opacity:0.8 }} />}
      </div>

      {/* Hero */}
      <div className="ci-hero" style={{ paddingTop:64 }}>
        {d.hero_video
          ? <video className="ci-hero-media" src={d.hero_video} autoPlay muted loop playsInline />
          : d.hero_image
          ? <img className="ci-hero-media" src={d.hero_image} alt="" />
          : null
        }
        {(d.hero_image || d.hero_video) && <div className="ci-hero-overlay" />}
        <div className="ci-hero-content" style={{ paddingTop: d.hero_image||d.hero_video ? 48 : 120 }}>
          {d.brand_name && <div className="pg-eyebrow ci-brand">{d.brand_name}</div>}
          <h1 className="pg-h1 ci-title">{d.title}</h1>
          {d.campaign_date && <div className="pg-body ci-date">{new Date(d.campaign_date+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>}
        </div>
      </div>

      {/* Body with tab switcher */}
      <div className="ci-body">
        <script dangerouslySetInnerHTML={{ __html:`
          function switchTab(t) {
            document.querySelectorAll('.ci-tab').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.ci-section-content').forEach(el => el.style.display='none');
            document.getElementById('tab-'+t).classList.add('active');
            document.getElementById('content-'+t).style.display='block';
          }
        `}} />

        <div className="ci-tabs">
          <button className="pg-btn ci-tab active" id="tab-athlete" onClick={() => (window as any).switchTab('athlete')}>🏃 Athletes</button>
          <button className="pg-btn ci-tab" id="tab-crew" onClick={() => (window as any).switchTab('crew')}>🎥 Crew</button>
        </div>

        {["athlete","crew"].map(type => {
          const sec = type === "athlete" ? d.athlete_section : d.crew_section;
          if (!sec) return null;
          return (
            <div key={type} className="ci-section-content" id={`content-${type}`} style={{ display: type==="athlete"?"block":"none" }}>
              {sec.intro && (
                <div className="ci-section">
                  <p className="pg-body ci-text">{sec.intro}</p>
                </div>
              )}

              {sec.deliverables?.length > 0 && (
                <div className="ci-section">
                  <div className="pg-eyebrow ci-section-label">Deliverables</div>
                  {sec.deliverables.map((del: any, i: number) => (
                    <div key={i} className="ci-deliverable">
                      <div className="ci-deliverable-dot" />
                      <div>
                        <div className="pg-lead ci-deliverable-text">{del.text}</div>
                        {del.required && <div className="pg-label ci-deliverable-req">Required</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sec.timeline && (
                <div className="ci-section">
                  <div className="pg-eyebrow ci-section-label">Timeline & Deadlines</div>
                  <p className="pg-body ci-text">{sec.timeline}</p>
                </div>
              )}

              {(sec.dos_donts?.dos?.length > 0 || sec.dos_donts?.donts?.length > 0) && (
                <div className="ci-section">
                  <div className="pg-eyebrow ci-section-label">Dos & Don&apos;ts</div>
                  <div className="ci-dos-grid">
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:"#4ade80", marginBottom:10, textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>✅ DO</div>
                      <div className="ci-do-list">
                        {sec.dos_donts.dos.map((do_: string, i: number) => (
                          <div key={i} className="ci-do-item"><span>✓</span>{do_}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:"#f87171", marginBottom:10, textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>❌ DON&apos;T</div>
                      <div className="ci-dont-list">
                        {sec.dos_donts.donts.map((dont: string, i: number) => (
                          <div key={i} className="ci-dont-item"><span>✕</span>{dont}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sec.hashtags && (
                <div className="ci-section">
                  <div className="pg-eyebrow ci-section-label">Hashtags</div>
                  <p className="pg-body ci-text" style={{ color:brandColor }}>{sec.hashtags}</p>
                </div>
              )}

              {sec.talking_points && (
                <div className="ci-section">
                  <div className="pg-eyebrow ci-section-label">Talking Points</div>
                  <p className="pg-body ci-text">{sec.talking_points}</p>
                </div>
              )}

              {sec.contact_name && (
                <div className="ci-section">
                  <div className="pg-eyebrow ci-section-label">Your Point of Contact</div>
                  <div className="ci-contact">
                    <div className="pg-h3 ci-contact-name">{sec.contact_name}</div>
                    {sec.contact_email && <div className="pg-body ci-contact-detail"><a href={`mailto:${sec.contact_email}`}>{sec.contact_email}</a></div>}
                    {sec.contact_phone && <div className="pg-body ci-contact-detail"><a href={`tel:${sec.contact_phone}`}>{sec.contact_phone}</a></div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SiteFooter />
    </div>
  );
}
