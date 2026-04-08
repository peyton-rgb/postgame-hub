"use client";

import { useEffect, useState, useRef } from "react";
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

interface UploadedFile {
  file: File;
  preview: string;
  error?: string;
}

type CreateTab = "blank" | "ai";

const PROGRESS_STEPS = [
  "Uploading assets...",
  "Analyzing brand history...",
  "Processing video frames...",
  "Generating with Claude...",
  "Almost there...",
];

const MAX_FILES = 10;
const MAX_VIDEO_DURATION_SEC = 30;
const MAX_VIDEO_SIZE_MB = 50;

export default function PitchList() {
  const [pitches, setPitches] = useState<PitchPage[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PitchPage | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Shared form state
  const [createTab, setCreateTab] = useState<CreateTab>("blank");
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");

  // AI tab state
  const [aiPrompt, setAiPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setCreateTab("blank");
    setNewTitle("");
    setNewSlug("");
    setSelectedBrandId("");
    setAiPrompt("");
    setUploadedFiles([]);
    setGenError(null);
    setGenerating(false);
    setProgressStep(0);
    setShowCreate(true);
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleTitleChange(title: string) {
    setNewTitle(title);
    setNewSlug(slugify(title));
  }

  function handleBrandChange(brandId: string) {
    setSelectedBrandId(brandId);
    // Auto-fill title/slug from brand name if on AI tab and fields are empty
    if (createTab === "ai" && brandId) {
      const brand = brands.find((b) => b.id === brandId);
      if (brand) {
        if (!newTitle) setNewTitle(`Postgame \u00d7 ${brand.name}`);
        if (!newSlug) setNewSlug(slugify(brand.name));
      }
    }
  }

  // ---- File validation ----

  function validateVideoFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        resolve(`${file.name}: exceeds ${MAX_VIDEO_SIZE_MB}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        return;
      }
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_VIDEO_DURATION_SEC) {
          resolve(`${file.name}: exceeds ${MAX_VIDEO_DURATION_SEC}s limit (${Math.round(video.duration)}s)`);
        } else {
          resolve(null);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null); // Can't validate duration, allow it
      };
      video.src = URL.createObjectURL(file);
    });
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files) return;

    const fileArray = Array.from(files);
    const totalAfter = uploadedFiles.length + fileArray.length;
    if (totalAfter > MAX_FILES) {
      setGenError(`Max ${MAX_FILES} files. You have ${uploadedFiles.length}, tried to add ${fileArray.length}.`);
      return;
    }

    const newFiles: UploadedFile[] = [];
    for (const file of fileArray) {
      const isVideo = file.type.startsWith("video/");
      let error: string | undefined;

      if (isVideo) {
        const validationError = await validateVideoFile(file);
        if (validationError) error = validationError;
      }

      newFiles.push({
        file,
        preview: isVideo ? "" : URL.createObjectURL(file),
        error,
      });
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setGenError(null);
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }

  // ---- Blank create ----

  async function createBlankPitch() {
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

  // ---- AI generate ----

  async function generatePitch() {
    if (!selectedBrandId) return;

    // Check for file errors
    const hasErrors = uploadedFiles.some((f) => f.error);
    if (hasErrors) {
      setGenError("Fix file errors before generating.");
      return;
    }

    setGenerating(true);
    setGenError(null);
    setProgressStep(0);

    try {
      // Step 0: Upload assets
      const tempId = crypto.randomUUID();
      const uploadedAssets: { path: string; mimeType: string; originalName: string }[] = [];

      if (uploadedFiles.length > 0) {
        for (const uf of uploadedFiles) {
          const path = `pitch-uploads/${tempId}/${uf.file.name}`;
          const { error } = await supabase.storage
            .from("campaign-media")
            .upload(path, uf.file);
          if (error) throw new Error(`Upload failed for ${uf.file.name}: ${error.message}`);
          uploadedAssets.push({
            path,
            mimeType: uf.file.type,
            originalName: uf.file.name,
          });
        }
      }

      // Step 1: Analyzing brand
      setProgressStep(1);

      // Derive title/slug if not set
      const brand = brands.find((b) => b.id === selectedBrandId);
      const finalTitle = newTitle || `Postgame \u00d7 ${brand?.name || "Brand"}`;
      const finalSlug = newSlug || slugify(brand?.name || "pitch");

      // Step 2: Processing video
      setProgressStep(2);

      // Step 3: Generating
      setProgressStep(3);

      const res = await fetch("/api/pitches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: selectedBrandId,
          title: finalTitle,
          slug: finalSlug,
          userPrompt: aiPrompt,
          uploadedAssets,
        }),
      });

      setProgressStep(4);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const { pitchId } = await res.json();
      window.location.href = `/dashboard/pitches/${pitchId}`;
    } catch (err: any) {
      setGenError(err.message || "Something went wrong. Try again.");
      setGenerating(false);
    }
  }

  // ---- Delete ----

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

  const tabClass = (tab: CreateTab) =>
    `flex-1 text-center py-2.5 text-sm font-bold rounded-lg transition-colors ${
      createTab === tab
        ? "bg-white/10 text-white"
        : "text-gray-500 hover:text-gray-300"
    }`;

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
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
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Title</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Brand</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Slug</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch) => {
                const brand = getBrandForPitch(pitch);
                return (
                  <tr key={pitch.id} className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/pitches/${pitch.id}`} className="font-bold text-white hover:text-[#D73F09] transition-colors">
                        {pitch.title || "Untitled"}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {brand ? (
                        <div className="flex items-center gap-2">
                          {(brand.logo_primary_url || brand.logo_light_url) && (
                            <img src={brand.logo_light_url || brand.logo_primary_url || ""} alt="" className="w-5 h-5 object-contain rounded" />
                          )}
                          <span className="text-gray-300">{brand.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">/pitch/{pitch.slug}</code>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${pitch.status === "published" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                        {pitch.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {new Date(pitch.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Link href={`/pitch/${pitch.slug}`} target="_blank" className="text-xs px-3 py-1.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
                          View
                        </Link>
                        <button onClick={() => setConfirmDelete(pitch)} className="text-xs px-3 py-1.5 border border-gray-700 rounded-lg text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-colors">
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
          onClick={() => !generating && setShowCreate(false)}
        >
          <div
            className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress overlay */}
            {generating && (
              <div className="absolute inset-0 bg-[#111]/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
                <div className="w-10 h-10 border-2 border-[#D73F09] border-t-transparent rounded-full animate-spin mb-6" />
                <div className="text-sm font-bold text-white mb-2">{PROGRESS_STEPS[progressStep]}</div>
                <div className="flex gap-1.5 mt-3">
                  {PROGRESS_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i <= progressStep ? "bg-[#D73F09]" : "bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="p-8">
              <h3 className="text-lg font-black text-white mb-5">New Pitch Page</h3>

              {/* Tab switcher */}
              <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-6">
                <button onClick={() => setCreateTab("blank")} className={tabClass("blank")}>
                  Blank
                </button>
                <button onClick={() => setCreateTab("ai")} className={tabClass("ai")}>
                  Generate with AI
                </button>
              </div>

              {/* Shared: Brand */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Brand {createTab === "ai" && <span className="text-[#D73F09]">*</span>}
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white text-sm focus:border-[#D73F09] outline-none"
                  >
                    <option value="">{createTab === "ai" ? "Select brand (required)" : "Select brand (optional)"}</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Shared: Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Title {createTab === "blank" && <span className="text-[#D73F09]">*</span>}
                    {createTab === "ai" && <span className="text-gray-600 normal-case font-normal"> (auto from brand if blank)</span>}
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder={createTab === "ai" ? "Auto-generated from brand" : "e.g. Postgame x Crocs"}
                    className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white text-sm focus:border-[#D73F09] outline-none placeholder-gray-600"
                  />
                </div>

                {/* Shared: Slug */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Slug {createTab === "blank" && <span className="text-[#D73F09]">*</span>}
                    {createTab === "ai" && <span className="text-gray-600 normal-case font-normal"> (auto from brand if blank)</span>}
                  </label>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 bg-black border border-gray-700 border-r-0 rounded-l-xl px-3 py-3">/pitch/</span>
                    <input
                      type="text"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder={createTab === "ai" ? "auto" : "crocs"}
                      className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-r-xl text-white text-sm focus:border-[#D73F09] outline-none placeholder-gray-600"
                    />
                  </div>
                </div>

                {/* AI-only fields */}
                {createTab === "ai" && (
                  <>
                    {/* Prompt */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Prompt
                      </label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={6}
                        placeholder="What's the angle? Who's the audience? What should this pitch lean into?"
                        className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white text-sm focus:border-[#D73F09] outline-none placeholder-gray-600 resize-none"
                      />
                    </div>

                    {/* File upload */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Assets <span className="text-gray-600 normal-case font-normal">(photos &amp; videos, max {MAX_FILES})</span>
                      </label>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />

                      {/* Drop zone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#D73F09]"); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#D73F09]"); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove("border-[#D73F09]");
                          handleFileSelect(e.dataTransfer.files);
                        }}
                        className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition-colors"
                      >
                        <div className="text-gray-500 text-sm">
                          Drop files here or <span className="text-[#D73F09] font-bold">browse</span>
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          Videos: max {MAX_VIDEO_DURATION_SEC}s, {MAX_VIDEO_SIZE_MB}MB each
                        </div>
                      </div>

                      {/* File list */}
                      {uploadedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {uploadedFiles.map((uf, i) => (
                            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${uf.error ? "bg-red-500/10 border border-red-500/20" : "bg-white/5"}`}>
                              {uf.preview ? (
                                <img src={uf.preview} alt="" className="w-8 h-8 rounded object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs text-gray-400">
                                  {uf.file.type.startsWith("video/") ? "VID" : "IMG"}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-300 truncate">{uf.file.name}</div>
                                {uf.error && (
                                  <div className="text-xs text-red-400 mt-0.5">{uf.error}</div>
                                )}
                                <div className="text-xs text-gray-600">{(uf.file.size / 1024 / 1024).toFixed(1)}MB</div>
                              </div>
                              <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 text-sm flex-shrink-0">&times;</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Error display */}
                {genError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                    {genError}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowCreate(false)}
                  disabled={generating}
                  className="flex-1 px-4 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-bold hover:text-white hover:border-gray-500 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>

                {createTab === "blank" ? (
                  <button
                    onClick={createBlankPitch}
                    disabled={!newTitle.trim() || !newSlug.trim() || creating}
                    className="flex-1 px-4 py-3 bg-[#D73F09] rounded-xl text-white text-sm font-bold hover:bg-[#B33407] disabled:opacity-40 transition-colors"
                  >
                    {creating ? "Creating..." : "Create Pitch"}
                  </button>
                ) : (
                  <button
                    onClick={generatePitch}
                    disabled={!selectedBrandId || generating || uploadedFiles.some((f) => f.error)}
                    className="flex-1 px-4 py-3 bg-[#D73F09] rounded-xl text-white text-sm font-bold hover:bg-[#B33407] disabled:opacity-40 transition-colors"
                  >
                    {generating ? "Generating..." : "Generate Pitch"}
                  </button>
                )}
              </div>
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
              &ldquo;{confirmDelete.title || "Untitled"}&rdquo; will be permanently deleted.
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
