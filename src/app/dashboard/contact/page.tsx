"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

const S = {
  page: { minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "Arial, sans-serif", padding: "32px 48px" } as const,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 } as const,
  h1: { fontSize: 28, fontWeight: 900, margin: 0 } as const,
  headerActions: { display: "flex", gap: 12 } as const,
  btnOutline: { padding: "8px 20px", border: "1.5px solid #D73F09", borderRadius: 8, background: "none", color: "#D73F09", fontSize: 12, fontWeight: 800, cursor: "pointer", textDecoration: "none", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  btnSave: { padding: "10px 28px", background: "#D73F09", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  card: { background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 24, marginBottom: 16 } as const,
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 },
  input: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", minHeight: 80, resize: "vertical" as const, boxSizing: "border-box" as const },
  row: { display: "flex", gap: 16, marginBottom: 16 } as const,
  col: { flex: 1 } as const,
  btnDanger: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,100,100,0.3)", background: "none", color: "#ff6b6b", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnAdd: { padding: "8px 16px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 12 },
  toast: { position: "fixed" as const, bottom: 24, right: 24, background: "#1a1a1a", border: "1px solid #D73F09", borderRadius: 12, padding: "12px 24px", color: "#D73F09", fontSize: 13, fontWeight: 700, zIndex: 9999 },
  mb: (n: number) => ({ marginBottom: n }),
  sectionLabel: { fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 20 },
};

interface Office { badge: string; city: string; address: string; }

const DEFAULT_OFFICES: Office[] = [
  { badge: "Headquarters", city: "Sarasota, FL", address: "1570 Boulevard of the Arts\nSuite 130-3\nSarasota, FL 34236" },
  { badge: "East Coast", city: "Philadelphia, PA", address: "50 South 16th Street\nPhiladelphia, PA 19102" },
  { badge: "Southeast", city: "Tampa, FL", address: "1905 North Market Street\nTampa, FL 33602" },
];

function Field({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean }) {
  return (
    <div style={S.mb(14)}>
      <label style={S.label}>{label}</label>
      {textarea
        ? <textarea style={S.textarea} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={S.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  );
}

export default function ContactEditorPage() {
  const [heroTitle, setHeroTitle] = useState("Let's Build Something Together");
  const [heroDesc, setHeroDesc] = useState("Whether you're a brand looking to run NIL campaigns or a marketer curious about our network — we'd love to hear from you.");
  const [email, setEmail] = useState("hello@postgame.co");
  const [infoTitle, setInfoTitle] = useState("We're Ready When You Are");
  const [infoDesc, setInfoDesc] = useState("Our team moves fast. Most inquiries get a response within 24 hours — often same day.");
  const [offices, setOffices] = useState<Office[]>(DEFAULT_OFFICES);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("pages").select("settings").eq("slug", "contact").single();
      if (data?.settings) {
        const s = data.settings as Record<string, unknown>;
        if (s.hero_title) setHeroTitle(s.hero_title as string);
        if (s.hero_desc) setHeroDesc(s.hero_desc as string);
        if (s.email) setEmail(s.email as string);
        if (s.info_title) setInfoTitle(s.info_title as string);
        if (s.info_desc) setInfoDesc(s.info_desc as string);
        if (s.offices) setOffices(s.offices as Office[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    await supabase.from("pages").upsert({
      slug: "contact", title: "Contact", published: true,
      settings: { hero_title: heroTitle, hero_desc: heroDesc, email, info_title: infoTitle, info_desc: infoDesc, offices }
    }, { onConflict: "slug" });
    setSaving(false);
    setToast("Saved!");
    setTimeout(() => setToast(""), 2500);
  }

  const updateOffice = (i: number, key: keyof Office, val: string) =>
    setOffices((prev) => prev.map((o, idx) => idx === i ? { ...o, [key]: val } : o));
  const addOffice = () => setOffices((prev) => [...prev, { badge: "", city: "", address: "" }]);
  const removeOffice = (i: number) => setOffices((prev) => prev.filter((_, idx) => idx !== i));

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <Link href="/dashboard/homepage" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textDecoration: "none", marginBottom: 8, display: "block" }}>← Website Editor</Link>
          <h1 style={S.h1}>Contact Page Editor</h1>
        </div>
        <div style={S.headerActions}>
          <a href="/contact" target="_blank" style={S.btnOutline}>Preview</a>
          <button style={S.btnSave} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>

      {/* Hero */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Hero</div>
        <Field label="Page Title" value={heroTitle} onChange={setHeroTitle} placeholder="Let's Build Something Together" />
        <Field label="Description" value={heroDesc} onChange={setHeroDesc} textarea />
      </div>

      {/* Contact Info */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Contact Info Panel</div>
        <Field label="Contact Email" value={email} onChange={setEmail} placeholder="hello@postgame.co" />
        <Field label="Panel Title" value={infoTitle} onChange={setInfoTitle} placeholder="We're Ready When You Are" />
        <Field label="Panel Description" value={infoDesc} onChange={setInfoDesc} textarea />
      </div>

      {/* Offices */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Office Locations</div>
        {offices.map((o, i) => (
          <div key={i} style={{ background: "#1a1a1a", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>{o.city || `Office ${i + 1}`}</span>
              <button style={S.btnDanger} onClick={() => removeOffice(i)}>Remove</button>
            </div>
            <div style={S.row}>
              <div style={S.col}><Field label="Badge" value={o.badge} onChange={(v) => updateOffice(i, "badge", v)} placeholder="Headquarters" /></div>
              <div style={S.col}><Field label="City" value={o.city} onChange={(v) => updateOffice(i, "city", v)} placeholder="Sarasota, FL" /></div>
            </div>
            <label style={S.label}>Address</label>
            <textarea style={S.textarea} value={o.address} onChange={(e) => updateOffice(i, "address", e.target.value)} />
          </div>
        ))}
        <button style={S.btnAdd} onClick={addOffice}>+ Add Office</button>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
