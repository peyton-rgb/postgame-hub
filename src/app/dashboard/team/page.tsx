"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

const S = {
  page: { minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "Arial, sans-serif", padding: "32px 48px" } as const,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 } as const,
  h1: { fontSize: 28, fontWeight: 900, margin: 0 } as const,
  headerActions: { display: "flex", gap: 12, alignItems: "center" } as const,
  btnOutline: { padding: "8px 20px", border: "1.5px solid #D73F09", borderRadius: 8, background: "none", color: "#D73F09", fontSize: 12, fontWeight: 800, cursor: "pointer", textDecoration: "none", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  btnSave: { padding: "10px 28px", background: "#D73F09", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  tabs: { display: "flex", gap: 8, marginBottom: 32 } as const,
  tab: (active: boolean) => ({ padding: "8px 20px", borderRadius: 20, border: "none", background: active ? "#D73F09" : "#141414", color: active ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }),
  card: { background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 24, marginBottom: 16 } as const,
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 },
  input: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", boxSizing: "border-box" as const },
  row: { display: "flex", gap: 16, marginBottom: 16 } as const,
  col: { flex: 1 } as const,
  btnSmall: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnDanger: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,100,100,0.3)", background: "none", color: "#ff6b6b", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnAdd: { padding: "8px 16px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 12 },
  itemCard: { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 16, marginBottom: 10 } as const,
  toast: { position: "fixed" as const, bottom: 24, right: 24, background: "#1a1a1a", border: "1px solid #D73F09", borderRadius: 12, padding: "12px 24px", color: "#D73F09", fontSize: 13, fontWeight: 700, zIndex: 9999 },
  mb: (n: number) => ({ marginBottom: n }),
  sectionTitle: { fontSize: 16, fontWeight: 800, margin: 0 } as const,
};

interface TeamMember {
  name: string;
  role: string;
  school: string;
  photo_url: string;
  instagram: string;
  linkedin: string;
}

interface ValueItem {
  num: string;
  title: string;
  desc: string;
}

interface OfficeItem {
  badge: string;
  city: string;
  address: string;
}

const DEFAULT_TEAM: TeamMember[] = [
  { name: "Bill Jula", role: "CEO & Founder", school: "Penn State University", photo_url: "/drafts/bill-jula.png", instagram: "https://www.instagram.com/billjula/", linkedin: "https://www.linkedin.com/in/billjula/" },
  { name: "Peyton Jula", role: "President", school: "Penn State University", photo_url: "/drafts/peyton-jula.png", instagram: "https://www.instagram.com/peytonjula/", linkedin: "https://www.linkedin.com/in/peytonjula/" },
  { name: "Jake Taraska", role: "Director of Operations", school: "Penn State University", photo_url: "/drafts/jake-taraska.png", instagram: "", linkedin: "" },
  { name: "Danny Morrissey", role: "Creative Director", school: "Penn State University", photo_url: "/drafts/danny-morrissey.png", instagram: "", linkedin: "" },
];

const DEFAULT_VALUES: ValueItem[] = [
  { num: "01", title: "Athletes First", desc: "Every team member is a former college athlete. We understand the grind, the schedule, and the opportunity." },
  { num: "02", title: "Execute at Scale", desc: "394 campaigns across 69 brands. We've built the playbook for NIL at a level nobody else can match." },
  { num: "03", title: "Brand Obsessed", desc: "We treat every brand partner's reputation like our own. Quality content, on time, on brand, every time." },
  { num: "04", title: "Move Fast", desc: "College sports don't wait. We operate on game-speed timelines and pride ourselves on speed to market." },
];

