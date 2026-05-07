"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentQueueItem {
  id: string;
  channel: string;
  caption: string | null;
  hashtags: string[] | null;
  asset_url: string | null;
  asset_urls: string[] | null;
  thumbnail_url: string | null;
  status: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  notes: string | null;
  athlete_name: string | null;
  campaign_id: string | null;
  template_type: string | null;
  platform_post_id: string | null;
  publish_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface PostingPackage {
  id: string;
  athlete_name: string;
  athlete_id: string | null;
  campaign_id: string | null;
  video_url: string | null;
  caption_short: string | null;
  caption_medium: string | null;
  caption_long: string | null;
  hashtags: string[] | null;
  mentions: string[] | null;
  platform_notes: string | null;
  ftc_note: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  intended_post_date: string | null;
  status: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  posted_at: string | null;
  live_url: string | null;
  am_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_STATUSES = ["all", "draft", "ready", "scheduled", "posted", "failed"] as const;
const PACKAGE_STATUSES = ["all", "draft", "sent", "confirmed", "posted"] as const;

const CHANNEL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "Twitter / X" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
];

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "IG",
  tiktok: "TikTok",
  twitter: "X",
  youtube: "YT",
  facebook: "FB",
};

const CHANNEL_COLORS: Record<string, string> = {
  instagram: "bg-pink-600",
  tiktok: "bg-gray-700",
  twitter: "bg-blue-500",
  youtube: "bg-red-600",
  facebook: "bg-blue-700",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-600 text-gray-200",
  ready: "bg-green-700 text-green-100",
  scheduled: "bg-blue-700 text-blue-100",
  posted: "bg-emerald-700 text-emerald-100",
  failed: "bg-red-700 text-red-100",
  sent: "bg-yellow-700 text-yellow-100",
  confirmed: "bg-indigo-700 text-indigo-100",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: string | null) {
  if (!d) return "---";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d: string | null) {
  if (!d) return "---";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(s: string | null, len = 80) {
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "..." : s;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PublishingPage() {
  const supabase = createBrowserSupabase();

  // Main tab
  const [mainTab, setMainTab] = useState<"queue" | "packages">("queue");

  // Content Queue state
  const [queueItems, setQueueItems] = useState<ContentQueueItem[]>([]);
  const [queueFilter, setQueueFilter] = useState("all");
  const [queueLoading, setQueueLoading] = useState(true);
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Posting Packages state
  const [packages, setPackages] = useState<PostingPackage[]>([]);
  const [packageFilter, setPackageFilter] = useState("all");
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);

  // Distributor agent
  const [showDistributor, setShowDistributor] = useState(false);
  const [distForm, setDistForm] = useState({
    athlete_name: "",
    asset_type: "",
    content_description: "",
    campaign_id: "",
  });
  const [distLoading, setDistLoading] = useState(false);
  const [distResult, setDistResult] = useState<string | null>(null);

  // Edit states
  const [editingQueue, setEditingQueue] = useState<Record<string, Partial<ContentQueueItem>>>({});
  const [editingPkg, setEditingPkg] = useState<Record<string, Partial<PostingPackage>>>({});
  const [saving, setSaving] = useState(false);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    let query = supabase
      .from("content_queue")
      .select("*")
      .order("created_at", { ascending: false });

    if (queueFilter !== "all") {
      query = query.eq("status", queueFilter);
    }
    const { data } = await query;
    setQueueItems((data as ContentQueueItem[]) || []);
    setQueueLoading(false);
  }, [queueFilter]);

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true);
    let query = supabase
      .from("posting_packages")
      .select("*")
      .order("created_at", { ascending: false });

    if (packageFilter !== "all") {
      query = query.eq("status", packageFilter);
    }
    const { data } = await query;
    setPackages((data as PostingPackage[]) || []);
    setPackagesLoading(false);
  }, [packageFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  // -----------------------------------------------------------------------
  // Queue actions
  // -----------------------------------------------------------------------

  async function updateQueueItem(id: string, updates: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/publishing/queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    loadQueue();
  }

  async function addQueueItem(form: Record<string, unknown>) {
    setSaving(true);
    await fetch("/api/publishing/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowAddModal(false);
    loadQueue();
  }

  // -----------------------------------------------------------------------
  // Package actions
  // -----------------------------------------------------------------------

  async function updatePackage(id: string, updates: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/publishing/packages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    loadPackages();
  }

  // -----------------------------------------------------------------------
  // Distributor agent
  // -----------------------------------------------------------------------

  async function runDistributor() {
    setDistLoading(true);
    setDistResult(null);
    try {
      const res = await fetch("/api/agents/distributor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athlete_name: distForm.athlete_name,
          asset_type: distForm.asset_type,
          content_description: distForm.content_description,
          campaign_id: distForm.campaign_id || undefined,
        }),
      });
      const data = await res.json();
      setDistResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setDistResult(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
    setDistLoading(false);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-400 hover:text-white text-sm transition"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Publishing</h1>
          </div>
        </div>

        {/* Main tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          <button
            onClick={() => setMainTab("queue")}
            className={`px-4 py-2 text-sm font-medium rounded-t transition ${
              mainTab === "queue"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Content Queue
          </button>
          <button
            onClick={() => setMainTab("packages")}
            className={`px-4 py-2 text-sm font-medium rounded-t transition ${
              mainTab === "packages"
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Posting Packages
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ================================================================
            TAB 1: CONTENT QUEUE
            ================================================================ */}
        {mainTab === "queue" && (
          <div>
            {/* Sub-filters + Add button */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex flex-wrap gap-1">
                {QUEUE_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQueueFilter(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition capitalize ${
                      queueFilter === s
                        ? "bg-[#D73F09] text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[#D73F09] hover:bg-[#c13607] text-white text-sm font-medium rounded transition"
              >
                + Add to Queue
              </button>
            </div>

            {/* Queue cards */}
            {queueLoading ? (
              <p className="text-gray-500 text-center py-12">Loading queue...</p>
            ) : queueItems.length === 0 ? (
              <p className="text-gray-500 text-center py-12">
                No items in queue{queueFilter !== "all" ? ` with status "${queueFilter}"` : ""}.
              </p>
            ) : (
              <div className="space-y-3">
                {queueItems.map((item) => {
                  const isExpanded = expandedQueue === item.id;
                  const edit = editingQueue[item.id] || {};
                  return (
                    <div
                      key={item.id}
                      className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
                    >
                      {/* Card header */}
                      <button
                        onClick={() =>
                          setExpandedQueue(isExpanded ? null : item.id)
                        }
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-750 transition"
                      >
                        {/* Thumbnail */}
                        {item.thumbnail_url && (
                          <img
                            src={item.thumbnail_url}
                            alt=""
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        )}

                        {/* Channel badge */}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                            CHANNEL_COLORS[item.channel] || "bg-gray-600"
                          } text-white flex-shrink-0`}
                        >
                          {CHANNEL_LABELS[item.channel] || item.channel}
                        </span>

                        {/* Caption preview */}
                        <span className="flex-1 text-sm text-gray-200 truncate">
                          {truncate(item.caption, 100) || "No caption"}
                        </span>

                        {/* Athlete */}
                        {item.athlete_name && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {item.athlete_name}
                          </span>
                        )}

                        {/* Status badge */}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
                            STATUS_COLORS[item.status || "draft"]
                          } flex-shrink-0`}
                        >
                          {item.status || "draft"}
                        </span>

                        {/* Scheduled */}
                        {item.scheduled_for && (
                          <span className="text-xs text-blue-400 flex-shrink-0">
                            {formatDate(item.scheduled_for)}
                          </span>
                        )}

                        {/* Created */}
                        <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:block">
                          {formatDate(item.created_at)}
                        </span>

                        <span className="text-gray-500 flex-shrink-0">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
                          {/* Full caption */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Caption
                            </label>
                            <textarea
                              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                              rows={3}
                              defaultValue={item.caption || ""}
                              onChange={(e) =>
                                setEditingQueue((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], caption: e.target.value },
                                }))
                              }
                            />
                          </div>

                          {/* Hashtags */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Hashtags
                            </label>
                            <input
                              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                              defaultValue={(item.hashtags || []).join(", ")}
                              onChange={(e) =>
                                setEditingQueue((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    hashtags: e.target.value
                                      .split(",")
                                      .map((t) => t.trim())
                                      .filter(Boolean) as string[],
                                  },
                                }))
                              }
                            />
                          </div>

                          {/* Asset URLs */}
                          {item.asset_url && (
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Asset URL
                              </label>
                              <a
                                href={item.asset_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-blue-400 hover:underline break-all"
                              >
                                {item.asset_url}
                              </a>
                            </div>
                          )}

                          {item.asset_urls && item.asset_urls.length > 0 && (
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Additional Assets
                              </label>
                              <div className="space-y-1">
                                {item.asset_urls.map((url, i) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-blue-400 hover:underline break-all block"
                                  >
                                    {url}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Notes
                            </label>
                            <textarea
                              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                              rows={2}
                              defaultValue={item.notes || ""}
                              onChange={(e) =>
                                setEditingQueue((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], notes: e.target.value },
                                }))
                              }
                            />
                          </div>

                          {/* Scheduled for */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Scheduled For
                            </label>
                            <input
                              type="datetime-local"
                              className="bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                              defaultValue={
                                item.scheduled_for
                                  ? item.scheduled_for.slice(0, 16)
                                  : ""
                              }
                              onChange={(e) =>
                                setEditingQueue((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    scheduled_for: e.target.value
                                      ? new Date(e.target.value).toISOString()
                                      : null,
                                  },
                                }))
                              }
                            />
                          </div>

                          {/* Error */}
                          {item.publish_error && (
                            <div className="bg-red-900/30 border border-red-700 rounded p-2 text-sm text-red-300">
                              Error: {item.publish_error}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {/* Save edits */}
                            {Object.keys(edit).length > 0 && (
                              <button
                                onClick={() => {
                                  updateQueueItem(item.id, edit);
                                  setEditingQueue((prev) => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                }}
                                disabled={saving}
                                className="px-3 py-1.5 bg-[#D73F09] hover:bg-[#c13607] text-white text-xs font-medium rounded transition"
                              >
                                {saving ? "Saving..." : "Save Changes"}
                              </button>
                            )}

                            {/* Status transitions */}
                            {item.status !== "ready" && (
                              <button
                                onClick={() =>
                                  updateQueueItem(item.id, { status: "ready" })
                                }
                                className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded transition"
                              >
                                Mark Ready
                              </button>
                            )}
                            {item.status !== "scheduled" && (
                              <button
                                onClick={() =>
                                  updateQueueItem(item.id, { status: "scheduled" })
                                }
                                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded transition"
                              >
                                Mark Scheduled
                              </button>
                            )}
                            {item.status !== "posted" && (
                              <button
                                onClick={() =>
                                  updateQueueItem(item.id, { status: "posted" })
                                }
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded transition"
                              >
                                Mark Posted
                              </button>
                            )}
                            {item.status !== "draft" && (
                              <button
                                onClick={() =>
                                  updateQueueItem(item.id, { status: "draft" })
                                }
                                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium rounded transition"
                              >
                                Back to Draft
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add to Queue Modal */}
            {showAddModal && <AddQueueModal onClose={() => setShowAddModal(false)} onSubmit={addQueueItem} saving={saving} />}
          </div>
        )}

        {/* ================================================================
            TAB 2: POSTING PACKAGES
            ================================================================ */}
        {mainTab === "packages" && (
          <div>
            {/* Sub-filters + Distributor button */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex flex-wrap gap-1">
                {PACKAGE_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPackageFilter(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition capitalize ${
                      packageFilter === s
                        ? "bg-[#D73F09] text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowDistributor(true)}
                className="px-4 py-2 bg-[#D73F09] hover:bg-[#c13607] text-white text-sm font-medium rounded transition"
              >
                Run Distributor Agent
              </button>
            </div>

            {/* Package cards */}
            {packagesLoading ? (
              <p className="text-gray-500 text-center py-12">
                Loading packages...
              </p>
            ) : packages.length === 0 ? (
              <p className="text-gray-500 text-center py-12">
                No posting packages
                {packageFilter !== "all" ? ` with status "${packageFilter}"` : ""}.
              </p>
            ) : (
              <div className="space-y-3">
                {packages.map((pkg) => {
                  const isExpanded = expandedPackage === pkg.id;
                  const edit = editingPkg[pkg.id] || {};
                  return (
                    <div
                      key={pkg.id}
                      className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
                    >
                      {/* Card header */}
                      <button
                        onClick={() =>
                          setExpandedPackage(isExpanded ? null : pkg.id)
                        }
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-750 transition"
                      >
                        {/* Athlete name */}
                        <span className="font-semibold text-sm flex-shrink-0">
                          {pkg.athlete_name}
                        </span>

                        {/* Video link */}
                        {pkg.video_url && (
                          <a
                            href={pkg.video_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-400 hover:underline flex-shrink-0"
                          >
                            Video
                          </a>
                        )}

                        {/* Caption preview */}
                        <span className="flex-1 text-sm text-gray-400 truncate">
                          {truncate(pkg.caption_short || pkg.caption_medium || pkg.caption_long, 80)}
                        </span>

                        {/* Status badge */}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
                            STATUS_COLORS[pkg.status || "draft"]
                          } flex-shrink-0`}
                        >
                          {pkg.status || "draft"}
                        </span>

                        {/* Posting window */}
                        {(pkg.posting_window_start || pkg.posting_window_end) && (
                          <span className="text-xs text-gray-500 flex-shrink-0 hidden md:block">
                            {formatDate(pkg.posting_window_start)} &ndash;{" "}
                            {formatDate(pkg.posting_window_end)}
                          </span>
                        )}

                        {/* Intended post date */}
                        {pkg.intended_post_date && (
                          <span className="text-xs text-blue-400 flex-shrink-0">
                            Post: {formatDate(pkg.intended_post_date)}
                          </span>
                        )}

                        {/* Live URL */}
                        {pkg.live_url && (
                          <a
                            href={pkg.live_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-emerald-400 hover:underline flex-shrink-0"
                          >
                            Live
                          </a>
                        )}

                        <span className="text-gray-500 flex-shrink-0">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
                          {/* Caption Short */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Caption (Short)
                            </label>
                            <textarea
                              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                              rows={2}
                              defaultValue={pkg.caption_short || ""}
                              onChange={(e) =>
                                setEditingPkg((prev) => ({
                                  ...prev,
                                  [pkg.id]: { ...prev[pkg.id], caption_short: e.target.value },
                                }))
                              }
                            />
                          </div>

                          {/* Caption Medium */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Caption (Medium)
                            </label>
                            <textarea
                              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                              rows={3}
                              defaultValue={pkg.caption_medium || ""}
                              onChange={(e) =>
                                setEditingPkg((prev) => ({
                                  ...prev,
                                  [pkg.id]: { ...prev[pkg.id], caption_medium: e.target.value },
                                }))
                              }
                            />
                          </div>

                          {/* Caption Long */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Caption (Long)
                            </label>
                            <textarea
                              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                              rows={4}
                              defaultValue={pkg.caption_long || ""}
                              onChange={(e) =>
                                setEditingPkg((prev) => ({
                                  ...prev,
                                  [pkg.id]: { ...prev[pkg.id], caption_long: e.target.value },
                                }))
                              }
                            />
                          </div>

                          {/* Hashtags */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Hashtags
                            </label>
                            <p className="text-sm text-gray-300">
                              {(pkg.hashtags || []).join(", ") || "---"}
                            </p>
                          </div>

                          {/* Mentions */}
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">
                              Mentions
                            </label>
                            <p className="text-sm text-gray-300">
                              {(pkg.mentions || []).join(", ") || "---"}
                            </p>
                          </div>

                          {/* FTC Note */}
                          {pkg.ftc_note && (
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                FTC Note
                              </label>
                              <p className="text-sm text-yellow-300">
                                {pkg.ftc_note}
                              </p>
                            </div>
                          )}

                          {/* AM Notes */}
                          {pkg.am_notes && (
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                AM Notes
                              </label>
                              <p className="text-sm text-gray-300">
                                {pkg.am_notes}
                              </p>
                            </div>
                          )}

                          {/* Platform Notes */}
                          {pkg.platform_notes && (
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Platform Notes
                              </label>
                              <p className="text-sm text-gray-300">
                                {pkg.platform_notes}
                              </p>
                            </div>
                          )}

                          {/* Posting Window */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Posting Window Start
                              </label>
                              <p className="text-sm text-gray-300">
                                {formatDate(pkg.posting_window_start)}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Posting Window End
                              </label>
                              <p className="text-sm text-gray-300">
                                {formatDate(pkg.posting_window_end)}
                              </p>
                            </div>
                          </div>

                          {/* Video URL */}
                          {pkg.video_url && (
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Video URL
                              </label>
                              <a
                                href={pkg.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-blue-400 hover:underline break-all"
                              >
                                {pkg.video_url}
                              </a>
                            </div>
                          )}

                          {/* Live URL */}
                          {pkg.live_url && (
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Live URL
                              </label>
                              <a
                                href={pkg.live_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-emerald-400 hover:underline break-all"
                              >
                                {pkg.live_url}
                              </a>
                            </div>
                          )}

                          {/* Edit fields for live_url and intended_post_date */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Live URL (edit)
                              </label>
                              <input
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                                placeholder="https://..."
                                defaultValue={pkg.live_url || ""}
                                onChange={(e) =>
                                  setEditingPkg((prev) => ({
                                    ...prev,
                                    [pkg.id]: { ...prev[pkg.id], live_url: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">
                                Intended Post Date
                              </label>
                              <input
                                type="date"
                                className="bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                                defaultValue={
                                  pkg.intended_post_date
                                    ? pkg.intended_post_date.slice(0, 10)
                                    : ""
                                }
                                onChange={(e) =>
                                  setEditingPkg((prev) => ({
                                    ...prev,
                                    [pkg.id]: {
                                      ...prev[pkg.id],
                                      intended_post_date: e.target.value || null,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {/* Save edits */}
                            {Object.keys(edit).length > 0 && (
                              <button
                                onClick={() => {
                                  updatePackage(pkg.id, edit);
                                  setEditingPkg((prev) => {
                                    const next = { ...prev };
                                    delete next[pkg.id];
                                    return next;
                                  });
                                }}
                                disabled={saving}
                                className="px-3 py-1.5 bg-[#D73F09] hover:bg-[#c13607] text-white text-xs font-medium rounded transition"
                              >
                                {saving ? "Saving..." : "Save Changes"}
                              </button>
                            )}

                            {pkg.status !== "sent" && (
                              <button
                                onClick={() =>
                                  updatePackage(pkg.id, { status: "sent" })
                                }
                                className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-medium rounded transition"
                              >
                                Mark Sent
                              </button>
                            )}
                            {pkg.status !== "confirmed" && (
                              <button
                                onClick={() =>
                                  updatePackage(pkg.id, { status: "confirmed" })
                                }
                                className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium rounded transition"
                              >
                                Mark Confirmed
                              </button>
                            )}
                            {pkg.status !== "posted" && (
                              <button
                                onClick={() =>
                                  updatePackage(pkg.id, { status: "posted" })
                                }
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded transition"
                              >
                                Mark Posted
                              </button>
                            )}
                            {pkg.status !== "draft" && (
                              <button
                                onClick={() =>
                                  updatePackage(pkg.id, { status: "draft" })
                                }
                                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium rounded transition"
                              >
                                Back to Draft
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Distributor Agent Modal */}
            {showDistributor && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold">
                        Run Distributor Agent
                      </h2>
                      <button
                        onClick={() => {
                          setShowDistributor(false);
                          setDistResult(null);
                        }}
                        className="text-gray-400 hover:text-white text-xl"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Athlete Name *
                        </label>
                        <input
                          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                          value={distForm.athlete_name}
                          onChange={(e) =>
                            setDistForm((f) => ({
                              ...f,
                              athlete_name: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Asset Type *
                        </label>
                        <input
                          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                          placeholder="e.g. produced_video, ugc, photo"
                          value={distForm.asset_type}
                          onChange={(e) =>
                            setDistForm((f) => ({
                              ...f,
                              asset_type: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Content Description *
                        </label>
                        <textarea
                          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                          rows={3}
                          value={distForm.content_description}
                          onChange={(e) =>
                            setDistForm((f) => ({
                              ...f,
                              content_description: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Campaign ID (optional)
                        </label>
                        <input
                          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                          value={distForm.campaign_id}
                          onChange={(e) =>
                            setDistForm((f) => ({
                              ...f,
                              campaign_id: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <button
                        onClick={runDistributor}
                        disabled={
                          distLoading ||
                          !distForm.athlete_name ||
                          !distForm.asset_type ||
                          !distForm.content_description
                        }
                        className="w-full px-4 py-2 bg-[#D73F09] hover:bg-[#c13607] disabled:opacity-50 text-white text-sm font-medium rounded transition"
                      >
                        {distLoading
                          ? "Running Agent..."
                          : "Run Distributor"}
                      </button>

                      {distResult && (
                        <div className="bg-gray-900 border border-gray-600 rounded p-3 max-h-64 overflow-y-auto">
                          <label className="text-xs text-gray-400 block mb-1">
                            Agent Results
                          </label>
                          <pre className="text-xs text-green-300 whitespace-pre-wrap">
                            {distResult}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Queue Modal Component
// ---------------------------------------------------------------------------

function AddQueueModal({
  onClose,
  onSubmit,
  saving,
}: {
  onClose: () => void;
  onSubmit: (form: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    channel: "instagram",
    caption: "",
    hashtags: "",
    asset_url: "",
    athlete_name: "",
    scheduled_for: "",
    notes: "",
  });

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      channel: form.channel,
      caption: form.caption || null,
      athlete_name: form.athlete_name || null,
      notes: form.notes || null,
      asset_url: form.asset_url || null,
      hashtags: form.hashtags
        ? form.hashtags.split(",").map((t) => t.trim()).filter(Boolean)
        : null,
      scheduled_for: form.scheduled_for
        ? new Date(form.scheduled_for).toISOString()
        : null,
    };
    onSubmit(payload);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Add to Content Queue</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              &times;
            </button>
          </div>

          <div className="space-y-4">
            {/* Channel */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Channel *
              </label>
              <select
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                value={form.channel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, channel: e.target.value }))
                }
              >
                {CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Caption */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Caption
              </label>
              <textarea
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                rows={3}
                value={form.caption}
                onChange={(e) =>
                  setForm((f) => ({ ...f, caption: e.target.value }))
                }
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Hashtags (comma-separated)
              </label>
              <input
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                placeholder="#brand, #campaign, #athlete"
                value={form.hashtags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hashtags: e.target.value }))
                }
              />
            </div>

            {/* Asset URL */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Asset URL
              </label>
              <input
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                placeholder="https://..."
                value={form.asset_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, asset_url: e.target.value }))
                }
              />
            </div>

            {/* Athlete Name */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Athlete Name
              </label>
              <input
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                value={form.athlete_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, athlete_name: e.target.value }))
                }
              />
            </div>

            {/* Scheduled For */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Scheduled For
              </label>
              <input
                type="datetime-local"
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white"
                value={form.scheduled_for}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scheduled_for: e.target.value }))
                }
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Notes</label>
              <textarea
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white resize-y"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || !form.channel}
              className="w-full px-4 py-2 bg-[#D73F09] hover:bg-[#c13607] disabled:opacity-50 text-white text-sm font-medium rounded transition"
            >
              {saving ? "Adding..." : "Add to Queue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
