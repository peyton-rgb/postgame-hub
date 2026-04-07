// src/components/DriveImportModal.tsx
// ─────────────────────────────────────────────────────────────
// Modal for importing media from any Google Drive folder into
// a campaign's Supabase storage. Matches Drive folders to
// athletes, supports manual mapping for unmatched folders,
// and confirms new athlete creation before importing.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState, useMemo, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailLink: string | null;
  folderName: string | null;
}

interface FileGroup {
  folderName: string;
  files: DriveFile[];
}

interface CampaignAthlete {
  id: string;
  name: string;
}

/** What the user chose for each folder */
type FolderMapping =
  | { type: "matched"; athleteId: string }
  | { type: "assigned"; athleteId: string }
  | { type: "create"; displayName: string }
  | { type: "skip" };

interface DriveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onImportComplete: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

function humanSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
}

function toTitleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ── Component ────────────────────────────────────────────────

type ModalStep = "browse" | "mapping" | "confirm";

export default function DriveImportModal({
  isOpen,
  onClose,
  campaignId,
  onImportComplete,
}: DriveImportModalProps) {
  const supabase = createBrowserSupabase();

  // Browse state
  const [folderInput, setFolderInput] = useState("");
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Matching/mapping state
  const [modalStep, setModalStep] = useState<ModalStep>("browse");
  const [campaignAthletes, setCampaignAthletes] = useState<CampaignAthlete[]>([]);
  const [folderMappings, setFolderMappings] = useState<Record<string, FolderMapping>>({});
  const [unmatchedFolders, setUnmatchedFolders] = useState<string[]>([]);
  const [matchedFolders, setMatchedFolders] = useState<Record<string, string>>({}); // folderName → athleteId

  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Reset / Close ──

  const reset = () => {
    setFolderInput("");
    setFolderName("");
    setFiles([]);
    setSelected(new Set());
    setFetchError(null);
    setModalStep("browse");
    setCampaignAthletes([]);
    setFolderMappings({});
    setUnmatchedFolders([]);
    setMatchedFolders({});
    setImporting(false);
    setImportProgress({ done: 0, total: 0, errors: 0 });
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleCancel = () => {
    if (importing) {
      abortControllerRef.current?.abort();
    } else if (modalStep !== "browse") {
      setModalStep("browse");
    } else {
      handleClose();
    }
  };

  // ── Fetch folder contents ──

  const handleFetch = async () => {
    const input = folderInput.trim();
    if (!input) return;

    setFetching(true);
    setFetchError(null);
    setFiles([]);
    setSelected(new Set());

    try {
      const res = await fetch(
        `/api/drive/list?folderId=${encodeURIComponent(input)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setFolderName(data.folderName);
      setFiles(data.files);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  };

  // ── Selection helpers ──

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllImages = () => {
    const ids = files.filter((f) => f.mimeType.startsWith("image/")).map((f) => f.id);
    setSelected((prev) => new Set([...prev, ...ids]));
  };

  const selectAllVideos = () => {
    const ids = files.filter((f) => f.mimeType.startsWith("video/")).map((f) => f.id);
    setSelected((prev) => new Set([...prev, ...ids]));
  };

  const selectAll = () => setSelected(new Set(files.map((f) => f.id)));
  const clearSelection = () => setSelected(new Set());

  const selectGroup = (groupFiles: DriveFile[]) => {
    const ids = groupFiles.map((f) => f.id);
    setSelected((prev) => new Set([...prev, ...ids]));
  };

  // ── Group files by folder ──

  const groups: FileGroup[] = useMemo(() => {
    const map = new Map<string, DriveFile[]>();
    for (const f of files) {
      const key = f.folderName ?? "Root";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).map(([folderName, grpFiles]) => ({
      folderName,
      files: grpFiles,
    }));
  }, [files]);

  // ── Matching logic — triggered when user clicks Import ──

  const startMatching = async () => {
    // 1. Fetch campaign athletes
    const res = await fetch(`/api/athletes/list?campaignId=${encodeURIComponent(campaignId)}`);
    if (!res.ok) {
      setFetchError("Failed to load campaign athletes");
      return;
    }
    const { athletes } = await res.json();
    setCampaignAthletes(athletes);

    // 2. Find which folders have selected files
    const selectedFiles = files.filter((f) => selected.has(f.id));
    const foldersWithSelected = new Set(selectedFiles.map((f) => f.folderName ?? "Root"));

    // 3. Match each folder to an athlete
    const matched: Record<string, string> = {};
    const unmatched: string[] = [];

    for (const folder of foldersWithSelected) {
      const normFolder = normalize(folder);
      const match = athletes.find((a: CampaignAthlete) => normalize(a.name) === normFolder);
      if (match) {
        matched[folder] = match.id;
      } else {
        unmatched.push(folder);
      }
    }

    setMatchedFolders(matched);
    setUnmatchedFolders(unmatched);

    if (unmatched.length === 0) {
      // All matched — go straight to import
      const mappings: Record<string, FolderMapping> = {};
      for (const [folder, athleteId] of Object.entries(matched)) {
        mappings[folder] = { type: "matched", athleteId };
      }
      setFolderMappings(mappings);
      runImport(mappings);
    } else {
      // Some unmatched — show mapping UI
      const mappings: Record<string, FolderMapping> = {};
      for (const [folder, athleteId] of Object.entries(matched)) {
        mappings[folder] = { type: "matched", athleteId };
      }
      // Pre-populate unmatched with "create" as default
      for (const folder of unmatched) {
        mappings[folder] = { type: "create", displayName: toTitleCase(folder) };
      }
      setFolderMappings(mappings);
      setModalStep("mapping");
    }
  };

  // ── Mapping UI helpers ──

  const setMappingForFolder = (folder: string, value: string) => {
    setFolderMappings((prev) => {
      const next = { ...prev };
      if (value === "__skip__") {
        next[folder] = { type: "skip" };
      } else if (value === "__create__") {
        next[folder] = { type: "create", displayName: toTitleCase(folder) };
      } else {
        next[folder] = { type: "assigned", athleteId: value };
      }
      return next;
    });
  };

  const pendingCreates = useMemo(() => {
    return Object.entries(folderMappings)
      .filter(([, m]) => m.type === "create")
      .map(([folder, m]) => ({ folder, displayName: (m as { type: "create"; displayName: string }).displayName }));
  }, [folderMappings]);

  const allUnmatchedResolved = useMemo(() => {
    return unmatchedFolders.every((f) => {
      const m = folderMappings[f];
      return m && (m.type === "skip" || m.type === "assigned" || m.type === "create");
    });
  }, [unmatchedFolders, folderMappings]);

  const handleContinueFromMapping = () => {
    if (pendingCreates.length > 0) {
      setModalStep("confirm");
    } else {
      runImport(folderMappings);
    }
  };

  const handleConfirmAndImport = () => {
    runImport(folderMappings);
  };

  // ── Import ──

  const runImport = async (mappings: Record<string, FolderMapping>) => {
    const selectedFiles = files.filter((f) => selected.has(f.id));

    // Resolve all folder → athleteId mappings, creating athletes as needed
    const resolvedAthleteIds: Record<string, string> = {};
    const skippedFolders = new Set<string>();

    for (const [folder, mapping] of Object.entries(mappings)) {
      if (mapping.type === "skip") {
        skippedFolders.add(folder);
      } else if (mapping.type === "matched" || mapping.type === "assigned") {
        resolvedAthleteIds[folder] = mapping.athleteId;
      } else if (mapping.type === "create") {
        // Create new athlete on this campaign
        const { data, error } = await supabase
          .from("athletes")
          .insert({ campaign_id: campaignId, name: mapping.displayName, sort_order: 999 })
          .select("id")
          .single();
        if (error || !data) {
          console.error(`Failed to create athlete "${mapping.displayName}":`, error);
          skippedFolders.add(folder);
          continue;
        }
        resolvedAthleteIds[folder] = data.id;
      }
    }

    // Filter to importable files (not skipped)
    const toImport = selectedFiles.filter((f) => {
      const folder = f.folderName ?? "Root";
      return !skippedFolders.has(folder) && resolvedAthleteIds[folder];
    });

    if (toImport.length === 0) {
      handleClose();
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setModalStep("browse"); // back to browse view to show progress
    setImporting(true);
    setImportProgress({ done: 0, total: toImport.length, errors: 0 });

    let errors = 0;

    for (let i = 0; i < toImport.length; i++) {
      if (controller.signal.aborted) break;

      const file = toImport[i];
      const folder = file.folderName ?? "Root";
      const athleteId = resolvedAthleteIds[folder];

      try {
        const res = await fetch("/api/drive/import-to-campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            campaignId,
            athleteId,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`Failed to import ${file.name}:`, body.error);
          errors++;
        }
      } catch (err: any) {
        if (err.name === "AbortError") break;
        console.error(`Failed to import ${file.name}:`, err);
        errors++;
      }
      setImportProgress({ done: i + 1, total: toImport.length, errors });
    }

    abortControllerRef.current = null;
    setImporting(false);
    onImportComplete();

    if (!controller.signal.aborted && errors === 0) {
      handleClose();
    } else if (controller.signal.aborted) {
      reset();
      onClose();
    }
  };

  // ── Render ─────────────────────────────────────────────────

  if (!isOpen) return null;

  const imageCount = files.filter((f) => f.mimeType.startsWith("image/")).length;
  const videoCount = files.filter((f) => f.mimeType.startsWith("video/")).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="w-[95vw] max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#D73F09] uppercase">
              Google Drive
            </div>
            <h2 className="text-xl font-black text-white">
              {modalStep === "mapping"
                ? "Map Folders to Athletes"
                : modalStep === "confirm"
                ? "Confirm New Athletes"
                : "Import from Drive"}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
          >
            &times;
          </button>
        </div>

        {/* ── STEP: MAPPING ─────────────────────────────── */}
        {modalStep === "mapping" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Auto-matched summary */}
              {Object.keys(matchedFolders).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-green-400 mb-3">
                    Auto-matched ({Object.keys(matchedFolders).length} folders)
                  </h3>
                  <div className="space-y-1">
                    {Object.entries(matchedFolders).map(([folder, athleteId]) => {
                      const athlete = campaignAthletes.find((a) => a.id === athleteId);
                      return (
                        <div key={folder} className="flex items-center gap-3 px-3 py-2 bg-green-900/20 border border-green-900/30 rounded-lg">
                          <div className="text-xs text-gray-400 flex-1 truncate">{folder}</div>
                          <div className="text-[10px] text-green-400 font-bold">&rarr;</div>
                          <div className="text-xs text-white font-bold truncate">{athlete?.name ?? athleteId}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unmatched folders */}
              {unmatchedFolders.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-yellow-400 mb-3">
                    Unmatched folders — please assign ({unmatchedFolders.length})
                  </h3>
                  <div className="space-y-3">
                    {unmatchedFolders.map((folder) => {
                      const mapping = folderMappings[folder];
                      const selectedFiles = files.filter(
                        (f) => (f.folderName ?? "Root") === folder && selected.has(f.id)
                      );
                      const currentValue =
                        mapping?.type === "skip"
                          ? "__skip__"
                          : mapping?.type === "create"
                          ? "__create__"
                          : mapping?.type === "assigned"
                          ? mapping.athleteId
                          : "__create__";

                      return (
                        <div key={folder} className="px-4 py-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-sm font-bold text-white">{folder}</div>
                              <div className="text-[10px] text-gray-500">{selectedFiles.length} files selected</div>
                            </div>
                          </div>
                          <select
                            value={currentValue}
                            onChange={(e) => setMappingForFolder(folder, e.target.value)}
                            className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-sm text-white outline-none focus:border-[#D73F09]/50"
                          >
                            <option value="__create__">Create new athlete: {toTitleCase(folder)}</option>
                            <option value="__skip__">Skip this folder</option>
                            <optgroup label="Existing athletes">
                              {campaignAthletes.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Mapping footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0 bg-black/40">
              <button
                onClick={() => setModalStep("browse")}
                className="px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:text-white"
              >
                &larr; Back
              </button>
              <button
                onClick={handleContinueFromMapping}
                disabled={!allUnmatchedResolved}
                className="px-6 py-2 text-xs font-black uppercase bg-[#D73F09] text-white rounded-lg hover:bg-[#ff5722] disabled:bg-gray-800 disabled:text-gray-600 transition-colors"
              >
                Continue Import
              </button>
            </div>
          </>
        )}

        {/* ── STEP: CONFIRM NEW ATHLETES ────────────────── */}
        {modalStep === "confirm" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-4">
                <div className="text-sm text-gray-300 mb-4">
                  The following <span className="font-bold text-white">{pendingCreates.length}</span> new
                  athlete{pendingCreates.length !== 1 ? "s" : ""} will be added to this campaign:
                </div>
                <div className="space-y-2">
                  {pendingCreates.map(({ folder, displayName }) => (
                    <div
                      key={folder}
                      className="flex items-center gap-3 px-4 py-3 bg-[#D73F09]/10 border border-[#D73F09]/30 rounded-lg"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#D73F09]" />
                      <div className="text-sm font-bold text-white">{displayName}</div>
                      <div className="text-[10px] text-gray-500">from folder: {folder}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirm footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0 bg-black/40">
              <button
                onClick={() => setModalStep("mapping")}
                className="px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:text-white"
              >
                &larr; Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAndImport}
                  className="px-6 py-2 text-xs font-black uppercase bg-[#D73F09] text-white rounded-lg hover:bg-[#ff5722] transition-colors"
                >
                  Confirm and Import
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP: BROWSE (file selection + import progress) ── */}
        {modalStep === "browse" && (
          <>
            {/* URL Input */}
            <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFetch();
                  }}
                  placeholder="Paste a Google Drive folder URL or ID..."
                  disabled={fetching || importing}
                  className="flex-1 px-4 py-2.5 bg-black border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-[#D73F09]/50 disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleFetch}
                  disabled={!folderInput.trim() || fetching || importing}
                  className="px-5 py-2.5 bg-white/10 text-sm font-bold text-white rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {fetching ? "Loading..." : "Fetch"}
                </button>
              </div>
              {fetchError && (
                <div className="mt-2 text-xs text-red-400">{fetchError}</div>
              )}
            </div>

            {/* File grid */}
            <div className="flex-1 overflow-y-auto">
              {files.length > 0 && (
                <>
                  {/* Toolbar */}
                  <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-10 flex-shrink-0">
                    <div className="text-xs text-gray-400">
                      <span className="font-bold text-white">{folderName}</span>
                      <span className="mx-2">&middot;</span>
                      {files.length} files
                      {imageCount > 0 && (
                        <span className="ml-1">({imageCount} images</span>
                      )}
                      {videoCount > 0 && (
                        <span>
                          {imageCount > 0 ? ", " : "("}
                          {videoCount} videos
                        </span>
                      )}
                      {(imageCount > 0 || videoCount > 0) && <span>)</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={selectAll}
                        className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 hover:text-white"
                      >
                        All
                      </button>
                      {imageCount > 0 && (
                        <button
                          onClick={selectAllImages}
                          className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 hover:text-white"
                        >
                          All Images
                        </button>
                      )}
                      {videoCount > 0 && (
                        <button
                          onClick={selectAllVideos}
                          className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 hover:text-white"
                        >
                          All Videos
                        </button>
                      )}
                      {selected.size > 0 && (
                        <button
                          onClick={clearSelection}
                          className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grouped grid */}
                  <div className="p-6 space-y-6">
                    {groups.map((group) => {
                      const groupSelectedCount = group.files.filter((f) =>
                        selected.has(f.id)
                      ).length;
                      return (
                        <div key={group.folderName}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-bold text-white">
                                {group.folderName}
                              </h3>
                              <span className="text-[10px] text-gray-500">
                                {group.files.length} files
                                {groupSelectedCount > 0 && (
                                  <span className="text-[#D73F09] font-bold ml-1">
                                    &middot; {groupSelectedCount} selected
                                  </span>
                                )}
                              </span>
                            </div>
                            <button
                              onClick={() => selectGroup(group.files)}
                              className="px-3 py-1 text-[10px] font-bold uppercase text-gray-500 hover:text-white"
                            >
                              Select folder
                            </button>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                            {group.files.map((file) => {
                              const isSelected = selected.has(file.id);
                              const isVideo = file.mimeType.startsWith("video/");
                              return (
                                <div
                                  key={file.id}
                                  onClick={() => !importing && toggle(file.id)}
                                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                    isSelected
                                      ? "border-[#D73F09] ring-2 ring-[#D73F09]/30"
                                      : "border-white/10 hover:border-white/30"
                                  } ${importing ? "opacity-60 pointer-events-none" : ""}`}
                                >
                                  <div className="aspect-square bg-black relative">
                                    <img
                                      src={`/api/drive/thumbnail/${file.id}`}
                                      alt={file.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                    {isVideo && (
                                      <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-black text-white">
                                        VIDEO
                                      </div>
                                    )}
                                    {isSelected && (
                                      <div className="absolute inset-0 bg-[#D73F09]/20 flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full bg-[#D73F09] flex items-center justify-center">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="px-2 py-1.5 bg-black/60">
                                    <div className="text-[10px] text-gray-400 truncate">{file.name}</div>
                                    <div className="text-[9px] text-gray-600">{humanSize(file.size)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {files.length === 0 && !fetching && !fetchError && (
                <div className="flex items-center justify-center h-48 text-sm text-gray-600">
                  Paste a Google Drive folder URL above to get started
                </div>
              )}

              {fetching && (
                <div className="flex items-center justify-center h-48">
                  <svg className="animate-spin h-8 w-8 text-[#D73F09]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Browse footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0 bg-black/40">
              <div className="text-xs text-gray-400">
                {importing ? (
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-4 w-4 text-[#D73F09]" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>
                      Importing {importProgress.done} / {importProgress.total}
                      {importProgress.errors > 0 && (
                        <span className="text-red-400 ml-1">({importProgress.errors} failed)</span>
                      )}
                    </span>
                    <div className="w-40 bg-gray-800 rounded-full h-1.5">
                      <div
                        className="bg-[#D73F09] h-1.5 rounded-full transition-all"
                        style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : selected.size > 0 ? (
                  <>
                    <span className="font-bold text-white">{selected.size}</span> files selected
                  </>
                ) : (
                  "No files selected"
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:text-white"
                >
                  {importing ? "Stop" : "Cancel"}
                </button>
                <button
                  onClick={startMatching}
                  disabled={selected.size === 0 || importing}
                  className="px-6 py-2 text-xs font-black uppercase bg-[#D73F09] text-white rounded-lg hover:bg-[#ff5722] disabled:bg-gray-800 disabled:text-gray-600 transition-colors"
                >
                  {importing
                    ? `Importing ${importProgress.done}/${importProgress.total}...`
                    : `Import${selected.size > 0 ? ` ${selected.size} files` : ""}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
