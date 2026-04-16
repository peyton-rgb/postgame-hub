
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Campaign, Athlete, Media, VisibleSections, KpiTargets } from "@/lib/types";
import { SchoolBadge } from "@/components/SchoolBadge";
import { ThumbnailModal } from "@/components/ThumbnailModal";
import { MasonryPreview } from "@/components/MasonryPreview";
import { parseMetricsCSV, mergeAthleteData, type ParsedAthlete } from "@/lib/csv-parser";
import MetricsSpreadsheet from "@/components/MetricsSpreadsheet";
import Link from "next/link";
import heic2any from "heic2any";
import DrivePicker from "@/components/DrivePicker";
import Tier3Picker from "@/components/Tier3Picker";
import { supabaseImageUrl } from "@/lib/supabase-image";

const SECTION_LABELS: { key: keyof VisibleSections; label: string }[] = [
  { key: "brief", label: "Campaign Overview" },
  { key: "key_takeaways", label: "Key Takeaways" },
  { key: "kpi_targets", label: "KPI Targets" },
  { key: "metrics", label: "Campaign Metrics" },
  { key: "platform_breakdown", label: "Platform Breakdown" },
  { key: "top_performers", label: "Top Performers" },
  { key: "content_gallery", label: "Best In Class Content" },
  { key: "roster", label: "Campaign Roster" },
  { key: "clicks", label: "Clicks & Conversions" },
  { key: "sales", label: "Sales" },
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

// ── Top 50 Roster Editor (inline) ────────────────────────────

function Top50RosterEditor({
  athletes,
  setAthletes,
  campaignId,
  supabase,
  uploadFile,
  convertHeicIfNeeded,
}: {
  athletes: Athlete[];
  setAthletes: React.Dispatch<React.SetStateAction<Athlete[]>>;
  campaignId: string;
  supabase: ReturnType<typeof createBrowserSupabase>;
  uploadFile: (file: File, path: string) => Promise<string | null>;
  convertHeicIfNeeded: (file: File) => Promise<File>;
}) {
  const [saving, setSaving] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDragging, setCsvDragging] = useState(false);
  const csvDragCounter = useRef(0);
  const [headshotFetching, setHeadshotFetching] = useState(false);
  const [headshotProgress, setHeadshotProgress] = useState<{ done: number; total: number; found: number } | null>(null);

  async function handleCsvImport(file: File) {
    if (athletes.length > 0) {
      const ok = window.confirm(`This will replace all ${athletes.length} existing athletes. Continue?`);
      if (!ok) return;
    }

    setCsvImporting(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setCsvImporting(false); return; }

      // Parse header row — normalize to lowercase, trim whitespace
      const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_ ]/g, ""));
      const colIndex = (variants: string[]) => {
        for (const v of variants) {
          const idx = rawHeaders.indexOf(v);
          if (idx !== -1) return idx;
        }
        return -1;
      };
      const iRank = colIndex(["rank", "#"]);
      const iName = colIndex(["name", "athlete name", "athlete"]);
      const iFirstName = colIndex(["first name", "first_name", "firstname"]);
      const iLastName = colIndex(["last name", "last_name", "lastname"]);
      const iSchool = colIndex(["school", "university"]);
      const iSport = colIndex(["sport"]);
      const iHandle = colIndex(["ig handle", "ig_handle", "handle", "instagram", "instagram profile"]);
      const iFollowers = colIndex(["ig followers", "ig_followers", "followers"]);
      const iNotes = colIndex(["notes", "bio"]);
      const iTag = colIndex(["campaign tag", "campaign_tag", "tag", "campaign participated in", "campaign"]);
      const iPostUrl = colIndex(["post url", "post_url", "url", "ig feed url", "ig_feed_url"]);
      const iReelUrl = colIndex(["ig reel url", "ig_reel_url"]);
      const iFeatured = colIndex(["featured"]);
      const iContentFolder = colIndex(["content folder", "content_folder", "content folder url", "content_folder_url"]);
      const iGender = colIndex(["gender"]);

      // Parse CSV rows (handles quoted fields with commas)
      const parseCsvRow = (line: string): string[] => {
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { current += ch; }
          } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ",") { fields.push(current.trim()); current = ""; }
            else { current += ch; }
          }
        }
        fields.push(current.trim());
        return fields;
      }

      // Delete existing athletes if any
      if (athletes.length > 0) {
        const existingIds = athletes.map((a) => a.id);
        await supabase.from("media").delete().in("athlete_id", existingIds);
        await supabase.from("athletes").delete().in("id", existingIds);
      }

      // Extract IG handle from a value that might be a full URL or @handle
      const extractIgHandle = (raw: string): string => {
        if (!raw) return "";
        // Full URL: https://www.instagram.com/alexkaraban_/?hl=en → alexkaraban_
        const urlMatch = raw.match(/instagram\.com\/([^/?#]+)/i);
        if (urlMatch) return urlMatch[1];
        // Strip leading @
        return raw.replace(/^@/, "").trim();
      };

      const toInsert: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvRow(lines[i]);

        // Build name: prefer single "Name" column, fall back to First+Last
        let name = iName !== -1 ? cols[iName] || "" : "";
        if (!name && iFirstName !== -1) {
          const first = cols[iFirstName]?.trim() || "";
          const last = iLastName !== -1 ? cols[iLastName]?.trim() || "" : "";
          name = (first + " " + last).trim();
        }
        if (!name) continue;

        const rank = iRank !== -1 ? parseInt(cols[iRank]) || i : i;
        const school = iSchool !== -1 ? cols[iSchool] || "" : "";
        const sport = iSport !== -1 ? cols[iSport] || "" : "";
        const igHandle = iHandle !== -1 ? extractIgHandle(cols[iHandle] || "") : "";
        const igFollowers = iFollowers !== -1 ? parseInt(cols[iFollowers]?.replace(/[^0-9]/g, "")) || 0 : 0;
        const notes = iNotes !== -1 ? cols[iNotes] || "" : "";
        const campaignTag = iTag !== -1 ? cols[iTag] || "" : "";
        const gender = iGender !== -1 ? cols[iGender] || "" : "";
        const contentFolder = iContentFolder !== -1 ? cols[iContentFolder] || "" : "";
        const featured = iFeatured !== -1 ? cols[iFeatured]?.toLowerCase() === "yes" : false;

        // Post URL: prefer feed URL, fall back to reel URL
        let postUrl = iPostUrl !== -1 ? cols[iPostUrl] || "" : "";
        const reelUrl = iReelUrl !== -1 ? cols[iReelUrl] || "" : "";
        if (!postUrl && reelUrl) postUrl = reelUrl;

        const metrics: Record<string, unknown> = {};
        if (campaignTag) metrics.campaign_tag = campaignTag;
        if (contentFolder) metrics.content_folder_url = contentFolder;
        if (postUrl) metrics.ig_feed = { post_url: postUrl };
        if (reelUrl) metrics.ig_reel = { post_url: reelUrl };

        toInsert.push({
          campaign_id: campaignId,
          name,
          school,
          sport,
          gender,
          ig_handle: igHandle,
          ig_followers: igFollowers,
          notes,
          post_type: "IG Feed" as const,
          post_url: postUrl || null,
          sort_order: rank - 1,
          metrics,
          is_featured: featured,
          featured_order: featured ? rank : 0,
        });
      }

      if (toInsert.length > 0) {
        const { data: inserted } = await supabase
          .from("athletes")
          .insert(toInsert)
          .select();
        if (inserted) setAthletes(inserted);
      }
    } catch (e) {
      console.error("CSV import failed:", e);
      alert("CSV import failed. Check the file format and try again.");
    }

    setCsvImporting(false);
  }

  async function updateAthleteField(athleteId: string, field: string, value: any) {
    setAthletes((prev) =>
      prev.map((a) => {
        if (a.id !== athleteId) return a;
        if (field === "campaign_tag") {
          return { ...a, metrics: { ...a.metrics, campaign_tag: value } };
        }
        return { ...a, [field]: value };
      })
    );

    // Debounced save
    if (field === "campaign_tag") {
      const athlete = athletes.find((a) => a.id === athleteId);
      const newMetrics = { ...(athlete?.metrics || {}), campaign_tag: value };
      await supabase.from("athletes").update({ metrics: newMetrics }).eq("id", athleteId);
    } else {
      await supabase.from("athletes").update({ [field]: value }).eq("id", athleteId);
    }
  }

  async function handleHeadshotUpload(athleteId: string, file: File) {
    const converted = await convertHeicIfNeeded(file);
    const path = `${campaignId}/${athleteId}/headshot-${Date.now()}-${converted.name}`;
    const url = await uploadFile(converted, path);
    if (!url) return;
    const athlete = athletes.find((a) => a.id === athleteId);
    const newMetrics = { ...(athlete?.metrics || {}), headshot_url: url };
    await supabase.from("athletes").update({ metrics: newMetrics }).eq("id", athleteId);
    setAthletes((prev) =>
      prev.map((a) => (a.id === athleteId ? { ...a, metrics: newMetrics } : a))
    );
  }

  async function fetchHeadshots() {
    const missing = athletes.filter((a) => a.name && !a.metrics?.headshot_url);
    if (missing.length === 0) return;

    setHeadshotFetching(true);
    setHeadshotProgress({ done: 0, total: missing.length, found: 0 });
    let found = 0;

    for (let i = 0; i < missing.length; i++) {
      const a = missing[i];
      try {
        const params = new URLSearchParams({ name: a.name });
        if (a.school) params.set("school", a.school);
        if (a.sport) params.set("sport", a.sport);
        if (a.gender) params.set("gender", a.gender);

        const res = await fetch(`/api/athlete-headshot?${params}`);
        const { url } = await res.json();

        if (url) {
          found++;
          const newMetrics = { ...(a.metrics || {}), headshot_url: url };
          await supabase.from("athletes").update({ metrics: newMetrics }).eq("id", a.id);
          setAthletes((prev) =>
            prev.map((x) => (x.id === a.id ? { ...x, metrics: newMetrics } : x))
          );
        }
      } catch (e) {
        // Skip failed fetches silently
      }

      setHeadshotProgress({ done: i + 1, total: missing.length, found });

      // Rate-limit delay between requests
      if (i < missing.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setHeadshotFetching(false);
  }

  async function addAthlete() {
    setSaving(true);
    const { data } = await supabase
      .from("athletes")
      .insert({
        campaign_id: campaignId,
        name: "",
        school: "",
        sport: "",
        post_type: "IG Feed",
        sort_order: athletes.length,
        metrics: {},
      })
      .select()
      .single();
    if (data) setAthletes((prev) => [...prev, data]);
    setSaving(false);
  }

  async function removeAthlete(athleteId: string) {
    await supabase.from("athletes").delete().eq("id", athleteId);
    setAthletes((prev) => prev.filter((a) => a.id !== athleteId));
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-wider">Top 50 Roster</h3>
        <span className="text-xs text-gray-500">{athletes.length} athletes</span>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[40px_48px_1.5fr_32px_1fr_0.8fr_1.2fr_1fr_80px_40px] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-800">
        <div>#</div>
        <div>Photo</div>
        <div>Name</div>
        <div>IG</div>
        <div>School</div>
        <div>Sport</div>
        <div>Notes</div>
        <div>Tag</div>
        <div>Post</div>
        <div></div>
      </div>

      {/* CSV Import Drop Zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); csvDragCounter.current++; setCsvDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); csvDragCounter.current--; if (csvDragCounter.current === 0) setCsvDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          csvDragCounter.current = 0;
          setCsvDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) handleCsvImport(file);
        }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".csv,text/csv";
          input.onchange = (ev) => {
            const f = (ev.target as HTMLInputElement).files?.[0];
            if (f) handleCsvImport(f);
          };
          input.click();
        }}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all my-2 ${
          csvDragging
            ? "border-[#D73F09] bg-[#D73F09]/5"
            : "border-gray-700 hover:border-gray-500 bg-[#111]"
        }`}
      >
        {csvImporting ? (
          <div className="flex items-center justify-center gap-3 py-1">
            <svg className="animate-spin h-4 w-4 text-[#D73F09]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <span className="text-sm font-bold text-gray-300">Importing CSV...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={csvDragging ? "#D73F09" : "#666"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm font-bold text-gray-500">Drop a CSV or click to import roster</span>
            <span className="text-[10px] text-gray-600 hidden sm:inline">(Rank, Name, School, Sport, IG Handle, IG Followers, Notes, Campaign Tag, Post URL, Featured)</span>
          </div>
        )}
      </div>

      {athletes.map((a, idx) => {
        const headshotUrl = a.metrics?.headshot_url;
        const postUrl = a.metrics?.ig_feed?.post_url || a.metrics?.ig_reel?.post_url || a.post_url;

        return (
          <div
            key={a.id}
            className="grid grid-cols-[40px_48px_1.5fr_32px_1fr_0.8fr_1.2fr_1fr_80px_40px] gap-2 px-3 py-2 items-center bg-[#111] border border-gray-800/50 rounded-lg hover:border-gray-700 transition-colors"
          >
            {/* Rank */}
            <div className="text-sm font-black text-gray-500 text-center">{idx + 1}</div>

            {/* Headshot */}
            <div
              className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a1a1a] border border-gray-700 cursor-pointer hover:border-[#D73F09] transition-colors flex-shrink-0"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*,.heic,.heif";
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleHeadshotUpload(a.id, f);
                };
                input.click();
              }}
            >
              {headshotUrl ? (
                <img src={headshotUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
              )}
            </div>

            {/* Name */}
            <input
              value={a.name}
              onChange={(e) => updateAthleteField(a.id, "name", e.target.value)}
              className="bg-transparent text-sm font-bold text-white outline-none truncate placeholder-gray-600 min-w-0"
              placeholder="Athlete name"
            />

            {/* IG profile link */}
            <div className="flex items-center justify-center">
              {a.ig_handle ? (
                <a
                  href={`https://instagram.com/${a.ig_handle.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D73F09] hover:text-[#ff5722] transition-colors"
                  title={`@${a.ig_handle.replace("@", "")}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
              ) : (
                <span className="text-gray-700">—</span>
              )}
            </div>

            {/* School */}
            <input
              value={a.school}
              onChange={(e) => updateAthleteField(a.id, "school", e.target.value)}
              className="bg-transparent text-sm text-gray-300 outline-none truncate placeholder-gray-600"
              placeholder="School"
            />

            {/* Sport */}
            <input
              value={a.sport}
              onChange={(e) => updateAthleteField(a.id, "sport", e.target.value)}
              className="bg-transparent text-sm text-gray-300 outline-none truncate placeholder-gray-600"
              placeholder="Sport"
            />

            {/* Notes */}
            <input
              value={a.notes || ""}
              onChange={(e) => updateAthleteField(a.id, "notes", e.target.value)}
              className="bg-transparent text-sm text-gray-400 outline-none truncate placeholder-gray-600"
              placeholder="Notes..."
            />

            {/* Campaign Tag */}
            <input
              value={a.metrics?.campaign_tag || ""}
              onChange={(e) => updateAthleteField(a.id, "campaign_tag", e.target.value)}
              className="bg-transparent text-sm text-[#D73F09] outline-none truncate placeholder-gray-600"
              placeholder="e.g. CVS Top 50"
            />

            {/* View Post */}
            <div className="text-center">
              {postUrl ? (
                <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D73F09] hover:underline font-bold">
                  View →
                </a>
              ) : (
                <span className="text-xs text-gray-700">—</span>
              )}
            </div>

            {/* Remove */}
            <button
              onClick={() => removeAthlete(a.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove athlete"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        );
      })}

      {/* Add athlete + Fetch headshots */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={addAthlete}
          disabled={saving}
          className="flex-1 py-3 border-2 border-dashed border-gray-700 rounded-lg text-sm font-bold text-gray-500 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
        >
          + Add Athlete
        </button>
        <button
          onClick={fetchHeadshots}
          disabled={headshotFetching || athletes.length === 0}
          className="px-5 py-3 border border-gray-700 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {headshotFetching ? (
            <>
              <svg className="animate-spin h-4 w-4 text-[#D73F09]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <span>Fetching headshots... {headshotProgress?.done}/{headshotProgress?.total}</span>
            </>
          ) : headshotProgress && !headshotFetching ? (
            <span>Found {headshotProgress.found} of {headshotProgress.total} headshots</span>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Fetch Headshots
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function CampaignEditor() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createBrowserSupabase();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [media, setMedia] = useState<Record<string, Media[]>>({});
  const [driveImportOpen, setDriveImportOpen] = useState(false);
  const [tier3PickerAthlete, setTier3PickerAthlete] = useState<Athlete | null>(null);
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
  const [contentType, setContentType] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({
    brief: true, key_takeaways: true, kpi_targets: true, metrics: true, platform_breakdown: true,
    top_performers: true, content_gallery: true, roster: true,
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // Brand logo state
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandKitLogos, setBrandKitLogos] = useState<{ url: string; label: string }[]>([]);
  const [brandLogoAutoSet, setBrandLogoAutoSet] = useState(false);

  // Key takeaways + KPI targets
  const [keyTakeaways, setKeyTakeaways] = useState("");
  const [kpiTargets, setKpiTargets] = useState<KpiTargets>({});

  // Editable campaign name / client name
  const [editingName, setEditingName] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [clientDraft, setClientDraft] = useState("");

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
      supabase.from("campaign_recaps").select("*").eq("id", id).single(),
      supabase.from("athletes").select("*").eq("campaign_id", id).order("sort_order"),
      supabase.from("media").select("*").eq("campaign_id", id).order("sort_order"),
      supabase.from("campaign_recaps").select("*").eq("type", "tracker").order("created_at", { ascending: false }),
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
      setContentType(camp.settings.content_type || "");
      setTags(camp.settings.tags || []);
      setVisibleSections(camp.settings.visible_sections || {
        brief: true, key_takeaways: true, kpi_targets: true, metrics: true, platform_breakdown: true,
        top_performers: true, content_gallery: true, roster: true,
      });
      setBrandLogoUrl(camp.settings.brand_logo_url || "");
      setKeyTakeaways(camp.settings.key_takeaways || "");
      setKpiTargets(camp.settings.kpi_targets || {});
    }

    const grouped: Record<string, Media[]> = {};
    (med || []).forEach((m: Media) => {
      if (!grouped[m.athlete_id]) grouped[m.athlete_id] = [];
      grouped[m.athlete_id].push(m);
    });
    setMedia(grouped);
    setLoading(false);

    // Fetch brand kit logos if brand_id exists
    if (camp?.brand_id) {
      fetchBrandKitLogos(camp.brand_id, camp.settings?.brand_logo_url || "");
    }
  }

  async function fetchBrandKitLogos(brandId: string, currentLogoUrl: string) {
    const logos: { url: string; label: string }[] = [];

    // 1. Get brand table logos
    const { data: brand } = await supabase
      .from("brands")
      .select("logo_url, logo_light_url, logo_dark_url, logo_mark_url")
      .eq("id", brandId)
      .single();

    if (brand) {
      if (brand.logo_url) logos.push({ url: brand.logo_url, label: "Primary" });
      if (brand.logo_light_url) logos.push({ url: brand.logo_light_url, label: "Light" });
      if (brand.logo_dark_url) logos.push({ url: brand.logo_dark_url, label: "Dark" });
      if (brand.logo_mark_url) logos.push({ url: brand.logo_mark_url, label: "Mark" });
    }

    // 2. List storage files in brand-kits/{brand_id}/
    const { data: files } = await supabase.storage
      .from("campaign-media")
      .list(`brand-kits/${brandId}`, { limit: 20 });

    if (files) {
      for (const f of files) {
        if (f.name && /\.(png|jpg|jpeg|svg|webp)$/i.test(f.name)) {
          const { data: urlData } = supabase.storage
            .from("campaign-media")
            .getPublicUrl(`brand-kits/${brandId}/${f.name}`);
          if (urlData?.publicUrl) {
            const alreadyInList = logos.some((l) => l.url === urlData.publicUrl);
            if (!alreadyInList) {
              logos.push({ url: urlData.publicUrl, label: f.name.replace(/\.[^.]+$/, "") });
            }
          }
        }
      }
    }

    setBrandKitLogos(logos);

    // Auto-populate if no logo is set
    if (!currentLogoUrl && logos.length > 0) {
      setBrandLogoUrl(logos[0].url);
      setBrandLogoAutoSet(true);
    }
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

    // Fetch existing athletes for this campaign (to merge, not wipe)
    const { data: existingAthletes } = await supabase
      .from("athletes")
      .select("*")
      .eq("campaign_id", id)
      .order("sort_order");

    if (trackerAthletes && trackerAthletes.length > 0) {
      // Build a name->athlete map of existing athletes to preserve media links
      const existingByName = new Map<string, Athlete>();
      for (const a of (existingAthletes || [])) {
        existingByName.set(a.name.toLowerCase().trim(), a);
      }

      const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
      const toInsert: Record<string, unknown>[] = [];
      const matchedExistingIds = new Set<string>();

      for (let i = 0; i < trackerAthletes.length; i++) {
        const ta = trackerAthletes[i];
        const key = ta.name.toLowerCase().trim();
        const existing = existingByName.get(key);

        if (existing) {
          // Merge: update identity + metrics, preserve the athlete ID (and its media)
          matchedExistingIds.add(existing.id);
          toUpdate.push({
            id: existing.id,
            data: {
              ig_handle: ta.ig_handle || existing.ig_handle || "",
              ig_followers: ta.ig_followers || existing.ig_followers || 0,
              school: ta.school || existing.school || "",
              sport: ta.sport || existing.sport || "",
              gender: ta.gender || existing.gender || "",
              notes: ta.notes || existing.notes || "",
              post_type: ta.post_type || existing.post_type || "IG Feed",
              post_url: ta.post_url || existing.post_url,
              metrics: ta.metrics || existing.metrics || {},
              sort_order: i,
            },
          });
        } else {
          // New athlete from tracker — insert fresh
          toInsert.push({
            campaign_id: id,
            name: ta.name,
            ig_handle: ta.ig_handle || "",
            ig_followers: ta.ig_followers || 0,
            school: ta.school || "",
            sport: ta.sport || "",
            gender: ta.gender || "",
            notes: ta.notes || "",
            post_type: ta.post_type || "IG Feed",
            post_url: ta.post_url,
            metrics: ta.metrics || {},
            sort_order: i,
          });
        }
      }

      // Only delete athletes that are NOT in the tracker (removed athletes)
      const toDeleteIds = (existingAthletes || [])
        .filter((a) => !matchedExistingIds.has(a.id))
        .map((a) => a.id);

      if (toDeleteIds.length > 0) {
        await supabase.from("media").delete().in("athlete_id", toDeleteIds);
        await supabase.from("athletes").delete().in("id", toDeleteIds);
      }

      // Update existing athletes
      for (const u of toUpdate) {
        await supabase.from("athletes").update(u.data).eq("id", u.id);
      }

      // Insert new athletes
      if (toInsert.length > 0) {
        await supabase.from("athletes").insert(toInsert);
      }

      // Reload all data
      const { data: aths } = await supabase
        .from("athletes")
        .select("*")
        .eq("campaign_id", id)
        .order("sort_order");
      setAthletes(aths || []);
      setSelected((aths || []).map((a: Athlete) => a.id));

      // Reload media (preserved for existing athletes)
      const { data: allMedia } = await supabase
        .from("media")
        .select("*")
        .eq("campaign_id", id)
        .order("sort_order");
      const grouped: Record<string, Media[]> = {};
      for (const m of (allMedia || [])) {
        if (!grouped[m.athlete_id]) grouped[m.athlete_id] = [];
        grouped[m.athlete_id].push(m);
      }
      setMedia(grouped);
    }

    setImportingTracker(false);
  }

  async function saveCampaignName(field: "name" | "client_name", value: string) {
    if (!campaign || !value.trim()) return;
    const { data } = await supabase
      .from("campaign_recaps")
      .update({ [field]: value.trim() })
      .eq("id", campaign.id)
      .select()
      .single();
    if (data) setCampaign(data);
  }

  async function saveCampaignInfo() {
    if (!campaign) return;
    setSavingInfo(true);
    const newSettings = {
      ...campaign.settings,
      description, quarter, campaign_type: campaignType,
      platform, content_type: contentType, tags, visible_sections: visibleSections,
      brand_logo_url: brandLogoUrl,
      key_takeaways: keyTakeaways,
      kpi_targets: kpiTargets,
    };
    const { data } = await supabase
      .from("campaign_recaps")
      .update({ settings: newSettings })
      .eq("id", campaign.id)
      .select()
      .single();
    if (data) {
      setCampaign(data);
      await fetch(`/api/revalidate?path=/recap/${data.slug}`);
    }
    setSavingInfo(false);
  }

  // Auto-save campaign info with debounce
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // Skip auto-save during initial data load
    if (!campaign || !initialLoadDone.current) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const newSettings = {
        ...campaign.settings,
        description, quarter, campaign_type: campaignType,
        platform, content_type: contentType, tags, visible_sections: visibleSections,
        brand_logo_url: brandLogoUrl,
        key_takeaways: keyTakeaways,
        kpi_targets: kpiTargets,
      };
      const { data } = await supabase
        .from("campaign_recaps")
        .update({ settings: newSettings })
        .eq("id", campaign.id)
        .select()
        .single();
      if (data) setCampaign(data);
    }, 1500);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [description, quarter, campaignType, platform, contentType, tags, visibleSections, brandLogoUrl, keyTakeaways, kpiTargets]);

  // Mark initial load as done after campaign data is populated
  useEffect(() => {
    if (campaign && !initialLoadDone.current) {
      // Small delay to let all state setters finish from loadData
      const t = setTimeout(() => { initialLoadDone.current = true; }, 500);
      return () => clearTimeout(t);
    }
  }, [campaign]);

  async function saveMetrics(rows: { _key: string; _isNew: boolean; id?: string; name: string; ig_handle: string; ig_followers: number | ""; school: string; sport: string; gender: string; content_rating: string; reach_level: string; notes: string; post_type: string; metrics: import("@/lib/types").AthleteMetrics }[], deletedIds: string[]) {
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
        content_rating: row.content_rating || null,
        reach_level: row.reach_level || null,
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
        content_rating: r.content_rating || "",
        reach_level: r.reach_level || "",
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
        key_takeaways: keyTakeaways,
        kpi_targets: kpiTargets,
      };
      const { data: updatedCamp } = await supabase
        .from("campaign_recaps")
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

  async function handleFolderConnected(folderId: string) {
    if (!campaign) return;
    const { data, error } = await supabase
      .from("campaign_recaps")
      .update({ drive_folder_id: folderId })
      .eq("id", campaign.id)
      .select()
      .single();
    if (error) throw error;
    if (data) setCampaign(data);
    else setCampaign((prev) => (prev ? ({ ...prev, drive_folder_id: folderId } as Campaign) : prev));
  }

  async function handleDriveImport(
    selections: Record<string, any[]>,
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
              recapId: id,
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const msg =
              errBody?.error ||
              errBody?.message ||
              `HTTP ${res.status}`;
            failed++;
            errors.push({ file: currentFile, error: String(msg) });
          } else {
            const { media: newMedia } = await res.json();
            succeeded++;
            setMedia((prev) => ({
              ...prev,
              [athleteId]: [...(prev[athleteId] || []), newMedia],
            }));
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

  async function removeMedia(athleteId: string, mediaId: string) {
    await supabase.from("media").delete().eq("id", mediaId);
    setMedia((prev) => ({ ...prev, [athleteId]: (prev[athleteId] || []).filter((m) => m.id !== mediaId) }));
  }

  async function setCoverPhoto(athleteId: string, mediaId: string) {
    const items = media[athleteId] || [];
    const target = items.find((m) => m.id === mediaId);
    if (!target || target.type === "video") return; // only images can be covers

    // Reorder: cover image first, then video, then remaining images
    const video = items.find((m) => m.type === "video");
    const otherImages = items.filter((m) => m.id !== mediaId && m.type !== "video");
    const newItems = [target, ...(video ? [video] : []), ...otherImages];

    // Update sort_order in DB and set cover as video thumbnail
    for (let i = 0; i < newItems.length; i++) {
      await supabase.from("media").update({ sort_order: i }).eq("id", newItems[i].id);
    }
    // Set the cover photo as the video's thumbnail
    if (video) {
      await supabase.from("media").update({ thumbnail_url: target.file_url }).eq("id", video.id);
      video.thumbnail_url = target.file_url;
    }
    setMedia((prev) => ({ ...prev, [athleteId]: newItems }));
  }

  function matchFileToAthlete(fileName: string, athleteList: Athlete[], relativePath?: string): Athlete | null {
    // Strip extension and clean up
    const clean = fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[_-]+/g, " ").trim();

    // If file is inside an athlete-named subfolder, try matching the folder name first
    if (relativePath) {
      const pathParts = relativePath.split("/");
      if (pathParts.length >= 2) {
        const folderName = pathParts[pathParts.length - 2].toLowerCase().replace(/[_-]+/g, " ").trim();
        for (const a of athleteList) {
          const nameLower = a.name.trim().toLowerCase();
          if (folderName === nameLower) return a;
          // Check if folder contains first and last name
          const parts = nameLower.split(" ").filter((p) => p.length > 2);
          if (parts.length >= 2 && parts.every((p) => folderName.includes(p))) return a;
          // Check last name match on folder
          const nameParts = nameLower.split(" ").filter(Boolean);
          const lastName = nameParts[nameParts.length - 1] || "";
          if (lastName.length >= 4 && folderName.includes(lastName) && nameParts.some((p) => folderName.includes(p))) return a;
        }
      }
    }

    // Try exact match first
    for (const a of athleteList) {
      if (a.name.trim().toLowerCase() === clean) return a;
    }

    // Try last name match
    for (const a of athleteList) {
      const parts = a.name.trim().toLowerCase().split(" ").filter(Boolean);
      const lastName = parts[parts.length - 1];
      if (!lastName) continue;
      if (clean === lastName) return a;
      // filename might be "lastname_firstname" or "firstname_lastname"
      if (clean.includes(lastName) && parts.some((p) => clean.includes(p))) return a;
    }

    // Try first + last anywhere in filename
    for (const a of athleteList) {
      const parts = a.name.trim().toLowerCase().split(" ").filter((p) => p.length > 2);
      if (parts.length >= 2 && parts.every((p) => clean.includes(p))) return a;
    }

    // Try just last name if it's unique enough (4+ chars)
    for (const a of athleteList) {
      const parts = a.name.trim().toLowerCase().split(" ").filter(Boolean);
      const lastName = parts[parts.length - 1];
      if (lastName && lastName.length >= 4 && clean.includes(lastName)) return a;
    }

    return null;
  }

  async function handleBulkUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      return f.type.startsWith("image/") || f.type.startsWith("video/") || name.endsWith(".heic") || name.endsWith(".heif") || name.endsWith(".mov") || name.endsWith(".mp4");
    });
    if (files.length === 0) return;

    setBulkUploading(true);
    setBulkProgress({ done: 0, total: files.length, matched: 0, unmatched: [] });

    const unmatched: string[] = [];
    let matched = 0;
    const seenAthletes = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const athlete = matchFileToAthlete(file.name, selectedAthletes, (file as any).webkitRelativePath);

      if (athlete) {
        if (!seenAthletes.has(athlete.id)) {
          seenAthletes.add(athlete.id);
        }

        // Skip if this filename already exists for this athlete (prevent duplicates)
        const existing = media[athlete.id] || [];
        const cleanName = file.name.toLowerCase();
        const alreadyUploaded = existing.some((m) => {
          const existingName = m.file_url.split("/").pop()?.replace(/^\d+-/, "").toLowerCase();
          return existingName === cleanName;
        });
        if (alreadyUploaded) {
          matched++;
          setBulkProgress({ done: i + 1, total: files.length, matched, unmatched: [...unmatched] });
          continue;
        }

        const isVideo = file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mov") || file.name.toLowerCase().endsWith(".mp4");

        if (isVideo) {
          const path = `${id}/${athlete.id}/${Date.now()}-${file.name}`;
          const url = await uploadFile(file, path);
          if (url) {
            const { data } = await supabase
              .from("media")
              .insert({ athlete_id: athlete.id, campaign_id: id, type: "video", file_url: url, sort_order: existing.length })
              .select().single();
            if (data) {
              setMedia((prev) => {
                const current = prev[athlete.id] || [];
                return { ...prev, [athlete.id]: [...current, data] };
              });
            }
          }
        } else {
          const converted = await convertHeicIfNeeded(file);
          const path = `${id}/${athlete.id}/${Date.now()}-${converted.name}`;
          const url = await uploadFile(converted, path);
          if (url) {
            const { data } = await supabase
              .from("media")
              .insert({ athlete_id: athlete.id, campaign_id: id, type: "image", file_url: url, sort_order: existing.length })
              .select().single();
            if (data) {
              // Auto-set as video thumbnail if this is the first image and a video exists
              const hasImageAlready = existing.some((m) => m.type === "image");
              const video = existing.find((m) => m.type === "video" && !m.thumbnail_url);
              if (!hasImageAlready && video) {
                await supabase.from("media").update({ thumbnail_url: url }).eq("id", video.id);
                video.thumbnail_url = url;
              }
              setMedia((prev) => {
                const current = prev[athlete.id] || [];
                return { ...prev, [athlete.id]: [...current, data] };
              });
            }
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
    const newSettings = {
      ...campaign.settings,
      description, quarter, campaign_type: campaignType,
      platform, content_type: contentType, tags, visible_sections: visibleSections,
      brand_logo_url: brandLogoUrl,
      key_takeaways: keyTakeaways,
      kpi_targets: kpiTargets,
    };
    const { data, error } = await supabase
      .from("campaign_recaps")
      .update({
        published: !campaign.published,
        settings: newSettings,
      })
      .eq("id", campaign.id)
      .select().single();
    if (error) {
      console.error("Publish failed:", error);
      alert("Publish failed: " + error.message);
      setPublishing(false);
      return;
    }
    if (data) {
      setCampaign(data);
      await fetch(`/api/revalidate?path=/recap/${data.slug}`);
    }
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
        platform, content_type: contentType, tags, visible_sections: visibleSections,
        brand_logo_url: brandLogoUrl,
        key_takeaways: keyTakeaways,
        kpi_targets: kpiTargets,
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
          videoFile={pendingVideo.file}
        />
      )}

      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-gray-500 hover:text-white">← Back</Link>
          <div>
            {editingClient ? (
              <input
                autoFocus
                value={clientDraft}
                onChange={(e) => setClientDraft(e.target.value)}
                onBlur={() => { saveCampaignName("client_name", clientDraft); setEditingClient(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { saveCampaignName("client_name", clientDraft); setEditingClient(false); } if (e.key === "Escape") setEditingClient(false); }}
                className="text-xs font-bold uppercase tracking-[2px] text-[#D73F09] mb-1 bg-transparent border-b border-[#D73F09] outline-none w-48"
              />
            ) : (
              <div
                className="text-xs font-bold uppercase tracking-[2px] text-[#D73F09] mb-1 cursor-pointer hover:opacity-70"
                onClick={() => { setClientDraft(campaign.client_name); setEditingClient(true); }}
                title="Click to edit"
              >
                {campaign.client_name}
              </div>
            )}
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => { saveCampaignName("name", nameDraft); setEditingName(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { saveCampaignName("name", nameDraft); setEditingName(false); } if (e.key === "Escape") setEditingName(false); }}
                className="text-xl font-black bg-transparent border-b border-white outline-none w-72 text-white"
              />
            ) : (
              <h1
                className="text-xl font-black cursor-pointer hover:opacity-70"
                onClick={() => { setNameDraft(campaign.name); setEditingName(true); }}
                title="Click to edit"
              >
                {campaign.name}
              </h1>
            )}
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

            {campaignType === "top_50" ? (
              <Top50RosterEditor
                athletes={athletes}
                setAthletes={setAthletes}
                campaignId={id}
                supabase={supabase}
                uploadFile={uploadFile}
                convertHeicIfNeeded={convertHeicIfNeeded}
              />
            ) : (
              <MetricsSpreadsheet
                athletes={athletes}
                campaignId={id}
                onSave={saveMetrics}
                saving={savingMetrics}
                hiddenColumns={campaign?.settings?.hidden_columns || []}
                onHiddenColumnsChange={async (cols) => {
                  if (!campaign) return;
                  const newSettings = { ...campaign.settings, hidden_columns: cols };
                  await supabase.from("campaign_recaps").update({ settings: newSettings }).eq("id", campaign.id);
                  setCampaign({ ...campaign, settings: newSettings });
                }}
              />
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

            {/* Key Takeaways */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Key Takeaways</label>
              <textarea value={keyTakeaways} onChange={(e) => setKeyTakeaways(e.target.value)} rows={4}
                className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                placeholder="Callouts, recommendations, and highlights for executives..." />
              <p className="text-[10px] text-gray-600 mt-1">Displayed prominently in the recap for executive review</p>
            </div>

            {/* Campaign KPI Targets */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Campaign KPI Targets</label>
              <p className="text-[10px] text-gray-600 mb-3">Set goals from the brief/SOW. The recap will show actual vs. target.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "athlete_quantity" as const, label: "Athletes", placeholder: "e.g. 50" },
                  { key: "content_units" as const, label: "Content Units", placeholder: "e.g. 150" },
                  { key: "posts" as const, label: "Posts", placeholder: "e.g. 100" },
                  { key: "impressions" as const, label: "Impressions", placeholder: "e.g. 500000" },
                  { key: "engagements" as const, label: "Engagements", placeholder: "e.g. 25000" },
                  { key: "engagement_rate" as const, label: "Eng. Rate %", placeholder: "e.g. 5" },
                  { key: "cpm" as const, label: "CPM ($)", placeholder: "e.g. 12" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">{label}</label>
                    <input
                      type="number"
                      value={kpiTargets[key] ?? ""}
                      onChange={(e) => setKpiTargets((prev) => ({
                        ...prev,
                        [key]: e.target.value === "" ? undefined : parseFloat(e.target.value),
                      }))}
                      className="w-full bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Other KPIs</label>
                <textarea
                  value={kpiTargets.other_kpis ?? ""}
                  onChange={(e) => setKpiTargets((prev) => ({ ...prev, other_kpis: e.target.value || undefined }))}
                  rows={2}
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                  placeholder="Any additional KPIs or notes (e.g. athlete reviews, click targets)..."
                />
              </div>
            </div>

            {/* Brand Logo Upload */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Brand Logo</label>
              <div className="flex items-center gap-4">
                {brandLogoUrl ? (
                  <div className="relative">
                    <img src={brandLogoUrl} className="h-16 object-contain bg-white/5 rounded-lg p-2" alt="Brand logo" />
                    <button
                      onClick={() => { setBrandLogoUrl(""); setBrandLogoAutoSet(false); }}
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
                      if (url) { setBrandLogoUrl(url); setBrandLogoAutoSet(false); }
                    };
                    input.click();
                  }}
                  className="px-5 py-2.5 border border-gray-700 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:border-gray-500">
                  Upload Custom
                </button>
              </div>
              {/* Brand Kit Logo Picker */}
              {brandKitLogos.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Brand Kit</p>
                  <div className="flex flex-wrap gap-2">
                    {brandKitLogos.map((logo, i) => (
                      <button
                        key={i}
                        onClick={() => { setBrandLogoUrl(logo.url); setBrandLogoAutoSet(true); }}
                        className="flex flex-col items-center gap-1 group"
                        title={logo.label}
                      >
                        <div
                          className="rounded-lg p-2 flex items-center justify-center"
                          style={{
                            width: 72, height: 48,
                            background: "#111",
                            border: brandLogoUrl === logo.url ? "2px solid #D73F09" : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <img src={logo.url} alt={logo.label} style={{ maxHeight: 32, maxWidth: 56, objectFit: "contain" }} />
                        </div>
                        <span className="text-[9px] text-gray-500 group-hover:text-gray-300 truncate" style={{ maxWidth: 72 }}>{logo.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : campaign?.brand_id ? (
                <p className="text-[10px] text-gray-600 mt-2">No logos in brand kit — upload manually</p>
              ) : null}
              <p className="text-[10px] text-gray-600 mt-1">Displayed in the recap header and footer</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Campaign Name</label>
              <input value={campaign?.name || ""} onChange={async (e) => {
                  const val = e.target.value;
                  setCampaign((prev) => prev ? { ...prev, name: val } : prev);
                  await supabase.from("campaign_recaps").update({ name: val }).eq("id", id);
                }}
                className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                placeholder="e.g. March Madness" />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Platform(s)</label>
                <input value={platform} onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                  placeholder="Instagram" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Content Type</label>
                <input value={contentType} onChange={(e) => setContentType(e.target.value)}
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#D73F09] focus:outline-none"
                  placeholder="IG Feed, Reels" />
              </div>
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

            <div className="text-xs text-gray-500 italic">Changes are saved automatically</div>
          </div>
        )}

        {/* ── STEP 3: Select Posts ─────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Featured Athletes Section (Top 50 campaigns only) */}
            {campaignType === "top_50" && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#D73F09"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span className="text-sm font-black uppercase text-[#D73F09]">Featured Athletes</span>
                  <span className="text-xs text-gray-500">(click to toggle, drag to reorder)</span>
                </div>

                {/* Currently featured */}
                <div className="space-y-1 mb-3">
                  {athletes
                    .filter((a: any) => a.is_featured)
                    .sort((a: any, b: any) => (a.featured_order || 0) - (b.featured_order || 0))
                    .map((a: any, idx: number) => (
                      <div key={a.id} className="rounded-lg bg-[#D73F09]/10 border border-[#D73F09]/30 overflow-hidden">
                        <div className="flex items-center gap-3 p-3">
                          <span className="text-lg font-black text-[#D73F09] w-8 text-center">#{idx + 1}</span>
                          <SchoolBadge school={a.school} size={32} />
                          <div className="flex-1">
                            <div className="text-sm font-black uppercase">{a.name}</div>
                            <div className="text-xs text-gray-500">{a.school} · {a.sport}</div>
                          </div>
                          {/* Move up/down */}
                          <button
                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                            onClick={async () => {
                              if (idx === 0) return;
                              const featured = athletes.filter((x: any) => x.is_featured).sort((x: any, y: any) => (x.featured_order || 0) - (y.featured_order || 0));
                              const prev = featured[idx - 1];
                              await supabase.from("athletes").update({ featured_order: idx }).eq("id", a.id);
                              await supabase.from("athletes").update({ featured_order: idx + 1 }).eq("id", prev.id);
                              setAthletes((p: any[]) => p.map((x) => x.id === a.id ? { ...x, featured_order: idx } : x.id === prev.id ? { ...x, featured_order: idx + 1 } : x));
                            }}>
                            ▲
                          </button>
                          <button
                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                            onClick={async () => {
                              const featured = athletes.filter((x: any) => x.is_featured).sort((x: any, y: any) => (x.featured_order || 0) - (y.featured_order || 0));
                              if (idx >= featured.length - 1) return;
                              const next = featured[idx + 1];
                              await supabase.from("athletes").update({ featured_order: idx + 2 }).eq("id", a.id);
                              await supabase.from("athletes").update({ featured_order: idx + 1 }).eq("id", next.id);
                              setAthletes((p: any[]) => p.map((x) => x.id === a.id ? { ...x, featured_order: idx + 2 } : x.id === next.id ? { ...x, featured_order: idx + 1 } : x));
                            }}>
                            ▼
                          </button>
                          {/* Remove from featured */}
                          <button
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-white/5 hover:bg-red-500/10"
                            onClick={async () => {
                              await supabase.from("athletes").update({ is_featured: false, featured_order: 0 }).eq("id", a.id);
                              setAthletes((p: any[]) => p.map((x) => x.id === a.id ? { ...x, is_featured: false, featured_order: 0 } : x));
                            }}>
                            ✕ Remove
                          </button>
                        </div>

                        {/* Content upload zone for featured athletes */}
                        <div className="px-3 pb-3 pt-1 border-t border-[#D73F09]/15">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D73F09]/60">Featured Content</span>
                            <span className="text-[10px] text-gray-600">{(media[a.id] || []).length} files</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            {(media[a.id] || []).map((m: Media) => {
                              const src = m.thumbnail_url || (m.type === "image" ? m.file_url : null);
                              return (
                                <div key={m.id} className="relative group/ft w-14 h-14 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                                  {src ? (
                                    <img src={supabaseImageUrl(src, 100) ?? src} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => removeMedia(a.id, m.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 text-white text-[8px] flex items-center justify-center hover:bg-red-600 opacity-0 group-hover/ft:opacity-100 transition-opacity z-10"
                                  >×</button>
                                </div>
                              );
                            })}
                            <div
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*,video/*,.heic,.heif";
                                input.multiple = true;
                                input.onchange = (ev) => handleFiles(a.id, (ev.target as HTMLInputElement).files);
                                input.click();
                              }}
                              onDrop={(e) => { e.preventDefault(); handleFiles(a.id, e.dataTransfer?.files); }}
                              onDragOver={(e) => e.preventDefault()}
                              className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-700 hover:border-[#D73F09] flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {athletes.filter((a: any) => a.is_featured).length === 0 && (
                    <div className="text-xs text-gray-500 italic p-3">No featured athletes selected. Click the star on any athlete below to feature them.</div>
                  )}
                </div>
                <div className="h-px bg-gray-800 my-4" />
              </div>
            )}

            {/* All athletes list */}
            {athletes.map((a: any) => {
              const on = selected.includes(a.id);
              const isFeatured = campaignType === "top_50" && a.is_featured;
              return (
                <div key={a.id} className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer border ${on ? "bg-[#D73F09]/5 border-[#D73F09]/30" : "bg-[#111] border-gray-800"}`}>
                  {/* Featured star (Top 50 only) */}
                  {campaignType === "top_50" && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const newFeatured = !a.is_featured;
                        const featuredCount = athletes.filter((x: any) => x.is_featured).length;
                        const newOrder = newFeatured ? featuredCount + 1 : 0;
                        await supabase.from("athletes").update({ is_featured: newFeatured, featured_order: newOrder }).eq("id", a.id);
                        setAthletes((p: any[]) => p.map((x) => x.id === a.id ? { ...x, is_featured: newFeatured, featured_order: newOrder } : x));
                      }}
                      className="flex-shrink-0"
                      title={isFeatured ? "Remove from featured" : "Add to featured"}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={isFeatured ? "#D73F09" : "none"} stroke={isFeatured ? "#D73F09" : "#555"} strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    </button>
                  )}
                  <div onClick={() => setSelected((prev) => on ? prev.filter((x) => x !== a.id) : [...prev, a.id])} className="flex items-center gap-4 flex-1">
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
                </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 4: Upload Content ──────────────────────── */}
        {step === 4 && (
          <div className="space-y-8">

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDriveImportOpen(true)}
                className="px-5 py-2.5 border border-gray-700 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:border-gray-500"
              >
                Import from Drive
              </button>
            </div>

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
                input.accept = "image/*,video/*,.heic,.heif";
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
                  <div className="text-sm font-bold text-gray-300 mb-1">Bulk Upload Content</div>
                  <div className="text-xs text-gray-500 mb-3">
                    Drop a folder of images &amp; videos or click to browse. Files are auto-matched to athletes by name.
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
                  // Always use the first image as cover (not video)
                  const firstImage = items.find((m) => m.type === "image" || m.type !== "video");
                  const cover = firstImage || items[0];
                  const coverSrc = cover?.type !== "video" ? cover?.file_url : cover?.thumbnail_url;

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
                          <img
                            src={supabaseImageUrl(coverSrc, 600) ?? coverSrc}
                            className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast]"
                            alt={a.name}
                            loading="lazy"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (img.src.includes("/render/image/public/")) {
                                img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
                              }
                            }}
                          />
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
                        {items.map((m, idx) => {
                          const thumbSrc = m.thumbnail_url || (m.type !== "video" ? m.file_url : null);
                          const isCover = idx === 0;
                          return (
                            <div key={m.id} className="relative flex-shrink-0 group/thumb">
                              <div
                                onClick={(e) => { e.stopPropagation(); if (!isCover) setCoverPhoto(a.id, m.id); }}
                                title={isCover ? "Cover photo" : "Click to set as cover"}
                                className={`w-9 h-9 rounded overflow-hidden border-2 cursor-pointer transition-all ${
                                  isCover
                                    ? "border-[#D73F09] ring-1 ring-[#D73F09]/40"
                                    : m.type === "video"
                                    ? "border-purple-500/50 hover:border-purple-400"
                                    : "border-gray-700 hover:border-[#D73F09]/60"
                                }`}
                              >
                                {thumbSrc ? (
                                  <img
                                    src={supabaseImageUrl(thumbSrc, 100) ?? thumbSrc}
                                    className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast]"
                                    alt=""
                                    loading="lazy"
                                    onError={(e) => {
                                      const img = e.currentTarget;
                                      if (img.src.includes("/render/image/public/")) {
                                        img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                  </div>
                                )}
                              </div>
                              {/* Cover star badge */}
                              {isCover && (
                                <div className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-[#D73F09] flex items-center justify-center z-10">
                                  <svg width="7" height="7" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                </div>
                              )}
                              {/* Video play button overlay */}
                              {m.type === "video" && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
                                    <svg width="7" height="7" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 19 12 8 19 8 5"/></svg>
                                  </div>
                                </div>
                              )}
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
                      {campaign?.admin_campaign_id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTier3PickerAthlete(a); }}
                          className="mt-1 w-full px-2 py-1 border border-gray-700 rounded text-[9px] font-bold text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center gap-1"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                          </svg>
                          Submissions
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <DrivePicker
              isOpen={driveImportOpen}
              onClose={() => setDriveImportOpen(false)}
              folderId={campaign?.drive_folder_id}
              onFolderConnected={handleFolderConnected}
              athletes={selectedAthletes.map((a) => ({ id: a.id, name: a.name }))}
              onImport={handleDriveImport}
            />

            {tier3PickerAthlete && campaign?.admin_campaign_id && (
              <Tier3Picker
                recapId={id}
                brandCampaignId={campaign.admin_campaign_id}
                athleteId={tier3PickerAthlete.id}
                athleteName={tier3PickerAthlete.name}
                onClose={() => setTier3PickerAthlete(null)}
                onImported={(newMedia) => {
                  setMedia((prev) => ({
                    ...prev,
                    [tier3PickerAthlete.id]: [...(prev[tier3PickerAthlete.id] || []), newMedia],
                  }));
                }}
              />
            )}
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
