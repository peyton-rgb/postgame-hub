"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign, Athlete, Media, VisibleSections } from "@/lib/types";
import { SchoolBadge } from "@/components/SchoolBadge";
import { ThumbnailModal } from "@/components/ThumbnailModal";
import { MasonryPreview } from "@/components/MasonryPreview";
import { parsePerformanceCSV, type ParsedAthlete } from "@/lib/csv-parser";
import Link from "next/link";

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
  const schools = new Set(parsed.map((a) => a.school));
  const sports = new Set(parsed.map((a) => a.sport.toLowerCase()));
  const athleteCount = parsed.length;
  const schoolCount = schools.size;
  const sportCount = sports.size;

  let totalFollowers = 0;
  let hasIgFeed = false;
  let hasIgReel = false;
  let hasTiktok = false;

  for (const a of parsed) {
    totalFollowers += a.ig_followers || 0;
    if (a.metrics.ig_feed?.post_url) hasIgFeed = true;
    if (a.metrics.ig_reel?.post_url) hasIgReel = true;
    if (a.metrics.tiktok?.post_url) hasTiktok = true;
  }

  const sportList = Array.from(sports).slice(0, 4).join(", ");
  const reachStr = fmt(totalFollowers);

  const platforms: string[] = [];
  if (hasIgFeed) platforms.push("Feed");
  if (hasIgReel) platforms.push("Reels");
  if (hasTiktok) platforms.push("TikTok");
  const platformStr = platforms.length > 0
    ? "Instagram (" + platforms.filter(p => p !== "TikTok").join(" + ") + ")" + (hasTiktok ? " + TikTok" : "")
    : "Instagram";

  const desc = `The ${clientName} ${campaignName} campaign activates ${athleteCount} college athletes representing ${schoolCount} universities and ${sportCount} sports to authentically showcase ${clientName.toLowerCase()} product through organic Instagram content — feed posts and behind-the-scenes Reels — integrating the shoe into their training and competition moments. The campaign emphasizes real performance over polished studio aesthetics, letting each athlete's discipline and competitive edge speak for the product.\n\nWith a combined social reach of ${reachStr}+ followers, this roster spans Power Five and mid-major conferences, delivering diverse audience coverage across ${sportList} for ${clientName}.`;

  const autoTags = [clientName, "Product Seeding", "Social First", "NIL Campaign"];

  return { description: desc, platform: platformStr, tags: autoTags };
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

  // CSV state
  const [csvParsed, setCsvParsed] = useState<ParsedAthlete[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDone, setCsvDone] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const [{ data: camp }, { data: aths }, { data: med }] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", id).single(),
      supabase.from("athletes").select("*").eq("campaign_id", id).order("sort_order"),
      supabase.from("media").select("*").eq("campaign_id", id).order("sort_order"),
    ]);

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

  function handleCSVFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parsePerformanceCSV(text);
      setCsvParsed(parsed);
      setCsvDone(false);
    };
    reader.readAsText(file);
  }

  async function importCSV() {
    if (!csvParsed.length) return;
    setCsvImporting(true);

    for (const pa of csvParsed) {
      // Try to find existing athlete by name match
      const existing = athletes.find(
        (a) => a.name.toLowerCase() === pa.name.toLowerCase()
      );

      if (existing) {
        // Update existing athlete with metrics
        await supabase
          .from("athletes")
          .update({
            ig_handle: pa.ig_handle,
            ig_followers: pa.ig_followers,
            gender: pa.gender,
            notes: pa.notes || existing.notes,
            metrics: pa.metrics,
            school: pa.school || existing.school,
            sport: pa.sport || existing.sport,
          })
          .eq("id", existing.id);
      } else {
        // Determine post_type from available data
        let post_type = "IG Feed";
        if (pa.metrics.ig_reel?.post_url) post_type = "IG Reel";
        if (pa.metrics.tiktok?.post_url) post_type = "TikTok";

        await supabase.from("athletes").insert({
          campaign_id: id,
          name: pa.name,
          school: pa.school,
          sport: pa.sport,
          post_type,
          post_url: pa.metrics.ig_feed?.post_url || pa.metrics.ig_reel?.post_url || null,
          ig_handle: pa.ig_handle,
          ig_followers: pa.ig_followers,
          gender: pa.gender,
          notes: pa.notes,
          metrics: pa.metrics,
          sort_order: athletes.length,
        });
      }
    }

    // Auto-generate campaign info from CSV data
    if (campaign && !description) {
      const auto = generateDescription(campaign.name, campaign.client_name, csvParsed);
      setDescription(auto.description);
      setPlatform(auto.platform);
      setTags(auto.tags);

      // Auto-save to DB
      const newSettings = {
        ...campaign.settings,
        description: auto.description,
        platform: auto.platform,
        tags: auto.tags,
        quarter: quarter || "",
        campaign_type: campaignType || "Product Seeding",
        visible_sections: visibleSections,
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

    setCsvDone(true);
    setCsvImporting(false);
    // Reload data
    await loadData();
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
      if (file.type.startsWith("image/")) {
        await uploadImage(athleteId, file);
      } else if (file.type.startsWith("video/")) {
        setPendingVideo({ athleteId, file });
      }
    }
  }

  async function uploadImage(athleteId: string, file: File) {
    const path = `${id}/${athleteId}/${Date.now()}-${file.name}`;
    const url = await uploadFile(file, path);
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
    if (!videoUrl) return;
    const thumbPath = `${id}/${athleteId}/${Date.now()}-thumb-${thumbnailFile.name}`;
    const thumbUrl = await uploadFile(thumbnailFile, thumbPath);
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
    return (
      <MasonryPreview
        campaign={campaign}
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
      const best = rates.length > 0 ? Math.max(...rates) : 0;
      return { ...a, bestEngRate: best };
    })
    .filter((a) => a.bestEngRate > 0)
    .sort((a, b) => b.bestEngRate - a.bestEngRate)
    .slice(0, 5);

  const steps = [
    { n: 1, title: "Import CSV", desc: "Upload performance data" },
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

        {/* ── STEP 1: CSV Upload ────────────────────────────── */}
        {step === 1 && (
          <div className="max-w-4xl space-y-6">
            <div
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-[#D73F09]/50"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv";
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleCSVFile(f);
                };
                input.click();
              }}
            >
              <div className="text-sm font-bold text-gray-400 mb-1">Drop CSV here or click to upload</div>
              <div className="text-xs text-gray-600">Adidas Performance Tracker format</div>
            </div>

            {csvParsed.length > 0 && (
              <>
                <div className="text-sm font-bold text-gray-300">{csvParsed.length} athletes parsed</div>
                <div className="overflow-x-auto border border-gray-800 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-left">
                        <th className="px-3 py-2 text-gray-500 font-bold uppercase">Name</th>
                        <th className="px-3 py-2 text-gray-500 font-bold uppercase">Handle</th>
                        <th className="px-3 py-2 text-gray-500 font-bold uppercase">Followers</th>
                        <th className="px-3 py-2 text-gray-500 font-bold uppercase">School</th>
                        <th className="px-3 py-2 text-gray-500 font-bold uppercase">Sport</th>
                        <th className="px-3 py-2 text-gray-500 font-bold uppercase">IG Feed Eng.</th>
                        <th className="px-3 py-2 text-gray-500 font-bold uppercase">IG Reel Eng.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsed.map((a, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="px-3 py-2 font-bold text-white">{a.name}</td>
                          <td className="px-3 py-2 text-gray-400">@{a.ig_handle}</td>
                          <td className="px-3 py-2 text-gray-400">{a.ig_followers.toLocaleString()}</td>
                          <td className="px-3 py-2 text-gray-400">{a.school}</td>
                          <td className="px-3 py-2 text-gray-400">{a.sport}</td>
                          <td className="px-3 py-2 text-gray-400">{a.metrics.ig_feed?.engagement_rate != null ? a.metrics.ig_feed.engagement_rate + "%" : "—"}</td>
                          <td className="px-3 py-2 text-gray-400">{a.metrics.ig_reel?.engagement_rate != null ? a.metrics.ig_reel.engagement_rate + "%" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button onClick={importCSV} disabled={csvImporting || csvDone}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white ${csvDone ? "bg-green-600" : "bg-[#D73F09] hover:bg-[#c43808]"} disabled:opacity-50`}>
                  {csvImporting ? "Importing..." : csvDone ? "Imported Successfully" : "Import Athletes & Metrics"}
                </button>
              </>
            )}
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
          <div className="space-y-10">
            {/* Top Performers Content Upload */}
            {topPerformers.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#D73F09]">Top Performers Content</h3>
                  <span className="text-[10px] text-gray-500 font-bold">Upload hero content for your top 5 athletes</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {topPerformers.map((a, idx) => {
                    const items = media[a.id] || [];
                    const thumb = items[0]?.thumbnail_url || items[0]?.file_url || null;
                    return (
                      <div key={a.id} className={`bg-[#111] rounded-xl overflow-hidden border ${idx === 0 ? "border-[#D73F09]" : "border-gray-800"}`}>
                        <div onClick={() => fileRefs.current[a.id]?.click()}
                          onDrop={(e) => { e.preventDefault(); handleFiles(a.id, e.dataTransfer?.files); }}
                          onDragOver={(e) => e.preventDefault()}
                          className="aspect-[4/5] max-h-[240px] bg-[#0a0a0a] flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden">
                          {thumb && !items[0]?.file_url?.match(/\.(mp4|mov|webm|avi)$/i)
                            ? <img src={thumb} className="w-full h-full object-cover" alt="" />
                            : thumb && items[0]?.thumbnail_url
                              ? <img src={items[0].thumbnail_url} className="w-full h-full object-cover" alt="" />
                              : items.length > 0
                                ? <div className="flex flex-col items-center gap-2">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    <span className="text-[10px] text-gray-600 font-bold uppercase">{items.length} file{items.length > 1 ? "s" : ""}</span>
                                  </div>
                                : <span className="text-[10px] text-gray-600 font-bold uppercase">Drop files or click</span>}
                          {items.length > 1 && (
                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-[10px] font-bold rounded">{items.length}</div>
                          )}
                          {/* Rank badge */}
                          <div className={`absolute top-2 left-2 w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center ${idx === 0 ? "bg-[#D73F09]" : "bg-gray-700"}`}>
                            {idx + 1}
                          </div>
                          <input ref={(el: HTMLInputElement | null) => { fileRefs.current[a.id] = el; }}
                            type="file" accept="image/*,video/*" multiple
                            onChange={(e) => handleFiles(a.id, e.target.files)} className="hidden" />
                        </div>
                        {items.length > 0 && (
                          <div className="flex gap-1 p-1.5 bg-[#0a0a0a] border-t border-gray-900 overflow-x-auto">
                            {items.map((m) => (
                              <div key={m.id} className="relative flex-shrink-0">
                                <div className={`w-8 h-8 rounded overflow-hidden border ${m.type === "video" ? "border-purple-500" : "border-gray-700"}`}>
                                  {m.type === "video" && !m.thumbnail_url
                                    ? <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
                                    : <img src={m.thumbnail_url || m.file_url} className="w-full h-full object-cover" alt="" />}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); removeMedia(a.id, m.id); }}
                                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gray-700 text-white text-[8px] flex items-center justify-center hover:bg-red-600">×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="p-2 border-t border-gray-900">
                          <div className="text-[10px] font-black uppercase truncate">{a.name}</div>
                          <div className="text-[9px] text-gray-600 truncate">{a.school} · {a.bestEngRate.toFixed(1)}% eng.</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content Gallery Upload */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider mb-4">Content Gallery Uploads</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {selectedAthletes.map((a) => {
                  const items = media[a.id] || [];
                  const thumb = items[0]?.thumbnail_url || items[0]?.file_url || null;
                  return (
                    <div key={a.id} className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
                      <div onClick={() => fileRefs.current[a.id]?.click()}
                        onDrop={(e) => { e.preventDefault(); handleFiles(a.id, e.dataTransfer?.files); }}
                        onDragOver={(e) => e.preventDefault()}
                        className="aspect-[4/5] max-h-[300px] bg-[#0a0a0a] flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden">
                        {thumb && !items[0]?.file_url?.match(/\.(mp4|mov|webm|avi)$/i)
                          ? <img src={thumb} className="w-full h-full object-cover" alt="" />
                          : thumb && items[0]?.thumbnail_url
                            ? <img src={items[0].thumbnail_url} className="w-full h-full object-cover" alt="" />
                            : items.length > 0
                              ? <div className="flex flex-col items-center gap-2">
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                  <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">{items.length} file{items.length > 1 ? "s" : ""}</span>
                                </div>
                              : <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">Drop files or click</span>}
                        {items.length > 1 && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-[10px] font-bold rounded">{items.length} files</div>
                        )}
                        <input ref={(el: HTMLInputElement | null) => { fileRefs.current[a.id] = el; }}
                          type="file" accept="image/*,video/*" multiple
                          onChange={(e) => handleFiles(a.id, e.target.files)} className="hidden" />
                      </div>
                      {items.length > 0 && (
                        <div className="flex gap-1 p-2 bg-[#0a0a0a] border-t border-gray-900 overflow-x-auto">
                          {items.map((m) => (
                            <div key={m.id} className="relative flex-shrink-0">
                              <div className={`w-10 h-10 rounded overflow-hidden border-2 ${m.type === "video" ? "border-purple-500" : "border-gray-700"}`}>
                                {m.type === "video" && !m.thumbnail_url
                                  ? <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
                                  : <img src={m.thumbnail_url || m.file_url} className="w-full h-full object-cover" alt="" />}
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); removeMedia(a.id, m.id); }}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-700 text-white text-[10px] flex items-center justify-center hover:bg-red-600">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-3 border-t border-gray-900 flex items-center gap-2">
                        <SchoolBadge school={a.school} size={24} />
                        <div>
                          <div className="text-xs font-black uppercase">{a.name}</div>
                          <div className="text-[10px] text-gray-600">{a.school} · {a.sport}</div>
                        </div>
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
