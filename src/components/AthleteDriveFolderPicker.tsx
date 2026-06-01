// src/components/AthleteDriveFolderPicker.tsx
// ─────────────────────────────────────────────────────────────
// Modal: paste a Drive folder URL → render thumbnails → check
// the ones to import → serial import to /api/drive/import,
// scoped to a single athlete.
//
// Use case: an athlete's content lives in an isolated Drive
// folder that isn't nested under the campaign's parent folder,
// so the campaign-level DrivePicker can't reach it.
// ─────────────────────────────────────────────────────────────

"use client";

import { useEffect, useMemo, useState } from "react";

interface FolderFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  thumbnailLink: string | null;
  webViewLink: string | null;
  createdTime: string | null;
  isVideo: boolean;
  // Set for recursive event imports: the subfolder this file sits in, and the
  // full path from the dropped root. Absent/ignored for flat athlete imports.
  folderName?: string;
  folderPath?: string;
}

interface ListFolderResponse {
  folderId: string;
  folderName: string;
  files: FolderFile[];
  alreadyImportedFileIds: string[];
}

interface AthleteDriveFolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  recapId: string;
  athleteId?: string;
  eventImport?: boolean;
  athleteName: string;
  onImported: (newMedia: any[]) => void;
}

type Phase = "input" | "loading" | "select" | "importing" | "done";

