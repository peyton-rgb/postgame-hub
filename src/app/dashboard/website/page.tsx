"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import CampaignMediaPicker from "@/components/CampaignMediaPicker";
import DealList from "@/components/DealList";
import PressList from "@/components/PressList";
import CaseStudyList from "@/components/CaseStudyList";
import Link from "next/link";

// ── Design tokens ────────────────────────────────────────────
const C = {
  bg:       "#000",
  surface:  "#0f0f0f",
  surface2: "#161616",
  border:   "rgba(255,255,255,0.08)",
  border2:  "rgba(255,255,255,0.13)",
  orange:   "#D73F09",
  text:     "#fff",
  text2:    "rgba(255,255,255,0.6)",
  text3:    "rgba(255,255,255,0.35)",
};

const S = {
  // Layout
  shell: { display:"flex", height:"100vh", background:C.bg, color:C.text, fontFamily:"Arial,sans-serif", overflow:"hidden" } as const,
  sidebar: { width:220, flexShrink:0, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" as const, overflow:"hidden" },
  main: { flex:1, display:"flex", overflow:"hidden" } as const,
  editPane: { width:400, flexShrink:0, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" as const, overflow:"hidden" },
  previewPane: { flex:1, background:"#0a0a0a", position:"relative" as const, overflow:"hidden" },

  // Sidebar
  sidebarHeader: { padding:"20px 16px 12px", borderBottom:`1px solid ${C.border}` },
  sidebarLogo: { fontSize:16, fontWeight:900, color:C.orange, letterSpacing:"0.04em" },
  sidebarSub: { fontSize:11, color:C.text3, marginTop:3, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.1em" },
  sidebarSection: { fontSize:10, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"0.15em", color:C.text3, padding:"16px 16px 6px" },
  sidebarItem: (active: boolean) => ({
    display:"flex", alignItems:"center", gap:10, padding:"9px 16px",
    cursor:"pointer", borderRadius:8, margin:"1px 8px",
    background: active ? "rgba(215,63,9,0.15)" : "transparent",
    color: active ? C.orange : C.text2,
    fontSize:13, fontWeight: active ? 700 : 600,
    border: active ? `1px solid rgba(215,63,9,0.25)` : "1px solid transparent",
    transition:"all 0.12s",
  }),
  sidebarFooter: { marginTop:"auto", padding:16, borderTop:`1px solid ${C.border}` },
  sidebarLink: { fontSize:12, color:C.text3, textDecoration:"none", display:"block", padding:"6px 0" },

  // Edit pane header
  editHeader: { padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 } as const,
  editTitle: { fontSize:15, fontWeight:800, margin:0 },
  editMeta: { fontSize:11, color:C.text3, marginTop:2 },

  // Fields
  editScroll: { flex:1, overflowY:"auto" as const, padding:"16px 20px" },
  card: { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:12 },
  cardTitle: { fontSize:12, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:C.text3, marginBottom:14 },
  label: { display:"block", fontSize:11, fontWeight:700, color:C.text3, textTransform:"uppercase" as const, letterSpacing:"0.08em", marginBottom:5 },
  input: { width:"100%", padding:"9px 12px", background:"#1a1a1a", border:`1px solid ${C.border2}`, borderRadius:8, color:C.text, fontSize:13, fontFamily:"Arial,sans-serif", outline:"none", boxSizing:"border-box" as const, transition:"border-color 0.15s" },
  textarea: { width:"100%", padding:"9px 12px", background:"#1a1a1a", border:`1px solid ${C.border2}`, borderRadius:8, color:C.text, fontSize:13, fontFamily:"Arial,sans-serif", outline:"none", minHeight:72, resize:"vertical" as const, boxSizing:"border-box" as const },
  mb: (n: number) => ({ marginBottom: n }),
  row2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 } as const,
  itemCard: { background:"#111", border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:8 } as const,
  btnAdd: { padding:"8px 14px", borderRadius:8, border:`1px dashed ${C.border2}`, background:"none", color:C.text3, fontSize:12, fontWeight:700, cursor:"pointer", width:"100%", marginTop:8 },
  btnSm: { padding:"5px 12px", borderRadius:6, border:`1px solid ${C.border2}`, background:"none", color:C.text2, fontSize:11, fontWeight:700, cursor:"pointer" },
  btnDanger: { padding:"5px 12px", borderRadius:6, border:"1px solid rgba(255,80,80,0.25)", background:"none", color:"#ff6b6b", fontSize:11, fontWeight:700, cursor:"pointer" },
  toggle: (on: boolean) => ({ width:36, height:20, borderRadius:10, background: on ? C.orange : "#333", border:"none", cursor:"pointer", position:"relative" as const, transition:"background 0.15s", padding:0, flexShrink:0 }),
  toggleDot: (on: boolean) => ({ width:14, height:14, borderRadius:"50%", background:"#fff", position:"absolute" as const, top:3, left: on ? 19 : 3, transition:"left 0.15s" }),

  // Actions bar
  actionsBar: { padding:"12px 20px", borderTop:`1px solid ${C.border}`, display:"flex", gap:10, alignItems:"center", flexShrink:0 } as const,
  btnSave: { padding:"9px 20px", background:C.orange, border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", textTransform:"uppercase" as const, letterSpacing:"0.06em", flex:1 },
  btnPreview: { padding:"9px 16px", border:`1px solid ${C.border2}`, borderRadius:8, background:"none", color:C.text2, fontSize:12, fontWeight:700, cursor:"pointer", textDecoration:"none", textTransform:"uppercase" as const, letterSpacing:"0.06em" },

  // Preview
  previewHeader: { position:"absolute" as const, top:0, left:0, right:0, height:40, background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", zIndex:10 },
  previewLabel: { fontSize:11, fontWeight:700, color:C.text3, textTransform:"uppercase" as const, letterSpacing:"0.1em" },
  previewFrame: { position:"absolute" as const, top:40, left:0, right:0, bottom:0, width:"100%", height:"calc(100% - 40px)", border:"none", background:"#000" },

  // Toast
  toast: { position:"fixed" as const, bottom:24, right:24, background:C.surface2, border:`1px solid ${C.orange}`, borderRadius:10, padding:"10px 20px", color:C.orange, fontSize:13, fontWeight:700, zIndex:99999 },
};

// ── Pages config ─────────────────────────────────────────────
const PAGES = [
  { key: "homepage",       label: "Homepage",        icon: "⌂",  url: "/homepage",              section: "Public Pages" },
  { key: "team",           label: "Team / About",    icon: "👥", url: "/about/team",             section: "Public Pages" },
  { key: "clients",        label: "Clients",         icon: "🏢", url: "/clients",                section: "Public Pages" },
  { key: "campaigns",      label: "Campaigns",       icon: "🎬", url: "/campaigns",              section: "Public Pages" },
  { key: "deals",          label: "Deal Tracker",    icon: "⭐", url: "/deals",                  section: "Public Pages" },
  { key: "press",          label: "Press",           icon: "📰", url: "/press",                  section: "Public Pages" },
  { key: "contact",        label: "Contact",         icon: "✉",  url: "/contact",                section: "Public Pages" },
  { key: "svc-elevated",   label: "Elevated",        icon: "⚡", url: "/services/elevated",      section: "Services" },
  { key: "svc-scaled",     label: "Scaled",          icon: "📈", url: "/services/scaled",        section: "Services" },
  { key: "svc-always-on",  label: "Always On",       icon: "🔄", url: "/services/always-on",     section: "Services" },
  { key: "svc-experiential",label: "Experiential",   icon: "🎯", url: "/services/experiential",  section: "Services" },
];

// ── Shared UI components ──────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button style={S.toggle(on)} onClick={() => onChange(!on)}>
      <div style={S.toggleDot(on)} />
    </button>
  );
}

function Field({ label, value, onChange, textarea, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  textarea?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <div style={S.mb(12)}>
      <label style={S.label}>{label}</label>
      {hint && <div style={{ fontSize:11, color:C.text3, marginBottom:5, lineHeight:1.4 }}>{hint}</div>}
      {textarea
        ? <textarea style={S.textarea} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={S.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  );
}

function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={S.card}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", marginBottom: open ? 14 : 0 }} onClick={() => setOpen(o => !o)}>
        <div style={S.cardTitle}>{title}</div>
        <span style={{ color:C.text3, fontSize:12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && children}
    </div>
  );
}

// ── Homepage editor ───────────────────────────────────────────
const HP_PAGE_ID = "1e2328e1-26d0-41c5-8876-8af003a22a6a";

interface StatItem { value: string; label: string }
interface CampaignItem { brand: string; name: string; meta: string; gradient: string; featured: boolean; image_url?: string; media_type?: "image"|"video"; campaign_id?: string; focal_point?: string }
interface AthleteItem { name: string; sport: string; school: string; image_url?: string; brand?: string }
interface BrandItem { name: string; logo_url: string; href?: string }
interface ServiceItem { name: string; desc: string; accent: boolean; num?: string }

function HomepageEditor({ onSaved }: { onSaved: () => void }) {
  const supabase = createBrowserSupabase();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [sections, setSections] = useState<Record<string, Record<string, unknown>>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ section: string; idx: number } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: page } = await supabase.from("pages").select("*, page_sections(*)").eq("id", HP_PAGE_ID).single();
      if (page) {
        setSettings(page.settings as Record<string, unknown> || {});
        const secs: Record<string, Record<string, unknown>> = {};
        for (const s of (page as any).page_sections || []) {
          secs[s.type] = { id: s.id, ...s.content };
        }
        setSections(secs);
      }
      setLoading(false);
    }
    load();
  }, []);

  const set = (key: string, val: unknown) => setSettings(p => ({ ...p, [key]: val }));
  const setCtaText = (key: string, text: string) => {
    const cur = settings[key] as Record<string, unknown> || {};
    set(key, { ...cur, text });
  };
  const setCtaUrl = (key: string, url: string) => {
    const cur = settings[key] as Record<string, unknown> || {};
    set(key, { ...cur, url });
  };
  const txt = (key: string) => {
    const v = settings[key];
    if (typeof v === "string") return v;
    if (typeof v === "object" && v && "text" in v) return String((v as any).text);
    return "";
  };
  const url = (key: string) => {
    const v = settings[key];
    if (typeof v === "object" && v && "url" in v) return String((v as any).url);
    return "";
  };

  const secArr = (type: string, key: string): Record<string, unknown>[] => {
    const s = sections[type];
    if (!s) return [];
    const v = s[key];
    return Array.isArray(v) ? v : [];
  };
  const setSec = (type: string, key: string, val: unknown) =>
    setSections(p => ({ ...p, [type]: { ...(p[type] || {}), [key]: val } }));

  const stats = (settings.stats as StatItem[] | undefined) || [];
  const campaigns = secArr("featured_campaigns", "campaigns");
  const athletes = secArr("featured_athletes", "athletes");
  const brands = secArr("brand_partners", "logos");
  const services = secArr("services_grid", "services");

  async function save() {
    setSaving(true);
    await supabase.from("pages").update({ settings }).eq("id", HP_PAGE_ID);
    for (const [type, content] of Object.entries(sections)) {
      const { id, ...rest } = content;
      if (id) await supabase.from("page_sections").update({ content: rest }).eq("id", id);
    }
    setSaving(false);
    onSaved();
  }

  if (loading) return <div style={{ padding:40, color:C.text3, fontSize:14 }}>Loading...</div>;

  return (
    <>
      <div style={S.editScroll}>

        {/* Hero */}
        <SectionCard title="Hero">
          <Field label="Eyebrow" value={txt("hero_eyebrow")} onChange={v => set("hero_eyebrow", v)} placeholder="#1 NIL Agency" />
          <Field label="Title" value={txt("hero_title")} onChange={v => set("hero_title", v)} textarea placeholder="We Build Brand Campaigns..." />
          <Field label="Description" value={txt("hero_desc")} onChange={v => set("hero_desc", v)} textarea />
          <div style={S.row2}>
            <Field label="CTA Primary Text" value={txt("hero_cta_primary")} onChange={v => setCtaText("hero_cta_primary", v)} placeholder="Start a Campaign" />
            <Field label="CTA Primary URL" value={url("hero_cta_primary")} onChange={v => setCtaUrl("hero_cta_primary", v)} placeholder="/contact" />
          </div>
          <div style={S.row2}>
            <Field label="CTA Secondary Text" value={txt("hero_cta_secondary")} onChange={v => setCtaText("hero_cta_secondary", v)} placeholder="View Our Work" />
            <Field label="CTA Secondary URL" value={url("hero_cta_secondary")} onChange={v => setCtaUrl("hero_cta_secondary", v)} placeholder="/campaigns" />
          </div>
        </SectionCard>

        {/* Stats */}
        <SectionCard title="Stats Bar">
          {stats.map((stat, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>Stat {i+1}</span>
                <button style={S.btnDanger} onClick={() => set("stats", stats.filter((_,j) => j !== i))}>Remove</button>
              </div>
              <div style={S.row2}>
                <Field label="Value" value={stat.value} onChange={v => set("stats", stats.map((s,j) => j===i ? {...s,value:v} : s))} placeholder="394+" />
                <Field label="Label" value={stat.label} onChange={v => set("stats", stats.map((s,j) => j===i ? {...s,label:v} : s))} placeholder="Campaigns Run" />
              </div>
            </div>
          ))}
          <button style={S.btnAdd} onClick={() => set("stats", [...stats, { value:"", label:"" }])}>+ Add Stat</button>
        </SectionCard>

        {/* Campaigns */}
        <SectionCard title="Campaign Highlights" defaultOpen={false}>
          {campaigns.map((c, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{String(c.brand||"Campaign "+(i+1))}</span>
                  <Toggle on={!!c.featured} onChange={v => setSec("featured_campaigns","campaigns",campaigns.map((x,j)=>j===i?{...x,featured:v}:x))} />
                  <span style={{ fontSize:10, color:C.text3 }}>Featured</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button style={S.btnSm} onClick={() => setPickerTarget({ section:"featured_campaigns", idx:i }) || setPickerOpen(true)}>Media</button>
                  <button style={S.btnDanger} onClick={() => setSec("featured_campaigns","campaigns",campaigns.filter((_,j)=>j!==i))}>✕</button>
                </div>
              </div>
              <div style={S.row2}>
                <Field label="Brand" value={String(c.brand||"")} onChange={v => setSec("featured_campaigns","campaigns",campaigns.map((x,j)=>j===i?{...x,brand:v}:x))} />
                <Field label="Campaign Name" value={String(c.name||"")} onChange={v => setSec("featured_campaigns","campaigns",campaigns.map((x,j)=>j===i?{...x,name:v}:x))} />
              </div>
              <Field label="Meta / Tagline" value={String(c.meta||"")} onChange={v => setSec("featured_campaigns","campaigns",campaigns.map((x,j)=>j===i?{...x,meta:v}:x))} />
              {c.image_url && <div style={{ fontSize:11, color:C.text3, marginTop:4 }}>Media: {String(c.image_url).split("/").pop()}</div>}
            </div>
          ))}
          <button style={S.btnAdd} onClick={() => setSec("featured_campaigns","campaigns",[...campaigns,{brand:"",name:"",meta:"",gradient:"rc-1",featured:false}])}>+ Add Campaign</button>
        </SectionCard>

        {/* Athletes */}
        <SectionCard title="Featured Athletes" defaultOpen={false}>
          {athletes.map((a, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{String(a.name||"Athlete "+(i+1))}</span>
                <button style={S.btnDanger} onClick={() => setSec("featured_athletes","athletes",athletes.filter((_,j)=>j!==i))}>✕</button>
              </div>
              <div style={S.row2}>
                <Field label="Name" value={String(a.name||"")} onChange={v => setSec("featured_athletes","athletes",athletes.map((x,j)=>j===i?{...x,name:v}:x))} />
                <Field label="Sport" value={String(a.sport||"")} onChange={v => setSec("featured_athletes","athletes",athletes.map((x,j)=>j===i?{...x,sport:v}:x))} />
              </div>
              <div style={S.row2}>
                <Field label="School" value={String(a.school||"")} onChange={v => setSec("featured_athletes","athletes",athletes.map((x,j)=>j===i?{...x,school:v}:x))} />
                <Field label="Photo URL" value={String(a.image_url||"")} onChange={v => setSec("featured_athletes","athletes",athletes.map((x,j)=>j===i?{...x,image_url:v}:x))} />
              </div>
            </div>
          ))}
          <button style={S.btnAdd} onClick={() => setSec("featured_athletes","athletes",[...athletes,{name:"",sport:"",school:""}])}>+ Add Athlete</button>
        </SectionCard>

        {/* Brand Partners */}
        <SectionCard title="Brand Partners" defaultOpen={false}>
          {brands.map((b, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{String(b.name||"Brand "+(i+1))}</span>
                <button style={S.btnDanger} onClick={() => setSec("brand_partners","logos",brands.filter((_,j)=>j!==i))}>✕</button>
              </div>
              <div style={S.row2}>
                <Field label="Brand Name" value={String(b.name||"")} onChange={v => setSec("brand_partners","logos",brands.map((x,j)=>j===i?{...x,name:v}:x))} />
                <Field label="Link URL" value={String(b.href||"")} onChange={v => setSec("brand_partners","logos",brands.map((x,j)=>j===i?{...x,href:v}:x))} />
              </div>
              <Field label="Logo URL" value={String(b.logo_url||"")} onChange={v => setSec("brand_partners","logos",brands.map((x,j)=>j===i?{...x,logo_url:v}:x))} />
            </div>
          ))}
          <button style={S.btnAdd} onClick={() => setSec("brand_partners","logos",[...brands,{name:"",logo_url:"",href:"#"}])}>+ Add Brand</button>
        </SectionCard>

        {/* Services */}
        <SectionCard title="Services Grid" defaultOpen={false}>
          {services.map((sv, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{String(sv.name||"Service "+(i+1))}</span>
                  <Toggle on={!!sv.accent} onChange={v => setSec("services_grid","services",services.map((x,j)=>j===i?{...x,accent:v}:x))} />
                  <span style={{ fontSize:10, color:C.text3 }}>Accent</span>
                </div>
                <button style={S.btnDanger} onClick={() => setSec("services_grid","services",services.filter((_,j)=>j!==i))}>✕</button>
              </div>
              <div style={S.row2}>
                <Field label="Number" value={String(sv.num||String(i+1).padStart(2,"0"))} onChange={v => setSec("services_grid","services",services.map((x,j)=>j===i?{...x,num:v}:x))} />
                <Field label="Title" value={String(sv.name||"")} onChange={v => setSec("services_grid","services",services.map((x,j)=>j===i?{...x,name:v}:x))} />
              </div>
              <Field label="Description" value={String(sv.desc||"")} onChange={v => setSec("services_grid","services",services.map((x,j)=>j===i?{...x,desc:v}:x))} textarea />
            </div>
          ))}
          <button style={S.btnAdd} onClick={() => setSec("services_grid","services",[...services,{name:"",desc:"",accent:false}])}>+ Add Service</button>
        </SectionCard>

        {/* CTA */}
        <SectionCard title="CTA Block" defaultOpen={false}>
          <Field label="CTA Title" value={txt("cta_title")} onChange={v => set("cta_title", v)} placeholder="Ready to Run Campaigns?" />
          <Field label="CTA Description" value={txt("cta_desc")} onChange={v => set("cta_desc", v)} textarea />
        </SectionCard>

      </div>

      <div style={S.actionsBar}>
        <a href="/homepage" target="_blank" style={S.btnPreview}>↗ View Live</a>
        <button style={S.btnSave} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
      </div>

      {pickerOpen && pickerTarget && (
        <CampaignMediaPicker
          open={pickerOpen}
          mode="campaign"
          onClose={() => { setPickerOpen(false); setPickerTarget(null); }}
          onSelect={(item) => {
            if (pickerTarget) {
              setSec(pickerTarget.section, "campaigns", campaigns.map((x,j) =>
                j === pickerTarget.idx ? { ...x, image_url: item.url, media_type: item.type, brand: x.brand || item.brand, name: x.name || item.campaign, campaign_id: item.campaign_id } : x
              ));
            }
            setPickerOpen(false);
            setPickerTarget(null);
          }}
        />
      )}
    </>
  );
}

