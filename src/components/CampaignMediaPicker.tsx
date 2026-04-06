"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

export interface MediaPickerResult {
  type: "image" | "video";
  url: string;
  brand: string;
  campaign: string;
  campaign_id: string;
  campaign_recap_id?: string;
}

export interface CampaignMediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaPickerResult) => void;
  /** 'full' = Brand → Campaign → Media (default). 'media-only' = skip to media step for a pre-set campaign. */
  mode?: "full" | "media-only";
  /** Required when mode='media-only' — the campaign to browse media for */
  initialCampaign?: { id: string; name: string; brand_name: string };
}

type Step = "brand" | "campaign" | "media";
type MediaTab = "browse" | "upload" | "url";

interface BrandRow {
  id: string;
  name: string;
}

interface CampaignRow {
  id: string;
  name: string;
  brand_name: string;
  source: "recap" | "brand_campaign";
  hasMedia?: boolean;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
const VIDEO_EXTS = ["mp4", "mov", "webm", "avi"];
const RAW_EXTS = ["cr2", "nef", "arw", "raf", "dng", "orf", "rw2", "pef", "srw", "tiff", "tif", "bmp"];

function ext(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

// ── Inline styles ──────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.8)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial, sans-serif",
};

const card: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  maxWidth: 720,
  width: "95vw",
  maxHeight: "80vh",
  overflowY: "auto",
  padding: 24,
  position: "relative",
  color: "#fff",
};

const closeBtn: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.5)",
  fontSize: 22,
  cursor: "pointer",
};

const breadcrumb: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.4)",
  marginBottom: 16,
  fontWeight: 700,
};

const breadcrumbActive: React.CSSProperties = {
  color: "#D73F09",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#111",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  fontFamily: "Arial, sans-serif",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 12,
};

const listItem: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 8,
  cursor: "pointer",
  transition: "background 0.15s",
  border: "1px solid rgba(255,255,255,0.06)",
  marginBottom: 6,
};

const backBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.5)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
  marginBottom: 12,
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "8px 20px",
  borderRadius: 20,
  border: "none",
  background: active ? "#D73F09" : "#111",
  color: active ? "#fff" : "rgba(255,255,255,0.55)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
});

const thumbGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 10,
};

const thumbCell: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1",
  borderRadius: 8,
  overflow: "hidden",
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.08)",
  position: "relative",
};

const dropZone = (dragging: boolean): React.CSSProperties => ({
  border: `2px dashed ${dragging ? "#D73F09" : "rgba(255,255,255,0.15)"}`,
  borderRadius: 12,
  padding: 40,
  textAlign: "center",
  color: dragging ? "#D73F09" : "rgba(255,255,255,0.4)",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.2s",
  marginBottom: 12,
});

