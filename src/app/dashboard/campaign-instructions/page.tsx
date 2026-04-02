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
  body:{display:"grid",gridTemplateColumns:"280px 1fr",height:"calc(100vh - 53px)"} as const,
  sidebar:{background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column" as const,overflow:"hidden"},
  panelHead:{padding:"16px 16px 10px",borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:800,textTransform:"uppercase" as const,letterSpacing:"0.12em",color:C.text3},
  panelBody:{flex:1,overflowY:"auto" as const,padding:10},
  editor:{display:"flex",flexDirection:"column" as const,overflow:"hidden"},
  editorBody:{flex:1,overflowY:"auto" as const,padding:24},
  card:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:12},
  cardTitle:{fontSize:11,fontWeight:800,textTransform:"uppercase" as const,letterSpacing:"0.1em",color:C.text3,marginBottom:14},
  label:{display:"block",fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5},
  input:{width:"100%",padding:"9px 12px",background:"#1a1a1a",border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box" as const},
  textarea:{width:"100%",padding:"9px 12px",background:"#1a1a1a",border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",minHeight:80,resize:"vertical" as const,boxSizing:"border-box" as const},
  btnOrange:{padding:"9px 20px",background:C.orange,border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",textTransform:"uppercase" as const,letterSpacing:"0.06em"},
  btnGhost:{padding:"8px 16px",border:`1px solid ${C.border2}`,borderRadius:8,background:"none",color:C.text2,fontSize:12,fontWeight:700,cursor:"pointer",textDecoration:"none" as const},
  btnAdd:{padding:"7px 14px",borderRadius:8,border:`1px dashed ${C.border2}`,background:"none",color:C.text3,fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",marginTop:8},
  btnDanger:{padding:"5px 10px",borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"none",color:"#ff6b6b",fontSize:11,fontWeight:700,cursor:"pointer"},
  listItem:(active:boolean)=>({padding:"10px 12px",borderRadius:8,cursor:"pointer",background:active?"rgba(215,63,9,0.1)":"transparent",border:`1px solid ${active?"rgba(215,63,9,0.25)":"transparent"}`,marginBottom:4}),
  tabs:{display:"flex",gap:4,marginBottom:20},
  tab:(on:boolean)=>({padding:"8px 18px",borderRadius:20,border:"none",background:on?"#D73F09":"#1a1a1a",color:on?"#fff":C.text2,fontSize:13,fontWeight:700,cursor:"pointer"}),
  toast:{position:"fixed" as const,bottom:24,right:24,background:C.surface2,border:`1px solid ${C.orange}`,borderRadius:10,padding:"10px 20px",color:C.orange,fontSize:13,fontWeight:700,zIndex:99999},
  row2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12} as const,
  mb:(n:number)=>({marginBottom:n}),
  listBullet:{background:"#1a1a1a",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:8} as const,
};

interface Deliverable { text: string; required: boolean }
interface DosAndDonts { dos: string[]; donts: string[] }

interface InstructionSection {
  intro: string;
  deliverables: Deliverable[];
  timeline: string;
  dos_donts: DosAndDonts;
  hashtags: string;
  talking_points: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

interface CampaignInstruction {
  id: string;
  title: string;
  slug: string;
  brand_id?: string;
  brand_name: string;
  brand_logo?: string;
  brand_color: string;
  campaign_date: string;
  hero_image?: string;
  hero_video?: string;
  athlete_section: InstructionSection;
  crew_section: InstructionSection;
  created_at: string;
}

const emptySection = (): InstructionSection => ({
  intro: "",
  deliverables: [],
  timeline: "",
  dos_donts: { dos: [], donts: [] },
  hashtags: "",
  talking_points: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
});

function SectionEditor({ section, onChange, label }: {
  section: InstructionSection;
  onChange: (s: InstructionSection) => void;
  label: string;
}) {
  const upd = (k: keyof InstructionSection, v: unknown) => onChange({ ...section, [k]: v });
  const updDel = (i: number, k: keyof Deliverable, v: unknown) =>
    upd("deliverables", section.deliverables.map((d,j) => j===i ? {...d,[k]:v} : d));
  const addDel = () => upd("deliverables", [...section.deliverables, { text:"", required:true }]);
  const rmDel = (i:number) => upd("deliverables", section.deliverables.filter((_,j) => j!==i));
  const addDo = () => upd("dos_donts", { ...section.dos_donts, dos: [...section.dos_donts.dos,""] });
  const addDont = () => upd("dos_donts", { ...section.dos_donts, donts: [...section.dos_donts.donts,""] });
  const updDo = (i:number,v:string) => upd("dos_donts", { ...section.dos_donts, dos: section.dos_donts.dos.map((d,j)=>j===i?v:d) });
  const updDont = (i:number,v:string) => upd("dos_donts", { ...section.dos_donts, donts: section.dos_donts.donts.map((d,j)=>j===i?v:d) });
  const rmDo = (i:number) => upd("dos_donts", { ...section.dos_donts, dos: section.dos_donts.dos.filter((_,j)=>j!==i) });
  const rmDont = (i:number) => upd("dos_donts", { ...section.dos_donts, donts: section.dos_donts.donts.filter((_,j)=>j!==i) });

  return (
    <div>
      {/* Intro */}
      <div style={S.card}>
        <div style={S.cardTitle}>{label} Intro</div>
        <textarea style={S.textarea} value={section.intro} onChange={e=>upd("intro",e.target.value)} placeholder={`Opening message for ${label.toLowerCase()}...`} />
      </div>

      {/* Deliverables */}
      <div style={S.card}>
        <div style={S.cardTitle}>Deliverables</div>
        {section.deliverables.map((d,i) => (
          <div key={i} style={S.listBullet}>
            <input style={{ ...S.input, flex:1 }} value={d.text} onChange={e=>updDel(i,"text",e.target.value)} placeholder="e.g. 1x Instagram Reel, 30-60 seconds" />
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.text3, whiteSpace:"nowrap" as const }}>
              <input type="checkbox" checked={d.required} onChange={e=>updDel(i,"required",e.target.checked)} />
              Required
            </label>
            <button style={S.btnDanger} onClick={()=>rmDel(i)}>✕</button>
          </div>
        ))}
        <button style={S.btnAdd} onClick={addDel}>+ Add Deliverable</button>
      </div>

      {/* Timeline */}
      <div style={S.card}>
        <div style={S.cardTitle}>Timeline & Deadlines</div>
        <textarea style={{ ...S.textarea, minHeight:60 }} value={section.timeline} onChange={e=>upd("timeline",e.target.value)} placeholder="Post by: Jan 15th&#10;Submit draft for review by: Jan 10th" />
      </div>

      {/* Dos and Donts */}
      <div style={S.card}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <div>
            <div style={{ ...S.cardTitle, color:"#4ade80" }}>✅ DO</div>
            {section.dos_donts.dos.map((d,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                <input style={{ ...S.input, flex:1 }} value={d} onChange={e=>updDo(i,e.target.value)} placeholder="Do this..." />
                <button style={S.btnDanger} onClick={()=>rmDo(i)}>✕</button>
              </div>
            ))}
            <button style={S.btnAdd} onClick={addDo}>+ Add</button>
          </div>
          <div>
            <div style={{ ...S.cardTitle, color:"#f87171" }}>❌ DON'T</div>
            {section.dos_donts.donts.map((d,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                <input style={{ ...S.input, flex:1 }} value={d} onChange={e=>updDont(i,e.target.value)} placeholder="Don't do this..." />
                <button style={S.btnDanger} onClick={()=>rmDont(i)}>✕</button>
              </div>
            ))}
            <button style={S.btnAdd} onClick={addDont}>+ Add</button>
          </div>
        </div>
      </div>

      {/* Hashtags & talking points */}
      <div style={S.card}>
        <div style={S.cardTitle}>Hashtags & Talking Points</div>
        <div style={S.mb(12)}>
          <label style={S.label}>Hashtags</label>
          <input style={S.input} value={section.hashtags} onChange={e=>upd("hashtags",e.target.value)} placeholder="#Postgame #NIL #CampaignName" />
        </div>
        <div>
          <label style={S.label}>Talking Points / Key Messages</label>
          <textarea style={S.textarea} value={section.talking_points} onChange={e=>upd("talking_points",e.target.value)} placeholder="Key messages to include in content..." />
        </div>
      </div>

      {/* Contact */}
      <div style={S.card}>
        <div style={S.cardTitle}>Point of Contact</div>
        <div style={S.row2}>
          <div><label style={S.label}>Name</label><input style={S.input} value={section.contact_name} onChange={e=>upd("contact_name",e.target.value)} placeholder="Campaign Manager" /></div>
          <div><label style={S.label}>Email</label><input style={S.input} value={section.contact_email} onChange={e=>upd("contact_email",e.target.value)} placeholder="team@postgame.co" /></div>
        </div>
        <div><label style={S.label}>Phone</label><input style={S.input} value={section.contact_phone} onChange={e=>upd("contact_phone",e.target.value)} placeholder="+1 (555) 000-0000" /></div>
      </div>
    </div>
  );
}

export default function CampaignInstructionsPage() {
  const supabase = createBrowserSupabase();
  const [instructions, setInstructions] = useState<CampaignInstruction[]>([]);
  const [active, setActive] = useState<CampaignInstruction | null>(null);
  const [brands, setBrands] = useState<{id:string;name:string;logo_url:string;primary_color:string}[]>([]);
  const [activeTab, setActiveTab] = useState<"athlete"|"crew">("athlete");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    load();
    supabase.from("brands").select("id,name,logo_url,primary_color").eq("archived",false).order("name").then(({data})=>setBrands((data||[]) as any));
  }, []);

  async function load() {
    const { data } = await supabase.from("campaign_instructions").select("*").order("created_at",{ascending:false});
    setInstructions((data||[]) as CampaignInstruction[]);
    if (data && data.length > 0 && !active) setActive(data[0] as CampaignInstruction);
  }

  async function create() {
    const slug = `campaign-${Date.now()}`;
    const { data } = await supabase.from("campaign_instructions").insert({
      title:"New Campaign Instructions",
      slug,
      brand_name:"",
      brand_color:"#D73F09",
      campaign_date:"",
      athlete_section: emptySection(),
      crew_section: emptySection(),
    }).select().single();
    if (data) { setInstructions(p => [data as CampaignInstruction,...p]); setActive(data as CampaignInstruction); }
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    await supabase.from("campaign_instructions").update({
      title: active.title, slug: active.slug, brand_id: active.brand_id,
      brand_name: active.brand_name, brand_logo: active.brand_logo,
      brand_color: active.brand_color, campaign_date: active.campaign_date,
      hero_image: active.hero_image, hero_video: active.hero_video,
      athlete_section: active.athlete_section, crew_section: active.crew_section,
    }).eq("id", active.id);
    setSaving(false);
    setToast("Saved ✓"); setTimeout(()=>setToast(""),2000);
  }

  async function del(id:string) {
    if (!confirm("Delete?")) return;
    await supabase.from("campaign_instructions").delete().eq("id",id);
    setInstructions(p=>p.filter(x=>x.id!==id));
    setActive(instructions.find(x=>x.id!==id)||null);
  }

  const upd = (k: keyof CampaignInstruction, v: unknown) => setActive(p=>p?{...p,[k]:v}:null);
  const publicUrl = active ? `${typeof window!=="undefined"?window.location.origin:""}/campaign-instructions/${active.slug}` : "";

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <Link href="/dashboard" style={{ fontSize:12, color:C.text3, textDecoration:"none", fontWeight:700 }}>← Dashboard</Link>
          <span style={{ color:C.border2 }}>|</span>
          <span style={{ fontSize:15, fontWeight:900 }}>Campaign Instructions</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {active && <button style={S.btnOrange} onClick={save} disabled={saving}>{saving?"Saving...":"Save"}</button>}
          <button style={S.btnOrange} onClick={create}>+ New</button>
        </div>
      </div>

      <div style={S.body}>
        {/* List */}
        <div style={S.sidebar}>
          <div style={S.panelHead}>Instructions ({instructions.length})</div>
          <div style={S.panelBody}>
            {instructions.map(n => (
              <div key={n.id} style={S.listItem(active?.id===n.id)} onClick={()=>setActive(n)}>
                <div style={{ fontSize:13, fontWeight:700, color: active?.id===n.id?C.orange:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{n.title}</div>
                <div style={{ fontSize:11, color:C.text3 }}>{n.brand_name||"No brand"} · {n.campaign_date||"No date"}</div>
              </div>
            ))}
            {instructions.length===0 && <div style={{ padding:20, color:C.text3, fontSize:13, textAlign:"center" }}>No instructions yet</div>}
          </div>
        </div>

        {/* Editor */}
        <div style={S.editor}>
          {!active ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:14 }}>Select or create campaign instructions</div>
          ) : (
            <>
              <div style={{ padding:"14px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:12, alignItems:"center" }}>
                <input
                  style={{ ...S.input, flex:1, fontSize:15, fontWeight:800, background:"transparent", border:"none", padding:0, outline:"none" }}
                  value={active.title}
                  onChange={e=>upd("title",e.target.value)}
                />
                <a href={publicUrl} target="_blank" style={{ ...S.btnGhost, fontSize:11 }}>↗ Preview</a>
                <button style={{ ...S.btnDanger, fontSize:11 }} onClick={()=>del(active.id)}>Delete</button>
              </div>

              {/* Public link */}
              <div style={{ padding:"10px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, background:"rgba(215,63,9,0.06)" }}>
                <span style={{ fontSize:11, color:C.text3, fontWeight:700 }}>SHARE LINK:</span>
                <span style={{ fontSize:12, color:C.orange, fontFamily:"monospace", flex:1, overflow:"hidden", textOverflow:"ellipsis" }}>{publicUrl}</span>
                <button style={S.btnGhost} onClick={()=>{navigator.clipboard.writeText(publicUrl);setToast("Link copied ✓");setTimeout(()=>setToast(""),2000);}}>Copy</button>
              </div>

              <div style={S.editorBody}>
                {/* Meta */}
                <div style={S.card}>
                  <div style={S.cardTitle}>Campaign Info</div>
                  <div style={S.row2}>
                    <div><label style={S.label}>Campaign Date</label><input style={S.input} type="date" value={active.campaign_date||""} onChange={e=>upd("campaign_date",e.target.value)} /></div>
                    <div><label style={S.label}>URL Slug</label><input style={S.input} value={active.slug} onChange={e=>upd("slug",e.target.value.toLowerCase().replace(/\s+/g,"-"))} /></div>
                    <div>
                      <label style={S.label}>Brand</label>
                      <select style={S.input} value={active.brand_id||""} onChange={e=>{
                        const b = brands.find(br=>br.id===e.target.value);
                        if (b) { upd("brand_id",b.id); upd("brand_name",b.name); upd("brand_logo",b.logo_url||""); upd("brand_color",b.primary_color||C.orange); }
                      }}>
                        <option value="">Select brand...</option>
                        {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div><label style={S.label}>Brand Color</label><input style={S.input} type="color" value={active.brand_color||C.orange} onChange={e=>upd("brand_color",e.target.value)} /></div>
                  </div>
                  <div style={S.row2}>
                    <div><label style={S.label}>Hero Image URL</label><input style={S.input} value={active.hero_image||""} onChange={e=>upd("hero_image",e.target.value)} placeholder="https://..." /></div>
                    <div><label style={S.label}>Hero Video URL</label><input style={S.input} value={active.hero_video||""} onChange={e=>upd("hero_video",e.target.value)} placeholder="https://..." /></div>
                  </div>
                </div>

                {/* Section tabs */}
                <div style={S.tabs}>
                  <button style={S.tab(activeTab==="athlete")} onClick={()=>setActiveTab("athlete")}>🏃 Athletes</button>
                  <button style={S.tab(activeTab==="crew")} onClick={()=>setActiveTab("crew")}>🎥 Crew</button>
                </div>

                {activeTab==="athlete" && (
                  <SectionEditor section={active.athlete_section} onChange={s=>upd("athlete_section",s)} label="Athlete" />
                )}
                {activeTab==="crew" && (
                  <SectionEditor section={active.crew_section} onChange={s=>upd("crew_section",s)} label="Crew" />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