export default function AthleteDriveFolderPicker({
  isOpen,
  onClose,
  recapId,
  athleteId,
  eventImport,
  athleteName,
  onImported,
}: AthleteDriveFolderPickerProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [folderUrl, setFolderUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [folder, setFolder] = useState<ListFolderResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thumbErrored, setThumbErrored] = useState<Set<string>>(new Set());
  const [importIndex, setImportIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<{ file: string; error: string }[]>([]);

  const alreadyImported = useMemo(
    () => new Set(folder?.alreadyImportedFileIds ?? []),
    [folder]
  );
  const selectableFiles = useMemo(
    () => (folder?.files ?? []).filter((f) => !alreadyImported.has(f.id)),
    [folder, alreadyImported]
  );

  // Group event-mode files by the subfolder they came from, preserving
  // first-appearance order (the route returns them root-first, BFS order).
  // Must run on every render — keep it above the `if (!isOpen) return null`.
  const groupedFiles = useMemo(() => {
    const groups: { name: string; files: FolderFile[] }[] = [];
    const index = new Map<string, number>();
    for (const f of folder?.files ?? []) {
      const key = f.folderName || "Other";
      let i = index.get(key);
      if (i === undefined) {
        i = groups.length;
        index.set(key, i);
        groups.push({ name: key, files: [] });
      }
      groups[i].files.push(f);
    }
    return groups;
  }, [folder]);

  // Fully reset whenever the modal closes so reopening starts fresh.
  useEffect(() => {
    if (isOpen) return;
    setPhase("input");
    setFolderUrl("");
    setInputError(null);
    setFolder(null);
    setSelected(new Set());
    setThumbErrored(new Set());
    setImportIndex(0);
    setImportedCount(0);
    setFailedCount(0);
    setImportErrors([]);
  }, [isOpen]);

  if (!isOpen) return null;

  async function loadFiles() {
    if (!folderUrl.trim()) {
      setInputError("Paste a Drive folder URL.");
      return;
    }
    setPhase("loading");
    setInputError(null);
    try {
      const res = await fetch("/api/drive/list-folder-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          eventImport
            ? { folderUrl: folderUrl.trim(), recapId, recursive: true }
            : { folderUrl: folderUrl.trim(), recapId }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInputError(String(data?.error || `HTTP ${res.status}`));
        setPhase("input");
        return;
      }
      setFolder(data as ListFolderResponse);
      setSelected(new Set());
      setPhase("select");
    } catch (e: any) {
      setInputError(String(e?.message || e));
      setPhase("input");
    }
  }

  function toggleFile(fileId: string) {
    if (alreadyImported.has(fileId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(selectableFiles.map((f) => f.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function runImport() {
    if (!folder || selected.size === 0) return;
    const toImport = folder.files.filter((f) => selected.has(f.id));
    setPhase("importing");
    setImportIndex(0);
    setImportedCount(0);
    setFailedCount(0);
    setImportErrors([]);

    // Local counters — React state updates are async, so we can't read
    // setFailedCount/setImportErrors back at the end of the loop.
    const successfulMedia: any[] = [];
    const failures: { file: string; error: string }[] = [];

    for (let i = 0; i < toImport.length; i++) {
      const file = toImport[i];
      setImportIndex(i + 1);
      try {
        const res = await fetch("/api/drive/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            eventImport
              ? { fileId: file.id, fileName: file.name, recapId, isEvent: true }
              : { fileId: file.id, fileName: file.name, athleteId, recapId }
          ),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          const msg = String(data?.error || `HTTP ${res.status}`);
          failures.push({ file: file.name, error: msg });
          setFailedCount(failures.length);
          setImportErrors([...failures]);
          console.error("[AthleteDriveFolderPicker] Import failed:", file.name, msg);
          continue;
        }
        if (data.media) successfulMedia.push(data.media);
        setImportedCount(successfulMedia.length);
      } catch (e: any) {
        const msg = String(e?.message || e);
        failures.push({ file: file.name, error: msg });
        setFailedCount(failures.length);
        setImportErrors([...failures]);
        console.error("[AthleteDriveFolderPicker] Import error:", file.name, msg);
      }
    }

    if (successfulMedia.length > 0) onImported(successfulMedia);

    // If everything succeeded, close immediately. Otherwise show the summary.
    if (failures.length === 0) {
      onClose();
    } else {
      setPhase("done");
    }
  }

  const totalFiles = folder?.files.length ?? 0;
  const alreadyCount = folder?.alreadyImportedFileIds.length ?? 0;

  // One file tile — identical markup for flat (athlete) and grouped (event) modes.
  const renderTile = (file: FolderFile) => {
    const isAlready = alreadyImported.has(file.id);
    const isSelected = !isAlready && selected.has(file.id);
    const thumbFailed = thumbErrored.has(file.id);
    return (
      <div
        key={file.id}
        onClick={() => toggleFile(file.id)}
        className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
          isAlready
            ? "border-white/10 opacity-40 cursor-default"
            : isSelected
            ? "border-[#D73F09] ring-2 ring-[#D73F09]/30 cursor-pointer"
            : "border-white/10 hover:border-white/30 cursor-pointer"
        }`}
      >
        <div className="aspect-square bg-black relative flex items-center justify-center">
          {!thumbFailed ? (
            <img
              src={`/api/drive/thumbnail/${file.id}`}
              alt={file.name}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() =>
                setThumbErrored((prev) => {
                  const next = new Set(prev);
                  next.add(file.id);
                  return next;
                })
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500 text-[9px] px-2 text-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {file.isVideo ? (
                  <>
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </>
                )}
              </svg>
              <div className="mt-1 truncate w-full">{file.name}</div>
            </div>
          )}
          {file.isVideo && (
            <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-black text-white">
              VIDEO
            </div>
          )}
          {isAlready && (
            <div className="absolute top-2 right-2 bg-green-600/90 px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-wide">
              ✓ Imported
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
          {isAlready && (
            <div className="text-[9px] text-green-400/70">Already imported</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "importing") onClose();
      }}
    >
      <div className="w-[95vw] h-[90vh] max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-widest text-[#D73F09] uppercase">
              Google Drive · Athlete folder
            </div>
            <h2 className="text-xl font-black text-white truncate">
              {phase === "select" || phase === "importing" || phase === "done"
                ? folder?.folderName || "Drive folder"
                : `Import to ${athleteName}`}
            </h2>
            {phase === "select" && folder && (
              <div className="text-xs text-gray-500 mt-0.5">
                {totalFiles} file{totalFiles !== 1 ? "s" : ""}
                {alreadyCount > 0 && ` · ${alreadyCount} already imported`}
                {" · "}
                Importing to <span className="text-gray-300 font-bold">{athleteName}</span>
              </div>
            )}
          </div>
          {phase !== "importing" && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Phase: input */}
        {phase === "input" && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-md py-16">
              <div className="text-center mb-8">
                <div className="text-2xl font-black text-white">
                  Paste this athlete's Drive folder
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  We'll list the files so you can pick which ones to import.
                </div>
              </div>
              <div className="space-y-3">
                <input
                  value={folderUrl}
                  onChange={(e) => {
                    setFolderUrl(e.target.value);
                    setInputError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && folderUrl.trim()) loadFiles();
                  }}
                  placeholder="https://drive.google.com/drive/folders/..."
                  aria-label="Drive folder URL"
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#D73F09]"
                />
                {inputError && (
                  <div className="text-sm text-red-400">{inputError}</div>
                )}
                <button
                  type="button"
                  disabled={!folderUrl.trim()}
                  onClick={loadFiles}
                  className="w-full bg-[#D73F09] hover:bg-[#ff5722] px-6 py-3 rounded-lg font-bold uppercase text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Load files
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase: loading */}
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-[#D73F09] mx-auto mb-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div className="text-sm font-bold text-gray-400">Scanning folder…</div>
            </div>
          </div>
        )}

        {/* Phase: select */}
        {phase === "select" && folder && (
          <>
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="text-xs text-gray-400">
                {selected.size > 0 ? (
                  <>
                    <span className="font-bold text-white">{selected.size}</span> selected
                    {" / "}
                    {selectableFiles.length} available
                  </>
                ) : selectableFiles.length === 0 ? (
                  "Nothing left to import"
                ) : (
                  `${selectableFiles.length} file${selectableFiles.length !== 1 ? "s" : ""} available`
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectableFiles.length > 0 && (
                  <>
                    <button
                      onClick={selectAll}
                      className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 hover:text-white"
                    >
                      Select all
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* File grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {folder.files.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <div className="text-sm">No image or video files in this folder.</div>
                </div>
              ) : eventImport ? (
                <div className="space-y-8">
                  {groupedFiles.map((group) => (
                    <div key={group.name}>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-black text-white uppercase tracking-wide">{group.name}</h3>
                        <span className="text-[10px] text-gray-500">
                          {group.files.length} file{group.files.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {group.files.map(renderTile)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {folder.files.map(renderTile)}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-black/40">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={runImport}
                disabled={selected.size === 0}
                className="px-6 py-2 text-xs font-black uppercase bg-[#D73F09] text-white rounded-lg hover:bg-[#ff5722] disabled:bg-gray-800 disabled:text-gray-600 transition-colors"
              >
                {selected.size === 0
                  ? "Select files to import"
                  : `Import ${selected.size} file${selected.size !== 1 ? "s" : ""} to ${athleteName}`}
              </button>
            </div>
          </>
        )}

        {/* Phase: importing */}
        {phase === "importing" && (
          <div className="flex-1 flex flex-col px-6 py-8">
            <div className="max-w-2xl mx-auto w-full">
              <div className="text-2xl font-black text-white mb-6">
                Importing to {athleteName}
              </div>
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <div className="w-full h-4 bg-black/60 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-[#D73F09] transition-all"
                    style={{
                      width: `${selected.size > 0 ? Math.min(100, (importIndex / selected.size) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-4 text-xl font-black text-white">
                  Importing {importIndex} of {selected.size}…
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                    <div className="text-sm font-black text-green-300">
                      ✓ Succeeded: {importedCount}
                    </div>
                  </div>
                  {failedCount > 0 ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <div className="text-sm font-black text-red-300">
                        ✗ Failed: {failedCount}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase: done (only reached when there were failures) */}
        {phase === "done" && (
          <div className="flex-1 flex flex-col px-6 py-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">{importedCount > 0 ? "✓" : "✕"}</div>
                <div className="text-2xl font-black text-white">
                  Imported {importedCount}. {failedCount} failed.
                </div>
              </div>
              {importErrors.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 overflow-hidden">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                    Failed files
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {importErrors.map((e, i) => (
                      <div key={i} className="text-sm">
                        <div className="text-red-300 font-bold truncate">{e.file}</div>
                        <div className="text-gray-500 text-xs">{e.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-lg font-bold uppercase text-sm bg-[#D73F09] hover:bg-[#ff5722] text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
