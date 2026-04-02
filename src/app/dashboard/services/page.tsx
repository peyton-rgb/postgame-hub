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
  tab: (active: boolean) => ({ padding: "8px 20px", borderRadius: 20, border: "none", background: active ? "#D73F09" : "#141414", color: active ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, cursor: "pointer" }),
  card: { background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 24, marginBottom: 16 } as const,
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 },
  input: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", minHeight: 80, resize: "vertical" as const, boxSizing: "border-box" as const },
  row: { display: "flex", gap: 16, marginBottom: 16 } as const,
  col: { flex: 1 } as const,
  btnSmall: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnDanger: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,100,100,0.3)", background: "none", color: "#ff6b6b", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnAdd: { padding: "8px 16px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 12 },
  toast: { position: "fixed" as const, bottom: 24, right: 24, background: "#1a1a1a", border: "1px solid #D73F09", borderRadius: 12, padding: "12px 24px", color: "#D73F09", fontSize: 13, fontWeight: 700, zIndex: 9999 },
  mb: (n: number) => ({ marginBottom: n }),
};

type ServiceTab = "elevated" | "scaled" | "always-on" | "experiential";

interface Feature { num: string; title: string; desc: string; }
interface ProcessStep { num: string; title: string; desc: string; }
interface ServiceData {
  hero_tag: string;
  hero_title: string;
  hero_desc: string;
  features: Feature[];
  process: ProcessStep[];
  cta_title: string;
  cta_sub: string;
}

const DEFAULTS: Record<ServiceTab, ServiceData> = {
  elevated: {
    hero_tag: "Elevated NIL",
    hero_title: "Tier 1 Athletes.\nMaximum Impact.",
    hero_desc: "Our Elevated service puts your brand in the hands of the most recognizable college athletes in the country.",
    features: [
      { num: "01", title: "Tier 1 Athlete Selection", desc: "Access to our hand-curated network of elite NIL athletes." },
      { num: "02", title: "Full Creative Direction", desc: "Our team handles scripting, briefing, and creative oversight." },
      { num: "03", title: "Multi-Platform Distribution", desc: "TikTok, Instagram Reels, YouTube Shorts, and X." },
      { num: "04", title: "Performance Reporting", desc: "Full campaign dashboard with real-time metrics." },
      { num: "05", title: "Rights & Licensing", desc: "Full usage rights to all athlete content." },
      { num: "06", title: "Dedicated Campaign Lead", desc: "One point of contact from kickoff to recap." },
    ],
    process: [
      { num: "01", title: "Strategy & Athlete Selection", desc: "We align on goals, audience, and timeline." },
      { num: "02", title: "Creative Briefing", desc: "Scripts, talking points, and shot lists. You approve before filming." },
      { num: "03", title: "Production & Posting", desc: "We QA every deliverable before it goes live." },
      { num: "04", title: "Launch & Amplification", desc: "Content goes live on schedule. We can boost top performers." },
      { num: "05", title: "Recap & Reporting", desc: "Full recap within 5 business days of completion." },
    ],
    cta_title: "Ready to Run Elevated?",
    cta_sub: "Let's build a campaign with the athletes your audience already knows.",
  },
  scaled: {
    hero_tag: "Scaled NIL",
    hero_title: "More Athletes.\nMore Markets.\nMore Reach.",
    hero_desc: "Scaled campaigns activate 10–500+ athletes simultaneously across every major conference.",
    features: [
      { num: "01", title: "Multi-School Activation", desc: "Simultaneously activate athletes across 5 to 500+ schools." },
      { num: "02", title: "Centralized Creative", desc: "One brief, one approval cycle, deployed across every athlete." },
      { num: "03", title: "Automated Coordination", desc: "Our platform handles contracting, payments, briefs, and deadlines." },
      { num: "04", title: "Geographic Targeting", desc: "Target by conference, state, or any combination." },
      { num: "05", title: "Aggregated Reporting", desc: "One unified dashboard across all athletes and posts." },
      { num: "06", title: "Volume Pricing", desc: "The more athletes you activate, the lower your cost per post." },
    ],
    process: [],
    cta_title: "Ready to Go Nationwide?",
    cta_sub: "We've run campaigns across every major conference. Let's build your footprint.",
  },
  "always-on": {
    hero_tag: "Always On",
    hero_title: "Year-Round\nAthlete Coverage.",
    hero_desc: "A retainer model built for brands that want to stay top of mind all season long.",
    features: [
      { num: "01", title: "Monthly Content Cadence", desc: "A guaranteed number of athlete posts per month." },
      { num: "02", title: "Rotating Athlete Roster", desc: "We rotate athletes to keep content fresh and reach new audiences." },
      { num: "03", title: "Seasonal Moments", desc: "We align content with the sports calendar — always relevant." },
      { num: "04", title: "Dedicated Strategy Lead", desc: "One Postgame strategist owns your account and plans 30 days out." },
      { num: "05", title: "Monthly Reporting", desc: "A full performance recap every month." },
      { num: "06", title: "Retainer Pricing", desc: "Predictable monthly cost. No surprises." },
    ],
    process: [],
    cta_title: "Stay In the Game All Year Long.",
    cta_sub: "The brands that win with NIL are the ones that show up consistently.",
  },
  experiential: {
    hero_tag: "Experiential",
    hero_title: "In-Person.\nOn Camera.\nUnforgettable.",
    hero_desc: "Experiential campaigns bring your brand directly into the athlete's world.",
    features: [
      { num: "01", title: "Event Concept & Planning", desc: "We develop the full concept end to end." },
      { num: "02", title: "On-Site Production", desc: "Our production crew captures everything in one shoot day." },
      { num: "03", title: "Tunnel Walks & Game Day", desc: "Game day activations at Power 4 stadiums and arenas." },
      { num: "04", title: "Campus Activations", desc: "Pop-ups, product drops, and fan events on campus." },
      { num: "05", title: "Content Production Package", desc: "Every event generates a full content library." },
      { num: "06", title: "PR & Press Coordination", desc: "We handle media outreach and press coordination." },
    ],
    process: [],
    cta_title: "Let's Create a Moment.",
    cta_sub: "The best brand content comes from real experiences. Let's build one together.",
  },
};

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

