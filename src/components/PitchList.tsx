"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { getDefaultPitchSections } from "@/lib/pitch/defaultTemplate";
import type { PitchPage } from "@/types/pitch";
import Link from "next/link";

interface Brand {
  id: string;
  name: string;
  logo_primary_url: string | null;
  logo_light_url: string | null;
}

export default function PitchList() {
  const [pitches, setPitches] = useState<PitchPage[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PitchPage | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");

  const supabase = createBrowserSupabase();

  useEffect(() => {
    loadPitches();
    loadBrands();
  }, []);

  async function loadPitches() {
    const { data } = await supabase
      .from("pitch_pages")
      .select("*")
      .order("updated_at", { ascending: false });
    setPitches((data as PitchPage[]) || []);
    setLoading(false);
  }

  async function loadBrands() {
    const { data } = await supabase
      .from("brands")
      .select("id, name, logo_primary_url, logo_light_url")
      .order("name", { ascending: true });
    setBrands(data || []);
  }

  function openCreate() {
    setNewTitle("");
    setNewSlug("");
    setSelectedBrandId("");
    setShowCreate(true);
  }

  function handleTitleChange(title: string) {
    setNewTitle(title);
    // Auto-generate slug from title
    setNewSlug(
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  async function createPitch() {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from("pitch_pages")
      .insert({
        title: newTitle,
        slug: newSlug,
        brand_id: selectedBrandId || null,
        status: "draft",
        content: { sections: getDefaultPitchSections() },
      })
      .select()
      .single();

    if (data && !error) {
      window.location.href = `/dashboard/pitches/${data.id}`;
    }
    setCreating(false);
  }

  async function deletePitch(pitch: PitchPage) {
    setDeleting(pitch.id);
    const { error } = await supabase
      .from("pitch_pages")
      .delete()
      .eq("id", pitch.id);
    if (!error) {
      setPitches((prev) => prev.filter((p) => p.id !== pitch.id));
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  function getBrandForPitch(pitch: PitchPage): Brand | undefined {
    return brands.find((b) => b.id === pitch.brand_id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Loading pitch pages...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-white">Pitch Pages</h2>
          <p className="text-sm text-gray-500 mt-1">
            {pitches.length} pitch{pitches.length !== 1 ? "es" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#D73F09] text-white text-sm font-bold rounded-lg hover:bg-[#B33407] transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Pitch
        </button>
      </div>

      {/* Table */}
      {pitches.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-4">&#9670;</div>
          <div className="text-sm">No pitch pages yet. Create your first one.</div>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-white/[0.02]">
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Title
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Brand
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Slug
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Updated
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch) => {
                const brand = getBrandForPitch(pitch);
                return (
                  <tr
                    key={pitch.id}
                    className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/pitches/${pitch.id}`}
                        className="font-bold text-white hover:text-[#D73F09] transition-colors"
                      >
                        {pitch.title || "Untitled"}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {brand ? (
                        <div className="flex items-center gap-2">
                          {(brand.logo_primary_url || brand.logo_light_url) && (
                            <img
                              src={brand.logo_light_url || brand.logo_primary_url || ""}
                              alt=""
                              className="w-5 h-5 object-contain rounded"
                            />
                          )}
                          <span className="text-gray-300">{brand.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                        /pitch/{pitch.slug}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                          pitch.status === "published"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {pitch.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {new Date(pitch.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/pitch/${pitch.slug}`}
                          target="_blank"
                          className="text-xs px-3 py-1.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => setConfirmDelete(pitch)}
                          className="text-xs px-3 py-1.5 border border-gray-700 rounded-lg text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-[#111] border border-gray-800 rounded-2xl p-8 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white mb-6">New Pitch Page</h3>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Postgame x Crocs"
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white text-sm focus:border-[#D73F09] outline-none placeholder-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Slug
                </label>
                <div className="flex items-center gap-0">
                  <span className="text-xs text-gray-500 bg-black border border-gray-700 border-r-0 rounded-l-xl px-3 py-3">
                    /pitch/
                  </span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="crocs"
                    className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-r-xl text-white text-sm focus:border-[#D73F09] outline-none placeholder-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Brand
                </label>
                <select
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white text-sm focus:border-[#D73F09] outline-none"
                >
                  <option value="">Select brand (optional)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-bold hover:text-white hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPitch}
                disabled={!newTitle.trim() || !newSlug.trim() || creating}
                className="flex-1 px-4 py-3 bg-[#D73F09] rounded-xl text-white text-sm font-bold hover:bg-[#B33407] disabled:opacity-40 transition-colors"
              >
                {creating ? "Creating..." : "Create Pitch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-[#111] border border-gray-800 rounded-2xl p-8 w-full max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white mb-3">Delete Pitch?</h3>
            <p className="text-sm text-gray-400 mb-6">
              &ldquo;{confirmDelete.title || "Untitled"}&rdquo; will be permanently
              deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-bold hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePitch(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 px-4 py-3 bg-red-600 rounded-xl text-white text-sm font-bold hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
