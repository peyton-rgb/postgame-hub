"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign, Athlete, Media, VisibleSections } from "@/lib/types";
import { SchoolBadge } from "@/components/SchoolBadge";
import { ThumbnailModal } from "@/components/ThumbnailModal";
import { MasonryPreview } from "@/components/MasonryPreview";
import { parseMetricsCSV, mergeAthleteData, type ParsedAthlete } from "@/lib/csv-parser";
import MetricsSpreadsheet from "@/components/MetricsSpreadsheet";
import Link from "next/link";
import heic2any from "heic2any";

const SECTION_LABELS: { key: keyof VisibleSections; label: string }[] = [
  { key: "brief", label: "Campaign Brief" },
  { key: "metrics", label: "Campaign Metrics" },
  { key: "platform_breakdown", label: "Platform Breakdown" },
  { key: "top_performers", label: "Top Performers" },
  { key: "content_gallery", label: "Content Gallery" },
  { key: "roster", label: "Campaign Roster" },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

function generateDescription(campaignName: string, clientName: string, parsed: ParsedAthlete[]): {
  description: string;
  platform: string;
  tags: string[];
} {
  const athleteCount = parsed.length;

  // Gather available data
  const schools = new Set(parsed.map((a) => a.school).filter(Boolean));
  const sports = new Set(parsed.map((a) => a.sport).filter(Boolean));
  const schoolCount = schools.size;
  const sportCount = sports.size;

  let totalFollowers = 0;
  let hasIgFeed = false;
  let hasIgReel = false;
  let hasIgStory = false;
  let hasTiktok = false;

  for (const a of parsed) {
    totalFollowers += a.ig_followers || 0;
    if (a.metrics.ig_feed?.post_url) hasIgFeed = true;
    if (a.metrics.ig_reel?.post_url) hasIgReel = true;
    if (a.metrics.ig_story?.count) hasIgStory = true;
    if (a.metrics.tiktok?.post_url) hasTiktok = true;
  }

  const reachStr = fmt(totalFollowers);

  // Build platform string from actual data
  const igParts: string[] = [];
  if (hasIgFeed) igParts.push("Feed");
  if (hasIgReel) igParts.push("Reels");
  if (hasIgStory) igParts.push("Stories");
  const platformStr = [
    igParts.length > 0 ? `Instagram (${igParts.join(" + ")})` : null,
    hasTiktok ? "TikTok" : null,
  ].filter(Boolean).join(" + ") || "Instagram";

  // Build content type descriptions from actual data
  const contentTypes: string[] = [];
  if (hasIgFeed) contentTypes.push("feed posts");
  if (hasIgReel) contentTypes.push("Reels");
  if (hasIgStory) contentTypes.push("Stories");
  if (hasTiktok) contentTypes.push("TikTok");

  // Build description dynamically — only include what we know
  let line1 = `The ${clientName} ${campaignName} campaign activates ${athleteCount} college athletes`;
  if (schoolCount > 0 && sportCount > 0) {
    line1 += ` representing ${schoolCount} universities and ${sportCount} sports`;
  } else if (schoolCount > 0) {
    line1 += ` from ${schoolCount} universities`;
  } else if (sportCount > 0) {
    line1 += ` across ${sportCount} sports`;
  }

  if (contentTypes.length > 0) {
    line1 += ` through ${contentTypes.join(", ")} content`;
  }
  line1 += ".";

  let line2 = "";
  if (totalFollowers > 0) {
    line2 = `\n\nWith a combined social reach of ${reachStr}+ followers`;
    if (sportCount > 0) {
      const sportList = Array.from(sports).slice(0, 5).join(", ");
      line2 += `, this roster delivers audience coverage across ${sportList}`;
    }
    line2 += ` for ${clientName}.`;
  }

  const autoTags = [clientName, "Product Seeding", "Social First", "NIL Campaign"];

  return { description: line1 + line2, platform: platformStr, tags: autoTags };
}

export default function CampaignEditor() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createBrowserSupabase();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [media, setMedia] = useState<Record<string, Media[]>>({});
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<{ athleteId: string; file: File } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Campaign Info state
  const [description, setDescription] = useState("");
  const [quarter, setQuarter] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [platform, setPlatform] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({
    brief: true, metrics: true, platform_breakdown: true,
    top_performers: true, content_gallery: true, roster: true,
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // Brand logo state
  const [brandLogoUrl, setBrandLogoUrl] = useState("");

  // Metrics spreadsheet save state
  const [savingMetrics, setSavingMetrics] = useState(false);

  // Tracker linking state
  const [trackers, setTrackers] = useState<Campaign[]>([]);
  const [linkedTrackerId, setLinkedTrackerId] = useState<string | null>(null);
  const [importingTracker, setImportingTracker] = useState(false);

  // Bulk upload state
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; matched: number; unmatched: string[] }>({ done: 0, total: 0, matched: 0, unmatched: [] });
  const [bulkDragging, setBulkDragging] = useState(false);
  const bulkDragCounter = useRef(0);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const [{ data: camp }, { data: aths }, { data: med }, { data: trks }] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", id).single(),
      supabase.from("athletes").select("*").eq("campaign_id", id).order("sort_order"),
      supabase.from("media").select("*").eq("campaign_id", id).order("sort_order"),
      supabase.from("campaigns").select("*").eq("type", "tracker").order("created_at", { ascending: false }),
    ]);

    setTrackers(trks || []);

    setCampaign(camp);
    setAthletes(aths || []);
    setSelected((aths || []).map((a: Athlete) => a.id));

    // Populate campaign info from settings
    if (camp?.settings) {
      setDescription(camp.settings.description || "");
      setQuarter(camp.settings.quarter || "");
      setCampaignType(camp.settings.campaign_type || "");
      setPlatform(camp.settings.platform || "");
      setTags(camp.settings.tags || []);
      setVisibleSections(camp.settings.visible_sections || {
        brief: true, metrics: true, platform_breakdown: true,
        top_performers: true, content_gallery: true, roster: true,
      });
      setBrandLogoUrl(camp.settings.brand_logo_url || "");
    }

    const grouped: Record<string, Media[]> = {};
    (med || []).forEach((m: Media) => {
      if (!grouped[m.athlete_id]) grouped[m.athlete_id] = [];
      grouped[m.athlete_id].push(m);
    });
    setMedia(grouped);
    setLoading(false);
  }

  async function importFromTracker(trackerId: string) {
    setImportingTracker(true);
    setLinkedTrackerId(trackerId);

    // Fetch athletes from the tracker
    const { data: trackerAthletes } = await supabase
      .from("athletes")
      .select("*")
      .eq("campaign_id", trackerId)
      .order("sort_order");

    if (trackerAthletes && trackerAthletes.length > 0) {
      // Delete existing athletes for this campaign first
      await supabase.from("media").delete().eq("campaign_id", id);
      await supabase.from("athletes").delete().eq("campaign_id", id);

      // Copy tracker athletes into this campaign
      const newRows = trackerAthletes.map((a: Athlete, i: number) => ({
        campaign_id: id,
        name: a.name,
        ig_handle: a.ig_handle || "",
        ig_followers: a.ig_followers || 0,
        school: a.school || "",
        sport: a.sport || "",
        gender: a.gender || "",
        notes: a.notes || "",
        post_type: a.post_type || "IG Feed",
        post_url: a.post_url,
        metrics: a.metrics || {},
        sort_order: i,
      }));

      await supabase.from("athletes").insert(newRows);

      // Reload data
      const { data: aths } = await supabase
        .from("athletes")
        .select("*")
        .eq("campaign_id", id)
        .order("sort_order");
      setAthletes(aths || []);
      setSelected((aths || []).map((a: Athlete) => a.id));
      setMedia({});
    }

    setImportingTracker(false);
  }

  async function saveCampaignInfo() {
    if (!campaign) return;
    setSavingInfo(true);
    const newSettings = {
      ...campaign.settings,
      description, quarter, campaign_type: campaignType,
      platform, tags, visible_sections: visibleSections,
      brand_logo_url: brandLogoUrl,
    };
    const { data } = await supabase
      .from("campaigns")
      .update({ settings: newSettings })
      .eq("id", campaign.id)
      .select()
      .single();
    if (data) setCampaign(data);
    setSavingInfo(false);
  }

  async function saveMetrics(rows: { _key: string; _isNew: boolean; id?: string; name: string; ig_handle: string; ig_followers: number | ""; school: string; sport: string; gender: string; notes: string; post_type: string; metrics: import("@/lib/types").AthleteMetrics }[], deletedIds: string[]) {
    setSavingMetrics(true);

    // Delete removed athletes
    if (deletedIds.length > 0) {
      await supabase.from("athletes").delete().in("id", deletedIds);
    }

    // Upsert existing + insert new
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data = {
        name: row.name,
        school: row.school,
        sport: row.sport,
        ig_handle: row.ig_handle,
        ig_followers: row.ig_followers === "" ? 0 : row.ig_followers,
        gender: row.gender,
        notes: row.notes,
        post_type: row.post_type || "IG Feed",
        post_url: row.metrics?.ig_feed?.post_url || row.metrics?.ig_reel?.post_url || null,
        metrics: row.metrics,
        sort_order: i,
      };

      if (row._isNew) {
        await supabase.from("athletes").insert({ ...data, campaign_id: id });
      } else if (row.id) {
        await supabase.from("athletes").update(data).eq("id", row.id);
      }
    }

    // Auto-generate description if empty
    if (campaign && !description && rows.length > 0) {
      const parsed: ParsedAthlete[] = rows.map((r) => ({
        first: r.name.split(" ")[0] || "",
        last: r.name.split(" ").slice(1).join(" ") || "",
        name: r.name,
        ig_handle: r.ig_handle,
        ig_followers: r.ig_followers === "" ? 0 : r.ig_followers,
        reach_level: "",
        school: r.school,
        sport: r.sport,
        gender: r.gender,
        notes: r.notes,
        metrics: r.metrics || {},
      }));
      const auto = generateDescription(campaign.name, campaign.client_name, parsed);
      setDescription(auto.description);
      setPlatform(auto.platform);
      setTags(auto.tags);

      const newSettings = {
        ...campaign.settings,
        description: auto.description,
        platform: auto.platform,
        tags: auto.tags,
        quarter: quarter || "",
        campaign_type: campaignType || "Product Seeding",
        visible_sections: visibleSections,
        brand_logo_url: brandLogoUrl,
      };
      const { data: updatedCamp } = await supabase
        .from("campaigns")
        .update({ settings: newSettings })
        .eq("id", campaign.id)
        .select()
        .single();
      if (updatedCamp) setCampaign(updatedCamp);
      if (!campaignType) setCampaignType("Product Seeding");
    }

    setSavingMetrics(false);
    await loadData();
  }

  async function convertHeicIfNeeded(file: File): Promise<File> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".heic") || name.endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif") {
      try {
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 }) as Blob;
        const newName = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
        return new File([blob], newName, { type: "image/jpeg" });
      } catch (e) {
        console.error("HEIC conversion failed:", e);
        return file;
      }
    }
    return file;
  }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from("campaign-media")
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from("campaign-media").getPublicUrl(data.path);
    return publicUrl;
  }

  async function handleFiles(athleteId: string, fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      const name = file.name.toLowerCase();
      const isHeic = name.endsWith(".heic") || name.endsWith(".heif");
      if (file.type.startsWith("image/") || isHeic) {
        await uploadImage(athleteId, file);
      } else if (file.type.startsWith("video/")) {
        setPendingVideo({ athleteId, file });
      }
    }
  }

  async function uploadImage(athleteId: string, file: File) {
    const converted = await convertHeicIfNeeded(file);
    const path = `${id}/${athleteId}/${Date.now()}-${converted.name}`;
    const url = await uploadFile(converted, path);
    if (!url) return;
    const existing = media[athleteId] || [];
    const { data } = await supabase
      .from("media")
      .insert({ athlete_id: athleteId, campaign_id: id, type: "image", file_url: url, sort_order: existing.length })
      .select().single();
    if (data) setMedia((prev) => ({ ...prev, [athleteId]: [...(prev[athleteId] || []), data] }));
  }

  async function uploadVideoWithThumbnail(thumbnailFile: File) {
    if (!pendingVideo) return;
    const { athleteId, file: videoFile } = pendingVideo;
    const videoPath = `${id}/${athleteId}/${Date.now()}-${videoFile.name}`;
    const videoUrl = await uploadFile(videoFile, videoPath);
    if (!videoUrl) { setPendingVideo(null); return; }
    const convertedThumb = await convertHeicIfNeeded(thumbnailFile);
    const thumbPath = `${id}/${athleteId}/${Date.now()}-thumb-${convertedThumb.name}`;
    const thumbUrl = await uploadFile(convertedThumb, thumbPath);
    if (!thumbUrl) { setPendingVideo(null); return; }
    const existing = media[athleteId] || [];
    const { data } = await supabase
      .from("media")
      .insert({ athlete_id: athleteId, campaign_id: id, type: "video", file_url: videoUrl, thumbnail_url: thumbUrl, sort_order: 0 })
      .select().single();
    if (data) {
      const newMedia = [data, ...existing];
      setMedia((prev) => ({ ...prev, [athleteId]: newMedia }));
      newMedia.forEach(async (m, i) => {
        await supabase.from("media").update({ sort_order: i }).eq("id", m.id);
      });
    }
    setPendingVideo(null);
  }

  async function removeMedia(athleteId: string, mediaId: string) {
    await supabase.from("media").delete().eq("id", mediaId);
    setMedia((prev) => ({ ...prev, [athleteId]: (prev[athleteId] || []).filter((m) => m.id !== mediaId) }));
  }

  function matchFileToAthlete(fileName: string, athleteList: Athlete[]): Athlete | null {
    // Strip extension and clean up
    const clean = fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[_-]+/g, " ").trim();

    // Try exact match first
    for (const a of athleteList) {
      if (a.name.toLowerCase() === clean) return a;
    }

    // Try last name match
    for (const a of athleteList) {
      const parts = a.name.toLowerCase().split(" ");
      const lastName = parts[parts.length - 1];
      if (clean === lastName) return a;
      // filename might be "lastname_firstname" or "firstname_lastname"
      if (clean.includes(lastName) && parts.some((p) => clean.includes(p))) return a;
    }

    // Try first + last anywhere in filename
    for (const a of athleteList) {
      const parts = a.name.toLowerCase().split(" ").filter((p) => p.length > 2);
      if (parts.length >= 2 && parts.every((p) => clean.includes(p))) return a;
    }

    // Try just last name if it's unique enough (4+ chars)
    for (const a of athleteList) {
      const parts = a.name.toLowerCase().split(" ");
      const lastName = parts[parts.length - 1];
      if (lastName.length >= 4 && clean.includes(lastName)) return a;
    }

    return null;
  }

  async function handleBulkUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      return f.type.startsWith("image/") || name.endsWith(".heic") || name.endsWith(".heif");
    });
    if (files.length === 0) return;

    setBulkUploading(true);
    setBulkProgress({ done: 0, total: files.length, matched: 0, unmatched: [] });

    const unmatched: string[] = [];
    let matched = 0;
    // Track which athletes we've already seen so we only delete existing media on the first file
    const seenAthletes = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const athlete = matchFileToAthlete(file.name, selectedAthletes);

      if (athlete) {
        // Only delete existing media on the FIRST file for this athlete
        if (!seenAthletes.has(athlete.id)) {
          seenAthletes.add(athlete.id);
          const existing = media[athlete.id] || [];
          for (const m of existing) {
            await supabase.from("media").delete().eq("id", m.id);
          }
          // Clear local state for this athlete so we build fresh
          setMedia((prev) => ({ ...prev, [athlete.id]: [] }));
        }

        // Upload photo (convert HEIC if needed)
        const converted = await convertHeicIfNeeded(file);
        const path = `${id}/${athlete.id}/${Date.now()}-${converted.name}`;
        const url = await uploadFile(converted, path);
        if (url) {
          const { data } = await supabase
            .from("media")
            .insert({ athlete_id: athlete.id, campaign_id: id, type: "image", file_url: url, sort_order: 0 })
            .select().single();
          if (data) {
            setMedia((prev) => {
              const current = prev[athlete.id] || [];
              return { ...prev, [athlete.id]: [...current, data] };
            });
          }
        }
        matched++;
      } else {
        unmatched.push(file.name);
      }

      setBulkProgress({ done: i + 1, total: files.length, matched, unmatched: [...unmatched] });
    }

    setBulkUploading(false);
  }

  async function togglePublish() {
    if (!campaign) return;
    setPublishing(true);
    const { data } = await supabase
      .from("campaigns")
      .update({ published: !campaign.published })
      .eq("id", campaign.id)
      .select().single();
    if (data) setCampaign(data);
    setPublishing(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading campaign...</div>;
  if (!campaign) return <div className="min-h-screen flex items-center justify-center text-gray-500">Campaign not found</div>;

  if (showPreview) {
    // Merge unsaved editor state into campaign so the preview reflects current values
    const previewCampaign = {
      ...campaign,
      settings: {
        ...campaign.settings,
        description, quarter, campaign_type: campaignType,
        platform, tags, visible_sections: visibleSections,
        brand_logo_url: brandLogoUrl,
      },
    };
    return (
      <MasonryPreview
        campaign={previewCampaign}
        athletes={athletes.filter((a) => selected.includes(a.id))}
        allAthletes={athletes}
        media={media}
        onBack={() => setShowPreview(false)}
        onPublish={togglePublish}
        publishing={publishing}
      />
    );
  }

  const selectedAthletes = athletes.filter((a) => selected.includes(a.id));
  const uploadedCount = Object.keys(media).filter((k) => media[k]?.length > 0).length;

  // Top performers by engagement rate (from ALL athletes, not just selected)
  const topPerformers = [...athletes]
    .map((a) => {
      const m = a.metrics || {};
      const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
      const best = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
      return { ...a, bestEngRate: best };
    })
    .filter((a) => a.bestEngRate > 0)
    .sort((a, b) => b.bestEngRate - a.bestEngRate)
    .slice(0, 5);

  const steps = [
    { n: 1, title: "Athletes & Metrics", desc: "Enter data or import CSV" },
    { n: 2, title: "Campaign Info", desc: "Brief, tags & section visibility" },
    { n: 3, title: "Select Posts", desc: "Choose athletes to feature" },
    { n: 4, title: "Upload Content", desc: "Add images & videos" },
  ];

  return (
    <div className="min-h-screen">
      {pendingVideo && (
        <ThumbnailModal
          athleteName={athletes.find((a) => a.id === pendingVideo.athleteId)?.name || ""}
          onUpload={async (file) => await uploadVideoWithThumbnail(file)}
          onCancel={() => setPendingVideo(null)}
        />
      )}

      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-gray-500 hover:text-white">← Back</Link>
          <div>
            <div className="text-xs font-bold uppercase tracking-[2px] text-[#D73F09] mb-1">{campaign.client_name}</div>
            <h1 className="text-xl font-black">{campaign.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">{selected.length} posts · {uploadedCount} with media</span>
          {campaign.published && (
            <a href={`/recap/${campaign.slug}`} target="_blank" className="text-[#D73F09] text-sm font-bold hover:underline">View Live →</a>
          )}
          <button onClick={() => setShowPreview(true)}
            className="px-5 py-2 text-sm font-bold rounded-lg bg-[#D73F09] text-white hover:bg-[#c43808]">
            Preview Recap →
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="border-b border-gray-800 px-8 flex">
        {steps.map((s) => (
          <div key={s.n} onClick={() => setStep(s.n)}
            className={`flex-1 py-4 px-5 cursor-pointer border-b-2 ${step === s.n ? "border-[#D73F09] opacity-100" : "border-transparent opacity-40"}`}>
            <div className="text-sm font-bold">{s.title}</div>
            <div className="text-xs text-gray-600 mt-1">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="p-8 pb-24">

        {/* ── STEP 1: Athletes & Metrics ─────────────────────── */}
        {step === 1 && (
          <div>
            {/* Tracker link dropdown */}
            {trackers.length > 0 && (
              <div className="mb-6 p-4 bg-[#111] border border-gray-800 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                      Import from Performance Tracker
                    </label>
                    <select
                      value={linkedTrackerId || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) importFromTracker(val);
                        else setLinkedTrackerId(null);
                      }}
                      disabled={importingTracker}
                      className="w-full px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none appearance-none disabled:opacity-50"
                    >
                      <option value="">Select a tracker to import...</option>
                      {trackers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {t.client_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {importingTracker && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 pt-5">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Importing...
                    </div>
                  )}
                  {linkedTrackerId && !importingTracker && (
                    <a
                      href={`/dashboard/trackers/${linkedTrackerId}`}
                      target="_blank"
                      className="pt-5 text-xs text-[#D73F09] hover:underline whitespace-nowrap"
                    >
                      Open Tracker →
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-gray-600 mt-2">
                  Imports all athlete data &amp; metrics from the selected tracker into this recap.
                </p>
              </div>
            )}

            <MetricsSpreadsheet
              athletes={athletes}
              campaignId={id}
              onSave={saveMetrics}
              saving={savingMetrics}
            />
          </div>
        )}

        {/* ── STEP 2: Campaign Info ─────────────────────────── */}
        {step === 2 && (
          <div className="max-w-3xl space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Campaign Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                placeholder="Twenty-five college athletes across six sports showcase the adidas Evo SL..." />
            </div>

            {/* Brand Logo Upload */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Brand Logo</label>
              <div className="flex items-center gap-4">
                {brandLogoUrl ? (
                  <div className="relative">
                    <img src={brandLogoUrl} className="h-16 object-contain bg-white/5 rounded-lg p-2" alt="Brand logo" />
                    <button
                      onClick={() => setBrandLogoUrl("")}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white/20 text-white text-xs flex items-center justify-center hover:bg-red-600">
                      &times;
                    </button>
                  </div>
                ) : null}
                <button
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      const path = `${id}/brand-logo-${Date.now()}-${file.name}`;
                      const url = await uploadFile(file, path);
                      if (url) setBrandLogoUrl(url);
                    };
                    input.click();
                  }}
                  className="px-5 py-2.5 border border-gray-700 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:border-gray-500">
                  {brandLogoUrl ? "Replace Logo" : "Upload Logo"}
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Displayed in the recap header and footer</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Quarter</label>
                <input value={quarter} onChange={(e) => setQuarter(e.target.value)}
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                  placeholder="Q1 2026" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Campaign Type</label>
                <div className="flex gap-2 mb-2">
                  {[
                    { value: "Product Seeding", label: "Standard Recap" },
                    { value: "top_50", label: "Top 50 Rankings" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCampaignType(opt.value)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                        campaignType === opt.value
                          ? "bg-[#D73F09]/15 border-[#D73F09] text-[#D73F09]"
                          : "border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input value={campaignType} onChange={(e) => setCampaignType(e.target.value)}
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                  placeholder="Or type a custom type..." />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Platform</label>
              <input value={platform} onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                placeholder="Instagram (Feed + Reels) + TikTok" />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D73F09]/15 text-[#D73F09] text-xs font-bold">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      setTags([...tags, tagInput.trim()]);
                      setTagInput("");
                    }
                  }}
                  className="flex-1 bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                  placeholder="Type a tag and press Enter" />
              </div>
            </div>

            {/* Section Toggles */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Visible Sections</label>
              <div className="space-y-2">
                {SECTION_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${visibleSections[key] !== false ? "bg-[#D73F09] border-[#D73F09]" : "border-gray-600"}`}
                      onClick={() => setVisibleSections((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }))}>
                      {visibleSections[key] !== false && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={saveCampaignInfo} disabled={savingInfo}
              className="px-6 py-2.5 bg-[#D73F09] rounded-lg text-sm font-bold text-white hover:bg-[#c43808] disabled:opacity-50">
              {savingInfo ? "Saving..." : "Save Campaign Info"}
            </button>
          </div>
        )}

        {/* ── STEP 3: Select Posts ─────────────────────────── */}
        {step === 3 && (
          <div className="space-y-1">
            {athletes.map((a) => {
              const on = selected.includes(a.id);
              return (
                <div key={a.id} onClick={() => setSelected((prev) => on ? prev.filter((x) => x !== a.id) : [...prev, a.id])}
                  className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer border ${on ? "bg-[#D73F09]/5 border-[#D73F09]/30" : "bg-[#111] border-gray-800"}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${on ? "bg-[#D73F09] border-[#D73F09]" : "border-gray-600"}`}>
                    {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  <SchoolBadge school={a.school} size={32} />
                  <div className="flex-1">
                    <div className="text-sm font-black uppercase">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.school} · {a.sport}</div>
                  </div>
                  {a.ig_followers ? <span className="text-xs text-gray-500 font-bold">{a.ig_followers.toLocaleString()}</span> : null}
                  <span className="text-xs text-gray-600 font-bold uppercase">{a.post_type}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 4: Upload Content ──────────────────────── */}
        {step === 4 && (
          <div className="space-y-8">

            {/* Bulk Upload Drop Zone */}
            <div
              onDragEnter={(e) => { e.preventDefault(); bulkDragCounter.current++; setBulkDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); bulkDragCounter.current--; if (bulkDragCounter.current === 0) setBulkDragging(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                bulkDragCounter.current = 0;
                setBulkDragging(false);
                handleBulkUpload(e.dataTransfer.files);
              }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.multiple = true;
                input.setAttribute("webkitdirectory", "");
                input.onchange = (ev) => handleBulkUpload((ev.target as HTMLInputElement).files);
                input.click();
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                bulkDragging
                  ? "border-[#D73F09] bg-[#D73F09]/5"
                  : "border-gray-700 hover:border-gray-500"
              }`}
            >
              {bulkUploading ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-[#D73F09]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    <span className="text-sm font-bold">Uploading {bulkProgress.done} / {bulkProgress.total}...</span>
                  </div>
                  <div className="w-64 mx-auto bg-gray-800 rounded-full h-2">
                    <div className="bg-[#D73F09] h-2 rounded-full transition-all" style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="text-green-400 font-bold">{bulkProgress.matched} matched</span>
                    {bulkProgress.unmatched.length > 0 && (
                      <span className="text-red-400 font-bold ml-3">{bulkProgress.unmatched.length} unmatched</span>
                    )}
                  </div>
                </div>
              ) : bulkProgress.total > 0 && !bulkUploading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-sm font-bold text-green-400">
                      {bulkProgress.matched} of {bulkProgress.total} photos matched to athletes
                    </span>
                  </div>
                  {bulkProgress.unmatched.length > 0 && (
                    <div className="text-xs text-red-400/70">
                      Unmatched: {bulkProgress.unmatched.slice(0, 5).join(", ")}{bulkProgress.unmatched.length > 5 ? ` +${bulkProgress.unmatched.length - 5} more` : ""}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-600 mt-1">Drop more files to replace</div>
                </div>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={bulkDragging ? "#D73F09" : "#555"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div className="text-sm font-bold text-gray-300 mb-1">Bulk Upload Cover Photos</div>
                  <div className="text-xs text-gray-500 mb-3">
                    Drop a folder of images or click to browse. Files are auto-matched to athletes by name.
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-[10px] text-gray-600">
                    <span className="px-2 py-1 rounded bg-gray-800/50">✓ &quot;firstname lastname.jpg&quot;</span>
                    <span className="px-2 py-1 rounded bg-gray-800/50">✓ &quot;lastname_firstname.png&quot;</span>
                    <span className="px-2 py-1 rounded bg-gray-800/50">✓ &quot;lastname.jpg&quot;</span>
                  </div>
                </>
              )}
            </div>

            {/* Cover Photo Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider">Cover Photos</h3>
                <span className="text-xs text-gray-500 font-bold">
                  {Object.keys(media).filter((k) => selectedAthletes.some((a) => a.id === k) && media[k]?.length > 0).length} / {selectedAthletes.length} assigned
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {selectedAthletes.map((a) => {
                  const items = media[a.id] || [];
                  const cover = items[0];
                  const coverSrc = cover?.thumbnail_url || (cover?.type !== "video" ? cover?.file_url : null);

                  return (
                    <div key={a.id} className="group relative">
                      <div
                        onClick={() => fileRefs.current[a.id]?.click()}
                        onDrop={(e) => { e.preventDefault(); handleFiles(a.id, e.dataTransfer?.files); }}
                        onDragOver={(e) => e.preventDefault()}
                        className={`aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          coverSrc
                            ? "border-transparent hover:border-[#D73F09]"
                            : "border-dashed border-gray-700 hover:border-gray-500 bg-[#0a0a0a]"
                        }`}
                      >
                        {coverSrc ? (
                          <img src={coverSrc} className="w-full h-full object-cover" alt={a.name} loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </div>
                        )}
                        <input ref={(el: HTMLInputElement | null) => { fileRefs.current[a.id] = el; }}
                          type="file" accept="image/*,video/*,.heic,.heif" multiple
                          onChange={(e) => handleFiles(a.id, e.target.files)} className="hidden" />
                      </div>

                      {/* Remove button on hover */}
                      {coverSrc && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (cover) removeMedia(a.id, cover.id); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >×</button>
                      )}

                      {/* Thumbnail carousel */}
                      <div className="flex gap-0.5 mt-1 overflow-x-auto scrollbar-none">
                        {items.map((m) => {
                          const thumbSrc = m.thumbnail_url || (m.type !== "video" ? m.file_url : null);
                          return (
                            <div key={m.id} className="relative flex-shrink-0 group/thumb">
                              <div className={`w-7 h-7 rounded overflow-hidden border ${m.id === cover?.id ? "border-[#D73F09]" : m.type === "video" ? "border-purple-500/50" : "border-gray-700"}`}>
                                {thumbSrc ? (
                                  <img src={thumbSrc} className="w-full h-full object-cover" alt="" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeMedia(a.id, m.id); }}
                                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/80 text-white text-[7px] flex items-center justify-center hover:bg-red-600 opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
                              >×</button>
                            </div>
                          );
                        })}
                        {/* Add photo button */}
                        <div
                          className="flex-shrink-0 w-7 h-7 rounded border border-dashed border-gray-600 hover:border-[#D73F09] flex items-center justify-center cursor-pointer transition-colors"
                          onClick={(e) => { e.stopPropagation(); fileRefs.current[a.id]?.click(); }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </div>
                      </div>

                      <div className="mt-1.5 px-0.5">
                        <div className="text-[10px] font-bold uppercase truncate text-gray-300">{a.name}</div>
                        <div className="text-[9px] text-gray-600 truncate">{a.school}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 px-8 py-4 border-t border-gray-800 bg-black/95 backdrop-blur-xl flex justify-between items-center">
        <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}
          className="px-5 py-2 border border-gray-700 rounded-lg text-sm font-bold disabled:opacity-30">← Back</button>
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)}
            disabled={step === 3 && selected.length === 0}
            className="px-5 py-2 bg-[#D73F09] rounded-lg text-sm font-bold disabled:opacity-30">Next →</button>
        ) : (
          <button onClick={() => setShowPreview(true)}
            className="px-6 py-2 bg-[#D73F09] rounded-lg text-sm font-bold">Preview Recap →</button>
        )}
      </div>
    </div>
  );
}
