"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import CampaignMediaPicker from "@/components/CampaignMediaPicker";
import Link from "next/link";

const PAGE_ID = "1e2328e1-26d0-41c5-8876-8af003a22a6a";

type Tab = "hero" | "sections" | "settings";

interface StatItem { value: string; label: string }
interface CampaignItem { brand: string; name: string; meta: string; gradient: string; featured: boolean; image_url?: string; media_type?: "image" | "video"; aspect_ratio?: "landscape" | "portrait"; campaign_id?: string; focal_point?: string }
interface AthleteItem { name: string; sport: string; school: string; image_url?: string; brand?: string; brand_id?: string; deal_id?: string; gradient?: string }
interface BrandItem { name: string; logo_url: string }
interface ServiceItem { name: string; desc: string; accent: boolean }

interface PageData {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  settings: Record<string, unknown>;
}

interface SectionData {
  id: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  sort_order: number;
}

// ── Styles ──────────────────────────────────────────────────
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
  textarea: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none", minHeight: 80, resize: "vertical" as const, boxSizing: "border-box" as const },
  row: { display: "flex", gap: 16, marginBottom: 16 } as const,
  col: { flex: 1 } as const,
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" } as const,
  sectionTitle: { fontSize: 16, fontWeight: 800, margin: 0 } as const,
  toggle: (on: boolean) => ({ width: 40, height: 22, borderRadius: 11, background: on ? "#D73F09" : "#333", border: "none", cursor: "pointer", position: "relative" as const, transition: "background 0.2s", padding: 0 }),
  toggleDot: (on: boolean) => ({ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute" as const, top: 3, left: on ? 21 : 3, transition: "left 0.2s" }),
  badge: { fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  btnSmall: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnDanger: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,100,100,0.3)", background: "none", color: "#ff6b6b", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnAdd: { padding: "8px 16px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 12 },
  gradientSelect: { padding: "6px 10px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 12 },
  toast: { position: "fixed" as const, bottom: 24, right: 24, background: "#1a1a1a", border: "1px solid #D73F09", borderRadius: 12, padding: "12px 24px", color: "#D73F09", fontSize: 13, fontWeight: 700, zIndex: 9999 },
  mb: (n: number) => ({ marginBottom: n }),
  itemCard: { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 16, marginBottom: 10 } as const,
  picker: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" },
  pickerContent: { background: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 500, maxHeight: "70vh", overflow: "auto" } as const,
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button style={S.toggle(on)} onClick={() => onChange(!on)}>
      <div style={S.toggleDot(on)} />
    </button>
  );
}

function Field({ label, value, onChange, textarea, placeholder }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string }) {
  return (
    <div style={S.mb(16)}>
      <label style={S.label}>{label}</label>
      {textarea ? (
        <textarea style={S.textarea} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input style={S.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  featured_campaigns: "Campaign Highlights",
  featured_athletes: "Featured Athletes",
  brand_partners: "Brand Partners",
  services_grid: "Services Grid",
};

const GRADIENTS: { key: string; color: string }[] = [
  { key: "rc-1", color: "linear-gradient(135deg, #1a1a2e, #0f3460)" },
  { key: "rc-2", color: "linear-gradient(135deg, #1a1a1a, #3d1f14)" },
  { key: "rc-3", color: "linear-gradient(135deg, #141414, #1e3a1e)" },
  { key: "rc-4", color: "linear-gradient(135deg, #1a1a1a, #3a1e3d)" },
  { key: "rc-5", color: "linear-gradient(135deg, #1a1a1a, #1e3a3a)" },
];

export default function HomepageEditorPage() {
  const [page, setPage] = useState<PageData | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState<Tab>("hero");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<"full" | "media-only">("full");
  const [mediaPickerTarget, setMediaPickerTarget] = useState<number | null>(null);
  const [mediaPickerInitialCampaign, setMediaPickerInitialCampaign] = useState<{ id: string; name: string; brand_name: string } | undefined>(undefined);
  const [athletePickerOpen, setAthletePickerOpen] = useState(false);
  const [athletePickerDeals, setAthletePickerDeals] = useState<any[]>([]);
  const [athletePickerSearch, setAthletePickerSearch] = useState("");
  const [athletePickerSport, setAthletePickerSport] = useState("");
  const [athletePickerBrand, setAthletePickerBrand] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AthleteItem[]>([]);

  const suggestFromNews = async () => {
    setSuggesting(true);
    setSuggestions([]);
    try {
      const supabase = createBrowserSupabase();
      const { data: deals } = await supabase
        .from("deals")
        .select("id, athlete_name, athlete_school, athlete_sport, brand_name, image_url, brand_id")
        .eq("published", true)
        .eq("tier", "tier_1");
      if (!deals?.length) return;
      const athleteList = deals.map((d: any) => d.athlete_name + " (" + d.athlete_sport + ", " + d.athlete_school + ")").join("\n");
const response = await fetch("/api/suggest-athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteList }),
      });
      const data = await response.json();
      if (data.error) { console.error(data.error); return; }
      let parsed: {name: string; reason: string}[] = [];
      try { parsed = JSON.parse(data.result); } catch { return; }
      const matched: AthleteItem[] = [];
      for (const s of parsed) {
        const sName = s.name?.toLowerCase().trim() || "";
        const deal = deals.find((d: any) => {
          const dName = d.athlete_name?.toLowerCase().trim() || "";
          return dName === sName || dName.includes(sName) || sName.includes(dName);
        });
        if (deal) matched.push({ name: deal.athlete_name, sport: deal.athlete_sport, school: deal.athlete_school, image_url: deal.image_url, brand: deal.brand_name, brand_id: deal.brand_id, deal_id: deal.id, gradient: s.reason });
      }
      setSuggestions(matched);
    } catch (e) { console.error("Suggest error:", e); }
    finally { setSuggesting(false); }
  };

  const supabase = createBrowserSupabase();

  // Load data
  useEffect(() => {
    async function load() {
      const { data: pageData } = await supabase
        .from("pages")
        .select("*, page_sections(*)")
        .eq("id", PAGE_ID)
        .order("sort_order", { referencedTable: "page_sections", ascending: true })
        .single();

      if (pageData) {
        const { page_sections, ...rest } = pageData as any;
        setPage(rest);
        setSections(page_sections || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Settings helpers
  const settings = (page?.settings || {}) as Record<string, unknown>;
  const str = (key: string): string => {
    const v = settings[key];
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null && "text" in v) return String((v as any).text || "");
    return "";
  };
  const ctaUrl = (key: string): string => {
    const v = settings[key];
    if (typeof v === "object" && v !== null && "url" in v) return String((v as any).url || "");
    return "";
  };

  const updateSetting = useCallback((key: string, value: unknown) => {
    setPage((p) => p ? { ...p, settings: { ...p.settings, [key]: value } } : p);
  }, []);

  const updatePublicSection = useCallback((sectionType: string, visible: boolean) => {
    setPage((p) => {
      if (!p) return p;
      const ps = (p.settings.public_sections || {}) as Record<string, boolean>;
      return { ...p, settings: { ...p.settings, public_sections: { ...ps, [sectionType]: visible } } };
    });
  }, []);

  const updateSectionContent = useCallback((sectionId: string, content: Record<string, unknown>) => {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, content } : s));
  }, []);

  const getStats = (): StatItem[] => (settings.stats as StatItem[] || []);
  const setStats = (stats: StatItem[]) => updateSetting("stats", stats);

  const getPublicSections = (): Record<string, boolean> => (settings.public_sections as Record<string, boolean> || {});
  const isSectionVisible = (type: string) => getPublicSections()[type] !== false;

  // Section content helpers
  const getSectionByType = (type: string) => sections.find((s) => s.type === type);
  const getCampaigns = (): CampaignItem[] => {
    const sec = getSectionByType("featured_campaigns");
    return (sec?.content?.campaigns as CampaignItem[] || []);
  };
  const getAthletes = (): AthleteItem[] => {
    const sec = getSectionByType("featured_athletes");
    return (sec?.content?.athletes as AthleteItem[] || []);
  };
  const getBrands = (): BrandItem[] => {
    const sec = getSectionByType("brand_partners");
    return (sec?.content?.logos as BrandItem[] || []);
  };
  const getServices = (): ServiceItem[] => {
    const sec = getSectionByType("services_grid");
    return (sec?.content?.services as ServiceItem[] || []);
  };

  const updateSectionItems = (type: string, key: string, items: unknown[]) => {
    const sec = getSectionByType(type);
    if (sec) updateSectionContent(sec.id, { ...sec.content, [key]: items });
  };

  // Pickers
  const openBrandPicker = async () => {
    setShowPicker("brand");
    const { data } = await supabase
      .from("brands")
      .select("id, name, logo_url")
      .eq("archived", false)
      .order("name")
      .limit(30);
    setPickerItems(data || []);
  };

  const openAthletePicker = async () => {
    setAthletePickerOpen(true);
    setAthletePickerSearch("");
    setAthletePickerSport("");
    setAthletePickerBrand("");
    const { data } = await supabase
      .from("deals")
      .select("id, athlete_name, athlete_school, athlete_sport, brand_name, image_url, brand_id")
      .eq("published", true)
      .order("sort_order", { ascending: true });
    setAthletePickerDeals(data || []);
  };

  const filteredAthleteDeals = athletePickerDeals.filter((d) => {
    const q = athletePickerSearch.toLowerCase();
    if (q && !d.athlete_name?.toLowerCase().includes(q) && !d.athlete_school?.toLowerCase().includes(q) && !d.brand_name?.toLowerCase().includes(q)) return false;
    if (athletePickerSport && d.athlete_sport !== athletePickerSport) return false;
    if (athletePickerBrand && d.brand_name !== athletePickerBrand) return false;
    return true;
  });

  const athletePickerSports = [...new Set(athletePickerDeals.map((d) => d.athlete_sport).filter(Boolean))].sort();
  const athletePickerBrands = [...new Set(athletePickerDeals.map((d) => d.brand_name).filter(Boolean))].sort();

  // Save
  const handleSave = async () => {
    if (!page) return;
    setSaving(true);

    await supabase
      .from("pages")
      .update({ settings: page.settings, published: page.published })
      .eq("id", PAGE_ID);

    for (const sec of sections) {
      await supabase
        .from("page_sections")
        .update({ content: sec.content, title: sec.title })
        .eq("id", sec.id);
    }

    setSaving(false);
    setToast("Saved successfully");
    setTimeout(() => setToast(""), 3000);
  };

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#ff6b6b", fontSize: 14 }}>Homepage not found</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/dashboard" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 13 }}>&larr; Dashboard</Link>
          <h1 style={S.h1}>Homepage Editor</h1>
        </div>
        <div style={S.headerActions}>
          <a href="/homepage" target="_blank" rel="noopener noreferrer" style={S.btnOutline}>View Live Page</a>
          <button style={{ ...S.btnSave, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {(["hero", "sections", "settings"] as Tab[]).map((t) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t === "hero" ? "Hero & Stats" : t === "sections" ? "Sections" : "Settings"}
          </button>
        ))}
      </div>

      {/* TAB 1: Hero & Stats */}
      {tab === "hero" && (
        <div>
          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 20px" }}>Hero</h3>
            <Field label="Eyebrow" value={str("hero_eyebrow")} onChange={(v) => updateSetting("hero_eyebrow", v)} placeholder="#1 NIL Agency in the Country" />
            <Field label="Title" value={str("hero_title")} onChange={(v) => updateSetting("hero_title", v)} placeholder="We Build Athletes Into Brands" />
            <Field label="Description" value={str("hero_desc")} onChange={(v) => updateSetting("hero_desc", v)} textarea placeholder="Postgame connects brands with college athletes..." />

            <div style={{ ...S.row, marginTop: 8 }}>
              <div style={S.col}>
                <label style={S.label}>Primary CTA — Text</label>
                <input style={S.input} value={typeof settings.hero_cta_primary === "object" ? String((settings.hero_cta_primary as any)?.text || "") : String(settings.hero_cta_primary || "")} onChange={(e) => updateSetting("hero_cta_primary", { text: e.target.value, url: ctaUrl("hero_cta_primary") || "/deals" })} />
              </div>
              <div style={S.col}>
                <label style={S.label}>Primary CTA — URL</label>
                <input style={S.input} value={ctaUrl("hero_cta_primary") || (typeof settings.hero_cta_primary === "string" ? "/deals" : "")} onChange={(e) => updateSetting("hero_cta_primary", { text: str("hero_cta_primary"), url: e.target.value })} />
              </div>
            </div>

            <div style={S.row}>
              <div style={S.col}>
                <label style={S.label}>Secondary CTA — Text</label>
                <input style={S.input} value={typeof settings.hero_cta_secondary === "object" ? String((settings.hero_cta_secondary as any)?.text || "") : String(settings.hero_cta_secondary || "")} onChange={(e) => updateSetting("hero_cta_secondary", { text: e.target.value, url: ctaUrl("hero_cta_secondary") || "mailto:hello@postgame.co" })} />
              </div>
              <div style={S.col}>
                <label style={S.label}>Secondary CTA — URL</label>
                <input style={S.input} value={ctaUrl("hero_cta_secondary") || (typeof settings.hero_cta_secondary === "string" ? "mailto:hello@postgame.co" : "")} onChange={(e) => updateSetting("hero_cta_secondary", { text: str("hero_cta_secondary"), url: e.target.value })} />
              </div>
            </div>
          </div>

          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 20px" }}>Stats</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {getStats().map((stat, i) => (
                <div key={i} style={S.itemCard}>
                  <div style={S.row}>
                    <div style={S.col}>
                      <label style={S.label}>Value</label>
                      <input style={S.input} value={stat.value} onChange={(e) => {
                        const s = [...getStats()];
                        s[i] = { ...s[i], value: e.target.value };
                        setStats(s);
                      }} />
                    </div>
                    <div style={S.col}>
                      <label style={S.label}>Label</label>
                      <input style={S.input} value={stat.label} onChange={(e) => {
                        const s = [...getStats()];
                        s[i] = { ...s[i], label: e.target.value };
                        setStats(s);
                      }} />
                    </div>
                    <button style={S.btnDanger} onClick={() => setStats(getStats().filter((_, j) => j !== i))}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <button style={S.btnAdd} onClick={() => setStats([...getStats(), { value: "", label: "" }])}>+ Add Stat</button>
          </div>
        </div>
      )}

      {/* TAB 2: Sections */}
      {tab === "sections" && (
        <div>
          {sections.map((sec) => {
            const isExpanded = expandedSection === sec.id;
            const label = SECTION_LABELS[sec.type] || sec.type;
            return (
              <div key={sec.id} style={S.card}>
                <div style={S.sectionHeader} onClick={() => setExpandedSection(isExpanded ? null : sec.id)}>
                  <div>
                    <h3 style={S.sectionTitle}>{label}</h3>
                    <span style={S.badge}>{sec.type}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }} onClick={(e) => e.stopPropagation()}>
                    <Toggle on={isSectionVisible(sec.type)} onChange={(v) => updatePublicSection(sec.type, v)} />
                    <span style={{ fontSize: 20, color: "rgba(255,255,255,0.3)" }}>{isExpanded ? "−" : "+"}</span>
                  </div>
                </div>

                {isExpanded && sec.type === "featured_campaigns" && (
                  <div style={{ marginTop: 20 }}>
                    <Field label="Eyebrow" value={String(sec.content?.eyebrow || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, eyebrow: v })} />
                    <Field label="Description" value={String(sec.content?.description || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, description: v })} />
                    {getCampaigns().map((c, i) => (
                      <div key={i} style={{ ...S.itemCard, borderLeft: c.featured ? "3px solid #D73F09" : "3px solid transparent", display: "flex", gap: 14 }}>
                        {/* Thumbnail */}
                        <div
                          style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0, background: c.image_url && c.media_type !== "video" ? `url(${c.image_url}) center/cover` : "#222", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase" as const, overflow: "hidden", position: "relative" as const }}
                          onClick={() => { setMediaPickerTarget(i); setMediaPickerMode("media-only"); setMediaPickerInitialCampaign(c.campaign_id ? { id: c.campaign_id, name: c.name, brand_name: c.brand } : undefined); setMediaPickerOpen(true); }}
                          title="Click to change media"
                        >
                          {c.image_url && c.media_type === "video" ? (
                            <>
                              <video src={c.image_url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "7px solid #111", marginLeft: 1 }} />
                                </div>
                              </div>
                            </>
                          ) : !c.image_url ? "No img" : null}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#D73F09" }}>{c.brand || "No Brand"}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{c.name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: c.featured ? "#D73F09" : "rgba(255,255,255,0.2)", padding: 0 }}
                                title={c.featured ? "Featured (big card)" : "Set as featured"}
                                onClick={() => { const items = getCampaigns().map((item, j) => ({ ...item, featured: j === i })); updateSectionItems("featured_campaigns", "campaigns", items); }}
                              >&#9733;</button>
                              <button style={{ ...S.btnDanger, padding: "4px 8px", fontSize: 13 }} onClick={() => { updateSectionItems("featured_campaigns", "campaigns", getCampaigns().filter((_, j) => j !== i)); }}>&times;</button>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <input style={{ ...S.input, fontSize: 12 }} value={c.brand} placeholder="Brand" onChange={(e) => { const items = [...getCampaigns()]; items[i] = { ...items[i], brand: e.target.value }; updateSectionItems("featured_campaigns", "campaigns", items); }} />
                            <input style={{ ...S.input, fontSize: 12 }} value={c.name} placeholder="Campaign" onChange={(e) => { const items = [...getCampaigns()]; items[i] = { ...items[i], name: e.target.value }; updateSectionItems("featured_campaigns", "campaigns", items); }} />
                            <input style={{ ...S.input, fontSize: 12 }} value={c.meta} placeholder="Athletes · TikTok · Instagram" onChange={(e) => { const items = [...getCampaigns()]; items[i] = { ...items[i], meta: e.target.value }; updateSectionItems("featured_campaigns", "campaigns", items); }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {GRADIENTS.map((g) => (
                              <button key={g.key} onClick={() => { const items = [...getCampaigns()]; items[i] = { ...items[i], gradient: g.key }; updateSectionItems("featured_campaigns", "campaigns", items); }}
                                style={{ width: 22, height: 22, borderRadius: 4, background: g.color, border: c.gradient === g.key ? "2px solid #D73F09" : "2px solid transparent", cursor: "pointer" }} title={g.key} />
                            ))}
                            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
                            <button onClick={() => { const items = [...getCampaigns()]; items[i] = { ...items[i], aspect_ratio: (c.aspect_ratio || "landscape") === "landscape" ? "portrait" : "landscape" }; updateSectionItems("featured_campaigns", "campaigns", items); }}
                              style={{ ...S.btnSmall, fontSize: 10, padding: "3px 8px", color: c.aspect_ratio === "portrait" ? "#D73F09" : "rgba(255,255,255,0.4)", borderColor: c.aspect_ratio === "portrait" ? "#D73F09" : "rgba(255,255,255,0.15)" }}
                              title="Toggle landscape/portrait"
                            >{c.aspect_ratio === "portrait" ? "Portrait" : "Landscape"}</button>
                            <select
                              value={c.focal_point || "center 20%"}
                              onChange={(e) => { const items = [...getCampaigns()]; items[i] = { ...items[i], focal_point: e.target.value }; updateSectionItems("featured_campaigns", "campaigns", items); }}
                              style={{ ...S.gradientSelect, fontSize: 10, padding: "3px 6px" }}
                              title="Focal point (face positioning)"
                            >
                              <option value="center 20%">Top (faces)</option>
                              <option value="center center">Center</option>
                              <option value="center 80%">Bottom</option>
                              <option value="center 30%">Upper third</option>
                              <option value="center 40%">Mid-upper</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button style={S.btnAdd} onClick={() => { setMediaPickerTarget(null); setMediaPickerMode("full"); setMediaPickerInitialCampaign(undefined); setMediaPickerOpen(true); }}>+ Add Campaign</button>
                  </div>
                )}

                {isExpanded && sec.type === "featured_athletes" && (
                  <div style={{ marginTop: 20 }}>
                    <Field label="Eyebrow" value={String(sec.content?.eyebrow || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, eyebrow: v })} />
                    <Field label="Description" value={String(sec.content?.description || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, description: v })} />
                    {getAthletes().map((a, i) => (
                      <div key={i} style={{ ...S.itemCard, display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "#222", border: "1px solid rgba(255,255,255,0.1)" }}>
                          {a.image_url ? (
                            <img src={a.image_url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#D73F09" }}>
                              {a.name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{a.name}</span>
                            {a.sport && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "#D73F09", background: "rgba(215,63,9,0.15)", padding: "2px 8px", borderRadius: 10 }}>{a.sport}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                            {a.school}{a.brand ? ` · ${a.brand}` : ""}
                          </div>
                        </div>
                        <button style={{ ...S.btnDanger, padding: "4px 8px", fontSize: 13 }} onClick={() => {
                          updateSectionItems("featured_athletes", "athletes", getAthletes().filter((_, j) => j !== i));
                        }}>&times;</button>
                      </div>
                    ))}
                    <button style={S.btnAdd} onClick={openAthletePicker}>+ Add Athlete</button>
                    <button style={{ ...S.btnAdd, background: "rgba(215,63,9,0.15)", color: "#D73F09", border: "1px solid rgba(215,63,9,0.3)", marginLeft: 8 }} onClick={suggestFromNews} disabled={suggesting}>
                      {suggesting ? "Searching news..." : "Suggest from News"}
                    </button>
                    {suggestions.length > 0 && (
                      <div style={{ marginTop: 16, background: "#0d0d0d", border: "1px solid rgba(215,63,9,0.25)", borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#D73F09", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 }}>Trending from your deal tracker</div>
                        {suggestions.map((a, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "#222", flexShrink: 0 }}>
                              {a.image_url && <img src={a.image_url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{a.name}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>{a.gradient}</div>
                            </div>
                            <button style={{ padding: "5px 12px", background: "#D73F09", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                              onClick={() => { updateSectionItems("featured_athletes", "athletes", [...getAthletes(), { ...a, gradient: undefined }]); setSuggestions(suggestions.filter((_, j) => j !== i)); }}>
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isExpanded && sec.type === "brand_partners" && (
                  <div style={{ marginTop: 20 }}>
                    <Field label="Eyebrow" value={String(sec.content?.eyebrow || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, eyebrow: v })} />
                    <Field label="Description" value={String(sec.content?.description || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, description: v })} />
                    {getBrands().map((b, i) => (
                      <div key={i} style={S.itemCard}>
                        <div style={S.row}>
                          <div style={S.col}>
                            <label style={S.label}>Brand Name</label>
                            <input style={S.input} value={b.name} onChange={(e) => {
                              const items = [...getBrands()];
                              items[i] = { ...items[i], name: e.target.value };
                              updateSectionItems("brand_partners", "logos", items);
                            }} />
                          </div>
                          <div style={S.col}>
                            <label style={S.label}>Logo URL</label>
                            <input style={S.input} value={b.logo_url} onChange={(e) => {
                              const items = [...getBrands()];
                              items[i] = { ...items[i], logo_url: e.target.value };
                              updateSectionItems("brand_partners", "logos", items);
                            }} />
                          </div>
                          <button style={S.btnDanger} onClick={() => {
                            updateSectionItems("brand_partners", "logos", getBrands().filter((_, j) => j !== i));
                          }}>Remove</button>
                        </div>
                      </div>
                    ))}
                    <button style={S.btnAdd} onClick={openBrandPicker}>+ Add Brand</button>
                  </div>
                )}

                {isExpanded && sec.type === "services_grid" && (
                  <div style={{ marginTop: 20 }}>
                    <Field label="Eyebrow" value={String(sec.content?.eyebrow || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, eyebrow: v })} />
                    <Field label="Description" value={String(sec.content?.description || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, description: v })} />
                    {getServices().map((svc, i) => (
                      <div key={i} style={S.itemCard}>
                        <div style={S.row}>
                          <div style={{ width: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: svc.accent ? "#D73F09" : "rgba(255,255,255,0.3)" }}>
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div style={S.col}>
                            <label style={S.label}>Name</label>
                            <input style={S.input} value={svc.name} onChange={(e) => {
                              const items = [...getServices()];
                              items[i] = { ...items[i], name: e.target.value };
                              updateSectionItems("services_grid", "services", items);
                            }} />
                          </div>
                          <div style={{ flex: 2 }}>
                            <label style={S.label}>Description</label>
                            <input style={S.input} value={svc.desc} onChange={(e) => {
                              const items = [...getServices()];
                              items[i] = { ...items[i], desc: e.target.value };
                              updateSectionItems("services_grid", "services", items);
                            }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                            <label style={{ ...S.label, marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}>
                              Accent
                              <Toggle on={svc.accent} onChange={(v) => {
                                const items = [...getServices()];
                                items[i] = { ...items[i], accent: v };
                                updateSectionItems("services_grid", "services", items);
                              }} />
                            </label>
                            {i > 0 && (
                              <button style={S.btnSmall} onClick={() => {
                                const items = [...getServices()];
                                [items[i - 1], items[i]] = [items[i], items[i - 1]];
                                updateSectionItems("services_grid", "services", items);
                              }}>Up</button>
                            )}
                            {i < getServices().length - 1 && (
                              <button style={S.btnSmall} onClick={() => {
                                const items = [...getServices()];
                                [items[i], items[i + 1]] = [items[i + 1], items[i]];
                                updateSectionItems("services_grid", "services", items);
                              }}>Dn</button>
                            )}
                            <button style={S.btnDanger} onClick={() => {
                              updateSectionItems("services_grid", "services", getServices().filter((_, j) => j !== i));
                            }}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button style={S.btnAdd} onClick={() => {
                      updateSectionItems("services_grid", "services", [...getServices(), { name: "", desc: "", accent: false }]);
                    }}>+ Add Service</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Settings */}
      {tab === "settings" && (
        <div>
          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 20px" }}>CTA Section</h3>
            <Field label="CTA Title" value={str("cta_title")} onChange={(v) => updateSetting("cta_title", v)} placeholder="Let's Build Something Together" />
            <Field label="CTA Description" value={str("cta_desc")} onChange={(v) => updateSetting("cta_desc", v)} textarea placeholder="Ready to launch your next NIL campaign?" />
          </div>
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>Published</h3>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>When off, the homepage shows the fallback.</p>
              </div>
              <Toggle on={page.published} onChange={(v) => setPage((p) => p ? { ...p, published: v } : p)} />
            </div>
          </div>
        </div>
      )}


      {/* Brand Picker Modal */}
      {showPicker === "brand" && (
        <div style={S.picker} onClick={() => setShowPicker(null)}>
          <div style={S.pickerContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px" }}>Add Brand</h3>
            {pickerItems.map((item) => (
              <div key={item.id} style={{ ...S.itemCard, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }} onClick={() => {
                const newItem: BrandItem = { name: item.name, logo_url: item.logo_url || "" };
                updateSectionItems("brand_partners", "logos", [...getBrands(), newItem]);
                setShowPicker(null);
              }}>
                {item.logo_url && <img src={item.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain", background: "#fff" }} />}
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
              </div>
            ))}
            {pickerItems.length === 0 && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No brands found</div>}
          </div>
        </div>
      )}

      {/* Athlete Picker Modal */}
      {athletePickerOpen && (
        <div style={S.picker} onClick={() => setAthletePickerOpen(false)}>
          <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 600, maxHeight: "70vh", display: "flex", flexDirection: "column" as const }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px" }}>Add Athlete from Deal Tracker</h3>
            <input
              style={{ ...S.input, marginBottom: 12 }}
              placeholder="Search by name, school, or brand..."
              value={athletePickerSearch}
              onChange={(e) => setAthletePickerSearch(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select style={{ ...S.gradientSelect, flex: 1 }} value={athletePickerSport} onChange={(e) => setAthletePickerSport(e.target.value)}>
                <option value="">All Sports</option>
                {athletePickerSports.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select style={{ ...S.gradientSelect, flex: 1 }} value={athletePickerBrand} onChange={(e) => setAthletePickerBrand(e.target.value)}>
                <option value="">All Brands</option>
                {athletePickerBrands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              {filteredAthleteDeals.length === 0 && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: 12 }}>No athletes found</div>}
              {filteredAthleteDeals.slice(0, 100).map((deal) => (
                <div
                  key={deal.id}
                  style={{ ...S.itemCard, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                  onClick={() => {
                    const existing = getAthletes();
                    const newAthlete: AthleteItem = {
                      name: deal.athlete_name || "",
                      sport: deal.athlete_sport || "",
                      school: deal.athlete_school || "",
                      image_url: deal.image_url || "",
                      brand: deal.brand_name || "",
                      brand_id: deal.brand_id || "",
                      deal_id: deal.id,
                    };
                    updateSectionItems("featured_athletes", "athletes", [...existing, newAthlete]);
                    setAthletePickerOpen(false);
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "#222", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {deal.image_url ? (
                      <img src={deal.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#D73F09" }}>?</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{deal.athlete_name}</span>
                      {deal.athlete_sport && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "#D73F09", background: "rgba(215,63,9,0.15)", padding: "2px 8px", borderRadius: 10 }}>{deal.athlete_sport}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                      {deal.athlete_school}{deal.brand_name ? ` · ${deal.brand_name}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Site Pages — quick links to all page editors */}
      {tab === "settings" && (
        <div style={{ ...S.card, marginTop: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>Site Pages</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 20px" }}>Edit content for each public page of the website.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "Homepage", href: "/dashboard/homepage", live: "/homepage" },
              { label: "Team / About", href: "/dashboard/team", live: "/about/team" },
              { label: "Contact", href: "/dashboard/contact", live: "/contact" },
              { label: "Services", href: "/dashboard/services", live: "/services/elevated" },
              { label: "Clients", href: "/clients", live: "/clients" },
              { label: "Campaigns", href: "/campaigns", live: "/campaigns" },
              { label: "Deal Tracker", href: "/dashboard?tab=deals", live: "/deals" },
              { label: "Press", href: "/dashboard?tab=press", live: "/press" },
              { label: "Case Studies", href: "/dashboard?tab=case-studies", live: "/case-studies" },
            ].map((p) => (
              <div key={p.label} style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href={p.href} style={{ fontSize: 11, fontWeight: 700, color: "#D73F09", textDecoration: "none", padding: "4px 10px", border: "1px solid #D73F09", borderRadius: 6 }}>Edit</Link>
                  <a href={p.live} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textDecoration: "none", padding: "4px 10px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}>↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Media Picker */}
      <CampaignMediaPicker
        open={mediaPickerOpen}
        mode={mediaPickerMode}
        initialCampaign={mediaPickerInitialCampaign}
        onClose={() => { setMediaPickerOpen(false); setMediaPickerTarget(null); }}
        onSelect={(item) => {
          if (mediaPickerTarget !== null) {
            // Updating media on existing card
            const items = [...getCampaigns()];
            items[mediaPickerTarget] = { ...items[mediaPickerTarget], image_url: item.url, media_type: item.type };
            updateSectionItems("featured_campaigns", "campaigns", items);
          } else {
            // Adding new campaign from full flow
            const newItem: CampaignItem = { brand: item.brand, name: item.campaign, meta: "", gradient: `rc-${(getCampaigns().length % 5) + 1}`, featured: false, image_url: item.url, media_type: item.type, aspect_ratio: "landscape", campaign_id: item.campaign_id };
            updateSectionItems("featured_campaigns", "campaigns", [...getCampaigns(), newItem]);
          }
          setMediaPickerOpen(false);
          setMediaPickerTarget(null);
        }}
      />

      {/* Toast */}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
