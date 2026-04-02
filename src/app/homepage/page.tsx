import { getHomepage, getBrandLogos, type HomepageData, type PageSection } from "@/lib/public-site";
import SiteFooter from "@/components/SiteFooter";

export const revalidate = 60;

function getSection(sections: PageSection[], type: string) {
  return sections.find(s => s.type === type && s.visible !== false);
}
function getSetting(page: HomepageData["page"], key: string): unknown {
  return (page.settings as Record<string, unknown>)?.[key];
}
function settingText(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "text" in val) return String((val as Record<string, unknown>).text);
}
function settingUrl(val: unknown): string | undefined {
  if (typeof val === "object" && val !== null && "url" in val) return String((val as Record<string, unknown>).url);
}
function contentArr(section: PageSection, ...keys: string[]): Record<string, unknown>[] {
  const c = section.content;
  if (!c) return [];
  for (const k of keys) { if (Array.isArray(c[k])) return c[k] as Record<string, unknown>[]; }
  if (Array.isArray(c)) return c;
  return [];
}
function contentStr(section: PageSection, key: string): string {
  const v = section.content?.[key];
  return typeof v === "string" ? v : "";
}

function ScrollScript() {
  return <script dangerouslySetInnerHTML={{ __html: `(function(){var n=document.querySelector('.pg-nav');if(!n)return;function u(){n.classList.toggle('solid',window.scrollY>40);}window.addEventListener('scroll',u,{passive:true});u();})();` }} />;
}

function Fallback() {
  return (
    <div className="pg-page">
      <div className="hp-hero"><div className="hp-hero-inner">
        <div className="pg-eyebrow" style={{marginBottom:20}}>NIL Campaign Management</div>
        <h1 className="hp-hero-title d">We Build<br/>Athlete-Powered<br/>Campaigns</h1>
        <p className="hp-hero-desc">Postgame connects brands with college athletes to create authentic, high-performing NIL campaigns at scale.</p>
        <div className="btn-group" style={{justifyContent:"center",marginTop:40}}>
          <a href="/deals" className="btn-primary">Deal Tracker</a>
          <a href="/contact" className="btn-secondary">Work With Us</a>
        </div>
      </div></div>
      <SiteFooter />
    </div>
  );
}

