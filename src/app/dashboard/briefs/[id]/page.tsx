"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Brief, Campaign } from "@/lib/types";
import { generateBriefHTML, type BriefFields } from "@/lib/brief-template";
import Link from "next/link";

const EMPTY_FIELDS: BriefFields = {
  title: "",
  clientName: "",
  badgeText: "Videographer Creative Brief",
  objective: "",
  deliverables: "",
  creativeDirection: "",
  platformNotes: "",
  cameraTechnical: "",
  dos: "",
  donts: "",
  workflow: "",
  fileDelivery: "",
};

const FIELD_CONFIG = [
  { key: "objective" as const, label: "Objective", placeholder: "Describe the campaign objective and goals..." },
  { key: "deliverables" as const, label: "Required Deliverables", placeholder: "List deliverables, one per line:\n- 3 vertical videos (9:16, 30-60s)\n- 10 high-res photos\n- 2 horizontal videos (16:9, 15-30s)" },
  { key: "creativeDirection" as const, label: "Creative Direction", placeholder: "Describe tone, style, visual direction:\n- Energetic, fast-paced editing\n- Natural lighting preferred\n- Brand colors prominent" },
  { key: "platformNotes" as const, label: "Platform & Posting", placeholder: "Platform-specific guidelines:\n- Instagram Reels: 9:16, 30s max\n- TikTok: trending audio encouraged\n- Stories: behind-the-scenes content" },
  { key: "cameraTechnical" as const, label: "Camera & Technical", placeholder: "Camera settings and technical requirements:\n- Shoot in 4K, 60fps\n- S-Log or flat color profile\n- Stabilized footage required" },
  { key: "workflow" as const, label: "Shoot Workflow", placeholder: "Step-by-step shoot workflow:\n- Arrive 30 min early for setup\n- Capture establishing shots first\n- Get talent in branded gear\n- Film primary content\n- Capture B-roll and close-ups" },
  { key: "fileDelivery" as const, label: "File Delivery", placeholder: "File delivery instructions:\n- Upload raw footage to Google Drive\n- Deliver edited files within 24 hours\n- Photos: JPEG + RAW\n- Videos: MP4, H.264" },
];

