"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

interface OptInField { id: string; label: string; type: "text"|"select"|"textarea"|"checkbox"; required: boolean; options?: string }
interface OptInPage {
  id: string; title: string; slug: string;
  brand_name: string; brand_logo?: string; brand_color: string; hero_image?: string;
  campaign_description: string; compensation_info: string; deadline: string;
  terms: string; fields: OptInField[]; success_message: string;
}

export default function CampaignOptInPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createBrowserSupabase();
  const [page, setPage] = useState<OptInPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  useEffect(() => {
    supabase.from("campaign_optins").select("*").eq("slug", slug).single().then(({ data }) => {
      if (data) {
        setPage(data as OptInPage);
        const defaults: Record<string,string> = {};
        (data as OptInPage).fields.forEach(f => { defaults[f.id] = ""; });
        setFormData(defaults);
      }
      setLoading(false);
    });
  }, [slug]);

  function validate() {
    const errs: Record<string,string> = {};
    page?.fields.forEach(f => {
      if (f.required && !formData[f.id]) errs[f.id] = "Required";
      if (f.required && f.type === "checkbox" && formData[f.id] !== "true") errs[f.id] = "You must agree to continue";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !page) return;
    setSubmitting(true);
    await supabase.from("campaign_optin_submissions").insert({ optin_id: page.id, data: formData });
    setSubmitting(false);
    setSubmitted(true);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.4)", fontFamily:"Arial,sans-serif", fontSize:14 }}>Loading...</div>
  );
  if (!page) return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.4)", fontFamily:"Arial,sans-serif", gap:16 }}>
      <div style={{ fontSize:18 }}>This page doesn't exist.</div>
      <a href="/homepage" style={{ color:"#D73F09", fontWeight:700, fontSize:14 }}>← Back to Postgame</a>
    </div>
  );

  const bc = page.brand_color || "#D73F09";

  if (submitted) return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Arial,sans-serif" }}>
      <div style={{ textAlign:"center", maxWidth:480, padding:"0 24px" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:`${bc}22`, border:`2px solid ${bc}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, margin:"0 auto 28px" }}>✓</div>
        {page.brand_logo && <img src={page.brand_logo} alt={page.brand_name} style={{ height:36, objectFit:"contain", margin:"0 auto 24px", display:"block", filter:"brightness(0) invert(1)" }} />}
        <h1 style={{ fontFamily:"'Bebas Neue',Arial,sans-serif", fontSize:52, lineHeight:0.95, color:"#fff", margin:"0 0 20px", letterSpacing:"0.02em" }}>You&apos;re In!</h1>
        <p style={{ fontSize:18, lineHeight:1.6, color:"rgba(255,255,255,0.65)" }}>{page.success_message}</p>
        <a href="/homepage" style={{ display:"inline-block", marginTop:36, padding:"12px 28px", background:bc, borderRadius:8, color:"#fff", fontWeight:800, fontSize:13, textDecoration:"none", textTransform:"uppercase", letterSpacing:"0.07em" }}>Back to Postgame</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#000", color:"#fff", fontFamily:"Arial,Helvetica,sans-serif" }}>
      <style>{`
        :root{--brand:${bc};}
        *{box-sizing:border-box;}
        .oi-input{width:100%;padding:12px 16px;background:#111;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:16px;font-family:Arial,sans-serif;outline:none;transition:border-color 0.15s;}
        .oi-input:focus{border-color:var(--brand);}
        .oi-input.err{border-color:#f87171;}
        .oi-label{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.45);margin-bottom:7px;}
        .oi-errtxt{font-size:12px;color:#f87171;margin-top:4px;}
        .oi-check{display:flex;align-items:flex-start;gap:12px;padding:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;cursor:pointer;}
        .oi-check.err{border-color:#f87171;}
        .oi-box{width:20px;height:20px;border:2px solid rgba(255,255,255,0.25);border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:2px;transition:all 0.15s;background:transparent;}
        .oi-box.on{background:var(--brand);border-color:var(--brand);}
        .oi-submit{width:100%;padding:16px;background:var(--brand);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;text-transform:uppercase;letter-spacing:0.08em;transition:opacity 0.15s;margin-top:8px;font-family:Arial,sans-serif;}
        .oi-submit:hover{opacity:0.88;}
        .oi-submit:disabled{opacity:0.5;cursor:not-allowed;}
        @media(max-width:600px){.oi-input{font-size:14px;}}
      `}</style>

      {/* Nav */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, padding:"14px 32px", background:"rgba(0,0,0,0.85)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <a href="/homepage"><img src="/postgame-logo.png" alt="Postgame" style={{ height:22, width:"auto" }} /></a>
        {page.brand_logo && <img src={page.brand_logo} alt={page.brand_name} style={{ height:22, objectFit:"contain", filter:"brightness(0) invert(1)", opacity:0.75 }} />}
      </div>

      {/* Hero image */}
      {page.hero_image && (
        <div style={{ position:"relative", width:"100%", height:280, overflow:"hidden", paddingTop:54 }}>
          <img src={page.hero_image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 20%", display:"block" }} />
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,rgba(0,0,0,0.85) 100%)" }} />
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth:600, margin:"0 auto", padding: page.hero_image ? "0 24px 80px" : "100px 24px 80px" }}>

        {/* Header */}
        <div style={{ textAlign:"center", padding:"40px 0 36px", borderBottom:"1px solid rgba(255,255,255,0.08)", marginBottom:36 }}>
          {page.brand_logo
            ? <img src={page.brand_logo} alt={page.brand_name} style={{ height:40, objectFit:"contain", margin:"0 auto 20px", display:"block", filter:"brightness(0) invert(1)" }} />
            : page.brand_name && <div style={{ fontSize:13, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.18em", color:bc, marginBottom:16 }}>{page.brand_name}</div>
          }
          <h1 style={{ fontFamily:"'Bebas Neue',Arial,sans-serif", fontSize:"clamp(40px,8vw,64px)", lineHeight:0.95, margin:"0 0 20px", letterSpacing:"0.02em" }}>{page.title}</h1>
          {page.campaign_description && (
            <p style={{ fontSize:18, lineHeight:1.6, color:"rgba(255,255,255,0.65)", maxWidth:480, margin:"0 auto" }}>{page.campaign_description}</p>
          )}
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginTop:24 }}>
            {page.compensation_info && (
              <div style={{ padding:"8px 16px", borderRadius:20, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", fontSize:14, color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:bc }}>$</span> {page.compensation_info}
              </div>
            )}
            {page.deadline && (
              <div style={{ padding:"8px 16px", borderRadius:20, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", fontSize:14, color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", gap:8 }}>
                <span>⏰</span> Deadline: {new Date(page.deadline+"T00:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric"})}
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit}>
          <div style={{ fontSize:13, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.14em", color:bc, marginBottom:20 }}>Confirm Your Participation</div>
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            {page.fields.map(field => {
              const hasErr = !!errors[field.id];
              const val = formData[field.id] || "";
              const setVal = (v: string) => setFormData(p=>({...p,[field.id]:v}));

              if (field.type === "checkbox") return (
                <div key={field.id}>
                  <div className={`oi-check${hasErr?" err":""}`} onClick={()=>setVal(val==="true"?"":"true")}>
                    <div className={`oi-box${val==="true"?" on":""}`}>{val==="true"&&<span style={{color:"#fff",fontSize:13,fontWeight:900}}>✓</span>}</div>
                    <span style={{ fontSize:15, lineHeight:1.5, color:"rgba(255,255,255,0.8)" }}>{field.label}</span>
                  </div>
                  {hasErr && <div className="oi-errtxt">{errors[field.id]}</div>}
                </div>
              );

              if (field.type === "select") return (
                <div key={field.id}>
                  <label className="oi-label">{field.label}{field.required&&<span style={{color:bc}}> *</span>}</label>
                  <select className={`oi-input${hasErr?" err":""}`} value={val} onChange={e=>setVal(e.target.value)} style={{appearance:"none"}}>
                    <option value="">Select...</option>
                    {(field.options||"").split(",").map(o=><option key={o.trim()} value={o.trim()}>{o.trim()}</option>)}
                  </select>
                  {hasErr && <div className="oi-errtxt">{errors[field.id]}</div>}
                </div>
              );

              if (field.type === "textarea") return (
                <div key={field.id}>
                  <label className="oi-label">{field.label}{field.required&&<span style={{color:bc}}> *</span>}</label>
                  <textarea className={`oi-input${hasErr?" err":""}`} value={val} onChange={e=>setVal(e.target.value)} style={{minHeight:80,resize:"vertical"}} />
                  {hasErr && <div className="oi-errtxt">{errors[field.id]}</div>}
                </div>
              );

              return (
                <div key={field.id}>
                  <label className="oi-label">{field.label}{field.required&&<span style={{color:bc}}> *</span>}</label>
                  <input
                    className={`oi-input${hasErr?" err":""}`}
                    type={field.label.toLowerCase().includes("email")?"email":field.label.toLowerCase().includes("phone")?"tel":"text"}
                    value={val} onChange={e=>setVal(e.target.value)} placeholder={field.label}
                  />
                  {hasErr && <div className="oi-errtxt">{errors[field.id]}</div>}
                </div>
              );
            })}
          </div>

          {page.terms && (
            <div style={{ marginTop:24, padding:"16px 20px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10 }}>
              <p style={{ fontSize:13, lineHeight:1.6, color:"rgba(255,255,255,0.4)", margin:0 }}>{page.terms}</p>
            </div>
          )}

          <div style={{ marginTop:28 }}>
            <button type="submit" className="oi-submit" disabled={submitting}>{submitting?"Submitting...":"Confirm Participation"}</button>
          </div>
        </form>

        <div style={{ textAlign:"center", marginTop:32, fontSize:13, color:"rgba(255,255,255,0.2)" }}>
          Powered by <a href="/homepage" style={{ color:"rgba(255,255,255,0.35)", textDecoration:"none", fontWeight:700 }}>Postgame</a>
        </div>
      </div>
    </div>
  );
}
