"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { BrandKit, BrandAsset, Campaign } from "@/lib/types";

type BrandTab = "campaigns" | "brand-kit";

interface BrandCampaign {
  id: string;
  brand_id: string;
  name: string;
  status: string;
  budget: number | null;
  has_brief: boolean;
  has_tracker: boolean;
  drive_folder_url: string | null;
  created_at: string;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatBudget(amount: number) {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return `$${amount.toLocaleString()}`;
}

/* ── Upload Zone ── */
function UploadZone({
  label,
  imageUrl,
  onUpload,
  uploading,
}: {
  label: string;
  imageUrl: string | null;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative group w-full aspect-[4/3] rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${
          dragOver ? "border-[#D73F09] bg-[#D73F09]/10" : "border-gray-700 hover:border-gray-500 bg-[#111]"
        }`}
        style={{
          backgroundImage: imageUrl ? "none" : "linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%), linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 8px 8px",
        }}
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={label} className="w-full h-full object-contain p-3" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs font-bold text-white">Click to replace</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-xs font-bold">{uploading ? "Uploading..." : "Drop or click"}</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Asset Row ── */
function AssetRow({
  asset,
  onDelete,
}: {
  asset: BrandAsset;
  onDelete: () => void;
}) {
  const isImage = asset.mime_type?.startsWith("image/");
  return (
    <div className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
      <div className="w-8 h-8 rounded bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
        {isImage && asset.file_url ? (
          <img src={asset.file_url} alt={asset.label || ""} className="w-full h-full object-contain" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{asset.label || asset.file_name || "Untitled"}</p>
        <p className="text-[10px] text-gray-600">{asset.variant ? `${asset.variant} · ` : ""}{asset.type}</p>
      </div>
      <a
        href={asset.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded transition-colors"
      >
        Open
      </a>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="px-2 py-1 text-[10px] font-bold text-red-400/60 hover:text-red-400 border border-transparent hover:border-red-400/30 rounded transition-colors opacity-0 group-hover:opacity-100"
      >
        Delete
      </button>
    </div>
  );
}

/* ── Main Page ── */
export default function BrandKitEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [activeTab, setActiveTab] = useState<BrandTab>("campaigns");
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Campaigns tab state
  const [brandCampaigns, setBrandCampaigns] = useState<BrandCampaign[]>([]);
  const [recaps, setRecaps] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  // Form state
  const [logoPrimary, setLogoPrimary] = useState<string | null>(null);
  const [logoDark, setLogoDark] = useState<string | null>(null);
  const [logoLight, setLogoLight] = useState<string | null>(null);
  const [logoMark, setLogoMark] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#D73F09");
  const [secondaryColor, setSecondaryColor] = useState("#000000");
  const [brandColors, setBrandColors] = useState<{ hex: string; name: string }[]>([]);
  const [fontPrimary, setFontPrimary] = useState("");
  const [fontSecondary, setFontSecondary] = useState("");
  const [fontPrimaryUrl, setFontPrimaryUrl] = useState("");
  const [fontSecondaryUrl, setFontSecondaryUrl] = useState("");
  const [guidelinesUrl, setGuidelinesUrl] = useState("");
  const [kitNotes, setKitNotes] = useState("");

  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadBrand();
      loadCampaigns();
    }
  }, [id]);

  async function loadBrand() {
    const [{ data: brandData }, { data: assetData }] = await Promise.all([
      supabase.from("brands").select("*").eq("id", id).single(),
      supabase.from("brand_assets").select("*").eq("brand_id", id).order("created_at", { ascending: false }),
    ]);

    if (!brandData) {
      router.push("/dashboard?tab=brands");
      return;
    }

    const b = brandData as BrandKit;
    setBrand(b);
    setLogoPrimary(b.logo_primary_url || b.logo_url || null);
    setLogoDark(b.logo_dark_url || null);
    setLogoLight(b.logo_light_url || null);
    setLogoMark(b.logo_mark_url || null);
    setWebsite(b.website || "");
    setPrimaryColor(b.primary_color || "#D73F09");
    setSecondaryColor(b.secondary_color || "#000000");
    setBrandColors(Array.isArray(b.brand_colors) ? b.brand_colors : []);
    setFontPrimary(b.font_primary || "");
    setFontSecondary(b.font_secondary || "");
    setFontPrimaryUrl(b.font_primary_url || "");
    setFontSecondaryUrl(b.font_secondary_url || "");
    setGuidelinesUrl(b.brand_guidelines_url || "");
    setKitNotes(b.kit_notes || "");
    setAssets(assetData || []);
    setLoading(false);
  }

  async function loadCampaigns() {
    setCampaignsLoading(true);
    const [{ data: bc }, { data: rc }] = await Promise.all([
      supabase.from("brand_campaigns").select("*").eq("brand_id", id).order("created_at", { ascending: false }),
      supabase.from("campaign_recaps").select("*").eq("brand_id", id).order("created_at", { ascending: false }),
    ]);
    setBrandCampaigns(bc || []);
    setRecaps(rc || []);
    setCampaignsLoading(false);
  }

  async function uploadFile(file: File, slot: string): Promise<string | null> {
    setUploadingSlot(slot);
    const ext = file.name.split(".").pop() || "png";
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `brand-kits/${Date.now()}-${rand}.${ext}`;

    const { error } = await supabase.storage
      .from("campaign-media")
      .upload(path, file, { upsert: true });

    setUploadingSlot(null);

    if (error) return null;

    const { data: { publicUrl } } = supabase.storage
      .from("campaign-media")
      .getPublicUrl(path);

    return publicUrl;
  }

  async function uploadLogoVariant(file: File, slot: string, setter: (url: string | null) => void) {
    const url = await uploadFile(file, slot);
    if (url) setter(url);
  }

  async function uploadAssetFile(file: File, type: BrandAsset["type"], variant?: string) {
    const url = await uploadFile(file, type);
    if (!url) return;

    const { data } = await supabase.from("brand_assets").insert({
      brand_id: id,
      type,
      variant: variant || null,
      label: file.name.replace(/\.[^.]+$/, ""),
      file_url: url,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    }).select().single();

    if (data) setAssets((prev) => [data, ...prev]);
  }

  async function deleteAsset(assetId: string) {
    await supabase.from("brand_assets").delete().eq("id", assetId);
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  }

  async function saveKit() {
    if (!brand) return;
    setSaving(true);
    setSaved(false);

    const updates: Record<string, unknown> = {
      logo_primary_url: logoPrimary,
      logo_dark_url: logoDark,
      logo_light_url: logoLight,
      logo_mark_url: logoMark,
      logo_url: logoPrimary || brand.logo_url,
      website: website || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      brand_colors: brandColors,
      font_primary: fontPrimary || null,
      font_secondary: fontSecondary || null,
      font_primary_url: fontPrimaryUrl || null,
      font_secondary_url: fontSecondaryUrl || null,
      brand_guidelines_url: guidelinesUrl || null,
      kit_notes: kitNotes || null,
    };

    const { data } = await supabase
      .from("brands")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (data) setBrand(data as BrandKit);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function triggerFileInput(accept: string, onFile: (f: File) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) onFile(f);
    };
    input.click();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!brand) return null;

  const logoAssets = assets.filter((a) => a.type === "logo");
  const fontAssets = assets.filter((a) => a.type === "font");
  const guidelineAssets = assets.filter((a) => a.type === "guideline");
  const allColors = [
    ...(primaryColor ? [primaryColor] : []),
    ...brandColors.map((c) => c.hex),
  ];

  const TABS: { key: BrandTab; label: string }[] = [
    { key: "campaigns", label: "Campaigns" },
    { key: "brand-kit", label: "Brand Kit" },
  ];

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 border-b border-gray-800 bg-black/90 backdrop-blur px-8 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard?tab=brands"
              className="text-sm font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Brands
            </Link>
            <span className="text-gray-700">/</span>
            <span className="text-sm font-black text-white">{brand.name}</span>
            {website && (
              <a
                href={website.startsWith("http") ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded transition-colors"
              >
                Website ↗
              </a>
            )}
          </div>
          {activeTab === "brand-kit" && (
            <button
              onClick={saveKit}
              disabled={saving}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
                saved
                  ? "bg-green-600 text-white"
                  : "bg-[#D73F09] hover:bg-[#B33407] text-white"
              } disabled:opacity-50`}
            >
              {saved ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved
                </>
              ) : saving ? "Saving..." : "Save Kit"}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8">
        {/* Brand identity header card */}
        <div className="p-6 mt-8 bg-[#111] border border-gray-800 rounded-2xl flex items-start gap-6">
          <div
            className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-800 flex items-center justify-center"
            style={{
              backgroundImage: "linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%), linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 6px 6px",
            }}
          >
            {logoPrimary ? (
              <img src={logoPrimary} alt={brand.name} className="w-full h-full object-contain" />
            ) : (
              <span
                className="w-full h-full flex items-center justify-center text-2xl font-black text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {getInitials(brand.name)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white mb-2">{brand.name}</h1>
            {website && (
              <a
                href={website.startsWith("http") ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {website}
              </a>
            )}
            {allColors.length > 0 && (
              <div className="flex gap-1.5 mt-3">
                {allColors.map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-6 border-b border-gray-800">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-bold rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? "text-white border-b-2 border-[#D73F09] bg-white/5"
                  : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════ CAMPAIGNS TAB ════════════ */}
        {activeTab === "campaigns" && (
          <div className="py-8 space-y-8">
            {campaignsLoading ? (
              <div className="text-gray-500 text-center py-20">Loading...</div>
            ) : brandCampaigns.length === 0 && recaps.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 mb-2">No campaigns yet for {brand.name}.</p>
              </div>
            ) : (
              <>
                {/* Brand Campaigns section */}
                {brandCampaigns.length > 0 && (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Campaigns</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {brandCampaigns.map((c) => (
                        <div
                          key={c.id}
                          className="p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-black text-white">{c.name}</h3>
                            <span
                              className={`text-[10px] font-bold px-2 py-1 rounded ${
                                c.status === "active"
                                  ? "bg-green-900/30 text-green-400"
                                  : "bg-gray-800 text-gray-500"
                              }`}
                            >
                              {c.status === "active" ? "Active" : "Archived"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-gray-500">{formatMonth(c.created_at)}</span>
                            {c.budget != null && c.budget > 0 && (
                              <span className="text-xs font-bold text-gray-400">{formatBudget(c.budget)}</span>
                            )}
                            {c.has_brief && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-900/30 text-purple-400">Brief</span>
                            )}
                            {c.has_tracker && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/30 text-blue-400">Tracker</span>
                            )}
                            {c.drive_folder_url && (
                              <a
                                href={c.drive_folder_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-white transition-colors"
                                title="Drive Folder"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Recaps section */}
                {recaps.length > 0 && (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Recaps</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recaps.map((r) => (
                        <div
                          key={r.id}
                          className="p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-black text-white">{r.name}</h3>
                            <span
                              className={`text-[10px] font-bold px-2 py-1 rounded ${
                                r.published
                                  ? "bg-green-900/30 text-green-400"
                                  : "bg-gray-800 text-gray-500"
                              }`}
                            >
                              {r.published ? "Published" : "Draft"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{formatMonth(r.created_at)}</span>
                            <Link
                              href={`/dashboard/${r.id}`}
                              className="text-xs font-bold text-[#D73F09] hover:underline"
                            >
                              Edit
                            </Link>
                            {r.published && r.slug && (
                              <a
                                href={`/recap/${r.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-gray-500 hover:text-white transition-colors"
                              >
                                View Live ↗
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════ BRAND KIT TAB ════════════ */}
        {activeTab === "brand-kit" && (
          <div className="py-8 space-y-10">
            {/* ── Logo Variations ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Logo Variations</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <UploadZone
                  label="Primary Logo"
                  imageUrl={logoPrimary}
                  uploading={uploadingSlot === "primary"}
                  onUpload={(f) => uploadLogoVariant(f, "primary", setLogoPrimary)}
                />
                <UploadZone
                  label="Dark Version"
                  imageUrl={logoDark}
                  uploading={uploadingSlot === "dark"}
                  onUpload={(f) => uploadLogoVariant(f, "dark", setLogoDark)}
                />
                <UploadZone
                  label="Light / White Version"
                  imageUrl={logoLight}
                  uploading={uploadingSlot === "light"}
                  onUpload={(f) => uploadLogoVariant(f, "light", setLogoLight)}
                />
                <UploadZone
                  label="Logo Mark / Icon"
                  imageUrl={logoMark}
                  uploading={uploadingSlot === "mark"}
                  onUpload={(f) => uploadLogoVariant(f, "mark", setLogoMark)}
                />
              </div>

              {/* Additional logo files */}
              {logoAssets.length > 0 && (
                <div className="mt-4 border border-gray-800 rounded-xl overflow-hidden">
                  {logoAssets.map((a) => (
                    <AssetRow key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} />
                  ))}
                </div>
              )}
              <button
                onClick={() => triggerFileInput("image/*,.svg,.ai,.eps", (f) => uploadAssetFile(f, "logo"))}
                className="mt-3 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
              >
                + Upload more logo files
              </button>
            </section>

            {/* ── Color Palette ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Color Palette</h2>
              <div className="space-y-3">
                {/* Primary */}
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-lg border border-white/10 overflow-hidden cursor-pointer" style={{ backgroundColor: primaryColor }}>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-28 px-2 py-1.5 bg-black border border-gray-800 rounded-lg text-xs text-gray-400 font-mono outline-none focus:border-gray-600 transition-colors"
                  />
                  <span className="text-xs text-gray-600 font-bold">Primary</span>
                </div>
                {/* Secondary */}
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-lg border border-white/10 overflow-hidden cursor-pointer" style={{ backgroundColor: secondaryColor }}>
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-28 px-2 py-1.5 bg-black border border-gray-800 rounded-lg text-xs text-gray-400 font-mono outline-none focus:border-gray-600 transition-colors"
                  />
                  <span className="text-xs text-gray-600 font-bold">Secondary</span>
                </div>

                {/* Brand colors */}
                <div className="mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block mb-2">Brand Colors</span>
                  <div className="flex flex-wrap gap-2">
                    {brandColors.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-[#111] border border-gray-800 rounded-lg">
                        <div className="relative w-6 h-6 rounded border border-white/10 overflow-hidden cursor-pointer" style={{ backgroundColor: c.hex }}>
                          <input
                            type="color"
                            value={c.hex}
                            onChange={(e) => {
                              const updated = [...brandColors];
                              updated[i] = { ...updated[i], hex: e.target.value };
                              setBrandColors(updated);
                            }}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                        </div>
                        <input
                          value={c.name}
                          placeholder="Name"
                          onChange={(e) => {
                            const updated = [...brandColors];
                            updated[i] = { ...updated[i], name: e.target.value };
                            setBrandColors(updated);
                          }}
                          className="w-20 px-1 py-0.5 bg-transparent border-none text-xs text-gray-400 outline-none"
                        />
                        <span className="text-[10px] text-gray-600 font-mono">{c.hex}</span>
                        <button
                          onClick={() => setBrandColors(brandColors.filter((_, j) => j !== i))}
                          className="text-gray-700 hover:text-red-400 transition-colors ml-1"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setBrandColors([...brandColors, { hex: "#888888", name: "" }])}
                      className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-white border border-dashed border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
                    >
                      + Add Color
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Typography ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Typography</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Primary Font</label>
                  <input
                    value={fontPrimary}
                    onChange={(e) => setFontPrimary(e.target.value)}
                    placeholder="e.g. Inter, Helvetica..."
                    className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white placeholder-gray-700 outline-none focus:border-gray-600 transition-colors"
                  />
                  <input
                    value={fontPrimaryUrl}
                    onChange={(e) => setFontPrimaryUrl(e.target.value)}
                    placeholder="Font URL (Google Fonts, etc.)..."
                    className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-gray-400 placeholder-gray-700 outline-none focus:border-gray-600 transition-colors"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Secondary Font</label>
                  <input
                    value={fontSecondary}
                    onChange={(e) => setFontSecondary(e.target.value)}
                    placeholder="e.g. Georgia, Merriweather..."
                    className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white placeholder-gray-700 outline-none focus:border-gray-600 transition-colors"
                  />
                  <input
                    value={fontSecondaryUrl}
                    onChange={(e) => setFontSecondaryUrl(e.target.value)}
                    placeholder="Font URL..."
                    className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-gray-400 placeholder-gray-700 outline-none focus:border-gray-600 transition-colors"
                  />
                </div>
              </div>

              {fontAssets.length > 0 && (
                <div className="mt-4 border border-gray-800 rounded-xl overflow-hidden">
                  {fontAssets.map((a) => (
                    <AssetRow key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} />
                  ))}
                </div>
              )}
              <button
                onClick={() => triggerFileInput(".ttf,.otf,.woff,.woff2", (f) => uploadAssetFile(f, "font"))}
                className="mt-3 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
              >
                + Upload font files
              </button>
            </section>

            {/* ── Brand Guidelines ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Brand Guidelines</h2>
              <input
                value={guidelinesUrl}
                onChange={(e) => setGuidelinesUrl(e.target.value)}
                placeholder="Brand guidelines URL..."
                className="w-full max-w-lg px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-gray-400 placeholder-gray-700 outline-none focus:border-gray-600 transition-colors mb-3"
              />

              {guidelineAssets.length > 0 && (
                <div className="border border-gray-800 rounded-xl overflow-hidden mb-3">
                  {guidelineAssets.map((a) => (
                    <AssetRow key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} />
                  ))}
                </div>
              )}
              <button
                onClick={() => triggerFileInput(".pdf,image/*", (f) => uploadAssetFile(f, "guideline"))}
                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
              >
                + Upload brand guidelines PDF
              </button>
            </section>

            {/* ── Notes ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Notes</h2>
              <textarea
                value={kitNotes}
                onChange={(e) => setKitNotes(e.target.value)}
                placeholder="Any notes about this brand's kit, preferences, usage rules..."
                rows={4}
                className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-gray-600 transition-colors resize-y"
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
