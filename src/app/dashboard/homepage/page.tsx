"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

const PAGE_ID = "1e2328e1-26d0-41c5-8876-8af003a22a6a";

type Tab = "hero" | "sections" | "settings";

interface StatItem { value: string; label: string }
interface CampaignItem { brand: string; name: string; meta: string; gradient: string; featured: boolean }
interface AthleteItem { name: string; sport: string; school: string; gradient: string }
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

const GRADIENTS = ["rc-1", "rc-2", "rc-3", "rc-4", "rc-5"];

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
  const openCampaignPicker = async () => {
    setShowPicker("campaign");
    const { data } = await supabase
      .from("campaign_recaps")
      .select("id, name, client_name, slug")
      .order("created_at", { ascending: false })
      .limit(20);
    setPickerItems(data || []);
  };

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
                      <div key={i} style={S.itemCard}>
                        <div style={S.row}>
                          <div style={S.col}>
                            <label style={S.label}>Brand</label>
                            <input style={S.input} value={c.brand} onChange={(e) => {
                              const items = [...getCampaigns()];
                              items[i] = { ...items[i], brand: e.target.value };
                              updateSectionItems("featured_campaigns", "campaigns", items);
                            }} />
                          </div>
                          <div style={S.col}>
                            <label style={S.label}>Campaign Name</label>
                            <input style={S.input} value={c.name} onChange={(e) => {
                              const items = [...getCampaigns()];
                              items[i] = { ...items[i], name: e.target.value };
                              updateSectionItems("featured_campaigns", "campaigns", items);
                            }} />
                          </div>
                        </div>
                        <div style={S.row}>
                          <div style={S.col}>
                            <label style={S.label}>Meta</label>
                            <input style={S.input} value={c.meta} onChange={(e) => {
                              const items = [...getCampaigns()];
                              items[i] = { ...items[i], meta: e.target.value };
                              updateSectionItems("featured_campaigns", "campaigns", items);
                            }} />
                          </div>
                          <div style={{ width: 120 }}>
                            <label style={S.label}>Gradient</label>
                            <select style={S.gradientSelect} value={c.gradient} onChange={(e) => {
                              const items = [...getCampaigns()];
                              items[i] = { ...items[i], gradient: e.target.value };
                              updateSectionItems("featured_campaigns", "campaigns", items);
                            }}>
                              {GRADIENTS.map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                            <label style={{ ...S.label, marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}>
                              Featured
                              <Toggle on={c.featured} onChange={(v) => {
                                const items = [...getCampaigns()];
                                items[i] = { ...items[i], featured: v };
                                updateSectionItems("featured_campaigns", "campaigns", items);
                              }} />
                            </label>
                            <button style={S.btnDanger} onClick={() => {
                              updateSectionItems("featured_campaigns", "campaigns", getCampaigns().filter((_, j) => j !== i));
                            }}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button style={S.btnAdd} onClick={openCampaignPicker}>+ Add Campaign</button>
                  </div>
                )}

                {isExpanded && sec.type === "featured_athletes" && (
                  <div style={{ marginTop: 20 }}>
                    <Field label="Eyebrow" value={String(sec.content?.eyebrow || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, eyebrow: v })} />
                    <Field label="Description" value={String(sec.content?.description || "")} onChange={(v) => updateSectionContent(sec.id, { ...sec.content, description: v })} />
                    {getAthletes().map((a, i) => (
                      <div key={i} style={S.itemCard}>
                        <div style={S.row}>
                          <div style={S.col}>
                            <label style={S.label}>Name</label>
                            <input style={S.input} value={a.name} onChange={(e) => {
                              const items = [...getAthletes()];
                              items[i] = { ...items[i], name: e.target.value };
                              updateSectionItems("featured_athletes", "athletes", items);
                            }} />
                          </div>
                          <div style={S.col}>
                            <label style={S.label}>Sport</label>
                            <input style={S.input} value={a.sport} onChange={(e) => {
                              const items = [...getAthletes()];
                              items[i] = { ...items[i], sport: e.target.value };
                              updateSectionItems("featured_athletes", "athletes", items);
                            }} />
                          </div>
                          <div style={S.col}>
                            <label style={S.label}>School</label>
                            <input style={S.input} value={a.school} onChange={(e) => {
                              const items = [...getAthletes()];
                              items[i] = { ...items[i], school: e.target.value };
                              updateSectionItems("featured_athletes", "athletes", items);
                            }} />
                          </div>
                          <button style={S.btnDanger} onClick={() => {
                            updateSectionItems("featured_athletes", "athletes", getAthletes().filter((_, j) => j !== i));
                          }}>Remove</button>
                        </div>
                      </div>
                    ))}
                    <button style={S.btnAdd} onClick={() => {
                      updateSectionItems("featured_athletes", "athletes", [...getAthletes(), { name: "", sport: "", school: "", gradient: "rc-1" }]);
                    }}>+ Add Athlete</button>
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

      {/* Campaign Picker Modal */}
      {showPicker === "campaign" && (
        <div style={S.picker} onClick={() => setShowPicker(null)}>
          <div style={S.pickerContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px" }}>Add Campaign</h3>
            {pickerItems.map((item) => (
              <div key={item.id} style={{ ...S.itemCard, cursor: "pointer" }} onClick={() => {
                const newItem: CampaignItem = { brand: item.client_name || "", name: item.name, meta: "", gradient: `rc-${(getCampaigns().length % 5) + 1}`, featured: false };
                updateSectionItems("featured_campaigns", "campaigns", [...getCampaigns(), newItem]);
                setShowPicker(null);
              }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{item.client_name}</div>
              </div>
            ))}
            {pickerItems.length === 0 && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No campaigns found</div>}
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

      {/* Toast */}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