export default async function HomepagePage() {
  let data: HomepageData | null = null;
  let brandLogos = new Map<string, string>();
  try { [data, brandLogos] = await Promise.all([getHomepage(), getBrandLogos()]); } catch {}
  if (!data) return <Fallback />;

  const { page, sections } = data;
  const raw = (k: string) => getSetting(page, k);
  const s = (k: string) => settingText(raw(k));
  const ps = (page.settings as Record<string, unknown>)?.public_sections as Record<string, boolean> | undefined;
  const show = (k: string) => !ps || ps[k] !== false;
  const stats = (getSetting(page, "stats") as {value:string;label:string}[] | undefined) || [];
  const fc = getSection(sections, "featured_campaigns");
  const fa = getSection(sections, "featured_athletes");
  const bp = getSection(sections, "brand_partners");
  const sg = getSection(sections, "services_grid");

  return (
    <div className="pg-page">
      <style>{`
        .hp-hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:120px 24px 80px;position:relative;overflow:hidden;}
        .hp-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(215,63,9,0.18) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 80%,rgba(215,63,9,0.06) 0%,transparent 50%);pointer-events:none;}
        .hp-hero-inner{position:relative;z-index:1;max-width:860px;}
        .hp-hero-title{font-size:clamp(72px,12vw,140px);line-height:0.9;letter-spacing:0.01em;margin:16px 0 28px;background:linear-gradient(160deg,#fff 40%,rgba(255,255,255,0.55) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .hp-hero-desc{font-size:24px;line-height:1.4;color:rgba(255,255,255,0.6);max-width:540px;margin:0 auto;}
        .hp-stats{display:flex;justify-content:center;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);}
        .hp-stat{flex:1;max-width:220px;padding:36px 24px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);}
        .hp-stat:last-child{border-right:none;}
        .hp-stat-num{font-family:'Bebas Neue',Arial,sans-serif;font-size:52px;line-height:1;color:var(--orange);letter-spacing:0.02em;}
        .hp-stat-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:rgba(255,255,255,0.4);margin-top:6px;}
        .hp-sec{padding:96px 48px;}
        .hp-sec-alt{padding:96px 48px;background:rgba(255,255,255,0.015);}
        .hp-featured{position:relative;border-radius:24px;overflow:hidden;min-height:440px;display:flex;flex-direction:column;justify-content:flex-end;padding:40px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);transition:border-color 0.25s;}
        .hp-featured:hover{border-color:rgba(215,63,9,0.5);}
        .hp-featured-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.2) 50%,transparent 100%);}
        .hp-featured-content{position:relative;z-index:1;}
        .hp-masonry{column-count:3;column-gap:16px;}
        .hp-card{break-inside:avoid;margin-bottom:16px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);backdrop-filter:blur(12px);transition:border-color 0.2s,transform 0.2s;}
        .hp-card:hover{border-color:rgba(215,63,9,0.35);transform:translateY(-3px);}
        .hp-card-body{padding:20px 24px 24px;}
        .hp-card-nm{min-height:180px;display:flex;flex-direction:column;justify-content:flex-end;padding:24px;}
        .hp-card-brand{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:var(--orange);margin-bottom:4px;}
        .hp-card-title{font-family:'Bebas Neue',Arial,sans-serif;font-size:28px;line-height:1;}
        .hp-card-meta{font-size:13px;color:rgba(255,255,255,0.45);margin-top:4px;}
        .hp-athletes-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px;}
        .hp-athlete{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:3/4;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);transition:border-color 0.2s,transform 0.25s;}
        .hp-athlete:hover{border-color:rgba(215,63,9,0.4);transform:translateY(-4px);}
        .hp-athlete img{width:100%;height:100%;object-fit:cover;object-position:center 15%;}
        .hp-athlete-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.82) 0%,transparent 50%);}
        .hp-athlete-info{position:absolute;bottom:0;left:0;right:0;padding:20px;}
        .hp-athlete-sport{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:var(--orange);margin-bottom:4px;}
        .hp-athlete-name{font-family:'Bebas Neue',Arial,sans-serif;font-size:26px;line-height:1;}
        .hp-athlete-school{font-size:12px;color:rgba(255,255,255,0.55);margin-top:2px;}
        .hp-brands-wrap{padding:64px 48px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);}
        .hp-brands-row{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:center;margin-top:36px;}
        .hp-brand-pill{height:48px;min-width:120px;display:flex;align-items:center;justify-content:center;padding:10px 20px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);transition:all 0.2s;}
        .hp-brand-pill:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.14);}
        .hp-brand-pill img{max-height:24px;max-width:80px;object-fit:contain;filter:grayscale(1) brightness(2);opacity:0.5;transition:opacity 0.2s,filter 0.2s;}
        .hp-brand-pill:hover img{opacity:0.9;filter:none;}
        .hp-brand-txt{font-size:11px;font-weight:800;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:0.06em;}
        .hp-services-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px;}
        .hp-service{padding:36px 28px;border-radius:20px;background:rgba(255,255,255,0.04);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);transition:border-color 0.25s,background 0.25s;}
        .hp-service:hover{border-color:rgba(215,63,9,0.4);background:rgba(255,255,255,0.065);}
        .hp-service-accent{border-left:3px solid var(--orange);}
        .hp-service-num{font-size:11px;font-weight:800;color:rgba(255,255,255,0.3);letter-spacing:0.12em;margin-bottom:16px;}
        .hp-service-accent .hp-service-num{color:var(--orange);}
        .hp-service-title{font-size:20px;font-weight:800;margin-bottom:12px;}
        .hp-service-desc{font-size:18px;line-height:1.4;color:rgba(255,255,255,0.55);}
        .hp-cta{padding:120px 24px;text-align:center;position:relative;overflow:hidden;}
        .hp-cta::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(215,63,9,0.14) 0%,transparent 60%);pointer-events:none;}
        .hp-cta-inner{position:relative;z-index:1;}
        .hp-cta-title{font-family:'Bebas Neue',Arial,sans-serif;font-size:clamp(56px,8vw,96px);line-height:0.92;letter-spacing:0.02em;margin-bottom:20px;}
        .hp-cta-desc{font-size:24px;line-height:1.4;color:rgba(255,255,255,0.55);max-width:480px;margin:0 auto 40px;}
        .rc-1{background:linear-gradient(135deg,#1a1a2e,#0f3460);}
        .rc-2{background:linear-gradient(135deg,#1a1a1a,#3d1f14);}
        .rc-3{background:linear-gradient(135deg,#141414,#1e3a1e);}
        .rc-4{background:linear-gradient(135deg,#1a1a1a,#3a1e3d);}
        .rc-5{background:linear-gradient(135deg,#1a1a1a,#1e3a3a);}
        @media(max-width:900px){
          .hp-hero{padding:100px 20px 64px;}
          .hp-hero-title{font-size:clamp(56px,16vw,80px);}
          .hp-hero-desc{font-size:14px;}
          .hp-stat{min-width:50%;flex:none;}
          .hp-sec,.hp-sec-alt{padding:64px 20px;}
          .hp-masonry{column-count:2;}
          .hp-athletes-grid{grid-template-columns:repeat(2,1fr);}
          .hp-services-grid{grid-template-columns:1fr;}
          .hp-brands-wrap{padding:48px 20px;}
          .hp-cta{padding:80px 20px;}
          .hp-cta-desc,.hp-service-desc{font-size:14px;}
          .hp-cta-title{font-size:clamp(48px,14vw,72px);}
        }
        @media(max-width:600px){
          .hp-masonry{column-count:1;}
          .hp-athletes-grid{grid-template-columns:1fr 1fr;}
        }
      `}</style>

      {/* Hero */}
      <section className="hp-hero">
        <div className="hp-hero-inner">
          {s("hero_eyebrow") && <div className="pg-eyebrow" style={{marginBottom:20}}>{s("hero_eyebrow")}</div>}
          <h1 className="hp-hero-title d">{s("hero_title") || "We Build\nAthlete-Powered\nCampaigns"}</h1>
          {s("hero_desc") && <p className="hp-hero-desc">{s("hero_desc")}</p>}
          <div className="btn-group" style={{justifyContent:"center",marginTop:40}}>
            {s("hero_cta_primary") && <a href={settingUrl(raw("hero_cta_primary"))||"/deals"} className="btn-primary">{s("hero_cta_primary")}</a>}
            {s("hero_cta_secondary") && <a href={settingUrl(raw("hero_cta_secondary"))||"/contact"} className="btn-secondary">{s("hero_cta_secondary")}</a>}
          </div>
        </div>
      </section>

      {/* Stats */}
      {show("stats") && stats.length > 0 && (
        <div className="hp-stats">
          {stats.map((st, i) => (
            <div key={i} className="hp-stat">
              <div className="hp-stat-num">{st.value}</div>
              <div className="hp-stat-label">{st.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Campaigns */}
      {show("featured_campaigns") && fc && (() => {
        const cps = contentArr(fc, "campaigns", "items");
        if (!cps.length) return null;
        const fi = Math.max(0, cps.findIndex(c => c.featured));
        const feat = cps[fi];
        const rest = cps.filter((_,i) => i !== fi);
        const GRADIENTS = ["rc-1","rc-2","rc-3","rc-4","rc-5"];
        return (
          <div className="hp-sec">
            {contentStr(fc,"eyebrow") && <div className="pg-eyebrow">{contentStr(fc,"eyebrow")}</div>}
            <h2 className="d pg-section-title">{fc.title || "Campaign Highlights"}</h2>
            {feat && (
              <div className={`hp-featured${feat.image_url ? "" : " rc-1"}`}>
                {feat.image_url && (String(feat.media_type||"")==="video"
                  ? <video autoPlay muted loop playsInline src={String(feat.image_url)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
                  : <img src={String(feat.image_url)} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:String(feat.focal_point||"center 20%")}} />
                )}
                <div className="hp-featured-overlay"/>
                <div className="hp-featured-content">
                  {String(feat.brand||"") && <div className="hp-card-brand">{String(feat.brand||"")}</div>}
                  <div className="d hp-card-title" style={{fontSize:"clamp(32px,4vw,52px)"}}>{String(feat.name||feat.title||"")}</div>
                  {String(feat.meta||"") && <div className="hp-card-meta">{String(feat.meta||"")}</div>}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div className="hp-masonry">
                {rest.map((item, i) => {
                  const hasMedia = !!item.image_url;
                  const isVid = String(item.media_type||"")==="video";
                  return (
                    <div key={i} className={`hp-card${!hasMedia?" "+GRADIENTS[i%5]:""}`}>
                      {hasMedia && (isVid
                        ? <video autoPlay muted loop playsInline src={String(item.image_url)} style={{width:"100%",display:"block"}}/>
                        : <img src={String(item.image_url)} alt="" style={{width:"100%",display:"block",objectPosition:String(item.focal_point||"center 20%")}}/>
                      )}
                      <div className={hasMedia?"hp-card-body":"hp-card-nm"}>
                        {String(item.brand||"") && <div className="hp-card-brand">{String(item.brand||"")}</div>}
                        <div className="d hp-card-title">{String(item.name||item.title||"")}</div>
                        {String(item.meta||"") && <div className="hp-card-meta">{String(item.meta||"")}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Athletes */}
      {show("featured_athletes") && fa && (() => {
        const aths = contentArr(fa, "athletes", "items");
        if (!aths.length) return null;
        return (
          <div className="hp-sec-alt">
            {contentStr(fa,"eyebrow") && <div className="pg-eyebrow">{contentStr(fa,"eyebrow")}</div>}
            <h2 className="d pg-section-title">{fa.title || "Featured Athletes"}</h2>
            <div className="hp-athletes-grid">
              {aths.map((item, i) => {
                const name = String(item.name||"");
                return (
                  <div key={i} className="hp-athlete">
                    {item.image_url
                      ? <img src={String(item.image_url)} alt={name}/>
                      : <div style={{width:"100%",height:"100%",background:"rgba(215,63,9,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,fontWeight:900,color:"var(--orange)",fontFamily:"'Bebas Neue',Arial,sans-serif"}}>{name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
                    }
                    <div className="hp-athlete-overlay"/>
                    <div className="hp-athlete-info">
                      {String(item.sport||"") && <div className="hp-athlete-sport">{String(item.sport||"")}</div>}
                      <div className="d hp-athlete-name">{name}</div>
                      {String(item.school||"") && <div className="hp-athlete-school">{String(item.school||"")}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Brands */}
      {show("brand_partners") && bp && (() => {
        const logos = contentArr(bp, "logos", "items");
        return (
          <div className="hp-brands-wrap">
            {contentStr(bp,"eyebrow") && <div className="pg-eyebrow">{contentStr(bp,"eyebrow")}</div>}
            <h2 className="d pg-section-title" style={{margin:"12px 0 0"}}>{bp.title||"Brand Partners"}</h2>
            <div className="hp-brands-row">
              {(logos.length ? logos : Array.from({length:8},(_,i)=>({name:`Brand ${i+1}`,logo_url:"",href:"#"}))).map((item,i) => (
                <a key={i} href={String(item.href||"#")} className="hp-brand-pill">
                  {item.logo_url
                    ? <img src={String(item.logo_url)} alt={String(item.name||"")}/>
                    : <span className="hp-brand-txt">{String(item.name||"Brand")}</span>
                  }
                </a>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Services */}
      {show("services_grid") && sg && (() => {
        const svcs = contentArr(sg, "services", "items");
        if (!svcs.length) return null;
        return (
          <div className="hp-sec" id="services">
            {contentStr(sg,"eyebrow") && <div className="pg-eyebrow">{contentStr(sg,"eyebrow")}</div>}
            <h2 className="d pg-section-title">{sg.title||"Our Services"}</h2>
            <div className="hp-services-grid">
              {svcs.map((item,i) => (
                <div key={i} className={`hp-service${item.accent?" hp-service-accent":""}`}>
                  <div className="hp-service-num">{String(item.num||String(i+1).padStart(2,"0"))}</div>
                  <div className="hp-service-title">{String(item.name||item.title||"")}</div>
                  {(item.desc||item.description) && <p className="hp-service-desc">{String(item.desc||item.description||"")}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* CTA */}
      {show("cta") && (s("cta_title")||s("cta_desc")) && (
        <section className="hp-cta">
          <div className="hp-cta-inner">
            {s("cta_title") && <h2 className="hp-cta-title">{s("cta_title")}</h2>}
            {s("cta_desc") && <p className="hp-cta-desc">{s("cta_desc")}</p>}
            <div className="btn-group" style={{justifyContent:"center"}}>
              <a href="/contact" className="btn-primary">Get In Touch</a>
              <a href="/campaigns" className="btn-secondary">See Our Work</a>
            </div>
          </div>
        </section>
      )}

      <SiteFooter/>
      <ScrollScript/>
    </div>
  );
}