// ── Team editor ───────────────────────────────────────────────
interface TeamMember { name: string; role: string; school: string; photo_url: string; instagram: string; linkedin: string }
interface ValueItem { num: string; title: string; desc: string }
interface OfficeItem { badge: string; city: string; address: string }

function TeamEditor({ onSaved }: { onSaved: () => void }) {
  const supabase = createBrowserSupabase();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [values, setValues] = useState<ValueItem[]>([]);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("pages").select("settings").eq("slug","team").single().then(({ data }) => {
      if (data?.settings) {
        const s = data.settings as Record<string,unknown>;
        if (s.team) setTeam(s.team as TeamMember[]);
        if (s.values) setValues(s.values as ValueItem[]);
        if (s.offices) setOffices(s.offices as OfficeItem[]);
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    await supabase.from("pages").upsert({ slug:"team", title:"Team", published:true, settings:{ team, values, offices } }, { onConflict:"slug" });
    setSaving(false);
    onSaved();
  }

  const upTeam = (i: number, k: keyof TeamMember, v: string) => setTeam(p => p.map((m,j) => j===i ? {...m,[k]:v} : m));
  const upVal = (i: number, k: keyof ValueItem, v: string) => setValues(p => p.map((m,j) => j===i ? {...m,[k]:v} : m));
  const upOff = (i: number, k: keyof OfficeItem, v: string) => setOffices(p => p.map((m,j) => j===i ? {...m,[k]:v} : m));

  if (loading) return <div style={{ padding:40, color:C.text3, fontSize:14 }}>Loading...</div>;

  return (
    <>
      <div style={S.editScroll}>
        <SectionCard title="Team Members">
          {team.map((m, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{m.name || `Member ${i+1}`}</span>
                <div style={{ display:"flex", gap:6 }}>
                  <button style={S.btnSm} onClick={() => { const t=[...team]; if(i>0)[t[i],t[i-1]]=[t[i-1],t[i]]; setTeam(t); }}>↑</button>
                  <button style={S.btnSm} onClick={() => { const t=[...team]; if(i<t.length-1)[t[i],t[i+1]]=[t[i+1],t[i]]; setTeam(t); }}>↓</button>
                  <button style={S.btnDanger} onClick={() => setTeam(p=>p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              </div>
              <div style={S.row2}>
                <Field label="Name" value={m.name} onChange={v=>upTeam(i,"name",v)} />
                <Field label="Role / Title" value={m.role} onChange={v=>upTeam(i,"role",v)} />
              </div>
              <div style={S.row2}>
                <Field label="School" value={m.school} onChange={v=>upTeam(i,"school",v)} />
                <Field label="Photo URL" value={m.photo_url} onChange={v=>upTeam(i,"photo_url",v)} />
              </div>
              <div style={S.row2}>
                <Field label="Instagram" value={m.instagram} onChange={v=>upTeam(i,"instagram",v)} placeholder="https://instagram.com/..." />
                <Field label="LinkedIn" value={m.linkedin} onChange={v=>upTeam(i,"linkedin",v)} placeholder="https://linkedin.com/in/..." />
              </div>
            </div>
          ))}
          <button style={S.btnAdd} onClick={() => setTeam(p=>[...p,{name:"",role:"",school:"",photo_url:"",instagram:"",linkedin:""}])}>+ Add Member</button>
        </SectionCard>

        <SectionCard title="Values" defaultOpen={false}>
          {values.map((v, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{v.title||`Value ${i+1}`}</span>
                <button style={S.btnDanger} onClick={()=>setValues(p=>p.filter((_,j)=>j!==i))}>✕</button>
              </div>
              <div style={S.row2}>
                <Field label="Number" value={v.num} onChange={val=>upVal(i,"num",val)} placeholder="01" />
                <Field label="Title" value={v.title} onChange={val=>upVal(i,"title",val)} />
              </div>
              <Field label="Description" value={v.desc} onChange={val=>upVal(i,"desc",val)} textarea />
            </div>
          ))}
          <button style={S.btnAdd} onClick={()=>setValues(p=>[...p,{num:String(p.length+1).padStart(2,"0"),title:"",desc:""}])}>+ Add Value</button>
        </SectionCard>

        <SectionCard title="Offices" defaultOpen={false}>
          {offices.map((o, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{o.city||`Office ${i+1}`}</span>
                <button style={S.btnDanger} onClick={()=>setOffices(p=>p.filter((_,j)=>j!==i))}>✕</button>
              </div>
              <div style={S.row2}>
                <Field label="Badge" value={o.badge} onChange={v=>upOff(i,"badge",v)} placeholder="Headquarters" />
                <Field label="City" value={o.city} onChange={v=>upOff(i,"city",v)} placeholder="Sarasota, FL" />
              </div>
              <Field label="Address" value={o.address} onChange={v=>upOff(i,"address",v)} textarea />
            </div>
          ))}
          <button style={S.btnAdd} onClick={()=>setOffices(p=>[...p,{badge:"",city:"",address:""}])}>+ Add Office</button>
        </SectionCard>
      </div>

      <div style={S.actionsBar}>
        <a href="/about/team" target="_blank" style={S.btnPreview}>↗ View Live</a>
        <button style={S.btnSave} onClick={save} disabled={saving}>{saving?"Saving...":"Save Changes"}</button>
      </div>
    </>
  );
}

// ── Services editor ───────────────────────────────────────────
type ServiceTab = "elevated"|"scaled"|"always-on"|"experiential";
interface CarouselPhoto { path:string; brand_logo_url?:string; focal_point?:string; }
interface ServicePageData { hero_tag:string; hero_title:string; hero_desc:string; features:{num:string;title:string;desc:string}[]; cta_title:string; cta_sub:string; carousel_photos:CarouselPhoto[] }

function ServicesEditor({ onSaved, svc }: { onSaved: () => void; svc?: ServiceTab }) {
  const supabase = createBrowserSupabase();
  const [tab, setTab] = useState<ServiceTab>(svc || "elevated");
  const [data, setData] = useState<Record<ServiceTab, ServicePageData>>({
    elevated:     { hero_tag:"Elevated NIL", hero_title:"Tier 1 Athletes.\nMaximum Impact.", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
    scaled:       { hero_tag:"Scaled NIL", hero_title:"More Athletes.\nMore Markets.", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
    "always-on":  { hero_tag:"Always On", hero_title:"Year-Round\nAthlete Coverage.", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
    experiential: { hero_tag:"Experiential", hero_title:"In-Person.\nUnforgettable.", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
  });
  const [saving, setSaving] = useState(false);
  const [carouselPickerOpen, setCarouselPickerOpen] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{path:string;brand_logo_url?:string}|null>(null);
  const [carouselBrands, setCarouselBrands] = useState<{id:string;name:string;logo_primary_url:string|null}[]>([]);
  const [carouselEditorOpen, setCarouselEditorOpen] = useState(false);
  const [carouselEditIdx, setCarouselEditIdx] = useState(0);
  const [photoZooms, setPhotoZooms] = useState<Record<number,number>>({});
  const svcCarouselDragging = useRef(false);
  const svcCarouselCanvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("brands").select("id,name,logo_primary_url").order("name").then(({data})=>setCarouselBrands(data||[]));
  }, []);

  useEffect(() => {
    supabase.from("pages").select("settings").eq("slug","services").single().then(({ data: row }) => {
      if (row?.settings) {
        const loaded = row.settings as Record<string, unknown>;
        const defaults: Record<ServiceTab, ServicePageData> = {
          elevated:     { hero_tag:"Elevated NIL", hero_title:"", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
          scaled:       { hero_tag:"Scaled NIL", hero_title:"", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
          "always-on":  { hero_tag:"Always On", hero_title:"", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
          experiential: { hero_tag:"Experiential", hero_title:"", hero_desc:"", features:[], cta_title:"", cta_sub:"", carousel_photos:[] },
        };
        const merged: Record<ServiceTab, ServicePageData> = {} as Record<ServiceTab, ServicePageData>;
        (["elevated","scaled","always-on","experiential"] as ServiceTab[]).forEach(k => {
          merged[k] = { ...defaults[k], ...((loaded[k] as object) || {}) };
          if (!Array.isArray(merged[k].features)) merged[k].features = [];
          if (!Array.isArray(merged[k].carousel_photos)) merged[k].carousel_photos = [];
          // Convert legacy string format to CarouselPhoto objects
          merged[k].carousel_photos = merged[k].carousel_photos.map((p: unknown) =>
            typeof p === "string" ? { path: p } : p
          ) as CarouselPhoto[];
        });
        setData(merged);
      }
    });
  }, []);

  // Drag handler for services carousel editor
  useEffect(() => {
    if (!carouselEditorOpen) return;
    const move = (e: MouseEvent|TouchEvent) => {
      if (!svcCarouselDragging.current || !svcCarouselCanvas.current) return;
      const rect = svcCarouselCanvas.current.getBoundingClientRect();
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
      const x = Math.round(Math.max(0,Math.min(100,(cx-rect.left)/rect.width*100)));
      const y = Math.round(Math.max(0,Math.min(100,(cy-rect.top)/rect.height*100)));
      setData(prev => {
        const photos = [...(prev[tab].carousel_photos||[])];
        if (photos[carouselEditIdx]) {
          photos[carouselEditIdx] = { ...photos[carouselEditIdx], focal_point: `${x}% ${y}%` };
        }
        return { ...prev, [tab]: { ...prev[tab], carousel_photos: photos } };
      });
    };
    const up = () => { svcCarouselDragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("touchmove", move); window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); };
  }, [carouselEditorOpen, carouselEditIdx, tab]);

  const cur = data[tab];
  const upd = (key: keyof ServicePageData, val: unknown) => setData(p => ({ ...p, [tab]: { ...p[tab], [key]: val } }));
  const updFeat = (i: number, key: string, val: string) => upd("features", cur.features.map((f,j) => j===i ? {...f,[key]:val} : f));

  async function save() {
    setSaving(true);
    await supabase.from("pages").upsert({ slug:"services", title:"Services", published:true, settings:data }, { onConflict:"slug" });
    const paths = ['/services/elevated', '/services/scaled', '/services/always-on', '/services/experiential'];
    await Promise.all(paths.map(path =>
      fetch(`/api/revalidate?path=${path}`).catch(() => {})
    ));
    setSaving(false);
    onSaved();
  }

  const SVC_URLS: Record<ServiceTab,string> = { elevated:"/services/elevated", scaled:"/services/scaled", "always-on":"/services/always-on", experiential:"/services/experiential" };

  return (
    <>
      <div style={S.editScroll}>
        <SectionCard title="Hero">
          <Field label="Service Tag" value={cur.hero_tag} onChange={v=>upd("hero_tag",v)} />
          <Field label="Title" value={cur.hero_title} onChange={v=>upd("hero_title",v)} textarea hint="Use \\n for line breaks" />
          <Field label="Description" value={cur.hero_desc} onChange={v=>upd("hero_desc",v)} textarea />
        </SectionCard>

        <SectionCard title="Features" defaultOpen={false}>
          {cur.features.map((f, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{f.title||`Feature ${i+1}`}</span>
                <button style={S.btnDanger} onClick={()=>upd("features",cur.features.filter((_,j)=>j!==i))}>✕</button>
              </div>
              <div style={S.row2}>
                <Field label="Number" value={f.num} onChange={v=>updFeat(i,"num",v)} />
                <Field label="Title" value={f.title} onChange={v=>updFeat(i,"title",v)} />
              </div>
              <Field label="Description" value={f.desc} onChange={v=>updFeat(i,"desc",v)} textarea />
            </div>
          ))}
          <button style={S.btnAdd} onClick={()=>upd("features",[...cur.features,{num:String(cur.features.length+1).padStart(2,"0"),title:"",desc:""}])}>+ Add Feature</button>
        </SectionCard>

        <SectionCard title="CTA" defaultOpen={false}>
          <Field label="CTA Title" value={cur.cta_title} onChange={v=>upd("cta_title",v)} />
          <Field label="CTA Subtitle" value={cur.cta_sub} onChange={v=>upd("cta_sub",v)} textarea />
        </SectionCard>

        <SectionCard title="Carousel Photos">
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
            {(cur.carousel_photos||[]).map((photo, i) => {
              const p = typeof photo === "string" ? {path: photo} as CarouselPhoto : photo;
              return (
                <div key={i} style={{ position:"relative", width:72, height:72, borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)" }}>
                  <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${p.path}`} style={{ width:72, height:72, objectFit:"cover", objectPosition: p.focal_point || "50% 20%" }} alt="" />
                  {p.brand_logo_url && (
                    <div style={{ position:"absolute", bottom:3, right:3, width:22, height:22, borderRadius:4, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <img src={p.brand_logo_url} style={{ width:18, height:18, objectFit:"contain" }} alt="" />
                    </div>
                  )}
                  <div style={{ position:"absolute", top:-1, right:-1, display:"flex", gap:1 }}>
                    {i > 0 && <button onClick={()=>{ const arr=[...(cur.carousel_photos||[])]; [arr[i-1],arr[i]]=[arr[i],arr[i-1]]; upd("carousel_photos",arr); }} style={{ width:16, height:16, borderRadius:3, background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>&#9650;</button>}
                    {i < (cur.carousel_photos||[]).length-1 && <button onClick={()=>{ const arr=[...(cur.carousel_photos||[])]; [arr[i],arr[i+1]]=[arr[i+1],arr[i]]; upd("carousel_photos",arr); }} style={{ width:16, height:16, borderRadius:3, background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>&#9660;</button>}
                    <button onClick={()=>upd("carousel_photos",(cur.carousel_photos||[]).filter((_,j)=>j!==i))} style={{ width:16, height:16, borderRadius:"50%", background:"#D73F09", border:"none", color:"#fff", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>&#215;</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...S.btnAdd, flex:1 }} onClick={()=>setCarouselPickerOpen(true)}>+ Add Photo</button>
            <button style={{ ...S.btnSm, padding:"8px 14px" }} onClick={()=>{ setCarouselEditIdx(0); setPhotoZooms({}); setCarouselEditorOpen(true); }}>Edit Carousel</button>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:6 }}>{(cur.carousel_photos||[]).length} photos · changes live after Save</div>
        </SectionCard>
      </div>

      <div style={S.actionsBar}>
        <a href={SVC_URLS[tab]} target="_blank" style={S.btnPreview}>↗ View Live</a>
        <button style={S.btnSave} onClick={save} disabled={saving}>{saving?"Saving...":"Save Changes"}</button>
      </div>

      {carouselPickerOpen && (
        <CampaignMediaPicker
          open={carouselPickerOpen}
          mode="full"
          onClose={() => setCarouselPickerOpen(false)}
          onSelect={(item) => {
            if (item.type === "image") {
              const raw = item.url.replace("https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/","").split("?")[0];
              setPendingPhoto({ path: raw });
            }
            setCarouselPickerOpen(false);
          }}
        />
      )}

      {pendingPhoto && (
        <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#141414", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, padding:32, width:480, maxWidth:"90vw" }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#fff", marginBottom:4 }}>Add Brand Logo?</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginBottom:20 }}>Optionally overlay a brand logo on the bottom-right of this photo.</div>
            <div style={{ display:"flex", gap:12, marginBottom:20, alignItems:"center" }}>
              <img src={`https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/${pendingPhoto.path}`} style={{ width:80, height:80, objectFit:"cover", objectPosition:"50% 15%", borderRadius:10, flexShrink:0 }} alt="" />
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", wordBreak:"break-all" }}>{pendingPhoto.path.split("/").pop()}</div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Select Brand</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, maxHeight:200, overflowY:"auto", marginBottom:20 }}>
              <button onClick={()=>setPendingPhoto(p=>p?{...p,brand_logo_url:undefined}:p)} style={{ padding:"6px 14px", borderRadius:8, border:`1.5px solid ${!pendingPhoto.brand_logo_url?"#D73F09":"rgba(255,255,255,0.15)"}`, background:"transparent", color:!pendingPhoto.brand_logo_url?"#D73F09":"rgba(255,255,255,0.5)", fontSize:12, fontWeight:700, cursor:"pointer" }}>No Logo</button>
              {carouselBrands.filter(b=>b.logo_primary_url).map(b=>(
                <button key={b.id} onClick={()=>setPendingPhoto(p=>p?{...p,brand_logo_url:b.logo_primary_url||undefined}:p)}
                  title={b.name}
                  style={{ padding:"4px 10px", borderRadius:8, border:`1.5px solid ${pendingPhoto.brand_logo_url===b.logo_primary_url?"#D73F09":"rgba(255,255,255,0.15)"}`, background:"rgba(0,0,0,0.4)", cursor:"pointer", display:"flex", alignItems:"center" }}>
                  <img src={b.logo_primary_url!} style={{ height:22, width:"auto", maxWidth:60, objectFit:"contain" }} alt={b.name} />
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setPendingPhoto(null)} style={{ flex:1, padding:"10px 0", borderRadius:10, border:"1px solid rgba(255,255,255,0.15)", background:"transparent", color:"rgba(255,255,255,0.6)", fontSize:13, fontWeight:700, cursor:"pointer" }}>Cancel</button>
              <button onClick={async ()=>{
                console.log("Adding photo to carousel:", pendingPhoto);
                const newPhotos = [...(cur.carousel_photos||[]), pendingPhoto];
                upd("carousel_photos", newPhotos);
                setPendingPhoto(null);
                await supabase.from("pages").upsert({ slug:"services", title:"Services", published:true, settings:{...data,[tab]:{...cur,carousel_photos:newPhotos}} }, {onConflict:"slug"});
                const paths = ['/services/elevated', '/services/scaled', '/services/always-on', '/services/experiential'];
                await Promise.all(paths.map(path =>
                  fetch(`/api/revalidate?path=${path}`).catch(() => {})
                ));
                onSaved();
              }} style={{ flex:2, padding:"10px 0", borderRadius:10, border:"none", background:"#D73F09", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer" }}>Add to Carousel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Services Carousel Editor Full-Screen ──────────────── */}
      {carouselEditorOpen && (() => {
        const photos = cur.carousel_photos || [];
        const selPhoto = photos[carouselEditIdx];
        const selFocal = selPhoto?.focal_point || "50% 20%";
        const selZoom = photoZooms[carouselEditIdx] ?? 1;
        const fpParts = selFocal.match(/(\d+)%\s+(\d+)%/);
        const fx = fpParts ? parseInt(fpParts[1]) : 50;
        const fy = fpParts ? parseInt(fpParts[2]) : 20;
        const MEDIA_BASE = "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/";
        const movePhoto = (idx: number, dir: -1|1) => {
          const next = idx + dir;
          if (next < 0 || next >= photos.length) return;
          const arr = [...photos];
          [arr[idx], arr[next]] = [arr[next], arr[idx]];
          upd("carousel_photos", arr);
          setCarouselEditIdx(next);
        };
        const removePhoto = (idx: number) => {
          upd("carousel_photos", photos.filter((_,j)=>j!==idx));
          if (carouselEditIdx >= photos.length - 1) setCarouselEditIdx(Math.max(0, photos.length - 2));
        };
        const saveFocalForPhoto = () => {
          // focal_point is already updated in state via drag handler; this is a visual confirmation
        };
        return (
          <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#080808", display:"flex", flexDirection:"column" }}>
            {/* Header */}
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:900 }}>Service Carousel Editor — {tab}</div>
                <div style={{ fontSize:11, color:C.text3, marginTop:1 }}>Drag photo to reposition · reorder with arrows · Save All to persist</div>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <button onClick={()=>setCarouselEditorOpen(false)} style={S.btnPreview}>Cancel</button>
                <button onClick={()=>{ save(); setCarouselEditorOpen(false); }} disabled={saving} style={{ ...S.btnSave, opacity:saving?0.6:1, flex:"none", width:"auto", padding:"9px 20px" }}>{saving ? "Saving..." : "Save All"}</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
              {/* LEFT — photo list */}
              <div style={{ width:220, borderRight:`1px solid ${C.border}`, overflowY:"auto", flexShrink:0, display:"flex", flexDirection:"column" }}>
                <div style={{ flex:1, overflowY:"auto" }}>
                  {photos.map((photo, idx) => {
                    const p = typeof photo === "string" ? { path: photo } as CarouselPhoto : photo;
                    const active = idx === carouselEditIdx;
                    return (
                      <div key={idx} onClick={()=>setCarouselEditIdx(idx)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", cursor:"pointer", borderLeft: active ? `3px solid ${C.orange}` : "3px solid transparent", background: active ? "rgba(215,63,9,0.06)" : "transparent", borderBottom:`1px solid ${C.border}` }}>
                        <img src={`${MEDIA_BASE}${p.path}`} alt="" style={{ width:36, height:46, borderRadius:6, objectFit:"cover" as const, objectPosition: p.focal_point || "50% 20%", flexShrink:0 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.path.split("/").pop()}</div>
                          <div style={{ fontSize:9, color:C.text3 }}>{p.focal_point || "50% 20%"}</div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
                          <button onClick={e=>{e.stopPropagation();movePhoto(idx,-1);}} disabled={idx===0} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:4, color:C.text3, fontSize:9, cursor:"pointer", padding:"1px 4px", opacity:idx===0?0.3:1 }}>&#9650;</button>
                          <button onClick={e=>{e.stopPropagation();movePhoto(idx,1);}} disabled={idx===photos.length-1} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:4, color:C.text3, fontSize:9, cursor:"pointer", padding:"1px 4px", opacity:idx===photos.length-1?0.3:1 }}>&#9660;</button>
                          <button onClick={e=>{e.stopPropagation();removePhoto(idx);}} style={{ background:"none", border:"1px solid rgba(255,80,80,0.3)", borderRadius:4, color:"#ff6b6b", fontSize:9, cursor:"pointer", padding:"1px 4px" }}>&#215;</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding:10, borderTop:`1px solid ${C.border}` }}>
                  <button style={{ ...S.btnAdd, marginTop:0 }} onClick={()=>{ setCarouselEditorOpen(false); setCarouselPickerOpen(true); }}>+ Add Photo</button>
                </div>
              </div>

              {/* CENTER — drag-to-reposition canvas */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                {/* Canvas */}
                <div style={{ flex:1, background:"#050505", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  {selPhoto ? (
                    <div
                      ref={svcCarouselCanvas}
                      onMouseDown={()=>{svcCarouselDragging.current=true;}}
                      onTouchStart={()=>{svcCarouselDragging.current=true;}}
                      style={{ width:400, height:225, overflow:"hidden", borderRadius:8, border:`2px solid ${C.orange}`, cursor:"crosshair", position:"relative", flexShrink:0 }}
                    >
                      <img src={`${MEDIA_BASE}${selPhoto.path}`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:`${fx}% ${fy}%`, transform: selZoom !== 1 ? `scale(${selZoom})` : undefined, transformOrigin:`${fx}% ${fy}%`, pointerEvents:"none" }} />
                      {/* Service page gradient overlay preview */}
                      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,rgba(5,5,5,0.92) 0%,rgba(5,5,5,0.7) 45%,rgba(5,5,5,0.2) 75%,rgba(5,5,5,0.05) 100%)", pointerEvents:"none" }} />
                      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(10,10,10,0.5) 0%,transparent 20%,transparent 80%,rgba(10,10,10,1) 100%)", pointerEvents:"none" }} />
                      {/* Focal dot */}
                      <div style={{ position:"absolute", left:`${fx}%`, top:`${fy}%`, transform:"translate(-50%,-50%)", width:14, height:14, borderRadius:"50%", background:C.orange, border:"2px solid #fff", pointerEvents:"none", boxShadow:"0 0 0 3px rgba(215,63,9,0.3)" }} />
                      {/* Device ratio label */}
                      <div style={{ position:"absolute", top:8, right:8, fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.4)", background:"rgba(0,0,0,0.5)", padding:"2px 6px", borderRadius:4, pointerEvents:"none" }}>16:9</div>
                    </div>
                  ) : (
                    <div style={{ color:C.text3, fontSize:12 }}>No photos in carousel</div>
                  )}
                </div>

                {/* Controls bar */}
                <div style={{ padding:"8px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                  {[{l:"Face",y:20},{l:"Center",y:50},{l:"Top",y:10}].map(p => (
                    <button key={p.l} onClick={()=>{
                      const photos2 = [...(cur.carousel_photos||[])];
                      if (photos2[carouselEditIdx]) { photos2[carouselEditIdx] = { ...photos2[carouselEditIdx], focal_point:`50% ${p.y}%` }; upd("carousel_photos", photos2); }
                    }} style={{ padding:"4px 10px", borderRadius:6, border: fy===p.y && fx===50 ? `1px solid ${C.orange}` : `1px solid ${C.border2}`, background: fy===p.y && fx===50 ? "rgba(215,63,9,0.15)" : "none", color: fy===p.y && fx===50 ? C.orange : C.text3, fontSize:10, fontWeight:700, cursor:"pointer" }}>{p.l}</button>
                  ))}
                  <button onClick={()=>{
                    const photos2 = [...(cur.carousel_photos||[])];
                    if (photos2[carouselEditIdx]) { photos2[carouselEditIdx] = { ...photos2[carouselEditIdx], focal_point:"50% 20%" }; upd("carousel_photos", photos2); }
                    setPhotoZooms(p => { const n={...p}; delete n[carouselEditIdx]; return n; });
                  }} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${C.border2}`, background:"none", color:C.text3, fontSize:10, fontWeight:700, cursor:"pointer" }}>Reset</button>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:C.text3 }}>Zoom</span>
                    <input type="range" min={1} max={3} step={0.05} value={selZoom} onChange={e=>{ setPhotoZooms(p=>({...p,[carouselEditIdx]:parseFloat(e.target.value)})); }} style={{ width:80, accentColor:C.orange }} />
                    <span style={{ fontSize:10, color:C.text3, minWidth:32, textAlign:"right" as const }}>{selZoom.toFixed(2)}x</span>
                  </div>
                  <div style={{ flex:1 }} />
                  <span style={{ fontSize:10, color:C.text3 }}>{fx}% {fy}%</span>
                  <button onClick={saveFocalForPhoto} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${C.orange}`, background:"rgba(215,63,9,0.15)", color:C.orange, fontSize:10, fontWeight:700, cursor:"pointer" }}>Save Position</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Contact editor ────────────────────────────────────────────
function ContactEditor({ onSaved }: { onSaved: () => void }) {
  const supabase = createBrowserSupabase();
  const [settings, setSettings] = useState({ hero_title:"", hero_desc:"", email:"", offices:[] as OfficeItem[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("pages").select("settings").eq("slug","contact").single().then(({ data }) => {
      if (data?.settings) setSettings(data.settings as typeof settings);
    });
  }, []);

  const set = (k: string, v: unknown) => setSettings(p => ({ ...p, [k]: v }));
  const upOff = (i: number, k: keyof OfficeItem, v: string) => setSettings(p => ({ ...p, offices: p.offices.map((o,j) => j===i ? {...o,[k]:v} : o) }));

  async function save() {
    setSaving(true);
    await supabase.from("pages").upsert({ slug:"contact", title:"Contact", published:true, settings }, { onConflict:"slug" });
    setSaving(false);
    onSaved();
  }

  return (
    <>
      <div style={S.editScroll}>
        <SectionCard title="Hero">
          <Field label="Page Title" value={settings.hero_title} onChange={v=>set("hero_title",v)} placeholder="Let's Build Something Together" />
          <Field label="Description" value={settings.hero_desc} onChange={v=>set("hero_desc",v)} textarea />
          <Field label="Contact Email" value={settings.email} onChange={v=>set("email",v)} placeholder="hello@postgame.co" />
        </SectionCard>

        <SectionCard title="Office Locations" defaultOpen={false}>
          {settings.offices.map((o, i) => (
            <div key={i} style={S.itemCard}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>{o.city||`Office ${i+1}`}</span>
                <button style={S.btnDanger} onClick={()=>set("offices",settings.offices.filter((_,j)=>j!==i))}>✕</button>
              </div>
              <div style={S.row2}>
                <Field label="Badge" value={o.badge} onChange={v=>upOff(i,"badge",v)} placeholder="Headquarters" />
                <Field label="City" value={o.city} onChange={v=>upOff(i,"city",v)} placeholder="Sarasota, FL" />
              </div>
              <Field label="Address" value={o.address} onChange={v=>upOff(i,"address",v)} textarea />
            </div>
          ))}
          <button style={S.btnAdd} onClick={()=>set("offices",[...settings.offices,{badge:"",city:"",address:""}])}>+ Add Office</button>
        </SectionCard>
      </div>
      <div style={S.actionsBar}>
        <a href="/contact" target="_blank" style={S.btnPreview}>↗ View Live</a>
        <button style={S.btnSave} onClick={save} disabled={saving}>{saving?"Saving...":"Save Changes"}</button>
      </div>
    </>
  );
}

// ── Clients editor ────────────────────────────────────────────
function ClientsEditor({ onSaved }: { onSaved: () => void }) {
  const supabase = createBrowserSupabase();
  const [brands, setBrands] = useState<{id:string;name:string;logo_url:string;featured:boolean;sort_order:number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("brands").select("id,name,logo_url,archived").eq("archived",false).order("name").then(({ data }) => {
      setBrands((data||[]).map((b:any,i:number) => ({ ...b, featured:false, sort_order:i })));
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ padding:40, color:C.text3, fontSize:14 }}>Loading brands...</div>;

  return (
    <>
      <div style={S.editScroll}>
        <SectionCard title="Brand Clients">
          <div style={{ fontSize:12, color:C.text3, marginBottom:12, lineHeight:1.5 }}>
            {brands.length} brands in your network. Brands are managed in the Brands dashboard.
          </div>
          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:8 }}>
            {brands.map(b => (
              <div key={b.id} style={{ padding:"6px 12px", borderRadius:8, background:"#1a1a1a", border:`1px solid ${C.border}`, fontSize:12, color:C.text2 }}>
                {b.name}
              </div>
            ))}
          </div>
        </SectionCard>
        <div style={{ padding:"16px 20px" }}>
          <Link href="/dashboard/brands" style={{ fontSize:13, color:C.orange, textDecoration:"none", fontWeight:700 }}>→ Manage Brands in Brand Dashboard</Link>
        </div>
      </div>
      <div style={S.actionsBar}>
        <a href="/clients" target="_blank" style={S.btnPreview}>↗ View Live</a>
      </div>
    </>
  );
}

// ── Press editor ──────────────────────────────────────────────
function PressEditor({ onSaved }: { onSaved: () => void }) {
  const supabase = createBrowserSupabase();
  const [articles, setArticles] = useState<{id:string;title:string;url:string;published_date:string;published:boolean;category:string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("press_articles").select("id,title,url,published_date,published,category").order("published_date",{ascending:false}).then(({ data }) => {
      setArticles((data||[]) as any);
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, published: boolean) => {
    await supabase.from("press_articles").update({ published }).eq("id", id);
    setArticles(p => p.map(a => a.id===id ? {...a,published} : a));
    onSaved();
  };

  if (loading) return <div style={{ padding:40, color:C.text3, fontSize:14 }}>Loading...</div>;

  return (
    <>
      <div style={S.editScroll}>
        <SectionCard title="Press Articles">
          <div style={{ fontSize:12, color:C.text3, marginBottom:12 }}>Toggle articles on/off to control what appears on the press page.</div>
          {articles.map(a => (
            <div key={a.id} style={{ ...S.itemCard, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color: a.published ? C.text : C.text3, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{a.title}</div>
                <div style={{ fontSize:11, color:C.text3 }}>{a.category} · {a.published_date}</div>
              </div>
              <Toggle on={a.published} onChange={v=>toggle(a.id,v)} />
            </div>
          ))}
        </SectionCard>
      </div>
      <div style={S.actionsBar}>
        <a href="/press" target="_blank" style={S.btnPreview}>↗ View Live</a>
      </div>
    </>
  );
}

// ── Campaigns editor ─────────────────────────────────────────
function CampaignsEditor({ onSaved }: { onSaved: () => void }) {
  const supabase = createBrowserSupabase();
  const [campaigns, setCampaigns] = useState<{id:string;name:string;slug:string;status:string;brand_name:string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("campaigns").select("id,name,slug,status,brands(name)").order("created_at",{ascending:false}).limit(50).then(({ data }) => {
      setCampaigns((data||[]).map((c:any) => ({ ...c, brand_name: c.brands?.name || "" })));
      setLoading(false);
    });
  }, []);

  const toggleStatus = async (id: string, current: string) => {
    const next = current === "published" ? "draft" : "published";
    await supabase.from("campaigns").update({ status: next }).eq("id", id);
    setCampaigns(p => p.map(c => c.id===id ? {...c,status:next} : c));
    onSaved();
  };

  if (loading) return <div style={{ padding:40, color:C.text3, fontSize:14 }}>Loading campaigns...</div>;

  return (
    <>
      <div style={S.editScroll}>
        <SectionCard title="Campaigns">
          <div style={{ fontSize:12, color:C.text3, marginBottom:12 }}>Toggle campaigns to control visibility on the public campaigns page.</div>
          {campaigns.map(c => (
            <div key={c.id} style={{ ...S.itemCard, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color: c.status==="published" ? C.text : C.text3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{c.name}</div>
                <div style={{ fontSize:11, color:C.text3 }}>{c.brand_name}</div>
              </div>
              <Toggle on={c.status==="published"} onChange={()=>toggleStatus(c.id,c.status)} />
            </div>
          ))}
        </SectionCard>
        <div style={{ padding:"16px 20px" }}>
          <Link href="/dashboard?tab=recaps" style={{ fontSize:13, color:C.orange, textDecoration:"none", fontWeight:700 }}>→ Manage Campaigns in Page Creator</Link>
        </div>
      </div>
      <div style={S.actionsBar}>
        <a href="/campaigns" target="_blank" style={S.btnPreview}>↗ View Live</a>
      </div>
    </>
  );
}

// ── Deals editor ──────────────────────────────────────────────
function DealsEditor({ onSaved }: { onSaved: () => void }) {
  const supabase = createBrowserSupabase();
  const router = useRouter();
  const [deals, setDeals] = useState<{id:string;athlete_name:string;brand_name:string;athlete_sport:string;athlete_school?:string;published:boolean;featured:boolean;sort_order:number;image_url:string;focal_point:string;focal_point_tablet?:string;focal_point_mobile?:string;zoom_desktop?:number;zoom_tablet?:number;zoom_mobile?:number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newAthlete, setNewAthlete] = useState("");
  const [newSport, setNewSport] = useState("");
  const [newSchool, setNewSchool] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [brands, setBrands] = useState<{id:string;name:string}[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [brandCampaigns, setBrandCampaigns] = useState<{id:string;name:string}[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignAthletes, setCampaignAthletes] = useState<{id:string;name:string;school:string;sport:string}[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [search, setSearch] = useState("");
  const [heroOrder, setHeroOrder] = useState<string[]>([]);
  const [showCarouselEditor, setShowCarouselEditor] = useState(false);
  const [carouselSelected, setCarouselSelected] = useState(0);
  const [carouselDevice, setCarouselDevice] = useState<"desktop"|"tablet"|"mobile">("desktop");
  const [carouselFocals, setCarouselFocals] = useState<Record<string,{desktop:{focal:string;zoom:number};tablet:{focal:string;zoom:number};mobile:{focal:string;zoom:number}}>>({});
  const [carouselSaving, setCarouselSaving] = useState(false);
  const carouselDragging = useRef(false);
  const carouselCanvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("deals").select("id,athlete_name,brand_name,athlete_sport,athlete_school,published,featured,sort_order,image_url,focal_point,focal_point_tablet,focal_point_mobile,zoom_desktop,zoom_tablet,zoom_mobile").order("featured",{ascending:false}).order("sort_order",{ascending:true}).then(({ data }) => {
      const rows = (data||[]) as any[];
      setDeals(rows);
      setHeroOrder(rows.filter((d:any)=>d.featured).map((d:any)=>d.id));
      setLoading(false);
    });
    supabase.from("brands").select("id,name").eq("archived",false).order("name").then(({ data }) => {
      setBrands((data||[]) as any);
    });
  }, []);

  useEffect(() => {
    supabase.from("campaign_recaps").select("id,name").order("name").then(({ data }) => {
      setBrandCampaigns((data||[]) as any);
    });
  }, []);

  useEffect(() => {
    setSelectedCampaignId("");
    setSelectedAthleteId("");
    setCampaignAthletes([]);
  }, [selectedBrandId]);

  useEffect(() => {
    if(!selectedCampaignId){ setCampaignAthletes([]); setSelectedAthleteId(""); return; }
    supabase.from("athletes").select("id,name,school,sport").eq("campaign_id",selectedCampaignId).order("name").then(({ data }) => {
      setCampaignAthletes((data||[]) as any);
      setSelectedAthleteId("");
    });
  }, [selectedCampaignId]);

  useEffect(() => {
    if(!selectedAthleteId) return;
    const ath = campaignAthletes.find(a=>a.id===selectedAthleteId);
    if(ath){ setNewAthlete(ath.name||""); setNewSchool(ath.school||""); setNewSport(ath.sport||""); }
  }, [selectedAthleteId]);

  const togglePublished = async (id: string, val: boolean) => {
    await supabase.from("deals").update({ published: val }).eq("id", id);
    setDeals(p => p.map(d => d.id===id ? {...d,published:val} : d));
    onSaved();
  };

  const toggleFeatured = async (id: string, val: boolean) => {
    await supabase.from("deals").update({ featured: val }).eq("id", id);
    setDeals(p => p.map(d => d.id===id ? {...d,featured:val} : d));
    setHeroOrder(prev => val
      ? prev.includes(id) ? prev : [...prev, id]
      : prev.filter(x => x !== id)
    );
    onSaved();
  };

  const updateFocalPoint = async (id: string, focal_point: string) => {
    await supabase.from("deals").update({ focal_point }).eq("id", id);
    setDeals(p => p.map(d => d.id===id ? {...d,focal_point} : d));
  };
  const updateFocalTablet = async (id: string, val: string) => {
    await supabase.from("deals").update({ focal_point_tablet: val }).eq("id", id);
    setDeals(p => p.map(d => d.id===id ? {...d,focal_point_tablet:val} : d));
  };
  const updateFocalMobile = async (id: string, val: string) => {
    await supabase.from("deals").update({ focal_point_mobile: val }).eq("id", id);
    setDeals(p => p.map(d => d.id===id ? {...d,focal_point_mobile:val} : d));
  };

  const openCarouselEditor = () => {
    const fm: Record<string,{desktop:{focal:string;zoom:number};tablet:{focal:string;zoom:number};mobile:{focal:string;zoom:number}}> = {};
    deals.filter(d=>d.featured).forEach(d => {
      fm[d.id] = {
        desktop: { focal: d.focal_point||"50% 20%", zoom: d.zoom_desktop ?? 1 },
        tablet: { focal: d.focal_point_tablet||"50% 20%", zoom: d.zoom_tablet ?? 1 },
        mobile: { focal: d.focal_point_mobile||"50% 20%", zoom: d.zoom_mobile ?? 1 },
      };
    });
    setCarouselFocals(fm);
    setCarouselSelected(0);
    setCarouselDevice("desktop");
    setHeroOrder(prev => {
      const featuredIds = deals.filter(d=>d.featured).map(d=>d.id);
      const kept = prev.filter(id => featuredIds.includes(id));
      const added = featuredIds.filter(id => !prev.includes(id));
      return [...kept, ...added];
    });
    setShowCarouselEditor(true);
  };

  useEffect(() => {
    if (!showCarouselEditor) return;
    const move = (e: MouseEvent|TouchEvent) => {
      if (!carouselDragging.current || !carouselCanvas.current) return;
      const rect = carouselCanvas.current.getBoundingClientRect();
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
      const x = Math.round(Math.max(0,Math.min(100,(cx-rect.left)/rect.width*100)));
      const y = Math.round(Math.max(0,Math.min(100,(cy-rect.top)/rect.height*100)));
      const selId = heroOrder[carouselSelected];
      if (selId) setCarouselFocals(p => ({...p,[selId]:{...p[selId],[carouselDevice]:{...p[selId][carouselDevice],focal:`${x}% ${y}%`}}}));
    };
    const up = () => { carouselDragging.current = false; };
    window.addEventListener("mousemove",move);
    window.addEventListener("touchmove",move,{passive:false});
    window.addEventListener("mouseup",up);
    window.addEventListener("touchend",up);
    return () => { window.removeEventListener("mousemove",move); window.removeEventListener("touchmove",move); window.removeEventListener("mouseup",up); window.removeEventListener("touchend",up); };
  }, [showCarouselEditor, carouselDevice, carouselSelected, heroOrder]);

  const saveCarouselAll = async () => {
    setCarouselSaving(true);
    // Save sort order
    await Promise.all(heroOrder.map((id,i) => supabase.from("deals").update({sort_order:i}).eq("id",id)));
    // Save focal points
    for (const [id, fp] of Object.entries(carouselFocals)) {
      await supabase.from("deals").update({ focal_point:fp.desktop.focal, focal_point_tablet:fp.tablet.focal, focal_point_mobile:fp.mobile.focal, zoom_desktop:fp.desktop.zoom, zoom_tablet:fp.tablet.zoom, zoom_mobile:fp.mobile.zoom }).eq("id",id);
    }
    setDeals(prev => prev.map(d => {
      const idx = heroOrder.indexOf(d.id);
      const fp = carouselFocals[d.id];
      const updates: any = {};
      if (idx >= 0) updates.sort_order = idx;
      if (fp) { updates.focal_point = fp.desktop.focal; updates.focal_point_tablet = fp.tablet.focal; updates.focal_point_mobile = fp.mobile.focal; updates.zoom_desktop = fp.desktop.zoom; updates.zoom_tablet = fp.tablet.zoom; updates.zoom_mobile = fp.mobile.zoom; }
      return Object.keys(updates).length ? {...d,...updates} : d;
    }));
    setCarouselSaving(false);
    setShowCarouselEditor(false);
    onSaved();
  };

  if (loading) return <div style={{ padding:40, color:C.text3, fontSize:14 }}>Loading deals...</div>;

  const q = search.toLowerCase();
  const filterDeal = (d: any) => !q || [d.athlete_name, d.brand_name, d.athlete_sport, d.athlete_school].some((v:string|null) => v?.toLowerCase().includes(q));
  const allFiltered = deals.filter(filterDeal);
  const featuredFiltered = allFiltered.filter(d => d.featured);
  const restFiltered = allFiltered.filter(d => !d.featured);

  const moveHero = (idx: number, dir: -1|1) => {
    const next = idx + dir;
    if (next < 0 || next >= heroOrder.length) return;
    const arr = [...heroOrder];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setHeroOrder(arr);
  };

  return (
    <>
      <div style={S.editScroll}>
        <button onClick={()=>{ setShowCreate(true); setCreateError(""); }} style={{ ...S.btnSave, width:"100%", marginBottom:12 }}>+ New Deal</button>
        {/* Search bar */}
        <div style={{ marginBottom:12, display:"flex", gap:8, alignItems:"center", padding:"0 0 12px", borderBottom:`1px solid rgba(255,255,255,0.07)` }}>
          <div style={{ flex:1, position:"relative" }}>
            <input style={{ ...S.input, paddingRight:28 }} placeholder="Search athlete, brand, sport, school..." value={search} onChange={e=>setSearch(e.target.value)} />
            {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.text3, fontSize:14, cursor:"pointer", padding:0, lineHeight:1 }}>×</button>}
          </div>
          {search && <span style={{ fontSize:11, color:C.orange, fontWeight:700, flexShrink:0 }}>{allFiltered.length} results</span>}
        </div>

        {/* Featured Athletes — collapsed strip */}
        <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
          {/* Header row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: featuredFiltered.length > 0 ? 12 : 0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14 }}>⭐</span>
              <span style={{ fontSize:13, fontWeight:800, color:C.text }}>Featured Athletes</span>
              <span style={{ fontSize:10, fontWeight:700, color:C.text3, background:"rgba(255,255,255,0.06)", padding:"2px 8px", borderRadius:10 }}>{featuredFiltered.length} athletes</span>
            </div>
            <button onClick={openCarouselEditor} style={S.btnSm}>Edit Carousel</button>
          </div>
          {/* Horizontal thumbnail strip */}
          {featuredFiltered.length > 0 && (
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
              {featuredFiltered.map(d => (
                <div key={d.id} style={{ flexShrink:0, width:64, textAlign:"center" }}>
                  {d.image_url ? (
                    <img src={d.image_url} alt="" style={{ width:64, height:80, borderRadius:8, objectFit:"cover" as const, objectPosition:d.focal_point||"50% 20%", border:`1px solid ${C.border}` }} />
                  ) : (
                    <div style={{ width:64, height:80, borderRadius:8, background:C.surface, border:`1px solid ${C.border}` }} />
                  )}
                  <div style={{ fontSize:8, fontWeight:700, color:C.text, marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{d.athlete_name}</div>
                  <div style={{ fontSize:7, color:C.text3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{d.brand_name}</div>
                </div>
              ))}
              <button onClick={()=>{ setShowCreate(true); setCreateError(""); }} style={{ flexShrink:0, width:64, height:80, borderRadius:8, border:`1px dashed ${C.border2}`, background:"none", color:C.text3, fontSize:24, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
            </div>
          )}
        </div>

        {/* All deals - full management */}
        <SectionCard title="All Deals" defaultOpen={false}>
          <div style={{ fontSize:12, color:C.text3, marginBottom:12 }}>Published = visible on public site. Star (☆) = featured at top. Use face position to keep athlete centered in banner.</div>
          {restFiltered.map(d => (
            <div key={d.id} style={{ ...S.itemCard }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: d.image_url ? 10 : 0 }}>
                {d.image_url && <img src={d.image_url} alt="" style={{ width:36, height:36, borderRadius:6, objectFit:"cover" as const, objectPosition: d.focal_point||"50% 25%" }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color: d.published ? C.text : C.text3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{d.athlete_name}</div>
                  <div style={{ fontSize:11, color:C.text3 }}>{d.brand_name}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <button onClick={()=>toggleFeatured(d.id,true)} style={S.btnSm} title="Feature this deal">☆</button>
                  <button onClick={()=>router.push(`/dashboard/deals/${d.id}`)} style={S.btnSm}>Edit</button>
                  <Toggle on={d.published} onChange={v=>togglePublished(d.id,v)} />
                </div>
              </div>
              <button onClick={()=>router.push(`/dashboard/deals/${d.id}`)} style={{ ...S.btnSm, marginTop: d.image_url ? 8 : 0, width:"100%", justifyContent:"center" as const }}>Edit Photo</button>
            </div>
          ))}
        </SectionCard>

        {/* Create deal modal */}
        {showCreate && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setShowCreate(false)}>
            <div style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:14, padding:28, width:380, maxWidth:"90vw" }} onClick={e=>e.stopPropagation()}>
              <h3 style={{ margin:"0 0 18px", fontSize:16, fontWeight:800 }}>New Deal</h3>
              {createError && <div style={{ color:"#ff6b6b", fontSize:12, marginBottom:12 }}>{createError}</div>}
              <div style={{ marginBottom:12 }}>
                <label style={S.label}>Brand *</label>
                <select style={S.input} value={selectedBrandId} onChange={e=>setSelectedBrandId(e.target.value)}>
                  <option value="">Select a brand...</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={S.label}>Campaign</label>
                <select style={{ ...S.input, opacity: selectedBrandId ? 1 : 0.5 }} value={selectedCampaignId} onChange={e=>setSelectedCampaignId(e.target.value)} disabled={!selectedBrandId}>
                  <option value="">{selectedBrandId ? "Select a campaign (optional)..." : "Select a brand first"}</option>
                  {brandCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={S.label}>Athlete</label>
                <select style={{ ...S.input, opacity: selectedCampaignId ? 1 : 0.5 }} value={selectedAthleteId} onChange={e=>setSelectedAthleteId(e.target.value)} disabled={!selectedCampaignId}>
                  <option value="">{selectedCampaignId ? "Select an athlete (optional)..." : "Select a campaign first"}</option>
                  {campaignAthletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={S.label}>Athlete Name *</label>
                <input style={S.input} value={newAthlete} onChange={e=>setNewAthlete(e.target.value)} placeholder="e.g. John Doe" />
              </div>
              <div style={S.row2}>
                <div>
                  <label style={S.label}>Sport</label>
                  <input style={S.input} value={newSport} onChange={e=>setNewSport(e.target.value)} placeholder="e.g. Football" />
                </div>
                <div>
                  <label style={S.label}>School</label>
                  <input style={S.input} value={newSchool} onChange={e=>setNewSchool(e.target.value)} placeholder="e.g. Oregon State" />
                </div>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                <button onClick={()=>{ setShowCreate(false); setSelectedBrandId(""); setSelectedCampaignId(""); setSelectedAthleteId(""); setNewAthlete(""); setNewSport(""); setNewSchool(""); setCreateError(""); }} style={{ ...S.btnPreview, flex:1 }}>Cancel</button>
                <button
                  disabled={creating}
                  onClick={async ()=>{
                    if(!selectedBrandId||!newAthlete.trim()){ setCreateError("Brand and athlete name are required."); return; }
                    const selectedBrand = brands.find(b=>b.id===selectedBrandId);
                    setCreating(true); setCreateError("");
                    const { data, error } = await supabase.from("deals").insert({
                      brand_name: selectedBrand?.name||"",
                      brand_id: selectedBrandId,
                      source_campaign_id: selectedCampaignId||null,
                      athlete_name: newAthlete.trim(),
                      athlete_sport: newSport.trim()||null,
                      athlete_school: newSchool.trim()||null,
                      tier: "tier_1",
                      published: false,
                      featured: false,
                      sort_order: 0,
                    }).select("id").single();
                    if(error||!data){ setCreateError(error?.message||"Failed to create deal."); setCreating(false); return; }
                    setCreating(false); setShowCreate(false);
                    setSelectedBrandId(""); setSelectedCampaignId(""); setSelectedAthleteId("");
                    setNewAthlete(""); setNewSport(""); setNewSchool("");
                    router.push(`/dashboard/deals/${data.id}`);
                  }}
                  style={{ ...S.btnSave, flex:1, opacity: creating ? 0.6 : 1 }}
                >{creating ? "Creating..." : "Create Deal"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={S.actionsBar}>
        <a href="/deals" target="_blank" style={S.btnPreview}>↗ View Live</a>
      </div>

      {/* ── Carousel Editor Full-Screen ──────────────────────── */}
      {showCarouselEditor && (() => {
        const selId = heroOrder[carouselSelected];
        const selDeal = selId ? deals.find(d=>d.id===selId) : null;
        const selEntry = selId && carouselFocals[selId] ? carouselFocals[selId][carouselDevice] : { focal: "50% 20%", zoom: 1 };
        const selFocal = selEntry.focal;
        const selZoom = selEntry.zoom;
        const fpParts = (selFocal||"50% 20%").match(/(\d+)%\s+(\d+)%/);
        const fx = fpParts ? parseInt(fpParts[1]) : 50;
        const fy = fpParts ? parseInt(fpParts[2]) : 20;
        const devSizes = {desktop:{w:400,h:225},tablet:{w:240,h:320},mobile:{w:170,h:302}};
        const ds = devSizes[carouselDevice];
        return (
          <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#080808", display:"flex", flexDirection:"column" }}>
            {/* Header */}
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:900 }}>Featured Carousel Editor</div>
                <div style={{ fontSize:11, color:C.text3, marginTop:1 }}>Select athlete · drag photo · reorder with arrows</div>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <button onClick={()=>setShowCarouselEditor(false)} style={S.btnPreview}>Cancel</button>
                <button onClick={saveCarouselAll} disabled={carouselSaving} style={{ ...S.btnSave, opacity:carouselSaving?0.6:1 }}>{carouselSaving ? "Saving..." : "Save All"}</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
              {/* LEFT — athlete list */}
              <div style={{ width:220, borderRight:`1px solid ${C.border}`, overflowY:"auto", flexShrink:0 }}>
                {heroOrder.map((hid, idx) => {
                  const d = deals.find(x=>x.id===hid);
                  if (!d) return null;
                  const active = idx === carouselSelected;
                  return (
                    <div key={hid} onClick={()=>setCarouselSelected(idx)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", cursor:"pointer", borderLeft: active ? `3px solid ${C.orange}` : "3px solid transparent", background: active ? "rgba(215,63,9,0.06)" : "transparent", borderBottom:`1px solid ${C.border}` }}>
                      {d.image_url && <img src={d.image_url} alt="" style={{ width:36, height:46, borderRadius:6, objectFit:"cover" as const, objectPosition:d.focal_point||"50% 20%", flexShrink:0 }} />}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{d.athlete_name}</div>
                        <div style={{ fontSize:10, fontWeight:700, color:C.orange }}>{d.brand_name}</div>
                        <div style={{ fontSize:9, color:C.text3 }}>{[d.athlete_school,d.athlete_sport].filter(Boolean).join(" · ")}</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
                        <button onClick={e=>{e.stopPropagation();moveHero(idx,-1);}} disabled={idx===0} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:4, color:C.text3, fontSize:9, cursor:"pointer", padding:"1px 4px", opacity:idx===0?0.3:1 }}>▲</button>
                        <button onClick={e=>{e.stopPropagation();moveHero(idx,1);}} disabled={idx===heroOrder.length-1} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:4, color:C.text3, fontSize:9, cursor:"pointer", padding:"1px 4px", opacity:idx===heroOrder.length-1?0.3:1 }}>▼</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RIGHT — photo position editor */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                {/* Device tabs */}
                <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                  {(["desktop","tablet","mobile"] as const).map(dev => {
                    const a = carouselDevice===dev;
                    const ratios = {desktop:"16:9",tablet:"3:4",mobile:"9:16"};
                    return <button key={dev} onClick={()=>setCarouselDevice(dev)} style={{ flex:1, padding:"10px 0", background:"none", border:"none", borderBottom: a ? `2px solid ${C.orange}` : "2px solid transparent", color: a ? C.orange : C.text3, fontSize:11, fontWeight:700, cursor:"pointer", textTransform:"uppercase", letterSpacing:"0.06em" }}>{dev} <span style={{ fontSize:9, opacity:0.5 }}>{ratios[dev]}</span></button>;
                  })}
                </div>

                {/* Canvas */}
                <div style={{ flex:1, background:"#050505", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  {selDeal?.image_url ? (
                    <div
                      ref={carouselCanvas}
                      onMouseDown={()=>{carouselDragging.current=true;}}
                      onTouchStart={()=>{carouselDragging.current=true;}}
                      style={{ width:ds.w, height:ds.h, overflow:"hidden", borderRadius:8, border:`2px solid ${C.orange}`, cursor:"crosshair", position:"relative", flexShrink:0 }}
                    >
                      <img src={selDeal.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:`${fx}% ${fy}%`, transform: selZoom !== 1 ? `scale(${selZoom})` : undefined, transformOrigin:`${fx}% ${fy}%`, pointerEvents:"none" }} />
                      {/* Hero overlay gradients */}
                      <div style={{ position:"absolute", top:0, left:0, right:0, height:"30%", background:"linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)", pointerEvents:"none" }} />
                      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"45%", background:"linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)", pointerEvents:"none" }} />
                      {/* Title overlay */}
                      <div style={{ position:"absolute", top: carouselDevice==="mobile"?14:undefined, bottom: carouselDevice==="mobile"?undefined:10, left:10, pointerEvents:"none", zIndex:2 }}>
                        <div style={{ fontSize: carouselDevice==="mobile"?9:7, fontWeight:900, textTransform:"uppercase", lineHeight:0.92 }}>NIL<br/><span style={{ color:C.orange }}>Deal Tracker</span></div>
                      </div>
                      {/* Nameplate overlay */}
                      <div style={{ position:"absolute", bottom:6, left: carouselDevice==="mobile"?6:undefined, right: carouselDevice==="mobile"?6:6, pointerEvents:"none", zIndex:2 }}>
                        <div style={{ fontSize:5, fontWeight:800, textTransform:"uppercase", color:C.orange, letterSpacing:"0.1em" }}>{selDeal.brand_name}</div>
                        <div style={{ fontSize: carouselDevice==="mobile"?8:6, fontWeight:900, lineHeight:1 }}>{selDeal.athlete_name}</div>
                        <div style={{ fontSize:4, color:"rgba(255,255,255,0.5)" }}>{[selDeal.athlete_school,selDeal.athlete_sport].filter(Boolean).join(" · ")}</div>
                      </div>
                      {/* Focal dot */}
                      <div style={{ position:"absolute", left:`${fx}%`, top:`${fy}%`, transform:"translate(-50%,-50%)", width:14, height:14, borderRadius:"50%", background:C.orange, border:"2px solid #fff", pointerEvents:"none", boxShadow:"0 0 0 3px rgba(215,63,9,0.3)" }} />
                    </div>
                  ) : (
                    <div style={{ color:C.text3, fontSize:12 }}>No image for this athlete</div>
                  )}
                </div>

                {/* Controls bar */}
                <div style={{ padding:"8px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                  {[{l:"Face",y:20},{l:"Center",y:50}].map(p => (
                    <button key={p.l} onClick={()=>{ if(!selId) return; setCarouselFocals(prev=>({...prev,[selId]:{...prev[selId],[carouselDevice]:{...prev[selId][carouselDevice],focal:`50% ${p.y}%`}}})); }} style={{ padding:"4px 10px", borderRadius:6, border: fy===p.y && fx===50 ? `1px solid ${C.orange}` : `1px solid ${C.border2}`, background: fy===p.y && fx===50 ? "rgba(215,63,9,0.15)" : "none", color: fy===p.y && fx===50 ? C.orange : C.text3, fontSize:10, fontWeight:700, cursor:"pointer" }}>{p.l}</button>
                  ))}
                  <button onClick={()=>{ if(!selId) return; setCarouselFocals(prev=>({...prev,[selId]:{...prev[selId],[carouselDevice]:{focal:"50% 20%",zoom:1}}})); }} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${C.border2}`, background:"none", color:C.text3, fontSize:10, fontWeight:700, cursor:"pointer" }}>Reset</button>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:C.text3 }}>Zoom</span>
                    <input type="range" min={1} max={3} step={0.05} value={selZoom} onChange={e=>{ if(!selId) return; const z=parseFloat(e.target.value); setCarouselFocals(prev=>({...prev,[selId]:{...prev[selId],[carouselDevice]:{...prev[selId][carouselDevice],zoom:z}}})); }} style={{ width:80, accentColor:C.orange }} />
                    <span style={{ fontSize:10, color:C.text3, minWidth:32, textAlign:"right" as const }}>{selZoom.toFixed(2)}x</span>
                  </div>
                  <div style={{ flex:1 }} />
                  <span style={{ fontSize:10, color:C.text3 }}>{fx}% {fy}%</span>
                  {selId && (
                    <button onClick={()=>{ toggleFeatured(selId,false); setHeroOrder(h=>h.filter(x=>x!==selId)); if(carouselSelected>=heroOrder.length-1) setCarouselSelected(Math.max(0,heroOrder.length-2)); }} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid rgba(255,80,80,0.3)", background:"none", color:"#ff6b6b", fontSize:10, fontWeight:700, cursor:"pointer" }}>Unfeature</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Case Studies editor ──────────────────────────────────────
function CaseStudiesEditor({ onSaved }: { onSaved: () => void }) {
  return (
    <>
      <div style={S.editScroll}>
        <SectionCard title="Case Studies">
          <div style={{ fontSize:13, lineHeight:1.4, color:C.text2, marginBottom:16 }}>
            Manage case studies below. Published case studies appear on the public Case Studies page.
          </div>
          <div style={{ margin:"0 -20px", borderTop:`1px solid ${C.border}` }}>
            <CaseStudyList />
          </div>
        </SectionCard>
      </div>
      <div style={S.actionsBar}>
        <a href="/case-studies" target="_blank" style={S.btnPreview}>↗ View Live</a>
      </div>
    </>
  );
}

// ── Events editor ─────────────────────────────────────────────
function EventsEditor({ onSaved }: { onSaved: () => void }) {
  return (
    <>
      <div style={S.editScroll}>
        <div style={S.card}>
          <div style={S.cardTitle}>Events</div>
          <div style={{ fontSize:13, lineHeight:1.6, color:C.text2, marginBottom:20 }}>
            Event pages are built in the Page Creator and published here. Each event page can pull athlete, brand, and campaign data.
          </div>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
            <Link href="/dashboard?tab=ros" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:10, background:"#1a1a1a", border:`1px solid ${C.border}`, textDecoration:"none", color:C.text2, fontSize:13, fontWeight:700 }}>
              <span>Run of Shows</span>
              <span style={{ color:C.text3 }}>→</span>
            </Link>
            <Link href="/dashboard" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:10, background:"#1a1a1a", border:`1px solid ${C.border}`, textDecoration:"none", color:C.text2, fontSize:13, fontWeight:700 }}>
              <span>Page Creator</span>
              <span style={{ color:C.text3 }}>→</span>
            </Link>
          </div>
        </div>
      </div>
      <div style={S.actionsBar}>
        <a href="/dashboard" target="_blank" style={S.btnPreview}>↗ Open Page Creator</a>
      </div>
    </>
  );
}

// ── Main Website Editor ───────────────────────────────────────
function WebsiteEditorInner() {
  const router = useRouter();
  const params = useSearchParams();
  const activePage = (params.get("page") || "homepage") as string;
  const [previewKey, setPreviewKey] = useState(0);
  const [toast, setToast] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewSize, setPreviewSize] = useState<"desktop"|"tablet"|"mobile">("desktop");

  const setPage = (p: string) => router.push(`/dashboard/website?page=${p}`, { scroll: false });

  const handleSaved = useCallback(() => {
    setPreviewKey(k => k + 1);
    setToast("Saved ✓");
    setTimeout(() => setToast(""), 2000);
  }, []);

  const activeMeta = PAGES.find(p => p.key === activePage) || PAGES[0];
  const previewUrl = activeMeta.url;

  return (
    <div style={S.shell}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarLogo}>POSTGAME</div>
          <div style={S.sidebarSub}>Website Editor</div>
        </div>

        <div style={{ overflowY:"auto" as const, flex:1 }}>
          {["Public Pages", "Services"].map(section => (
            <div key={section}>
              <div style={S.sidebarSection}>{section}</div>
              {PAGES.filter(p => p.section === section).map(p => (
                <div key={p.key} style={S.sidebarItem(activePage === p.key)} onClick={() => setPage(p.key)}>
                  <span style={{ fontSize:14 }}>{p.icon}</span>
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
          ))}

          <div style={S.sidebarSection}>Private Tools</div>
          <div style={S.sidebarItem(false)} onClick={() => router.push("/dashboard")}>
            <span style={{ fontSize:14 }}>📋</span>
            <span>Page Creator</span>
          </div>
          <div style={S.sidebarItem(false)} onClick={() => router.push("/dashboard/brands")}>
            <span style={{ fontSize:14 }}>🏷️</span>
            <span>Brands</span>
          </div>
          <div style={S.sidebarItem(false)} onClick={() => router.push("/media-library")}>
            <span style={{ fontSize:14 }}>🖼️</span>
            <span>Media Library</span>
          </div>
        </div>

        <div style={S.sidebarFooter}>
          <a href="/dashboard" style={S.sidebarLink}>← Page Creator</a>
          <a href="/dashboard/brands" style={S.sidebarLink}>Brands & Assets</a>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        {/* Edit pane */}
        <div style={S.editPane}>
          <div style={S.editHeader}>
            <div>
              <div style={S.editTitle}>{activeMeta.label}</div>
              <div style={S.editMeta}>Edit content · changes save to Supabase</div>
            </div>
          </div>

          {activePage === "homepage"        && <HomepageEditor onSaved={handleSaved} />}
          {activePage === "team"            && <TeamEditor onSaved={handleSaved} />}
          {activePage === "contact"         && <ContactEditor onSaved={handleSaved} />}
          {activePage === "clients"         && <ClientsEditor onSaved={handleSaved} />}
          {activePage === "campaigns"       && <CampaignsEditor onSaved={handleSaved} />}
          {activePage === "deals"           && <DealsEditor onSaved={handleSaved} />}
          {activePage === "press"           && <PressEditor onSaved={handleSaved} />}
          {activePage === "case-studies"    && <CaseStudiesEditor onSaved={handleSaved} />}
          {activePage === "events"          && <EventsEditor onSaved={handleSaved} />}
          {activePage === "svc-elevated"    && <ServicesEditor svc="elevated" onSaved={handleSaved} />}
          {activePage === "svc-scaled"      && <ServicesEditor svc="scaled" onSaved={handleSaved} />}
          {activePage === "svc-always-on"   && <ServicesEditor svc="always-on" onSaved={handleSaved} />}
          {activePage === "svc-experiential"&& <ServicesEditor svc="experiential" onSaved={handleSaved} />}
        </div>

        {/* Preview pane */}
        <div style={S.previewPane}>
          <div style={S.previewHeader}>
            <span style={S.previewLabel}>Live Preview — {previewUrl}</span>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <button onClick={() => setPreviewKey(k=>k+1)} style={{ ...S.btnSm, fontSize:11 }}>↺ Refresh</button>
              <a href={previewUrl} target="_blank" style={{ fontSize:11, color:C.text3, textDecoration:"none", fontWeight:700 }}>Open ↗</a>
              <span style={{ width:1, height:14, background:C.border2, margin:"0 2px" }} />
              {(["desktop","tablet","mobile"] as const).map(s => (
                <button key={s} onClick={()=>setPreviewSize(s)} style={{ ...S.btnSm, fontSize:11, color: previewSize===s ? C.orange : C.text3, borderColor: previewSize===s ? C.orange : C.border2 }}>
                  {s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ position:"absolute", top:40, left:0, right:0, bottom:0, background:"#0a0a0a", display:"flex", justifyContent:"center", overflowX:"auto" }}>
            <iframe
              key={previewKey}
              ref={iframeRef}
              src={previewUrl}
              style={{ width: previewSize==="desktop" ? "100%" : previewSize==="tablet" ? 768 : 390, height:"100%", border:"none", background:"#000", flexShrink:0 }}
              title="Page Preview"
            />
          </div>
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

export default function WebsiteEditorPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.4)", fontFamily:"Arial,sans-serif" }}>Loading editor...</div>}>
      <WebsiteEditorInner />
    </Suspense>
  );
}
