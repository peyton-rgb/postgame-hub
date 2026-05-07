"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { PostgameLogo } from "@/components/PostgameLogo";
import { createBrowserSupabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FinalAsset {
  id: string;
  campaign_id: string | null;
  title: string;
  asset_type: "video" | "photo" | "graphic";
  file_url: string;
  thumbnail_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  athlete_name: string | null;
  brand_name: string | null;
  tags: string[] | null;
  notes: string | null;
  status: "pending" | "delivered" | "posted";
  delivered_at: string | null;
  delivered_to: string | null;
  created_at: string;
  created_by: string | null;
}

type StatusFilter = "all" | "pending" | "delivered" | "posted";
type TypeFilter = "all" | "video" | "photo" | "graphic";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function typeIcon(t: string) {
  if (t === "video") return "🎬";
  if (t === "photo") return "📸";
  return "🎨";
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-600 text-gray-200",
  delivered: "bg-blue-600 text-blue-100",
  posted: "bg-green-600 text-green-100",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AssetsPage() {
  const [assets, setAssets] = useState<FinalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  /* expanded card */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [showDeliverInput, setShowDeliverInput] = useState(false);

  /* add modal */
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "",
    asset_type: "video" as "video" | "photo" | "graphic",
    file_url: "",
    thumbnail_url: "",
    athlete_name: "",
    brand_name: "",
    campaign_id: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch                                                            */
  /* ---------------------------------------------------------------- */

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const supabase = createBrowserSupabase();
    let query = supabase
      .from("final_assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (typeFilter !== "all") query = query.eq("asset_type", typeFilter);

    const { data } = await query;
    setAssets((data as FinalAsset[]) ?? []);
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  async function handleAddAsset() {
    if (!addForm.title || !addForm.file_url) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      title: addForm.title,
      asset_type: addForm.asset_type,
      file_url: addForm.file_url,
    };
    if (addForm.thumbnail_url) body.thumbnail_url = addForm.thumbnail_url;
    if (addForm.athlete_name) body.athlete_name = addForm.athlete_name;
    if (addForm.brand_name) body.brand_name = addForm.brand_name;
    if (addForm.campaign_id) body.campaign_id = addForm.campaign_id;
    if (addForm.notes) body.notes = addForm.notes;

    await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setShowAdd(false);
    setAddForm({
      title: "",
      asset_type: "video",
      file_url: "",
      thumbnail_url: "",
      athlete_name: "",
      brand_name: "",
      campaign_id: "",
      notes: "",
    });
    fetchAssets();
  }

  async function handleSaveEdit(asset: FinalAsset) {
    const updates: Record<string, unknown> = {};
    if (editTitle !== asset.title) updates.title = editTitle;
    if (editNotes !== (asset.notes ?? "")) updates.notes = editNotes;
    const newTags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (JSON.stringify(newTags) !== JSON.stringify(asset.tags ?? []))
      updates.tags = newTags;

    if (Object.keys(updates).length === 0) return;

    await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    fetchAssets();
  }

  async function handleDeliver(id: string) {
    if (!deliverTo.trim()) return;
    await fetch(`/api/assets/${id}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivered_to: deliverTo.trim() }),
    });
    setShowDeliverInput(false);
    setDeliverTo("");
    fetchAssets();
  }

  async function handleMarkPosted(id: string) {
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "posted" }),
    });
    fetchAssets();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this asset permanently?")) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    setExpandedId(null);
    fetchAssets();
  }

  function openExpanded(asset: FinalAsset) {
    setExpandedId(asset.id);
    setEditTitle(asset.title);
    setEditNotes(asset.notes ?? "");
    setEditTags((asset.tags ?? []).join(", "));
    setShowDeliverInput(false);
    setDeliverTo("");
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const statusTabs: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Delivered", value: "delivered" },
    { label: "Posted", value: "posted" },
  ];

  const typeBtns: { label: string; value: TypeFilter }[] = [
    { label: "All", value: "all" },
    { label: "Video", value: "video" },
    { label: "Photo", value: "photo" },
    { label: "Graphic", value: "graphic" },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ---- Header ---- */}
      <div className="border-b border-gray-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <PostgameLogo size="md" />
            </Link>
            <span className="text-gray-700">/</span>
            <Link
              href="/dashboard"
              className="text-sm font-bold text-gray-500 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-gray-700">/</span>
            <h1 className="text-sm font-black text-white">Asset Library</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors"
              style={{ backgroundColor: "#D73F09" }}
            >
              + Add Asset
            </button>
            <button
              onClick={async () => {
                await createBrowserSupabase().auth.signOut();
                window.location.href = "/login";
              }}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="px-8 pt-6 pb-2 flex flex-wrap items-center gap-6">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {statusTabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                statusFilter === t.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Type buttons */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {typeBtns.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                typeFilter === t.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Grid ---- */}
      <div className="p-8">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading assets...</p>
        ) : assets.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No assets found. Click &quot;Add Asset&quot; to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {assets.map((asset) => {
              const isExpanded = expandedId === asset.id;

              return (
                <div
                  key={asset.id}
                  className={`bg-gray-800 rounded-xl border transition-colors ${
                    isExpanded
                      ? "border-[#D73F09] col-span-1 sm:col-span-2"
                      : "border-gray-700 hover:border-gray-600 cursor-pointer"
                  }`}
                >
                  {/* Card top — always visible */}
                  <div
                    onClick={() =>
                      isExpanded
                        ? setExpandedId(null)
                        : openExpanded(asset)
                    }
                    className="p-4"
                  >
                    {/* Thumbnail / icon */}
                    <div className="w-full h-36 rounded-lg bg-gray-700 flex items-center justify-center mb-3 overflow-hidden">
                      {asset.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">
                          {typeIcon(asset.asset_type)}
                        </span>
                      )}
                    </div>

                    {/* Title + type badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-sm leading-tight line-clamp-2">
                        {asset.title}
                      </h3>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                        {asset.asset_type}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="space-y-1 text-xs text-gray-400">
                      {asset.athlete_name && (
                        <p>
                          <span className="text-gray-500">Athlete:</span>{" "}
                          {asset.athlete_name}
                        </p>
                      )}
                      {asset.brand_name && (
                        <p>
                          <span className="text-gray-500">Brand:</span>{" "}
                          {asset.brand_name}
                        </p>
                      )}
                      <div className="flex items-center gap-3 pt-1">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            statusColors[asset.status] ?? "bg-gray-600"
                          }`}
                        >
                          {asset.status}
                        </span>
                        {asset.file_size_bytes && (
                          <span>{formatFileSize(asset.file_size_bytes)}</span>
                        )}
                        {asset.asset_type === "video" &&
                          asset.duration_seconds && (
                            <span>
                              {formatDuration(asset.duration_seconds)}
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Tags */}
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {asset.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Date */}
                    <p className="text-[10px] text-gray-600 mt-2">
                      {new Date(asset.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-700 p-4 space-y-4">
                      {/* File URL */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          File URL
                        </label>
                        <a
                          href={asset.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:underline break-all"
                        >
                          {asset.file_url}
                        </a>
                      </div>

                      {/* Notes (read) */}
                      {asset.notes && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Notes
                          </label>
                          <p className="text-sm text-gray-300">{asset.notes}</p>
                        </div>
                      )}

                      {/* Edit form */}
                      <div className="space-y-3 bg-gray-900 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Edit
                        </h4>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Title
                          </label>
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            rows={2}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Tags (comma-separated)
                          </label>
                          <input
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                          />
                        </div>

                        <button
                          onClick={() => handleSaveEdit(asset)}
                          className="px-4 py-2 text-sm font-bold rounded-lg text-white transition-colors"
                          style={{ backgroundColor: "#D73F09" }}
                        >
                          Save Changes
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        {/* Mark as delivered */}
                        {asset.status === "pending" && (
                          <>
                            {showDeliverInput ? (
                              <div className="flex gap-2 items-center">
                                <input
                                  placeholder="Delivered to..."
                                  value={deliverTo}
                                  onChange={(e) =>
                                    setDeliverTo(e.target.value)
                                  }
                                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                                <button
                                  onClick={() => handleDeliver(asset.id)}
                                  className="px-3 py-1.5 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setShowDeliverInput(false)}
                                  className="px-3 py-1.5 text-sm font-bold rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowDeliverInput(true)}
                                className="px-3 py-1.5 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                              >
                                Mark as Delivered
                              </button>
                            )}
                          </>
                        )}

                        {/* Mark as posted */}
                        {asset.status === "delivered" && (
                          <button
                            onClick={() => handleMarkPosted(asset.id)}
                            className="px-3 py-1.5 text-sm font-bold rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors"
                          >
                            Mark as Posted
                          </button>
                        )}

                        {/* Delivered info */}
                        {asset.delivered_to && (
                          <span className="text-xs text-gray-500 self-center">
                            Delivered to: {asset.delivered_to}
                            {asset.delivered_at &&
                              ` on ${new Date(
                                asset.delivered_at
                              ).toLocaleDateString()}`}
                          </span>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="ml-auto px-3 py-1.5 text-sm font-bold rounded-lg bg-red-900/50 text-red-400 hover:bg-red-900 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Add Asset Modal ---- */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Add Asset</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-500 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Title *
                </label>
                <input
                  value={addForm.title}
                  onChange={(e) =>
                    setAddForm({ ...addForm, title: e.target.value })
                  }
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              {/* Asset type */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Asset Type *
                </label>
                <select
                  value={addForm.asset_type}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      asset_type: e.target.value as "video" | "photo" | "graphic",
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                >
                  <option value="video">Video</option>
                  <option value="photo">Photo</option>
                  <option value="graphic">Graphic</option>
                </select>
              </div>

              {/* File URL */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  File URL *
                </label>
                <input
                  value={addForm.file_url}
                  onChange={(e) =>
                    setAddForm({ ...addForm, file_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              {/* Thumbnail URL */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Thumbnail URL
                </label>
                <input
                  value={addForm.thumbnail_url}
                  onChange={(e) =>
                    setAddForm({ ...addForm, thumbnail_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              {/* Athlete + Brand side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Athlete Name
                  </label>
                  <input
                    value={addForm.athlete_name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, athlete_name: e.target.value })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Brand Name
                  </label>
                  <input
                    value={addForm.brand_name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, brand_name: e.target.value })
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                  />
                </div>
              </div>

              {/* Campaign ID */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Campaign ID
                </label>
                <input
                  value={addForm.campaign_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, campaign_id: e.target.value })
                  }
                  placeholder="UUID (optional)"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Notes
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) =>
                    setAddForm({ ...addForm, notes: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D73F09]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAsset}
                disabled={saving || !addForm.title || !addForm.file_url}
                className="px-5 py-2 text-sm font-bold text-white rounded-lg transition-colors disabled:opacity-40"
                style={{ backgroundColor: "#D73F09" }}
              >
                {saving ? "Saving..." : "Create Asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