export default function ServicesEditorPage() {
  const [svcTab, setSvcTab] = useState<ServiceTab>("elevated");
  const [data, setData] = useState<Record<ServiceTab, ServiceData>>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserSupabase();

  useEffect(() => {
    async function load() {
      const { data: row } = await supabase.from("pages").select("settings").eq("slug", "services").single();
      if (row?.settings) setData(row.settings as Record<ServiceTab, ServiceData>);
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    await supabase.from("pages").upsert({ slug: "services", title: "Services", published: true, settings: data }, { onConflict: "slug" });
    setSaving(false);
    setToast("Saved!");
    setTimeout(() => setToast(""), 2500);
  }

  const current = data[svcTab];
  const update = (key: keyof ServiceData, val: unknown) =>
    setData((prev) => ({ ...prev, [svcTab]: { ...prev[svcTab], [key]: val } }));

  const updateFeature = (i: number, key: keyof Feature, val: string) =>
    setData((prev) => {
      const features = [...prev[svcTab].features];
      features[i] = { ...features[i], [key]: val };
      return { ...prev, [svcTab]: { ...prev[svcTab], features } };
    });
  const addFeature = () => update("features", [...current.features, { num: String(current.features.length + 1).padStart(2, "0"), title: "", desc: "" }]);
  const removeFeature = (i: number) => update("features", current.features.filter((_, idx) => idx !== i));

  const updateProcess = (i: number, key: keyof ProcessStep, val: string) =>
    setData((prev) => {
      const process = [...prev[svcTab].process];
      process[i] = { ...process[i], [key]: val };
      return { ...prev, [svcTab]: { ...prev[svcTab], process } };
    });
  const addProcess = () => update("process", [...current.process, { num: String(current.process.length + 1).padStart(2, "0"), title: "", desc: "" }]);
  const removeProcess = (i: number) => update("process", current.process.filter((_, idx) => idx !== i));

  const SERVICE_LINKS: Record<ServiceTab, string> = {
    elevated: "/services/elevated",
    scaled: "/services/scaled",
    "always-on": "/services/always-on",
    experiential: "/services/experiential",
  };

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <Link href="/dashboard/homepage" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textDecoration: "none", marginBottom: 8, display: "block" }}>← Website Editor</Link>
          <h1 style={S.h1}>Services Editor</h1>
        </div>
        <div style={S.headerActions}>
          <a href={SERVICE_LINKS[svcTab]} target="_blank" style={S.btnOutline}>Preview Page</a>
          <button style={S.btnSave} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>

      {/* Service selector */}
      <div style={S.tabs}>
        {(["elevated", "scaled", "always-on", "experiential"] as ServiceTab[]).map((t) => (
          <button key={t} style={S.tab(svcTab === t)} onClick={() => setSvcTab(t)}>
            {t === "always-on" ? "Always On" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Hero */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Hero Section</div>
        <Field label="Service Tag" value={current.hero_tag} onChange={(v) => update("hero_tag", v)} placeholder="Elevated NIL" />
        <Field label="Hero Title (use \\n for line breaks)" value={current.hero_title} onChange={(v) => update("hero_title", v)} textarea placeholder="Tier 1 Athletes.\nMaximum Impact." />
        <Field label="Hero Description" value={current.hero_desc} onChange={(v) => update("hero_desc", v)} textarea placeholder="Describe this service..." />
      </div>

      {/* Features */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Features / What&apos;s Included</div>
        {current.features.map((f, i) => (
          <div key={i} style={{ background: "#1a1a1a", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{f.title || `Feature ${i + 1}`}</span>
              <button style={S.btnDanger} onClick={() => removeFeature(i)}>Remove</button>
            </div>
            <div style={S.row}>
              <div style={{ width: 80 }}>
                <label style={S.label}>Num</label>
                <input style={S.input} value={f.num} onChange={(e) => updateFeature(i, "num", e.target.value)} />
              </div>
              <div style={S.col}>
                <label style={S.label}>Title</label>
                <input style={S.input} value={f.title} onChange={(e) => updateFeature(i, "title", e.target.value)} />
              </div>
            </div>
            <label style={S.label}>Description</label>
            <textarea style={S.textarea} value={f.desc} onChange={(e) => updateFeature(i, "desc", e.target.value)} />
          </div>
        ))}
        <button style={S.btnAdd} onClick={addFeature}>+ Add Feature</button>
      </div>

      {/* Process (elevated only, but available for all) */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Process Steps (optional)</div>
        {current.process.map((p, i) => (
          <div key={i} style={{ background: "#1a1a1a", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{p.title || `Step ${i + 1}`}</span>
              <button style={S.btnDanger} onClick={() => removeProcess(i)}>Remove</button>
            </div>
            <div style={S.row}>
              <div style={{ width: 80 }}>
                <label style={S.label}>Num</label>
                <input style={S.input} value={p.num} onChange={(e) => updateProcess(i, "num", e.target.value)} />
              </div>
              <div style={S.col}>
                <label style={S.label}>Title</label>
                <input style={S.input} value={p.title} onChange={(e) => updateProcess(i, "title", e.target.value)} />
              </div>
            </div>
            <label style={S.label}>Description</label>
            <textarea style={S.textarea} value={p.desc} onChange={(e) => updateProcess(i, "desc", e.target.value)} />
          </div>
        ))}
        <button style={S.btnAdd} onClick={addProcess}>+ Add Process Step</button>
      </div>

      {/* CTA */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>CTA Block</div>
        <Field label="CTA Title" value={current.cta_title} onChange={(v) => update("cta_title", v)} />
        <Field label="CTA Subtitle" value={current.cta_sub} onChange={(v) => update("cta_sub", v)} textarea />
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
