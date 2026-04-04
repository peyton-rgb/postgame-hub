"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";

/* ── Extended deal type ───────────────────────────────────────── */
type DealRow = Deal & {
  focal_point?: string | null;
  focal_point_tablet?: string | null;
  focal_point_mobile?: string | null;
  zoom_desktop?: number | null;
  zoom_tablet?: number | null;
  zoom_mobile?: number | null;
  bg_position_desktop?: string | null;
  source_campaign_id?: string | null;
  brand_id?: string | null;
  campaign_recaps?: { name: string } | null;
  brands?: { logo_primary_url: string | null } | null;
};

/* ── Design tokens ────────────────────────────────────────────── */
const C = {
  bg: "#080808", surface: "#0f0f0f", surface2: "#111", border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.13)", orange: "#D73F09", text: "#fff",
  text2: "rgba(255,255,255,0.6)", text3: "rgba(255,255,255,0.35)",
};
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 11px", background: "#1a1a1a", border: `1px solid ${C.border2}`, borderRadius: 8, color: C.text, fontSize: 12, fontFamily: "Arial,sans-serif", outline: "none", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
const sectionTitle: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: C.text3, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` };

/* ── Device configs ───────────────────────────────────────────── */
const DEVICES = [
  { key: "desktop" as const, label: "Desktop", ratio: "Full bleed", w: 420, h: 580 },
  { key: "tablet" as const, label: "Tablet", ratio: "3:4", w: 240, h: 320 },
  { key: "mobile" as const, label: "Mobile", ratio: "9:16", w: 170, h: 302 },
];
const PRESETS = [
  { label: "Top", y: 8 }, { label: "Face", y: 20 }, { label: "Shoulders", y: 35 },
  { label: "Center", y: 50 }, { label: "Lower", y: 65 }, { label: "Full", y: 80 },
];

type DeviceKey = "desktop" | "tablet" | "mobile";
type FocalXY = { x: number; y: number };

function parseFocal(fp: string | null | undefined): FocalXY {
  const m = (fp || "").match(/(\d+)%\s+(\d+)%/);
  return m ? { x: parseInt(m[1]), y: parseInt(m[2]) } : { x: 50, y: 20 };
}
function focalStr(p: FocalXY) { return `${p.x}% ${p.y}%`; }

export default function DealEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  /* ── Core state ─────────────────────────────────────────────── */
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* ── Form fields ────────────────────────────────────────────── */
  const [athleteName, setAthleteName] = useState("");
  const [athleteSport, setAthleteSport] = useState("");
  const [athleteSchool, setAthleteSchool] = useState("");
  const [instagram, setInstagram] = useState("");
  const [brandName, setBrandName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [dealType, setDealType] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [dateAnnounced, setDateAnnounced] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);

  /* ── Photo editor state ─────────────────────────────────────── */
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [positions, setPositions] = useState<Record<DeviceKey, FocalXY>>({ desktop: { x: 50, y: 20 }, tablet: { x: 50, y: 20 }, mobile: { x: 50, y: 20 } });
  const [zooms, setZooms] = useState<Record<DeviceKey, number>>({ desktop: 1, tablet: 1, mobile: 1 });
  const [savingPos, setSavingPos] = useState(false);
  const dragging = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  /* ── Campaign photos ────────────────────────────────────────── */
  const [campaignPhotos, setCampaignPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  /* ── Load deal ──────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("deals").select("*, campaign_recaps(name), brands(logo_primary_url)").eq("id", id).single();
      if (data) {
        const d = data as DealRow;
        setDeal(d);
        setAthleteName(d.athlete_name || "");
        setAthleteSport(d.athlete_sport || "");
        setAthleteSchool(d.athlete_school || "");
        setBrandName(d.brand_name || "");
        setCampaignName(d.campaign_recaps?.name || "");
        setDealType(d.deal_type || "");
        setValue(d.value || "");
        setDescription(d.description || "");
        setDateAnnounced(d.date_announced || "");
        setImageUrl(d.image_url || "");
        setPublished(d.published);
        setFeatured(d.featured);
        setPositions({
          desktop: parseFocal(d.bg_position_desktop || d.focal_point),
          tablet: parseFocal(d.focal_point_tablet),
          mobile: parseFocal(d.focal_point_mobile),
        });
        setZooms({
          desktop: d.zoom_desktop ?? 1,
          tablet: d.zoom_tablet ?? 1,
          mobile: d.zoom_mobile ?? 1,
        });
        // Load campaign photos
        if (d.source_campaign_id) {
          const { data: photos } = await supabase.from("deals").select("image_url").eq("source_campaign_id", d.source_campaign_id).not("image_url", "is", null);
          const urls = [...new Set((photos || []).map((p: any) => p.image_url).filter(Boolean))] as string[];
          setCampaignPhotos(urls);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  /* ── Drag handler for photo editor ──────────────────────────── */
  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
      const x = Math.round(Math.max(0, Math.min(100, ((cx - rect.left) / rect.width) * 100)));
      const y = Math.round(Math.max(0, Math.min(100, ((cy - rect.top) / rect.height) * 100)));
      setPositions(p => ({ ...p, [device]: { x, y } }));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("touchmove", move); window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); };
  }, [device]);

  /* ── Save form fields ───────────────────────────────────────── */
  const saveDeal = async () => {
    if (!deal) return;
    setSaving(true);
    await supabase.from("deals").update({
      athlete_name: athleteName || null, athlete_sport: athleteSport || null, athlete_school: athleteSchool || null,
      brand_name: brandName, deal_type: dealType || null, value: value || null,
      description: description || null, date_announced: dateAnnounced || null, image_url: imageUrl || null,
      updated_at: new Date().toISOString(),
    }).eq("id", deal.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /* ── Toggle published/featured immediately ──────────────────── */
  const togglePublished = async (val: boolean) => {
    if (!deal) return;
    setPublished(val);
    await supabase.from("deals").update({ published: val }).eq("id", deal.id);
  };
  const toggleFeatured = async (val: boolean) => {
    if (!deal) return;
    setFeatured(val);
    await supabase.from("deals").update({ featured: val }).eq("id", deal.id);
  };

  /* ── Save photo positions ───────────────────────────────────── */
  const savePositions = async () => {
    if (!deal) return;
    setSavingPos(true);
    const desktopFocal = focalStr(positions.desktop);
    await supabase.from("deals").update({
      focal_point: desktopFocal,
      bg_position_desktop: desktopFocal,
      focal_point_tablet: focalStr(positions.tablet),
      focal_point_mobile: focalStr(positions.mobile),
      zoom_desktop: zooms.desktop,
      zoom_tablet: zooms.tablet,
      zoom_mobile: zooms.mobile,
    }).eq("id", deal.id);
    setSavingPos(false);
  };

  /* ── Delete deal ────────────────────────────────────────────── */
  const deleteDeal = async () => {
    if (!deal || !confirm("Delete this deal? This cannot be undone.")) return;
    await supabase.from("deals").delete().eq("id", deal.id);
    router.push("/dashboard/website?page=deals");
  };

  /* ── Upload image ───────────────────────────────────────────── */
  const uploadImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file || !deal) return;
      setUploading(true);
      const path = `deals/${deal.id}/${Date.now()}-${file.name}`;
      const { data: up, error } = await supabase.storage.from("campaign-media").upload(path, file, { upsert: true });
      if (!error && up) {
        const { data: { publicUrl } } = supabase.storage.from("campaign-media").getPublicUrl(up.path);
        setImageUrl(publicUrl);
        await supabase.from("deals").update({ image_url: publicUrl }).eq("id", deal.id);
      }
      setUploading(false);
    };
    input.click();
  };

  /* ── Select campaign photo ──────────────────────────────────── */
  const selectPhoto = async (url: string) => {
    if (!deal) return;
    setImageUrl(url);
    await supabase.from("deals").update({ image_url: url }).eq("id", deal.id);
  };

  const curPos = positions[device];
  const curZoom = zooms[device];
  const devConfig = DEVICES.find(d => d.key === device)!;

  if (loading) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontFamily: "Arial,sans-serif" }}>Loading...</div>;
  if (!deal) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontFamily: "Arial,sans-serif" }}>Deal not found.</div>;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "Arial,sans-serif", overflow: "hidden" }}>

      {/* ═══ PANEL 1 — LEFT: Form ═══════════════════════════════ */}
      <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => router.push("/dashboard/website?page=deals")} style={{ background: "none", border: "none", color: C.text3, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 6, display: "block" }}>← Deal Tracker</button>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>{athleteName || "Untitled"}</div>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{brandName}{campaignName ? ` · ${campaignName}` : ""}</div>
        </div>

        {/* Scrollable form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {/* Athlete Info */}
          <div style={sectionTitle}>Athlete Info</div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={athleteName} onChange={e => setAthleteName(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelStyle}>Sport</label><input style={inputStyle} value={athleteSport} onChange={e => setAthleteSport(e.target.value)} /></div>
            <div><label style={labelStyle}>School</label><input style={inputStyle} value={athleteSchool} onChange={e => setAthleteSchool(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Instagram</label>
            <input style={inputStyle} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@handle" />
          </div>

          {/* Deal Info */}
          <div style={sectionTitle}>Deal Info</div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Brand</label>
            <input style={inputStyle} value={brandName} onChange={e => setBrandName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Campaign</label>
            <input style={{ ...inputStyle, opacity: 0.6 }} value={campaignName} readOnly />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelStyle}>Type</label><input style={inputStyle} value={dealType} onChange={e => setDealType(e.target.value)} placeholder="NIL, Endorsement" /></div>
            <div><label style={labelStyle}>Value</label><input style={inputStyle} value={value} onChange={e => setValue(e.target.value)} placeholder="$50,000" /></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Date Announced</label>
            <input type="date" style={inputStyle} value={dateAnnounced} onChange={e => setDateAnnounced(e.target.value)} />
          </div>

          {/* Visibility */}
          <div style={sectionTitle}>Visibility</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>Published</span>
            <ToggleSwitch on={published} onChange={togglePublished} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>Featured in Hero</span>
            <ToggleSwitch on={featured} onChange={toggleFeatured} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={deleteDeal} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.25)", background: "none", color: "#ff6b6b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Delete</button>
          <button onClick={saveDeal} disabled={saving} style={{ flex: 1, padding: "8px 0", background: C.orange, border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}</button>
        </div>
      </div>

      {/* ═══ PANEL 2 — MIDDLE: Photo Editor ═════════════════════ */}
      <div style={{ flex: 1, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Photo Editor</div>
          <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{device === "desktop" ? "Drag to position across hero + featured section · zoom to scale" : "Drag to reposition · scroll to zoom"}</div>
        </div>

        {/* Device tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {DEVICES.map(d => (
            <button key={d.key} onClick={() => setDevice(d.key)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderBottom: device === d.key ? `2px solid ${C.orange}` : "2px solid transparent", color: device === d.key ? C.orange : C.text3, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {d.label} <span style={{ fontSize: 9, opacity: 0.5 }}>{d.ratio}</span>
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, background: "#0a0a0a", overflow: "hidden" }}>
          {imageUrl ? (
            <>
              {/* Crop frame with hero overlay */}
              <div
                ref={canvasRef}
                onMouseDown={() => { dragging.current = true; }}
                onTouchStart={() => { dragging.current = true; }}
                style={{ width: devConfig.w, height: devConfig.h, overflow: "hidden", borderRadius: 8, border: `2px solid ${C.orange}`, cursor: "crosshair", position: "relative", flexShrink: 0 }}
              >
                <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${curPos.x}% ${curPos.y}%`, transform: `scale(${curZoom})`, transformOrigin: `${curPos.x}% ${curPos.y}%`, pointerEvents: "none" }} />

                {device === "desktop" ? (
                  <>
                    {/* Desktop full-bleed overlay — hero top 55%, stats strip, featured section */}
                    {/* Top gradient */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "20%", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)", pointerEvents: "none" }} />
                    {/* Full-page gradient: transparent top → black bottom */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 15%, transparent 40%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.92) 75%, #000 90%)", pointerEvents: "none" }} />
                    {/* Hero zone title (top-left, within upper 55%) */}
                    <div style={{ position: "absolute", bottom: "48%", left: 12, pointerEvents: "none", zIndex: 2 }}>
                      <div style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", lineHeight: 0.92 }}>NIL<br /><span style={{ color: C.orange }}>Deal Tracker</span></div>
                    </div>
                    {/* Nameplate (upper-right area, within hero zone) */}
                    <div style={{ position: "absolute", bottom: "48%", right: 10, pointerEvents: "none", zIndex: 2 }}>
                      <div style={{ fontSize: 4, fontWeight: 800, textTransform: "uppercase", color: C.orange, letterSpacing: "0.1em" }}>{brandName}</div>
                      <div style={{ fontSize: 6, fontWeight: 900, lineHeight: 1 }}>{athleteName}</div>
                      <div style={{ fontSize: 3, color: "rgba(255,255,255,0.5)" }}>{[athleteSchool, athleteSport].filter(Boolean).join(" · ")}</div>
                    </div>
                    {/* Stats strip at ~55% */}
                    <div style={{ position: "absolute", top: "55%", left: 0, right: 0, pointerEvents: "none", zIndex: 2, borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "6px 0", display: "flex", justifyContent: "space-around" }}>
                      {["394+", "100+", "10K+", "4K"].map(n => <span key={n} style={{ fontSize: 6, fontWeight: 800, color: C.orange }}>{n}</span>)}
                    </div>
                    {/* Featured section labels below stats */}
                    <div style={{ position: "absolute", top: "63%", left: 12, pointerEvents: "none", zIndex: 2 }}>
                      <div style={{ fontSize: 4, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: C.orange }}>Featured Athletes</div>
                      <div style={{ fontSize: 7, fontWeight: 900, marginTop: 2 }}>Headliner Deals</div>
                    </div>
                    {/* Placeholder carousel cards */}
                    <div style={{ position: "absolute", top: "73%", left: 10, right: 10, display: "flex", gap: 4, pointerEvents: "none", zIndex: 2 }}>
                      {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, height: 40, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }} />)}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Tablet/Mobile: standard hero crop overlay */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%", background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: device === "mobile" ? 16 : undefined, bottom: device === "mobile" ? undefined : 12, left: 12, pointerEvents: "none", zIndex: 2 }}>
                      <div style={{ fontSize: device === "mobile" ? 10 : 7, fontWeight: 900, textTransform: "uppercase", lineHeight: 0.92 }}>NIL<br /><span style={{ color: C.orange }}>Deal Tracker</span></div>
                    </div>
                    <div style={{ position: "absolute", bottom: 8, left: device === "mobile" ? 8 : undefined, right: device === "mobile" ? 8 : 8, pointerEvents: "none", zIndex: 2 }}>
                      <div style={{ fontSize: 5, fontWeight: 800, textTransform: "uppercase", color: C.orange, letterSpacing: "0.1em" }}>{brandName}</div>
                      <div style={{ fontSize: device === "mobile" ? 8 : 7, fontWeight: 900, lineHeight: 1 }}>{athleteName}</div>
                      <div style={{ fontSize: 4, color: "rgba(255,255,255,0.5)" }}>{[athleteSchool, athleteSport].filter(Boolean).join(" · ")}</div>
                    </div>
                  </>
                )}

                {/* Focal dot */}
                <div style={{ position: "absolute", left: `${curPos.x}%`, top: `${curPos.y}%`, transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", background: C.orange, border: "2px solid #fff", pointerEvents: "none", boxShadow: "0 0 0 3px rgba(215,63,9,0.3)" }} />
              </div>
              <div style={{ fontSize: 10, color: C.text3 }}>{device === "desktop" ? "Drag to position across hero + featured section" : "Drag to reposition · click to set"}</div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: C.text3, fontSize: 13 }}>No image — select one from the right panel or upload</div>
          )}
        </div>

        {/* Controls bar */}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {PRESETS.slice(0, 3).map(p => (
            <button key={p.label} onClick={() => setPositions(prev => ({ ...prev, [device]: { x: 50, y: p.y } }))} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${curPos.x === 50 && curPos.y === p.y ? C.orange : C.border2}`, background: curPos.x === 50 && curPos.y === p.y ? "rgba(215,63,9,0.15)" : "none", color: curPos.x === 50 && curPos.y === p.y ? C.orange : C.text3, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{p.label}</button>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.text3 }}>Zoom</span>
            <input type="range" min={1} max={3} step={0.05} value={curZoom} onChange={e => setZooms(prev => ({ ...prev, [device]: parseFloat(e.target.value) }))} style={{ width: 80, accentColor: C.orange }} />
            <span style={{ fontSize: 10, color: C.text3, minWidth: 32, textAlign: "right" }}>{curZoom.toFixed(2)}x</span>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: C.text3 }}>{curPos.x}% {curPos.y}%</span>
          <div style={{ display: "flex", gap: 4 }}>
            {(["desktop", "tablet", "mobile"] as const).filter(d => d !== device).map(d => (
              <button key={d} onClick={() => setPositions(p => ({ ...p, [d]: p[device] }))} style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border2}`, background: "none", color: C.text3, fontSize: 9, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>→ {d}</button>
            ))}
          </div>
          <button onClick={savePositions} disabled={savingPos} style={{ padding: "6px 14px", background: C.orange, border: "none", borderRadius: 6, color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer", opacity: savingPos ? 0.6 : 1 }}>{savingPos ? "Saving..." : "Save Position"}</button>
        </div>
      </div>

      {/* ═══ PANEL 3 — RIGHT: Campaign Photos ═══════════════════ */}
      <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 14px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Campaign Photos</div>
          <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>Click to use as deal photo</div>
        </div>

        {/* Photo grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {campaignPhotos.length === 0 && (
            <div style={{ fontSize: 11, color: C.text3, textAlign: "center", padding: "20px 0" }}>No campaign photos found</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {campaignPhotos.map(url => (
              <button key={url} onClick={() => selectPhoto(url)} style={{ padding: 0, border: url === imageUrl ? `2px solid ${C.orange}` : `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none", aspectRatio: "3/4" }}>
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </div>

        {/* Upload button */}
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={uploadImage} disabled={uploading} style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: `1px dashed ${C.border2}`, background: "none", color: C.text3, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>{uploading ? "Uploading..." : "+ Upload Photo"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Toggle Switch component ──────────────────────────────────── */
function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 36, height: 20, borderRadius: 10, background: on ? C.orange : "#333", border: "none", cursor: "pointer", position: "relative", transition: "background 0.15s", padding: 0, flexShrink: 0 }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 19 : 3, transition: "left 0.15s" }} />
    </button>
  );
}