const DEFAULT_OFFICES: OfficeItem[] = [
  { badge: "Headquarters", city: "Sarasota, FL", address: "1570 Boulevard of the Arts\nSuite 130-3\nSarasota, FL 34236" },
  { badge: "East Coast", city: "Philadelphia, PA", address: "50 South 16th Street\nPhiladelphia, PA 19102" },
  { badge: "Southeast", city: "Tampa, FL", address: "1905 North Market Street\nTampa, FL 33602" },
];

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={S.mb(12)}>
      <label style={S.label}>{label}</label>
      <input style={S.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function TeamEditorPage() {
  const [tab, setTab] = useState<"team" | "values" | "offices" | "cta">("team");
  const [team, setTeam] = useState<TeamMember[]>(DEFAULT_TEAM);
  const [values, setValues] = useState<ValueItem[]>(DEFAULT_VALUES);
  const [offices, setOffices] = useState<OfficeItem[]>(DEFAULT_OFFICES);
  const [ctaTitle, setCtaTitle] = useState("Want to Join\nthe Team?");
  const [ctaSub, setCtaSub] = useState("We're always looking for former athletes and sports marketers who want to build the future of NIL.");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserSupabase();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("pages").select("settings").eq("slug", "team").single();
      if (data?.settings) {
        const s = data.settings as Record<string, unknown>;
        if (s.team) setTeam(s.team as TeamMember[]);
        if (s.values) setValues(s.values as ValueItem[]);
        if (s.offices) setOffices(s.offices as OfficeItem[]);
        if (s.cta_title) setCtaTitle(s.cta_title as string);
        if (s.cta_sub) setCtaSub(s.cta_sub as string);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    const settings = { team, values, offices, cta_title: ctaTitle, cta_sub: ctaSub };
    const { error } = await supabase
      .from("pages")
      .upsert({ slug: "team", title: "Team", published: true, settings }, { onConflict: "slug" });
    setSaving(false);
    if (error) { setToast("Error saving"); } else { setToast("Saved!"); }
    setTimeout(() => setToast(""), 2500);
  }

  // Team CRUD
  const updateMember = (i: number, key: keyof TeamMember, val: string) => {
    setTeam((prev) => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m));
  };
  const addMember = () => setTeam((prev) => [...prev, { name: "", role: "", school: "", photo_url: "", instagram: "", linkedin: "" }]);
  const removeMember = (i: number) => setTeam((prev) => prev.filter((_, idx) => idx !== i));
  const moveMember = (i: number, dir: -1 | 1) => {
    const next = [...team];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setTeam(next);
  };

  // Values CRUD
  const updateValue = (i: number, key: keyof ValueItem, val: string) => setValues((prev) => prev.map((v, idx) => idx === i ? { ...v, [key]: val } : v));
  const addValue = () => setValues((prev) => [...prev, { num: String(prev.length + 1).padStart(2, "0"), title: "", desc: "" }]);
  const removeValue = (i: number) => setValues((prev) => prev.filter((_, idx) => idx !== i));

  // Offices CRUD
  const updateOffice = (i: number, key: keyof OfficeItem, val: string) => setOffices((prev) => prev.map((o, idx) => idx === i ? { ...o, [key]: val } : o));
  const addOffice = () => setOffices((prev) => [...prev, { badge: "", city: "", address: "" }]);
  const removeOffice = (i: number) => setOffices((prev) => prev.filter((_, idx) => idx !== i));

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <Link href="/dashboard" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textDecoration: "none", marginBottom: 8, display: "block" }}>← Dashboard</Link>
          <h1 style={S.h1}>Team Page Editor</h1>
        </div>
        <div style={S.headerActions}>
          <a href="/about/team" target="_blank" style={S.btnOutline}>Preview</a>
          <button style={S.btnSave} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>

      <div style={S.tabs}>
        {(["team", "values", "offices", "cta"] as const).map((t) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t === "team" ? "Team Members" : t === "values" ? "Values" : t === "offices" ? "Offices" : "CTA"}
          </button>
        ))}
      </div>

      {/* Team Members */}
      {tab === "team" && (
        <div>
          {team.map((member, i) => (
            <div key={i} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{member.name || `Member ${i + 1}`}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.btnSmall} onClick={() => moveMember(i, -1)} disabled={i === 0}>↑</button>
                  <button style={S.btnSmall} onClick={() => moveMember(i, 1)} disabled={i === team.length - 1}>↓</button>
                  <button style={S.btnDanger} onClick={() => removeMember(i)}>Remove</button>
                </div>
              </div>
              <div style={S.row}>
                <div style={S.col}><Field label="Name" value={member.name} onChange={(v) => updateMember(i, "name", v)} placeholder="Bill Jula" /></div>
                <div style={S.col}><Field label="Role / Title" value={member.role} onChange={(v) => updateMember(i, "role", v)} placeholder="CEO & Founder" /></div>
              </div>
              <div style={S.row}>
                <div style={S.col}><Field label="School" value={member.school} onChange={(v) => updateMember(i, "school", v)} placeholder="Penn State University" /></div>
                <div style={S.col}><Field label="Photo URL" value={member.photo_url} onChange={(v) => updateMember(i, "photo_url", v)} placeholder="/drafts/bill-jula.png" /></div>
              </div>
              <div style={S.row}>
                <div style={S.col}><Field label="Instagram URL" value={member.instagram} onChange={(v) => updateMember(i, "instagram", v)} placeholder="https://instagram.com/..." /></div>
                <div style={S.col}><Field label="LinkedIn URL" value={member.linkedin} onChange={(v) => updateMember(i, "linkedin", v)} placeholder="https://linkedin.com/in/..." /></div>
              </div>
            </div>
          ))}
          <button style={S.btnAdd} onClick={addMember}>+ Add Team Member</button>
        </div>
      )}

      {/* Values */}
      {tab === "values" && (
        <div>
          {values.map((v, i) => (
            <div key={i} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontWeight: 700 }}>{v.title || `Value ${i + 1}`}</span>
                <button style={S.btnDanger} onClick={() => removeValue(i)}>Remove</button>
              </div>
              <div style={S.row}>
                <div style={{ width: 80 }}><Field label="Number" value={v.num} onChange={(val) => updateValue(i, "num", val)} placeholder="01" /></div>
                <div style={S.col}><Field label="Title" value={v.title} onChange={(val) => updateValue(i, "title", val)} placeholder="Athletes First" /></div>
              </div>
              <div style={S.mb(0)}>
                <label style={S.label}>Description</label>
                <textarea
                  style={{ width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", minHeight: 80, resize: "vertical" as const, boxSizing: "border-box" as const }}
                  value={v.desc}
                  onChange={(e) => updateValue(i, "desc", e.target.value)}
                />
              </div>
            </div>
          ))}
          <button style={S.btnAdd} onClick={addValue}>+ Add Value</button>
        </div>
      )}

      {/* Offices */}
      {tab === "offices" && (
        <div>
          {offices.map((o, i) => (
            <div key={i} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontWeight: 700 }}>{o.city || `Office ${i + 1}`}</span>
                <button style={S.btnDanger} onClick={() => removeOffice(i)}>Remove</button>
              </div>
              <div style={S.row}>
                <div style={S.col}><Field label="Badge Label" value={o.badge} onChange={(v) => updateOffice(i, "badge", v)} placeholder="Headquarters" /></div>
                <div style={S.col}><Field label="City" value={o.city} onChange={(v) => updateOffice(i, "city", v)} placeholder="Sarasota, FL" /></div>
              </div>
              <div>
                <label style={S.label}>Address</label>
                <textarea
                  style={{ width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", minHeight: 80, resize: "vertical" as const, boxSizing: "border-box" as const }}
                  value={o.address}
                  onChange={(e) => updateOffice(i, "address", e.target.value)}
                />
              </div>
            </div>
          ))}
          <button style={S.btnAdd} onClick={addOffice}>+ Add Office</button>
        </div>
      )}

      {/* CTA */}
      {tab === "cta" && (
        <div style={S.card}>
          <h3 style={{ ...S.sectionTitle, marginBottom: 24 }}>Page CTA Block</h3>
          <div style={S.mb(16)}>
            <label style={S.label}>CTA Title</label>
            <input style={S.input} value={ctaTitle} onChange={(e) => setCtaTitle(e.target.value)} placeholder="Want to Join the Team?" />
          </div>
          <div style={S.mb(0)}>
            <label style={S.label}>CTA Subtitle</label>
            <textarea
              style={{ width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", minHeight: 80, resize: "vertical" as const, boxSizing: "border-box" as const }}
              value={ctaSub}
              onChange={(e) => setCtaSub(e.target.value)}
            />
          </div>
        </div>
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