export default function BriefEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [fields, setFields] = useState<BriefFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRawHtml, setShowRawHtml] = useState(false);
  const [rawHtml, setRawHtml] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const supabase = createBrowserSupabase();

  // Tracker linking state
  const [trackers, setTrackers] = useState<Campaign[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [creatingTracker, setCreatingTracker] = useState(false);
  const [newTrackerName, setNewTrackerName] = useState("");

  useEffect(() => {
    loadBrief();
    loadTrackers();
  }, [id]);

  async function loadTrackers() {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("type", "tracker")
      .order("created_at", { ascending: false });
    setTrackers(data || []);
  }

  async function loadBrief() {
    const { data } = await supabase
      .from("briefs")
      .select("*, tracker_id")
      .eq("id", id)
      .single();
    if (data) {
      setBrief(data);
      setSelectedTrackerId(data.tracker_id || null);
      // Try to parse stored fields from html_content metadata, or use defaults
      const storedFields = parseStoredFields(data);
      setFields(storedFields);
      setRawHtml(data.html_content || "");
    }
    setLoading(false);
  }

  async function createTrackerFromBrief() {
    const trackerName = newTrackerName.trim() || `${fields.title || brief?.title || "Untitled"} Tracker`;
    const clientName = fields.clientName || brief?.client_name || "";
    if (!clientName) return;

    setCreatingTracker(true);
    const slug = trackerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
      "-" + Date.now().toString(36);

    const { data } = await supabase
      .from("campaigns")
      .insert({
        name: trackerName,
        slug,
        client_name: clientName,
        published: false,
        type: "tracker",
        settings: { primary_color: "#D73F09" },
      })
      .select()
      .single();

    if (data) {
      // Link to this brief
      setSelectedTrackerId(data.id);
      await supabase.from("briefs").update({ tracker_id: data.id }).eq("id", id);
      setTrackers((prev) => [data, ...prev]);
      setNewTrackerName("");
    }
    setCreatingTracker(false);
  }

  function parseStoredFields(brief: Brief): BriefFields {
    // Check if there's a JSON comment in the HTML with field data
    const match = brief.html_content?.match(
      /<!--BRIEF_FIELDS:(.*?)-->/s
    );
    if (match) {
      try {
        return { ...EMPTY_FIELDS, ...JSON.parse(match[1]) };
      } catch {}
    }
    // Fallback: populate title/client from brief record
    return {
      ...EMPTY_FIELDS,
      title: brief.title,
      clientName: brief.client_name,
    };
  }

  const previewHtml = useCallback(() => {
    if (showRawHtml) return rawHtml;
    const html = generateBriefHTML(fields);
    // Embed field data as a comment for round-tripping
    return html.replace(
      "</head>",
      `<!--BRIEF_FIELDS:${JSON.stringify(fields)}-->\n</head>`
    );
  }, [fields, showRawHtml, rawHtml]);

  function updateField(key: keyof BriefFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function saveBrief(publish?: boolean) {
    if (!brief) return;
    setSaving(true);
    const htmlContent = previewHtml();
    const updates: Record<string, unknown> = {
      title: fields.title || brief.title,
      client_name: fields.clientName || brief.client_name,
      html_content: htmlContent,
      updated_at: new Date().toISOString(),
      tracker_id: selectedTrackerId || null,
    };
    if (publish !== undefined) {
      updates.published = publish;
    }
    const { data } = await supabase
      .from("briefs")
      .update(updates)
      .eq("id", brief.id)
      .select()
      .single();
    if (data) {
      setBrief(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Brief not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Link
            href="/dashboard?tab=briefs"
            className="text-xs text-gray-500 hover:text-gray-300 mb-1 block"
          >
            ← Back to Briefs
          </Link>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-1">
            {brief.client_name}
          </div>
          <h1 className="text-lg font-black">{brief.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {brief.published && (
            <Link
              href={`/brief/${brief.slug}`}
              target="_blank"
              className="text-xs text-[#D73F09] hover:underline"
            >
              View Live →
            </Link>
          )}
          <button
            onClick={() => saveBrief()}
            disabled={saving}
            className="px-4 py-2 border border-gray-700 text-gray-400 text-sm font-bold rounded-lg hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save Draft"}
          </button>
          <button
            onClick={() => saveBrief(!brief.published)}
            disabled={saving}
            className="px-5 py-2 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50"
          >
            {brief.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Form fields */}
        <div className="w-[440px] flex-shrink-0 border-r border-gray-800 overflow-y-auto p-6 space-y-6">
          {/* Title & client */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Brief Title
            </label>
            <input
              value={fields.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Brand / Client
              </label>
              <input
                value={fields.clientName}
                onChange={(e) => updateField("clientName", e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Badge Text
              </label>
              <input
                value={fields.badgeText}
                onChange={(e) => updateField("badgeText", e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none"
              />
            </div>
          </div>

          {/* Content sections */}
          {FIELD_CONFIG.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                {label}
              </label>
              <textarea
                value={fields[key]}
                onChange={(e) => updateField(key, e.target.value)}
                placeholder={placeholder}
                rows={5}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y"
              />
            </div>
          ))}

          {/* Do's & Don'ts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-green-600 mb-2">
                Do&apos;s
              </label>
              <textarea
                value={fields.dos}
                onChange={(e) => updateField("dos", e.target.value)}
                placeholder={"Capture wide establishing shots\nShow branded product clearly\nUse natural lighting"}
                rows={5}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-red-500 mb-2">
                Don&apos;ts
              </label>
              <textarea
                value={fields.donts}
                onChange={(e) => updateField("donts", e.target.value)}
                placeholder={"No competitor branding visible\nDon't shoot vertical for YouTube\nAvoid shaky handheld footage"}
                rows={5}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none resize-y"
              />
            </div>
          </div>

          {/* Performance Tracker Link */}
          <div className="border-t border-gray-800 pt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Performance Tracker
            </label>

            {/* Select existing tracker */}
            <select
              value={selectedTrackerId || ""}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTrackerId(val || null);
                setSaved(false);
              }}
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none mb-3 appearance-none"
            >
              <option value="">No tracker linked</option>
              {trackers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.client_name}
                </option>
              ))}
            </select>

            {/* Quick link to edit selected tracker */}
            {selectedTrackerId && (
              <Link
                href={`/dashboard/trackers/${selectedTrackerId}`}
                className="inline-flex items-center gap-2 text-xs text-[#D73F09] hover:underline mb-3"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Tracker →
              </Link>
            )}

            {/* Or create new tracker */}
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-600 my-3">
              <div className="flex-1 border-t border-gray-800" />
              or
              <div className="flex-1 border-t border-gray-800" />
            </div>
            <div className="flex gap-2">
              <input
                value={newTrackerName}
                onChange={(e) => setNewTrackerName(e.target.value)}
                placeholder="New tracker name..."
                className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#D73F09] outline-none"
              />
              <button
                onClick={createTrackerFromBrief}
                disabled={creatingTracker}
                className="px-4 py-2 bg-[#D73F09] text-white text-xs font-bold rounded-lg hover:bg-[#B33407] disabled:opacity-50 whitespace-nowrap"
              >
                {creatingTracker ? "Creating..." : "+ Create"}
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              Creates a new tracker and links it to this brief. It will also appear in the Performance Trackers tab.
            </p>
          </div>

          {/* Raw HTML toggle */}
          <div className="border-t border-gray-800 pt-4">
            <button
              onClick={() => {
                if (!showRawHtml) {
                  setRawHtml(previewHtml());
                }
                setShowRawHtml(!showRawHtml);
              }}
              className="text-xs text-gray-500 hover:text-gray-300 font-bold uppercase tracking-wider"
            >
              {showRawHtml ? "← Back to Fields" : "Edit Raw HTML →"}
            </button>
            {showRawHtml && (
              <textarea
                value={rawHtml}
                onChange={(e) => setRawHtml(e.target.value)}
                rows={20}
                className="w-full mt-3 px-4 py-3 bg-black border border-gray-700 rounded-lg text-green-400 text-xs font-mono focus:border-[#D73F09] outline-none resize-y"
              />
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 bg-[#0a0a0a] overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Preview
            </span>
          </div>
          <div className="flex-1 overflow-auto flex justify-center p-4">
            <iframe
              ref={iframeRef}
              srcDoc={previewHtml()}
              className="w-full max-w-[850px] bg-white rounded-lg shadow-2xl"
              style={{ height: "calc(100vh - 120px)" }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