const actionBtn: React.CSSProperties = {
  padding: "10px 28px",
  background: "#D73F09",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export default function CampaignMediaPicker({
  open,
  onClose,
  onSelect,
  mode = "full",
  initialCampaign,
}: CampaignMediaPickerProps) {
  const supabase = createBrowserSupabase();

  const [step, setStep] = useState<Step>("brand");
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<BrandRow | null>(null);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);

  const [mediaTab, setMediaTab] = useState<MediaTab>("browse");
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [includeVideos, setIncludeVideos] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pasteUrl, setPasteUrl] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setMediaTab("browse");
      setFiles([]);
      setUploadedUrl(null);
      setPasteUrl("");

      if (mode === "media-only" && initialCampaign) {
        setSelectedCampaign({ id: initialCampaign.id, name: initialCampaign.name, brand_name: initialCampaign.brand_name, source: "recap" });
        setStep("media");
        loadFiles(initialCampaign.id);
      } else {
        setStep("brand");
        setSelectedBrand(null);
        setSelectedCampaign(null);
        setBrandSearch("");
        setCampaignSearch("");
        loadBrands();
      }
    }
  }, [open]);

  // ── Data loaders ─────────────────────────────────────
  const loadBrands = async () => {
    const { data } = await supabase
      .from("brands")
      .select("id, name")
      .eq("archived", false)
      .order("name");
    setBrands(data || []);
  };

  const loadCampaigns = async (brandId: string | null) => {
    // Query campaign_recaps (have media folders)
    let qRecaps = supabase
      .from("campaign_recaps")
      .select("id, name, brands(name)")
      .not("name", "is", null)
      .neq("name", "")
      .order("created_at", { ascending: false })
      .limit(50);
    if (brandId) qRecaps = qRecaps.eq("brand_id", brandId);

    // Query brand_campaigns (may not have media yet)
    let qBrand = supabase
      .from("brand_campaigns")
      .select("id, name, brands(name)")
      .not("name", "is", null)
      .neq("name", "")
      .order("created_at", { ascending: false })
      .limit(50);
    if (brandId) qBrand = qBrand.eq("brand_id", brandId);

    const [{ data: recaps }, { data: brandCampaigns }] = await Promise.all([qRecaps, qBrand]);

    const merged: CampaignRow[] = [];
    const seen = new Set<string>();

    // Recaps first (they have media)
    for (const d of (recaps || []) as Record<string, unknown>[]) {
      const key = `${String(d.name).toLowerCase()}|${String((d.brands as any)?.name || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ id: String(d.id), name: String(d.name), brand_name: String((d.brands as any)?.name || ""), source: "recap", hasMedia: true });
    }

    // Then brand_campaigns (dedup by name+brand)
    for (const d of (brandCampaigns || []) as Record<string, unknown>[]) {
      const key = `${String(d.name).toLowerCase()}|${String((d.brands as any)?.name || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ id: String(d.id), name: String(d.name), brand_name: String((d.brands as any)?.name || ""), source: "brand_campaign" });
    }

    setCampaigns(merged);
  };

  const loadFiles = useCallback(
    async (campaignId: string) => {
      setLoadingFiles(true);

      // Recursively list all files including nested folders
      const allFiles: { name: string; path: string }[] = [];
      const listFolder = async (prefix: string) => {
        const { data } = await supabase.storage
          .from("campaign-media")
          .list(prefix, { limit: 200 });
        if (!data) return;
        for (const f of data) {
          if (!f.name) continue;
          const fullPath = `${prefix}/${f.name}`;
          // If no extension, assume it's a folder
          if (!f.name.includes(".")) {
            await listFolder(fullPath);
          } else {
            allFiles.push({ name: f.name, path: fullPath });
          }
        }
      };
      await listFolder(campaignId);

      const items = allFiles
        .filter((f) => {
          const e = ext(f.name);
          if (IMAGE_EXTS.includes(e)) return true;
          if (includeVideos && VIDEO_EXTS.includes(e)) return true;
          return false;
        })
        .map((f) => {
          const { data: { publicUrl } } = supabase.storage
            .from("campaign-media")
            .getPublicUrl(f.path);
          return { name: f.name, url: publicUrl };
        });

      setFiles(items);
      setLoadingFiles(false);
    },
    [includeVideos, supabase]
  );

  // Reload files when includeVideos changes
  useEffect(() => {
    if (step === "media" && selectedCampaign) {
      loadFiles(selectedCampaign.id);
    }
  }, [includeVideos, step, selectedCampaign, loadFiles]);

  // ── Handlers ─────────────────────────────────────────
  const selectBrand = (brand: BrandRow | null) => {
    setSelectedBrand(brand);
    setCampaignSearch("");
    loadCampaigns(brand?.id || null);
    setStep("campaign");
  };

  const selectCampaign = (campaign: CampaignRow) => {
    setSelectedCampaign(campaign);
    setMediaTab("browse");
    setUploadedUrl(null);
    setPasteUrl("");
    setStep("media");
    loadFiles(campaign.id);
  };

  const handleFileSelect = (file: { name: string; url: string }) => {
    if (!selectedCampaign) return;
    const e = ext(file.name);
    onSelect({
      type: VIDEO_EXTS.includes(e) ? "video" : "image",
      url: file.url,
      brand: selectedCampaign.brand_name,
      campaign: selectedCampaign.name,
      campaign_id: selectedCampaign.id,
      campaign_recap_id: selectedCampaign.source === "recap" ? selectedCampaign.id : undefined,
    });
    onClose();
  };

  const uploadFile = async (file: File) => {
    if (!selectedCampaign) return;
    setUploading(true);

    let processedFile = file;

    // Auto-convert unsupported image formats to JPEG
    const fileExt = ext(file.name);
    const isImage = file.type.startsWith("image/") || RAW_EXTS.includes(fileExt);
    const supportedImage = IMAGE_EXTS.includes(fileExt);

    if (isImage && !supportedImage) {
      try {
        let blob: Blob;
        if (RAW_EXTS.includes(fileExt)) {
          // RAW files: convert server-side via sharp
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/convert-image", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Server conversion failed");
          blob = await res.blob();
        } else if (file.type === "image/heic" || file.type === "image/heif" || fileExt === "heic" || fileExt === "heif") {
          const heic2any = (await import("heic2any")).default;
          const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
          blob = Array.isArray(result) ? result[0] : result;
        } else {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
          ctx.drawImage(bitmap, 0, 0);
          blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.92)
          );
          bitmap.close();
        }
        const newName = file.name.replace(/\.[^.]+$/, ".jpg");
        processedFile = new File([blob], newName, { type: "image/jpeg" });
      } catch (err) {
        console.error("Image conversion failed, uploading original:", err);
      }
    }

    const ts = Date.now();
    const path = `${selectedCampaign.id}/homepage/${ts}-${processedFile.name}`;
    const { error } = await supabase.storage
      .from("campaign-media")
      .upload(path, processedFile);
    if (!error) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("campaign-media").getPublicUrl(path);
      setUploadedUrl(publicUrl);
      const e = ext(processedFile.name);
      onSelect({
        type: VIDEO_EXTS.includes(e) ? "video" : "image",
        url: publicUrl,
        brand: selectedCampaign.brand_name,
        campaign: selectedCampaign.name,
        campaign_id: selectedCampaign.id,
        campaign_recap_id: selectedCampaign.source === "recap" ? selectedCampaign.id : undefined,
      });
      onClose();
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handlePasteSelect = () => {
    if (!pasteUrl || !selectedCampaign) return;
    onSelect({
      type: "image",
      url: pasteUrl,
      brand: selectedCampaign.brand_name,
      campaign: selectedCampaign.name,
      campaign_id: selectedCampaign.id,
      campaign_recap_id: selectedCampaign.source === "recap" ? selectedCampaign.id : undefined,
    });
    onClose();
  };

  if (!open) return null;

  // ── Filter helpers ───────────────────────────────────
  const filteredBrands = brandSearch
    ? brands.filter((b) =>
        b.name.toLowerCase().includes(brandSearch.toLowerCase())
      )
    : brands;

  const filteredCampaigns = campaignSearch
    ? campaigns.filter(
        (c) =>
          c.name.toLowerCase().includes(campaignSearch.toLowerCase()) ||
          c.brand_name.toLowerCase().includes(campaignSearch.toLowerCase())
      )
    : campaigns;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <button style={closeBtn} onClick={onClose}>
          &times;
        </button>

        {/* Breadcrumb */}
        <div style={breadcrumb}>
          <span
            style={step === "brand" ? breadcrumbActive : { cursor: "pointer" }}
            onClick={() => {
              setStep("brand");
              setSelectedBrand(null);
              setSelectedCampaign(null);
            }}
          >
            Brand
          </span>
          <span style={{ margin: "0 8px" }}>&gt;</span>
          <span
            style={
              step === "campaign"
                ? breadcrumbActive
                : step === "media"
                ? { cursor: "pointer" }
                : {}
            }
            onClick={() => {
              if (step === "media") {
                setStep("campaign");
                setSelectedCampaign(null);
              }
            }}
          >
            Campaign
          </span>
          <span style={{ margin: "0 8px" }}>&gt;</span>
          <span style={step === "media" ? breadcrumbActive : {}}>Media</span>
        </div>

        {/* ── STEP 1: Brand ─────────────────────────────── */}
        {step === "brand" && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>
              Select a Brand
            </h3>
            <input
              style={searchInput}
              placeholder="Search brands..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              autoFocus
            />
            <div
              style={{
                ...listItem,
                background: "#111",
                fontWeight: 800,
                color: "#D73F09",
              }}
              onClick={() => selectBrand(null)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(215,63,9,0.1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#111")
              }
            >
              All Brands
            </div>
            {filteredBrands.map((b) => (
              <div
                key={b.id}
                style={listItem}
                onClick={() => selectBrand(b)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name}</div>
              </div>
            ))}
            {filteredBrands.length === 0 && (
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 13,
                  padding: 16,
                  textAlign: "center",
                }}
              >
                No brands found
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Campaign ──────────────────────────── */}
        {step === "campaign" && (
          <div>
            <button style={backBtn} onClick={() => { setStep("brand"); setSelectedBrand(null); }}>
              &larr; Back to Brands
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>
              Select a Campaign
              {selectedBrand && (
                <span style={{ color: "#D73F09", marginLeft: 8, fontSize: 14 }}>
                  ({selectedBrand.name})
                </span>
              )}
            </h3>
            <input
              style={searchInput}
              placeholder="Search campaigns..."
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              autoFocus
            />
            {filteredCampaigns.map((c) => (
              <div
                key={c.id}
                style={listItem}
                onClick={() => selectCampaign(c)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#D73F09",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 2,
                  }}
                >
                  {c.brand_name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  {c.hasMedia && <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(215,63,9,0.15)", color: "#D73F09", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>has media</span>}
                </div>
              </div>
            ))}
            {filteredCampaigns.length === 0 && (
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 13,
                  padding: 16,
                  textAlign: "center",
                }}
              >
                No campaigns found
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Media ─────────────────────────────── */}
        {step === "media" && selectedCampaign && (
          <div>
            <button style={backBtn} onClick={() => { setStep("campaign"); setSelectedCampaign(null); }}>
              &larr; Back to Campaigns
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>
              {selectedCampaign.name}
              <span style={{ color: "#D73F09", marginLeft: 8, fontSize: 14 }}>
                {selectedCampaign.brand_name}
              </span>
            </h3>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["browse", "upload", "url"] as MediaTab[]).map((t) => (
                <button
                  key={t}
                  style={tabBtn(mediaTab === t)}
                  onClick={() => setMediaTab(t)}
                >
                  {t === "browse"
                    ? "Browse"
                    : t === "upload"
                    ? "Upload"
                    : "URL"}
                </button>
              ))}
            </div>

            {/* Browse tab */}
            {mediaTab === "browse" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <label
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 700,
                    }}
                  >
                    Include videos
                  </label>
                  <input
                    type="checkbox"
                    checked={includeVideos}
                    onChange={(e) => setIncludeVideos(e.target.checked)}
                  />
                </div>
                {loadingFiles ? (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 13,
                      padding: 24,
                      textAlign: "center",
                    }}
                  >
                    Loading...
                  </div>
                ) : files.length > 0 ? (
                  <div style={thumbGrid}>
                    {files.map((f, i) => (
                      <div
                        key={i}
                        style={thumbCell}
                        onClick={() => handleFileSelect(f)}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.borderColor =
                            "rgba(215,63,9,0.6)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.borderColor =
                            "rgba(255,255,255,0.08)")
                        }
                      >
                        {VIDEO_EXTS.includes(ext(f.name)) ? (
                          <>
                            <video src={f.url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "10px solid #111", marginLeft: 2 }} />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={f.url}
                            alt={f.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 13,
                      padding: 24,
                      textAlign: "center",
                    }}
                  >
                    No media files found for this campaign
                  </div>
                )}
              </div>
            )}

            {/* Upload tab */}
            {mediaTab === "upload" && (
              <div>
                <div
                  style={dropZone(dragging)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading
                    ? "Uploading..."
                    : "Drag & drop a file here, or click to browse"}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                  }}
                />
                {uploadedUrl && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: "#111",
                      borderRadius: 8,
                      textAlign: "center",
                    }}
                  >
                    <img
                      src={uploadedUrl}
                      alt="Uploaded"
                      style={{
                        maxWidth: "100%",
                        maxHeight: 200,
                        borderRadius: 8,
                      }}
                    />
                    <div
                      style={{
                        color: "#4caf50",
                        fontSize: 12,
                        fontWeight: 700,
                        marginTop: 8,
                      }}
                    >
                      Uploaded &amp; selected!
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* URL tab */}
            {mediaTab === "url" && (
              <div>
                <input
                  style={searchInput}
                  placeholder="Paste image URL..."
                  value={pasteUrl}
                  onChange={(e) => setPasteUrl(e.target.value)}
                  autoFocus
                />
                {pasteUrl && (
                  <div style={{ marginBottom: 12 }}>
                    <img
                      src={pasteUrl}
                      alt="Preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: 200,
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      onError={(e) =>
                        (e.currentTarget.style.display = "none")
                      }
                    />
                  </div>
                )}
                <button
                  style={{
                    ...actionBtn,
                    opacity: pasteUrl ? 1 : 0.4,
                  }}
                  disabled={!pasteUrl}
                  onClick={handlePasteSelect}
                >
                  Use This Image
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
