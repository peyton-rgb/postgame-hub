"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign, Athlete, Media } from "@/lib/types";
import { PostgameLogo } from "@/components/PostgameLogo";
import DrivePicker from "@/components/DrivePicker";
import { extractDriveFolderId } from "@/lib/drive-url";
import Link from "next/link";

// Feature 2: per-athlete manual upload (browser → Storage, then JSON insert).
const UPLOAD_BUCKET = "campaign-media";
const ACCEPTED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
];
const ACCEPTED_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif", "mp4", "mov", "webm"];
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB — tune here if needed
function sanitizeUploadName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}
function uploadExt(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

interface Brand {
  name: string;
  campaigns: Campaign[];
  totalMedia: number;
}

type View =
  | { level: "brands" }
  | { level: "campaigns"; brand: string }
  | { level: "athletes"; brand: string; campaign: Campaign }
  | { level: "media"; brand: string; campaign: Campaign; athlete: Athlete };

export default function MediaLibrary() {
  const supabase = createBrowserSupabase();
  const [view, setView] = useState<View>({ level: "brands" });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [athleteMediaCounts, setAthleteMediaCounts] = useState<Record<string, number>>({});
  const [campaignCounts, setCampaignCounts] = useState<Record<string, { athletes: number; media: number }>>({});
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<Media | null>(null);

  // Feature 2: manual upload
  const [uploads, setUploads] = useState<
    { name: string; status: "pending" | "uploading" | "done" | "failed"; error?: string }[]
  >([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drive-import empty-state flow ──
  const [urlInput, setUrlInput] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  // When the folder is flat (no athlete subfolders) we show a warning instead.
  const [flatInfo, setFlatInfo] = useState<{ fileCount: number } | null>(null);
  // When the campaign is already linked to a different folder, confirm first.
  const [confirmReplace, setConfirmReplace] = useState<
    { existingFolderId: string; newFolderId: string } | null
  >(null);
  // DrivePicker wiring.
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [drivePickerAthletes, setDrivePickerAthletes] = useState<
    { id: string; name: string; sort_order: number }[]
  >([]);
  const [drivePickerFolderId, setDrivePickerFolderId] = useState<string | null>(null);
  const [drivePickerCampaignId, setDrivePickerCampaignId] = useState<string | null>(null);
  const [alreadyImportedFileIds, setAlreadyImportedFileIds] = useState<string[]>([]);

  // Feature 1: "Import more from Drive" expansion on an already-populated campaign.
  const [importMoreOpen, setImportMoreOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Reset the import UI whenever we navigate to a different campaign's view.
  function resetImportUI() {
    setUrlInput("");
    setDiscoverError(null);
    setFlatInfo(null);
    setConfirmReplace(null);
    setImportMoreOpen(false);
  }

  async function loadData() {
    setLoading(true);
    // Fetch all data in parallel
    const [campsRes, athletesRes, mediaRes] = await Promise.all([
      supabase.from("campaign_recaps").select("*").order("created_at", { ascending: false }),
      supabase.from("athletes").select("id, campaign_id"),
      supabase.from("media").select("id, campaign_id").eq("is_video_thumbnail", false),
    ]);
    const camps = campsRes.data || [];
    const allAthletes = athletesRes.data || [];
    const allMedia = mediaRes.data || [];
    setCampaigns(camps);

    const counts: Record<string, { athletes: number; media: number }> = {};
    for (const c of camps) {
      counts[c.id] = {
        athletes: allAthletes.filter((a) => a.campaign_id === c.id).length,
        media: allMedia.filter((m) => m.campaign_id === c.id).length,
      };
    }
    setCampaignCounts(counts);

    // Group campaigns by brand (client_name)
    const brandMap = new Map<string, Campaign[]>();
    for (const c of camps) {
      const existing = brandMap.get(c.client_name) || [];
      existing.push(c);
      brandMap.set(c.client_name, existing);
    }
    setBrands(
      Array.from(brandMap.entries()).map(([name, brandCamps]) => ({
        name,
        campaigns: brandCamps,
        totalMedia: brandCamps.reduce((sum, c) => sum + (counts[c.id]?.media || 0), 0),
      }))
    );
    setLoading(false);
  }

  function openBrand(brandName: string) {
    setView({ level: "campaigns", brand: brandName });
  }

  async function openCampaign(campaign: Campaign, brandName: string) {
    resetImportUI();
    setLoading(true);
    // Fetch athletes and their media counts in parallel
    const [athletesRes, mediaRes] = await Promise.all([
      supabase.from("athletes").select("*").eq("campaign_id", campaign.id).order("sort_order", { ascending: true }),
      supabase.from("media").select("id, athlete_id").eq("campaign_id", campaign.id).eq("is_video_thumbnail", false),
    ]);
    const athleteData = athletesRes.data || [];
    const mediaData = mediaRes.data || [];
    setAthletes(athleteData);

    const mediaCounts: Record<string, number> = {};
    for (const a of athleteData) {
      mediaCounts[a.id] = mediaData.filter((m) => m.athlete_id === a.id).length;
    }
    setAthleteMediaCounts(mediaCounts);

    setView({ level: "athletes", brand: brandName, campaign });
    setLoading(false);
  }

  async function openAthlete(athlete: Athlete) {
    if (view.level !== "athletes") return;
    setLoading(true);
    setUploads([]);
    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("athlete_id", athlete.id)
      .eq("is_video_thumbnail", false)
      .order("sort_order", { ascending: true });
    setMedia(data || []);
    setView({ level: "media", brand: view.brand, campaign: view.campaign, athlete });
    setLoading(false);
  }

  async function reloadAthleteMedia() {
    if (view.level !== "media") return;
    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("athlete_id", view.athlete.id)
      .eq("is_video_thumbnail", false)
      .order("sort_order", { ascending: true });
    setMedia(data || []);
  }

  // Serial upload: browser → Storage, then POST the path to /api/media/upload
  // to insert the media row. One file at a time (matches the DrivePicker import
  // pattern; avoids hammering Storage). Per-file status; failures don't block the rest.
  async function uploadFiles(files: File[]) {
    if (view.level !== "media") return;
    const campaignId = view.campaign.id;
    const athleteId = view.athlete.id;

    setUploads(files.map((f) => ({ name: f.name, status: "pending" as const })));
    let anySucceeded = false;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = uploadExt(f.name);

      // Cheap client-side validation — reject before any Storage write.
      if (!ACCEPTED_MIME.includes(f.type) && !ACCEPTED_EXT.includes(ext)) {
        setUploads((p) => p.map((u, j) => (j === i ? { ...u, status: "failed", error: "Only images and videos are supported." } : u)));
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        setUploads((p) => p.map((u, j) => (j === i ? { ...u, status: "failed", error: "Too large (max 100 MB)." } : u)));
        continue;
      }

      setUploads((p) => p.map((u, j) => (j === i ? { ...u, status: "uploading" } : u)));
      const storagePath = `${campaignId}/${athleteId}/${Date.now()}-${sanitizeUploadName(f.name)}`;

      try {
        const { error: upErr } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(storagePath, f, { contentType: f.type || undefined, cacheControl: "3600", upsert: false });
        if (upErr) throw new Error(upErr.message);

        const res = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, athleteId, storagePath }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setUploads((p) => p.map((u, j) => (j === i ? { ...u, status: "failed", error: String(data?.error || `HTTP ${res.status}`) } : u)));
        } else {
          anySucceeded = true;
          setUploads((p) => p.map((u, j) => (j === i ? { ...u, status: "done" } : u)));
        }
      } catch (e: any) {
        setUploads((p) => p.map((u, j) => (j === i ? { ...u, status: "failed", error: String(e?.message || e) } : u)));
      }
    }

    if (anySucceeded) await reloadAthleteMedia();
  }

  function goBack() {
    resetImportUI();
    if (view.level === "media") {
      openCampaign(view.campaign, view.brand);
    } else if (view.level === "athletes") {
      setView({ level: "campaigns", brand: view.brand });
    } else if (view.level === "campaigns") {
      setView({ level: "brands" });
    }
  }

  // Discover a Drive folder's structure for the current campaign, then open
  // the existing DrivePicker (per-athlete) or show the flat-folder warning.
  async function handleContinue(force = false) {
    if (view.level !== "athletes") return;
    const campaignId = view.campaign.id;
    setDiscoverError(null);
    setDiscovering(true);
    try {
      const res = await fetch("/api/drive/discover-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl: urlInput, campaignId, force }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDiscoverError(data?.error || `Something went wrong (HTTP ${res.status}).`);
        return;
      }

      if (data.shape === "confirm_replace") {
        setConfirmReplace({
          existingFolderId: data.existingFolderId,
          newFolderId: data.newFolderId,
        });
        return;
      }

      if (data.shape === "flat") {
        setFlatInfo({ fileCount: data.fileCount ?? 0 });
        return;
      }

      if (data.shape === "per_athlete") {
        setConfirmReplace(null);
        setFlatInfo(null);
        setDrivePickerAthletes(data.athletes || []);
        setDrivePickerFolderId(data.folderId);
        setDrivePickerCampaignId(campaignId);
        setAlreadyImportedFileIds(data.alreadyImportedFileIds || []);
        setDrivePickerOpen(true);
        return;
      }

      setDiscoverError("Unexpected response from the server.");
    } catch (e: any) {
      setDiscoverError(String(e?.message || e));
    } finally {
      setDiscovering(false);
    }
  }

  // onImport callback for the DrivePicker — mirrors the recap editor's
  // handleDriveImport: POST each selected file to /api/drive/import, tying
  // it to its athlete, and report progress back to the picker.
  async function handleMediaLibraryImport(
    selections: Record<string, { id: string; name: string }[]>,
    onProgress: (p: {
      current: number;
      total: number;
      currentFile: string;
      succeeded: number;
      failed: number;
      errors: Array<{ file: string; error: string }>;
    }) => void,
    signal?: AbortSignal
  ) {
    const total = Object.values(selections).reduce((sum, files) => sum + files.length, 0);
    let current = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ file: string; error: string }> = [];

    outer: for (const [athleteId, files] of Object.entries(selections)) {
      for (const file of files) {
        if (signal?.aborted) break outer;

        const currentFile = String(file?.name || "Unknown file");
        onProgress({ current, total, currentFile, succeeded, failed, errors: [...errors] });

        try {
          const res = await fetch("/api/drive/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileId: file.id,
              fileName: file.name,
              athleteId,
              recapId: drivePickerCampaignId,
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            failed++;
            errors.push({
              file: currentFile,
              error: String(errBody?.error || errBody?.message || `HTTP ${res.status}`),
            });
          } else {
            succeeded++;
          }
        } catch (e: any) {
          failed++;
          errors.push({ file: currentFile, error: String(e?.message || e) });
        } finally {
          current++;
          onProgress({ current, total, currentFile, succeeded, failed, errors: [...errors] });
        }
      }
    }

    return { current, total, currentFile: "", succeeded, failed, errors };
  }

  // Close the picker and refresh the campaign view so freshly-imported
  // athletes and files appear.
  function handleDrivePickerClose() {
    setDrivePickerOpen(false);
    if (view.level === "athletes") {
      resetImportUI();
      openCampaign(view.campaign, view.brand);
    }
  }

  // Get brand campaigns for current view
  function getBrandCampaigns(brandName: string) {
    return campaigns.filter((c) => c.client_name === brandName);
  }

  function Breadcrumb() {
    return (
      <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
        <button
          onClick={() => setView({ level: "brands" })}
          className={`font-bold transition-colors ${
            view.level === "brands" ? "text-white" : "text-gray-500 hover:text-white"
          }`}
        >
          All Brands
        </button>
        {view.level !== "brands" && (
          <>
            <span className="text-gray-600">/</span>
            <button
              onClick={() => openBrand(view.brand)}
              className={`font-bold transition-colors ${
                view.level === "campaigns" ? "text-white" : "text-gray-500 hover:text-white"
              }`}
            >
              {view.brand}
            </button>
          </>
        )}
        {(view.level === "athletes" || view.level === "media") && (
          <>
            <span className="text-gray-600">/</span>
            <button
              onClick={() => openCampaign(view.campaign, view.brand)}
              className={`font-bold transition-colors ${
                view.level === "athletes" ? "text-white" : "text-gray-500 hover:text-white"
              }`}
            >
              {view.campaign.name}
            </button>
          </>
        )}
        {view.level === "media" && (
          <>
            <span className="text-gray-600">/</span>
            <span className="font-bold text-white">{view.athlete.name}</span>
          </>
        )}
      </div>
    );
  }

  // Back button shared across views
  function BackButton() {
    return (
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white font-bold mb-4 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>
    );
  }

  // Shared Drive-import form — used by BOTH the empty state and the
  // "Import more from Drive" expansion. State/handlers stay on the parent.
  const renderImportForm = (heading?: string, subtext?: string) => {
    if (flatInfo) {
      return (
        <div className="bg-[#111] border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">⚠️</span>
            <div>
              <h3 className="font-black text-white mb-2">No athlete subfolders found.</h3>
              <p className="text-sm text-gray-400">
                {flatInfo.fileCount > 0 ? (
                  <>
                    This folder has <span className="font-bold text-white">{flatInfo.fileCount}</span> loose file{flatInfo.fileCount !== 1 ? "s" : ""}, but the Hub needs subfolders (one per athlete) to import. Add athletes to this campaign first in the recap editor, then come back.
                  </>
                ) : (
                  <>This folder is empty. Add athlete subfolders in Drive, or add athletes to this campaign in the recap editor, then come back.</>
                )}
              </p>
              <div className="flex flex-wrap gap-4 mt-4">
                <a
                  href={`/dashboard/${view.level === "athletes" ? view.campaign.id : ""}`}
                  target="_blank"
                  rel="noopener"
                  className="text-[#D73F09] font-bold text-sm hover:underline"
                >
                  → Open campaign in recap editor
                </a>
                <button
                  onClick={() => { setFlatInfo(null); setUrlInput(""); setDiscoverError(null); }}
                  className="text-gray-400 font-bold text-sm hover:text-white"
                >
                  ← Try a different URL
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (confirmReplace) {
      return (
        <div className="bg-[#111] border border-yellow-500/30 rounded-xl p-6">
          <h3 className="font-black text-white mb-2">This campaign is already linked to a different Drive folder.</h3>
          <p className="text-sm text-gray-400 mb-4">Continuing will link it to the new folder you pasted. Existing imported files stay; new athlete subfolders will be added.</p>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={discovering}
              onClick={() => handleContinue(true)}
              className="bg-[#D73F09] hover:bg-[#ff5722] px-5 py-2.5 rounded-lg font-bold uppercase text-sm text-white disabled:opacity-50 transition-colors"
            >
              {discovering ? "Working…" : "Replace & continue"}
            </button>
            <button onClick={() => setConfirmReplace(null)} className="text-gray-400 font-bold text-sm hover:text-white">Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className={heading ? "text-center" : "text-left"}>
        {heading && <h2 className="text-xl font-black text-white mb-2">{heading}</h2>}
        {subtext && <p className="text-sm text-gray-400 mb-6">{subtext}</p>}
        <div className="text-left">
          <input
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setDiscoverError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !discovering && extractDriveFolderId(urlInput)) handleContinue();
            }}
            placeholder="https://drive.google.com/drive/folders/..."
            aria-label="Paste a Drive folder URL to import content"
            className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#D73F09]"
          />
          {discoverError && <div className="text-sm text-red-400 mt-2">{discoverError}</div>}
          <button
            disabled={discovering || !extractDriveFolderId(urlInput)}
            onClick={() => handleContinue()}
            className="w-full mt-4 bg-[#D73F09] hover:bg-[#ff5722] px-6 py-3 rounded-lg font-bold uppercase text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {discovering ? "Scanning folder…" : "Continue"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <PostgameLogo size="md" />
            </Link>
            <h1 className="text-xl font-black">Media Library</h1>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-white font-bold transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <Breadcrumb />

        {loading ? (
          <div className="text-gray-500 text-center py-20">Loading...</div>
        ) : (
          <>
            {/* === BRANDS VIEW === */}
            {view.level === "brands" && (
              brands.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-500 mb-2">No campaigns yet.</p>
                  <Link href="/dashboard" className="text-[#D73F09] font-bold text-sm hover:underline">
                    Create a campaign to get started
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {brands.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => openBrand(b.name)}
                      className="text-left p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-sm truncate group-hover:text-white">{b.name}</h3>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>{b.campaigns.length} campaign{b.campaigns.length !== 1 ? "s" : ""}</span>
                        <span>{b.totalMedia} files</span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* === CAMPAIGNS VIEW === */}
            {view.level === "campaigns" && (
              <>
                <BackButton />
                {(() => {
                  const brandCampaigns = getBrandCampaigns(view.brand);
                  return brandCampaigns.length === 0 ? (
                    <div className="text-center py-20">
                      <p className="text-gray-500 mb-2">No campaigns for this brand.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {brandCampaigns.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => openCampaign(c, view.brand)}
                          className="text-left p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-all group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-[#D73F09]/10 border border-[#D73F09]/20 flex items-center justify-center flex-shrink-0">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D73F09" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-black text-sm truncate group-hover:text-white">{c.name}</h3>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-600">
                            <span>{campaignCounts[c.id]?.athletes || 0} athletes</span>
                            <span>{campaignCounts[c.id]?.media || 0} files</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}

            {/* === ATHLETES VIEW === */}
            {view.level === "athletes" && (
              <>
                <BackButton />
                {athletes.length === 0 ? (
                  <div className="max-w-lg mx-auto py-16">
                    {renderImportForm(
                      "This campaign has no content yet",
                      "Paste a Google Drive folder URL to import content for each athlete"
                    )}
                  </div>
                ) : (
                  <>
                    {/* Feature 1: import more from Drive into an already-populated campaign */}
                    <div className="mb-5">
                      {!importMoreOpen ? (
                        <button
                          onClick={() => { resetImportUI(); setImportMoreOpen(true); }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111] border border-gray-800 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Import more from Drive
                        </button>
                      ) : (
                        <div className="max-w-lg bg-[#111] border border-gray-800 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-white">Import more from Drive</h3>
                            <button
                              onClick={() => { setImportMoreOpen(false); resetImportUI(); }}
                              aria-label="Close"
                              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                          {renderImportForm(
                            undefined,
                            "Paste a Drive folder URL — already-imported files appear greyed out."
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {athletes.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => openAthlete(a)}
                        className="text-left p-5 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-black text-sm truncate group-hover:text-white">{a.name}</h3>
                            <p className="text-xs text-gray-500">
                              {[a.sport, a.school].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-600">
                          <span>{athleteMediaCounts[a.id] || 0} files</span>
                          {a.ig_handle && <span>@{a.ig_handle}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                  </>
                )}
              </>
            )}

            {/* === MEDIA VIEW === */}
            {view.level === "media" && (
              <>
                <BackButton />
                {/* Feature 2: per-athlete manual upload */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const fs = Array.from(e.dataTransfer.files);
                    if (fs.length) uploadFiles(fs);
                  }}
                  className={`mb-5 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                    dragOver ? "border-[#D73F09] bg-[#D73F09]/5" : "border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const fs = Array.from(e.target.files || []);
                      if (fs.length) uploadFiles(fs);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-sm font-bold text-gray-300">Drag and drop files here, or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Images &amp; videos · up to 100 MB each</p>
                </div>

                {uploads.length > 0 && (
                  <div className="mb-6 space-y-1.5">
                    {uploads.map((u, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-xs bg-[#111] border border-gray-800 rounded-lg px-3 py-2">
                        <span className="truncate text-gray-300">{u.name}</span>
                        <span
                          className={
                            u.status === "done" ? "text-green-400 flex-shrink-0"
                            : u.status === "failed" ? "text-red-400 flex-shrink-0"
                            : "text-gray-400 flex-shrink-0"
                          }
                        >
                          {u.status === "uploading" ? "Uploading…"
                            : u.status === "done" ? "✓ Done"
                            : u.status === "failed" ? (u.error || "Failed")
                            : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {media.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-gray-500 mb-2">No media uploaded for this athlete.</p>
                    <Link
                      href={`/dashboard/${view.campaign.id}`}
                      className="text-[#D73F09] font-bold text-sm hover:underline"
                    >
                      Upload content in the campaign editor
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {media.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setLightbox(m)}
                        className="relative aspect-square bg-[#111] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all group"
                      >
                        {m.type === "video" ? (
                          <>
                            {m.thumbnail_url ? (
                              <img
                                src={m.thumbnail_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={m.file_url}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                            )}
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] font-bold text-white flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              VIDEO
                            </div>
                          </>
                        ) : (
                          <img
                            src={m.file_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            <line x1="11" y1="8" x2="11" y2="14" />
                            <line x1="8" y1="11" x2="14" y2="11" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Drive import picker (reuses the recap editor's pipeline) */}
      {drivePickerCampaignId && (
        <DrivePicker
          isOpen={drivePickerOpen}
          onClose={handleDrivePickerClose}
          folderId={drivePickerFolderId}
          recapId={drivePickerCampaignId}
          athletes={drivePickerAthletes}
          alreadyImportedFileIds={alreadyImportedFileIds}
          onFolderConnected={async () => {
            /* no-op: folder is saved by /api/drive/discover-folder */
          }}
          onImport={handleMediaLibraryImport}
          onImportToCollab={async (files) => ({
            succeeded: 0,
            failed: files.length,
            errors: files.map((f) => ({
              file: f.name,
              error: "Collab import isn't available from the Media Library.",
            })),
          })}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-4xl max-h-[85vh] w-full">
            {lightbox.type === "video" ? (
              <video
                src={lightbox.file_url}
                controls
                autoPlay
                className="w-full max-h-[85vh] rounded-lg"
              />
            ) : (
              <img
                src={lightbox.file_url}
                alt=""
                className="w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
