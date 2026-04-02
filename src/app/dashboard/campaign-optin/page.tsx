"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

const C = {
  bg:"#000",surface:"#0f0f0f",surface2:"#161616",
  border:"rgba(255,255,255,0.08)",border2:"rgba(255,255,255,0.13)",
  orange:"#D73F09",text:"#fff",text2:"rgba(255,255,255,0.6)",text3:"rgba(255,255,255,0.35)",
};
const S = {
  page:{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Arial,sans-serif"} as const,
  header:{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"} as const,
  body:{display:"grid",gridTemplateColumns:"280px 1fr 360px",height:"calc(100vh - 53px)"} as const,
  sidebar:{background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column" as const,overflow:"hidden"},
  panelHead:{padding:"16px 16px 10px",borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:800,textTransform:"uppercase" as const,letterSpacing:"0.12em",color:C.text3},
  panelBody:{flex:1,overflowY:"auto" as const,padding:10},
  editor:{display:"flex",flexDirection:"column" as const,overflow:"hidden"},
  editorBody:{flex:1,overflowY:"auto" as const,padding:24},
  submissions:{background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column" as const,overflow:"hidden"},
  card:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:12},
  cardTitle:{fontSize:11,fontWeight:800,textTransform:"uppercase" as const,letterSpacing:"0.1em",color:C.text3,marginBottom:14},
  label:{display:"block",fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5},
  input:{width:"100%",padding:"9px 12px",background:"#1a1a1a",border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box" as const},
  textarea:{width:"100%",padding:"9px 12px",background:"#1a1a1a",border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",minHeight:80,resize:"vertical" as const,boxSizing:"border-box" as const},
  btnOrange:{padding:"9px 20px",background:C.orange,border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",textTransform:"uppercase" as const,letterSpacing:"0.06em"},
  btnGhost:{padding:"8px 16px",border:`1px solid ${C.border2}`,borderRadius:8,background:"none",color:C.text2,fontSize:12,fontWeight:700,cursor:"pointer",textDecoration:"none" as const},
  btnDanger:{padding:"5px 10px",borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"none",color:"#ff6b6b",fontSize:11,fontWeight:700,cursor:"pointer"},
  listItem:(active:boolean)=>({padding:"10px 12px",borderRadius:8,cursor:"pointer",background:active?"rgba(215,63,9,0.1)":"transparent",border:`1px solid ${active?"rgba(215,63,9,0.25)":"transparent"}`,marginBottom:4}),
  toast:{position:"fixed" as const,bottom:24,right:24,background:C.surface2,border:`1px solid ${C.orange}`,borderRadius:10,padding:"10px 20px",color:C.orange,fontSize:13,fontWeight:700,zIndex:99999},
  row2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12} as const,
  mb:(n:number)=>({marginBottom:n}),
  subCard:{background:"#111",border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8},
  checkRow:{display:"flex",alignItems:"center",gap:8,marginBottom:8} as const,
};

interface OptInField { id: string; label: string; type: "text"|"select"|"textarea"|"checkbox"; required: boolean; options?: string }
interface OptInPage {
  id: string;
  title: string;
  slug: string;
  brand_id?: string;
  brand_name: string;
  brand_logo?: string;
  brand_color: string;
  hero_image?: string;
  campaign_description: string;
  compensation_info: string;
  deadline: string;
  terms: string;
  fields: OptInField[];
  success_message: string;
  created_at: string;
}

interface Submission {
  id: string;
  optin_id: string;
  data: Record<string,string>;
  created_at: string;
}

const DEFAULT_FIELDS: OptInField[] = [
  { id:"f1", label:"Full Name", type:"text", required:true },
  { id:"f2", label:"School", type:"text", required:true },
  { id:"f3", label:"Sport", type:"text", required:true },
  { id:"f4", label:"Year (Fr/So/Jr/Sr)", type:"select", required:true, options:"Freshman,Sophomore,Junior,Senior" },
  { id:"f5", label:"Instagram Handle", type:"text", required:true },
  { id:"f6", label:"TikTok Handle", type:"text", required:false },
  { id:"f7", label:"Email Address", type:"text", required:true },
  { id:"f8", label:"Phone Number", type:"text", required:false },
  { id:"f9", label:"I agree to the campaign terms and conditions", type:"checkbox", required:true },
];

export default function CampaignOptInPage() {
  const supabase = createBrowserSupabase();
  const [pages, setPages] = useState<OptInPage[]>([]);
  const [active, setActive] = useState<OptInPage | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [brands, setBrands] = useState<{id:string;name:string;logo_url:string;primary_color:string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [showSubs, setShowSubs] = useState(true);

  useEffect(() => {
    load();
    supabase.from("brands").select("id,name,logo_url,primary_color").eq("archived",false).order("name").then(({data})=>setBrands((data||[]) as any));
  }, []);

  async function load() {
    const { data } = await supabase.from("campaign_optins").select("*").order("created_at",{ascending:false});
    setPages((data||[]) as OptInPage[]);
    if (data && data.length > 0 && !active) {
      setActive(data[0] as OptInPage);
      loadSubs(data[0].id);
    }
  }

  async function loadSubs(id: string) {
    const { data } = await supabase.from("campaign_optin_submissions").select("*").eq("optin_id",id).order("created_at",{ascending:false});
    setSubmissions((data||[]) as Submission[]);
  }

  async function create() {
    const slug = `optin-${Date.now()}`;
    const { data } = await supabase.from("campaign_optins").insert({
      title:"New Opt-In Page",
      slug,
      brand_name:"",
      brand_color:"#D73F09",
      campaign_description:"",
      compensation_info:"",
      deadline:"",
      terms:"By confirming, you agree to participate in this campaign and grant Postgame the right to use your likeness in campaign materials.",
      fields: DEFAULT_FIELDS,
      success_message:"You're in! We'll be in touch with next steps shortly.",
    }).select().single();
    if (data) {
      setPages(p=>[data as OptInPage,...p]);
      setActive(data as OptInPage);
      setSubmissions([]);
    }
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    await supabase.from("campaign_optins").update({
      title:active.title, slug:active.slug, brand_id:active.brand_id,
      brand_name:active.brand_name, brand_logo:active.brand_logo,
      brand_color:active.brand_color, hero_image:active.hero_image,
      campaign_description:active.campaign_description,
      compensation_info:active.compensation_info,
      deadline:active.deadline, terms:active.terms,
      fields:active.fields, success_message:active.success_message,
    }).eq("id",active.id);
    setSaving(false);
    setToast("Saved ✓"); setTimeout(()=>setToast(""),2000);
  }

  async function del(id:string) {
    if (!confirm("Delete this opt-in page?")) return;
    await supabase.from("campaign_optins").delete().eq("id",id);
    setPages(p=>p.filter(x=>x.id!==id));
    setActive(pages.find(x=>x.id!==id)||null);
  }

  async function exportCSV() {
    if (!submissions.length) return;
    const fields = active?.fields || DEFAULT_FIELDS;
    const headers = ["Submitted At", ...fields.map(f=>f.label)];
    const rows = submissions.map(s => [
      new Date(s.created_at).toLocaleString(),
      ...fields.map(f => s.data[f.id] || "")
    ]);
    const csv = [headers, ...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`${active?.slug||"optin"}-submissions.csv`; a.click();
  }

  const upd = (k: keyof OptInPage, v: unknown) => setActive(p=>p?{...p,[k]:v}:null);
  const updField = (i:number, k:keyof OptInField, v:unknown) => {
    if (!active) return;
    upd("fields", active.fields.map((f,j)=>j===i?{...f,[k]:v}:f));
  };
  const addField = () => {
    if (!active) return;
    const id = `f${Date.now()}`;
    upd("fields", [...active.fields, { id, label:"New Field", type:"text" as const, required:false }]);
  };
  const rmField = (i:number) => {
    if (!active) return;
    upd("fields", active.fields.filter((_,j)=>j!==i));
  };
  const moveField = (i:number, dir:-1|1) => {
    if (!active) return;
    const fs = [...active.fields]; const j=i+dir;
    if(j<0||j>=fs.length) return;
    [fs[i],fs[j]]=[fs[j],fs[i]]; upd("fields",fs);
  };

  const publicUrl = active ? `${typeof window!=="undefined"?window.location.origin:""}/campaign-optin/${active.slug}` : "";

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <Link href="/dashboard" style={{ fontSize:12, color:C.text3, textDecoration:"none", fontWeight:700 }}>← Dashboard</Link>
          <span style={{ color:C.border2 }}>|</span>
          <span style={{ fontSize:15, fontWeight:900 }}>Campaign Opt-In</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {active && <button style={S.btnOrange} onClick={save} disabled={saving}>{saving?"Saving...":"Save"}</button>}
          <button style={S.btnOrange} onClick={create}>+ New</button>
        </div>
      </div>

      <div style={S.body}>
        {/* List */}
        <div style={S.sidebar}>
          <div style={S.panelHead}>Opt-In Pages ({pages.length})</div>
          <div style={S.panelBody}>
            {pages.map(p => (
              <div key={p.id} style={S.listItem(active?.id===p.id)} onClick={()=>{setActive(p);loadSubs(p.id);}}>
                <div style={{ fontSize:13, fontWeight:700, color: active?.id===p.id?C.orange:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.title}</div>
                <div style={{ fontSize:11, color:C.text3 }}>{p.brand_name||"No brand"}</div>
                <div style={{ fontSize:10, color:C.text3, marginTop:2 }}>{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            ))}
            {pages.length===0 && <div style={{ padding:20, color:C.text3, fontSize:13, textAlign:"center" }}>No opt-in pages yet</div>}
          </div>
        </div>

        {/* Editor */}
        <div style={S.editor}>
          {!active ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:14 }}>Select or create an opt-in page</div>
          ) : (
            <>
              <div style={{ padding:"14px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:12, alignItems:"center" }}>
                <input
                  style={{ ...S.input, flex:1, fontSize:15, fontWeight:800, background:"transparent", border:"none", padding:0, outline:"none" }}
                  value={active.title} onChange={e=>upd("title",e.target.value)}
                />
                <a href={publicUrl} target="_blank" style={{ ...S.btnGhost, fontSize:11 }}>↗ Preview</a>
                <button style={{ ...S.btnGhost, fontSize:11 }} onClick={()=>{navigator.clipboard.writeText(publicUrl);setToast("Link copied ✓");setTimeout(()=>setToast(""),2000);}}>Copy Link</button>
                <button style={{ ...S.btnDanger, fontSize:11 }} onClick={()=>del(active.id)}>Delete</button>
              </div>

              <div style={{ padding:"10px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, background:"rgba(215,63,9,0.06)" }}>
                <span style={{ fontSize:11, color:C.text3, fontWeight:700 }}>ATHLETE LINK:</span>
                <span style={{ fontSize:12, color:C.orange, fontFamily:"monospace", flex:1, overflow:"hidden", textOverflow:"ellipsis" }}>{publicUrl}</span>
              </div>

              <div style={S.editorBody}>
                {/* Settings */}
                <div style={S.card}>
                  <div style={S.cardTitle}>Page Settings</div>
                  <div style={S.row2}>
                    <div>
                      <label style={S.label}>Brand</label>
                      <select style={S.input} value={active.brand_id||""} onChange={e=>{
                        const b=brands.find(br=>br.id===e.target.value);
                        if(b){upd("brand_id",b.id);upd("brand_name",b.name);upd("brand_logo",b.logo_url||"");upd("brand_color",b.primary_color||C.orange);}
                      }}>
                        <option value="">Select brand...</option>
                        {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div><label style={S.label}>URL Slug</label><input style={S.input} value={active.slug} onChange={e=>upd("slug",e.target.value.toLowerCase().replace(/\s+/g,"-"))} /></div>
                    <div><label style={S.label}>Brand Color</label><input style={S.input} type="color" value={active.brand_color} onChange={e=>upd("brand_color",e.target.value)} /></div>
                    <div><label style={S.label}>Deadline</label><input style={S.input} type="date" value={active.deadline||""} onChange={e=>upd("deadline",e.target.value)} /></div>
                  </div>
                  <div style={S.mb(12)}><label style={S.label}>Hero Image URL</label><input style={S.input} value={active.hero_image||""} onChange={e=>upd("hero_image",e.target.value)} placeholder="https://..." /></div>
                  <div style={S.mb(12)}><label style={S.label}>Campaign Description</label><textarea style={S.textarea} value={active.campaign_description} onChange={e=>upd("campaign_description",e.target.value)} placeholder="Tell athletes what this campaign is about..." /></div>
                  <div style={S.mb(12)}><label style={S.label}>Compensation / Rate Info</label><input style={S.input} value={active.compensation_info} onChange={e=>upd("compensation_info",e.target.value)} placeholder="e.g. $500 flat rate, product gifting, etc." /></div>
                  <div style={S.mb(12)}><label style={S.label}>Terms & Conditions</label><textarea style={S.textarea} value={active.terms} onChange={e=>upd("terms",e.target.value)} /></div>
                  <div><label style={S.label}>Success Message (shown after submit)</label><textarea style={{ ...S.textarea, minHeight:60 }} value={active.success_message} onChange={e=>upd("success_message",e.target.value)} /></div>
                </div>

                {/* Form fields */}
                <div style={S.card}>
                  <div style={S.cardTitle}>Form Fields</div>
                  {active.fields.map((f,i) => (
                    <div key={f.id} style={{ background:"#111", border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:8 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
                        <div style={{ flex:1 }}>
                          <input style={{ ...S.input, marginBottom:8 }} value={f.label} onChange={e=>updField(i,"label",e.target.value)} placeholder="Field label" />
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                            <select style={S.input} value={f.type} onChange={e=>updField(i,"type",e.target.value)}>
                              <option value="text">Text</option>
                              <option value="select">Dropdown</option>
                              <option value="textarea">Long Text</option>
                              <option value="checkbox">Checkbox</option>
                            </select>
                            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.text2, cursor:"pointer" }}>
                              <input type="checkbox" checked={f.required} onChange={e=>updField(i,"required",e.target.checked)} />
                              Required
                            </label>
                          </div>
                          {f.type==="select" && (
                            <div style={{ marginTop:8 }}>
                              <label style={S.label}>Options (comma separated)</label>
                              <input style={S.input} value={f.options||""} onChange={e=>updField(i,"options",e.target.value)} placeholder="Option 1,Option 2,Option 3" />
                            </div>
                          )}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column" as const, gap:4 }}>
                          <button style={S.btnGhost} onClick={()=>moveField(i,-1)} disabled={i===0}>↑</button>
                          <button style={S.btnGhost} onClick={()=>moveField(i,1)} disabled={i===active.fields.length-1}>↓</button>
                          <button style={S.btnDanger} onClick={()=>rmField(i)}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button style={S.btnGhost} onClick={addField} style2={{ marginTop:8, width:"100%" }}>+ Add Field</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Submissions panel */}
        <div style={S.submissions}>
          <div style={{ ...S.panelHead, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Submissions ({submissions.length})</span>
            {submissions.length > 0 && <button style={{ ...S.btnGhost, fontSize:10, padding:"4px 10px" }} onClick={exportCSV}>Export CSV</button>}
          </div>
          <div style={S.panelBody}>
            {submissions.length === 0 && (
              <div style={{ padding:20, color:C.text3, fontSize:13, textAlign:"center" }}>
                No submissions yet.<br/>Share the link with athletes to collect opt-ins.
              </div>
            )}
            {submissions.map(sub => {
              const fields = active?.fields || DEFAULT_FIELDS;
              const nameField = fields.find(f=>f.label.toLowerCase().includes("name"));
              const schoolField = fields.find(f=>f.label.toLowerCase().includes("school"));
              const name = nameField ? sub.data[nameField.id] : "—";
              const school = schoolField ? sub.data[schoolField.id] : "";
              return (
                <div key={sub.id} style={S.subCard}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:2 }}>{name}</div>
                  {school && <div style={{ fontSize:11, color:C.text3, marginBottom:6 }}>{school}</div>}
                  <div style={{ fontSize:10, color:C.text3 }}>{new Date(sub.created_at).toLocaleString()}</div>
                  <details style={{ marginTop:8 }}>
                    <summary style={{ fontSize:11, color:C.orange, cursor:"pointer", fontWeight:700 }}>View all fields</summary>
                    <div style={{ marginTop:8 }}>
                      {fields.map(f => sub.data[f.id] && (
                        <div key={f.id} style={{ marginBottom:4 }}>
                          <span style={{ fontSize:10, color:C.text3, textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>{f.label}: </span>
                          <span style={{ fontSize:12, color:C.text2 }}>{sub.data[f.id]}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
