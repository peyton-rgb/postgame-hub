// src/components/DrivePicker.tsx
// ─────────────────────────────────────────────────────────────
// Modal component for browsing Drive campaign folders and
// selecting files to import into the recap builder.
//
// Props:
//   - isOpen: control visibility
//   - onClose: close the modal
//   - folderId: Drive parent folder ID for the campaign
//   - athletes: array of recap athletes (id, name)
//   - onImport: callback fired with selected files per athlete
// ─────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { fetchSchoolAliases, matchTeamFolder, type SchoolAliasMap } from "@/lib/team-folders";
import { ensureTeamContainer, type DetectedTeam } from "@/lib/collab-containers";

// ── Types ─────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  createdTime: string | null;
}

interface AthleteFolder {
  folderName: string;
  folderId: string;
  files: DriveFile[];
}

interface DriveData {
  parentFolderId: string;
  parentFolderName: string;
  athletes: AthleteFolder[];
  totalFiles: number;
}

interface RecapAthlete {
  id: string;
  name: string;
  school?: string;
  sport?: string;
}

interface DrivePickerProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string | null | undefined;
  recapId: string;
  onFolderConnected: (folderId: string) => Promise<void>;
  athletes: RecapAthlete[];
  onImport: (
    selections: Record<string, DriveFile[]>,
    onProgress: (p: ImportProgress) => void,
    signal?: AbortSignal
  ) => Promise<ImportProgress>;
  onImportToCollab: (
    files: DriveFile[],
    containerId: string,
    slot: "feed" | "reel",
  ) => Promise<{ succeeded: number; failed: number; errors: Array<{ file: string; error: string }> }>;
  // When the picker is opened from a collab card slot, this pre-scopes it to
  // the team's Drive folder and remembers which slot (feed/reel) to fill.
  initialDestination?: { driveFolderId: string | null; slot: "feed" | "reel" } | null;
}

interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
  succeeded: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

// ── Name matching helpers ─────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function matchAthleteToFolder(
  athleteName: string,
  folders: AthleteFolder[]
): AthleteFolder | null {
  const norm = normalizeName(athleteName);
  const exact = folders.find((f) => normalizeName(f.folderName) === norm);
  if (exact) return exact;

  // Fuzzy: check if all parts of athlete name appear in folder name
  const parts = athleteName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  for (const folder of folders) {
    const folderNorm = folder.folderName.toLowerCase();
    if (parts.every((part) => folderNorm.includes(part)) && parts.length >= 2) {
      return folder;
    }
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────

export default function DrivePicker({
  isOpen,
  onClose,
  folderId,
  recapId,
  onFolderConnected,
  athletes,
  onImport,
  onImportToCollab,
  initialDestination,
}: DrivePickerProps) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [aliasMap, setAliasMap] = useState<SchoolAliasMap>(new Map());
  const [teamFolders, setTeamFolders] = useState<DetectedTeam[]>([]);
  const [activeTeamFolderId, setActiveTeamFolderId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<"feed" | "reel">("feed");
  const [containerByFolderId, setContainerByFolderId] = useState<Record<string, string>>({});
  const [teamPoolSelection, setTeamPoolSelection] = useState<Set<string>>(new Set());
  const [collabImporting, setCollabImporting] = useState(false);
  const [collabMsg, setCollabMsg] = useState<string | null>(null);
  const [assignedFileIds, setAssignedFileIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveData, setDriveData] = useState<DriveData | null>(null);
  const [activeAthleteId, setActiveAthleteId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
  const [mode, setMode] = useState<"connect" | "selecting" | "importing" | "complete">("selecting");
  const [folderUrlInput, setFolderUrlInput] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [extraFolderIds, setExtraFolderIds] = useState<string[]>([]);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addFolderInput, setAddFolderInput] = useState("");
  const [addFolderError, setAddFolderError] = useState<string | null>(null);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    currentFile: "",
    succeeded: 0,
    failed: 0,
    errors: [],
  });
  const [wasAborted, setWasAborted] = useState(false);

  // When opened from a collab card slot, jump straight to that team's folder
  // and remember which slot (feed/reel) the imported files should fill.
  useEffect(() => {
    if (!isOpen || !initialDestination) return;
    setActiveSlot(initialDestination.slot);
    if (initialDestination.driveFolderId) {
      setActiveTeamFolderId(initialDestination.driveFolderId);
      setActiveAthleteId(null);
    }
  }, [isOpen, initialDestination]);

  const isImporting = mode === "importing";
  const prevIsOpen = useRef<boolean>(false);

  const resetImportState = (nextMode: "connect" | "selecting") => {
    setSelections({});
    setFilterType("all");
    setAbortController(null);
    setWasAborted(false);
    setImportProgress({
      current: 0,
      total: 0,
      currentFile: "",
      succeeded: 0,
      failed: 0,
      errors: [],
    });
    setError(null);
    setIsLoading(false);
    setDriveData(null);
    setActiveAthleteId(athletes[0]?.id || null);
    setFolderUrlInput("");
    setConnectError(null);
    setIsConnecting(false);
    setExtraFolderIds([]);
    setAddFolderOpen(false);
    setAddFolderInput("");
    setAddFolderError(null);
    setIsAddingFolder(false);
    setActiveTeamFolderId(null);
    setTeamPoolSelection(new Set());
    setAssignedFileIds(new Set());
    setCollabMsg(null);
    setMode(nextMode);
  };

  // Reset when modal is opened (fresh session each time)
  useEffect(() => {
    const wasOpen = prevIsOpen.current;
    if (isOpen && !wasOpen) {
      if (mode === "importing") return;
      resetImportState(folderId ? "selecting" : "connect");
    }
    prevIsOpen.current = isOpen;
    // Intentionally include athletes so first-athlete selection is correct on open
  }, [isOpen, folderId, athletes, mode]);

  // Keep mode in sync with folderId, but never override importing/complete
  useEffect(() => {
    if (!isOpen) return;
    if (mode === "importing" || mode === "complete") return;
    setMode(folderId ? "selecting" : "connect");
  }, [isOpen, folderId, mode]);

  // ── Fetch Drive data when modal opens ──
  useEffect(() => {
    if (!isOpen || !folderId) return;
    if (mode !== "selecting") return;

    setIsLoading(true);
    setError(null);

    fetch(`/api/drive/campaign-media?folderId=${encodeURIComponent(folderId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: DriveData) => {
        setDriveData(data);
        // Set first athlete as active
        if (athletes.length > 0) {
          setActiveAthleteId(athletes[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, folderId, athletes, mode]);

  // ── Detect team folders & auto-create their collab containers ──
  useEffect(() => {
    if (!driveData) return;
    let cancelled = false;
    (async () => {
      const aliases = aliasMap.size ? aliasMap : await fetchSchoolAliases(supabase);
      if (!aliasMap.size && !cancelled) setAliasMap(aliases);

      // folders already claimed by an individual athlete are off the table
      const claimed = new Set<string>();
      for (const a of athletes) {
        const f = matchAthleteToFolder(a.name, driveData.athletes);
        if (f) claimed.add(f.folderId);
      }

      const roster = athletes.map((a) => ({
        id: a.id, name: a.name, school: a.school || "", sport: a.sport || "",
      }));

      const teams: DetectedTeam[] = [];
      for (const folder of driveData.athletes) {
        if (claimed.has(folder.folderId)) continue;
        const m = matchTeamFolder(folder.folderName, aliases, roster);
        if (!m) continue;
        const teamName = folder.folderName.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
        teams.push({ ...m, folderId: folder.folderId, teamName });
      }
      if (cancelled) return;
      setTeamFolders(teams);

      // auto-create containers (silent, idempotent) and map folder -> container id
      const map: Record<string, string> = {};
      for (const t of teams) {
        const c = await ensureTeamContainer(supabase, recapId, t);
        if (c) map[t.folderId] = c.id;
      }
      if (!cancelled) setContainerByFolderId(map);
    })();
    return () => { cancelled = true; };
  }, [driveData, athletes, supabase, recapId]); // aliasMap intentionally omitted

  // Prevent Escape from closing modal during import
  useEffect(() => {
    if (!isOpen || mode !== "importing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, mode]);

  // ── Add another folder (merges into current driveData) ──
  const handleAddFolder = async () => {
    const match = addFolderInput.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      setAddFolderError("Invalid Drive folder URL");
      return;
    }
    const newId = match[1];
    if (newId === folderId || extraFolderIds.includes(newId)) {
      setAddFolderError("That folder is already loaded");
      return;
    }
    setIsAddingFolder(true);
    setAddFolderError(null);
    try {
      const res = await fetch(
        `/api/drive/campaign-media?folderId=${encodeURIComponent(newId)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const newData: DriveData = await res.json();
      setDriveData((prev) => {
        if (!prev) return newData;
        // Merge athletes: if same folder name exists, combine files
        const mergedAthletes = [...prev.athletes];
        for (const incoming of newData.athletes) {
          const existingIdx = mergedAthletes.findIndex(
            (a) => normalizeName(a.folderName) === normalizeName(incoming.folderName)
          );
          if (existingIdx >= 0) {
            const existing = mergedAthletes[existingIdx];
            const existingFileIds = new Set(existing.files.map((f) => f.id));
            mergedAthletes[existingIdx] = {
              ...existing,
              files: [
                ...existing.files,
                ...incoming.files.filter((f) => !existingFileIds.has(f.id)),
              ],
            };
          } else {
            mergedAthletes.push(incoming);
          }
        }
        return {
          ...prev,
          parentFolderName: `${prev.parentFolderName} + ${newData.parentFolderName}`,
          athletes: mergedAthletes,
          totalFiles: mergedAthletes.reduce((sum, a) => sum + a.files.length, 0),
        };
      });
      setExtraFolderIds((prev) => [...prev, newId]);
      setAddFolderInput("");
      setAddFolderOpen(false);
    } catch (e: any) {
      setAddFolderError(String(e?.message || e));
    } finally {
      setIsAddingFolder(false);
    }
  };

  // ── Match active athlete to Drive folder ──
          
  const activeAthlete = athletes.find((a) => a.id === activeAthleteId);
  const activeTeam = teamFolders.find((t) => t.folderId === activeTeamFolderId) || null;
  const activeFolder = useMemo(() => {
    if (!driveData) return null;
    if (activeTeamFolderId)
      return driveData.athletes.find((f) => f.folderId === activeTeamFolderId) || null;
    if (!activeAthlete) return null;
    return matchAthleteToFolder(activeAthlete.name, driveData.athletes);
  }, [driveData, activeAthlete, activeTeamFolderId]);

  // Reset team-pool selection + status when switching teams. (assignedFileIds
  // is left alone so the session ✓ badges persist across team switches.)
  useEffect(() => {
    setTeamPoolSelection(new Set());
    setCollabMsg(null);
  }, [activeTeamFolderId]);

  const activeContainerId = activeTeamFolderId ? containerByFolderId[activeTeamFolderId] : undefined;
  const toggleTeamPoolFile = (fileId: string) =>
    setTeamPoolSelection((p) => { const n = new Set(p); n.has(fileId) ? n.delete(fileId) : n.add(fileId); return n; });

  // Inline import of selected team-pool files to the team's collab container.
  const handleImportCollab = async () => {
    if (!activeContainerId || teamPoolSelection.size === 0 || !activeFolder) return;
    const files = activeFolder.files.filter((f) => teamPoolSelection.has(f.id));
    setCollabImporting(true);
    setCollabMsg(null);
    try {
      const res = await onImportToCollab(files, activeContainerId, activeSlot);
      setAssignedFileIds((prev) => {
        const n = new Set(prev);
        files.forEach((f) => n.add(f.id));
        return n;
      });
      setCollabMsg(
        `Imported ${res.succeeded}/${files.length} to Collab Post` +
        (res.failed ? ` · ${res.failed} failed` : ""),
      );
      setTeamPoolSelection(new Set());
    } finally {
      setCollabImporting(false);
    }
  };

  // ── Files for the current view ──
  // Team selected: that team's pool files. Athlete selected: their personal
  // folder files PLUS the pool files of any team they belong to (tagged with
  // the team name so they're visually distinct).
  const displayFiles = useMemo<{ file: DriveFile; teamName?: string }[]>(() => {
    if (!driveData) return [];
    const out: { file: DriveFile; teamName?: string }[] = [];
    const seen = new Set<string>();
    const push = (f: DriveFile, teamName?: string) => {
      if (seen.has(f.id)) return;
      seen.add(f.id);
      out.push({ file: f, teamName });
    };
    if (activeTeamFolderId) {
      const folder = driveData.athletes.find((df) => df.folderId === activeTeamFolderId);
      for (const f of folder?.files || []) push(f);
    } else if (activeAthlete) {
      const personal = matchAthleteToFolder(activeAthlete.name, driveData.athletes);
      for (const f of personal?.files || []) push(f);
      for (const t of teamFolders) {
        if (!t.athletes.some((a) => a.id === activeAthlete.id)) continue;
        const folder = driveData.athletes.find((df) => df.folderId === t.folderId);
        for (const f of folder?.files || []) push(f, t.teamName);
      }
    }
    return out.filter(({ file }) =>
      filterType === "image" ? file.mimeType.startsWith("image/")
      : filterType === "video" ? file.mimeType.startsWith("video/")
      : true,
    );
  }, [driveData, activeTeamFolderId, activeAthlete, teamFolders, filterType]);

  // ── View-aware selection (sidebar destination drives everything) ──
  const isTeamView = !!activeTeamFolderId;
  const currentSelectedIds =
    (isTeamView ? teamPoolSelection : activeAthleteId ? selections[activeAthleteId] : undefined) ||
    new Set<string>();
  const toggleCurrent = (fileId: string) => {
    if (isTeamView) toggleTeamPoolFile(fileId);
    else if (activeAthleteId) toggleFile(activeAthleteId, fileId);
  };
  const selectAllCurrent = () => {
    const ids = displayFiles.map((d) => d.file.id);
    if (isTeamView) setTeamPoolSelection(new Set(ids));
    else if (activeAthleteId) setSelections((prev) => ({ ...prev, [activeAthleteId]: new Set(ids) }));
  };
  const clearCurrent = () => {
    if (isTeamView) setTeamPoolSelection(new Set());
    else if (activeAthleteId) setSelections((prev) => ({ ...prev, [activeAthleteId]: new Set() }));
  };

  // ── Build athlete tabs with match info (personal folder + team membership) ──
  const athleteTabs = useMemo(() => {
    if (!driveData) return [];
    return athletes.map((athlete) => {
      const folder = matchAthleteToFolder(athlete.name, driveData.athletes);
      const selectedCount = selections[athlete.id]?.size || 0;
      const teams = teamFolders.filter((t) => t.athletes.some((a) => a.id === athlete.id));
      const teamFileCount = teams.reduce((sum, t) => {
        const tf = driveData.athletes.find((df) => df.folderId === t.folderId);
        return sum + (tf?.files.length || 0);
      }, 0);
      return {
        ...athlete,
        folder,
        fileCount: folder?.files.length || 0,
        selectedCount,
        isMatched: !!folder,
        onTeam: teams.length > 0,
        teamFileCount,
      };
    });
  }, [driveData, athletes, selections, teamFolders]);

  // ── Toggle file selection ──
  const toggleFile = (athleteId: string, fileId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[athleteId] || []);
      if (set.has(fileId)) {
        set.delete(fileId);
      } else {
        set.add(fileId);
      }
      next[athleteId] = set;
      return next;
    });
  };

  // ── Total selection count ──
  const totalSelected = Object.values(selections).reduce(
    (sum, set) => sum + set.size,
    0
  );
  const athletesWithSelections = Object.keys(selections).filter(
    (id) => (selections[id]?.size || 0) > 0
  ).length;

  // ── Import handler ──
  const handleImport = async () => {
    if (totalSelected === 0 || !driveData) return;

    setMode("importing");
    setWasAborted(false);
    const controller = new AbortController();
    setAbortController(controller);
    setImportProgress({
      current: 0,
      total: totalSelected,
      currentFile: "",
      succeeded: 0,
      failed: 0,
      errors: [],
    });

    // Build selections payload: { [athleteId]: DriveFile[] }. Candidate files
    // are the athlete's personal folder PLUS the pool files of any team they're
    // on, so team-pool picks made in an athlete's view import to that athlete.
    const payload: Record<string, DriveFile[]> = {};
    for (const athlete of athletes) {
      const selectedIds = selections[athlete.id];
      if (!selectedIds || selectedIds.size === 0) continue;

      const candidates = new Map<string, DriveFile>();
      const personal = matchAthleteToFolder(athlete.name, driveData.athletes);
      for (const f of personal?.files || []) candidates.set(f.id, f);
      for (const t of teamFolders) {
        if (!t.athletes.some((a) => a.id === athlete.id)) continue;
        const tf = driveData.athletes.find((df) => df.folderId === t.folderId);
        for (const f of tf?.files || []) candidates.set(f.id, f);
      }

      const files: DriveFile[] = [];
      selectedIds.forEach((fid) => { const f = candidates.get(fid); if (f) files.push(f); });
      if (files.length) payload[athlete.id] = files;
    }

    try {
      const finalStats = await onImport(
        payload,
        (p) => setImportProgress(p),
        controller.signal
      );
      setImportProgress(finalStats);
    } catch (err) {
      console.error("Import failed:", err);
      setError("Import failed. Check console for details.");
    } finally {
      if (controller.signal.aborted) setWasAborted(true);
      setAbortController(null);
      setMode("complete");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && mode !== "importing") onClose();
      }}
    >
      <div className="w-[95vw] h-[90vh] max-w-7xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#D73F09] uppercase">
              Google Drive
            </div>
            <h2 className="text-xl font-black text-white">
              {mode === "connect" ? "Connect Google Drive" : (driveData?.parentFolderName || "Loading...")}
            </h2>
            {mode === "connect" ? (
              <div className="text-xs text-gray-500 mt-0.5">
                Paste a Drive folder link to import campaign content
              </div>
            ) : driveData ? (
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                <span>{driveData.athletes.length} folders · {driveData.totalFiles} files</span>
                <button
                  type="button"
                  onClick={() => setAddFolderOpen((v) => !v)}
                  className="text-[10px] font-bold tracking-widest uppercase text-[#D73F09] hover:text-[#ff5722]"
                >
                  + Add Folder
                </button>
              </div>
            ) : null}
          </div>
          {mode !== "importing" ? (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
            >
              ✕
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>

        {/* Add Folder inline input */}
        {mode === "selecting" && addFolderOpen && (
          <div className="px-6 py-3 border-b border-white/10 bg-white/[0.02] flex items-center gap-2">
            <input
              value={addFolderInput}
              onChange={(e) => {
                setAddFolderInput(e.target.value);
                setAddFolderError(null);
              }}
              placeholder="https://drive.google.com/drive/folders/..."
              className="flex-1 bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#D73F09]"
              disabled={isAddingFolder}
            />
            <button
              type="button"
              disabled={isAddingFolder || !addFolderInput}
              onClick={handleAddFolder}
              className="bg-[#D73F09] hover:bg-[#ff5722] px-4 py-2 rounded-lg font-bold uppercase text-xs text-white disabled:opacity-50"
            >
              {isAddingFolder ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddFolderOpen(false);
                setAddFolderInput("");
                setAddFolderError(null);
              }}
              className="px-3 py-2 text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            {addFolderError ? (
              <div className="text-xs text-red-400 ml-2">{addFolderError}</div>
            ) : null}
          </div>
        )}

        {/* Connect mode */}
        {mode === "connect" && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-md py-16">
              <div className="text-center mb-8">
                <div className="text-[10px] font-bold tracking-widest text-[#D73F09] uppercase">
                  Google Drive
                </div>
                <div className="text-2xl font-black text-white mt-2">
                  Connect Google Drive
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  Paste a Drive folder link to import campaign content
                </div>
              </div>

              <div className="space-y-3">
                <input
                  value={folderUrlInput}
                  onChange={(e) => {
                    setFolderUrlInput(e.target.value);
                    setConnectError(null);
                  }}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#D73F09]"
                />
                {connectError ? (
                  <div className="text-sm text-red-400">{connectError}</div>
                ) : null}

                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={async () => {
                    const match = folderUrlInput.match(/\/folders\/([a-zA-Z0-9_-]+)/);
                    if (!match) {
                      setConnectError("Invalid Drive folder URL — must be a Google Drive folder link");
                      return;
                    }
                    const extractedId = match[1];
                    setIsConnecting(true);
                    setConnectError(null);
                    try {
                      await onFolderConnected(extractedId);
                      setMode("selecting");
                    } catch (e: any) {
                      setConnectError(String(e?.message || e));
                    } finally {
                      setIsConnecting(false);
                    }
                  }}
                  className="w-full bg-[#D73F09] hover:bg-[#ff5722] px-6 py-3 rounded-lg font-bold uppercase text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Importing mode */}
        {mode === "importing" && (
          <div className="flex-1 flex flex-col overflow-hidden px-6 py-8">
            <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
              <div className="text-2xl font-black text-white mb-6">
                Importing from Drive
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <div className="w-full h-4 bg-black/60 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-[#D73F09] transition-all"
                    style={{
                      width: `${importProgress.total > 0 ? Math.min(100, (importProgress.current / importProgress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-4 text-xl font-black text-white">
                  {importProgress.current} of {importProgress.total} files
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Currently processing:{" "}
                  <span className="text-gray-200 font-semibold">
                    {importProgress.currentFile || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                    <div className="text-sm font-black text-green-300">
                      ✓ Succeeded: {importProgress.succeeded}
                    </div>
                  </div>
                  {importProgress.failed > 0 ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <div className="text-sm font-black text-red-300">
                        ✗ Failed: {importProgress.failed}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3" />
                  )}
                </div>
              </div>

              {importProgress.errors.length > 0 ? (
                <div className="mt-4 bg-black/40 border border-white/10 rounded-2xl p-4 overflow-hidden">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                    Errors
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {importProgress.errors.map((e, i) => (
                      <div key={i} className="text-sm">
                        <div className="text-red-300 font-bold truncate">{e.file}</div>
                        <div className="text-gray-500 text-xs">{e.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => abortController?.abort()}
                  className="px-6 py-3 rounded-lg font-bold uppercase text-sm bg-white/5 border border-white/10 text-white hover:bg-white/10"
                >
                  Cancel Import
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete mode */}
        {mode === "complete" && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">
                  {importProgress.succeeded > 0 ? "✓" : "✕"}
                </div>
                <div className="text-2xl font-black text-white">
                  {wasAborted ? "Import Cancelled" : "Import Complete"}
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  {importProgress.succeeded} of {importProgress.total} files imported successfully
                </div>
              </div>

              {importProgress.errors.length > 0 ? (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 overflow-hidden">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                    Failed files
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {importProgress.errors.map((e, i) => (
                      <div key={i} className="text-sm">
                        <div className="text-red-300 font-bold truncate">{e.file}</div>
                        <div className="text-gray-500 text-xs">{e.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetImportState(folderId ? "selecting" : "connect");
                    onClose();
                  }}
                  className="px-6 py-3 rounded-lg font-bold uppercase text-sm bg-[#D73F09] hover:bg-[#ff5722] text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {mode === "selecting" && isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="animate-spin h-8 w-8 text-[#D73F09] mx-auto mb-3"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <div className="text-sm font-bold text-gray-400">
                Scanning Drive folders...
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {mode === "selecting" && error && !isLoading && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-3">⚠️</div>
              <div className="text-sm font-bold text-red-400 mb-2">
                Failed to load Drive
              </div>
              <div className="text-xs text-gray-500">{error}</div>
            </div>
          </div>
        )}

        {/* Main content */}
        {mode === "selecting" && driveData && !isLoading && !error && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left sidebar — teams + athletes */}
            <div className="w-64 border-r border-white/10 overflow-y-auto bg-black/40">
              {/* TEAMS section */}
              {teamFolders.length > 0 && (
                <>
                  <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/10">
                    Teams ({teamFolders.length})
                  </div>
                  {teamFolders.map((team) => {
                    const isActive = team.folderId === activeTeamFolderId;
                    return (
                      <button
                        key={team.folderId}
                        onClick={() => {
                          setActiveTeamFolderId(team.folderId);
                          setActiveAthleteId(null);
                        }}
                        className={`w-full px-4 py-3 text-left border-b border-white/5 transition-colors flex items-center justify-between ${
                          isActive
                            ? "bg-[#D73F09]/10 border-l-2 border-l-[#D73F09]"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white truncate">
                            {team.teamName}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {team.athletes.length} athletes
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* ATHLETES section */}
              <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/10">
                Athletes ({athletes.length})
              </div>
              {athleteTabs.map((tab) => {
                const isActive = tab.id === activeAthleteId && !activeTeamFolderId;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveAthleteId(tab.id);
                      setActiveTeamFolderId(null);
                    }}
                    className={`w-full px-4 py-3 text-left border-b border-white/5 transition-colors flex items-center justify-between ${
                      isActive
                        ? "bg-[#D73F09]/10 border-l-2 border-l-[#D73F09]"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">
                        {tab.name}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {tab.isMatched ? (
                          <>
                            {tab.fileCount} files
                            {tab.onTeam && <span className="text-gray-400"> · team pool</span>}
                            {tab.selectedCount > 0 && (
                              <span className="text-[#D73F09] font-bold ml-1">
                                · {tab.selectedCount} selected
                              </span>
                            )}
                          </>
                        ) : tab.onTeam ? (
                          <>
                            <span className="text-gray-400">Team pool · {tab.teamFileCount} files</span>
                            {tab.selectedCount > 0 && (
                              <span className="text-[#D73F09] font-bold ml-1">
                                · {tab.selectedCount} selected
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-red-400">No folder match</span>
                        )}
                      </div>
                    </div>
                    {tab.selectedCount > 0 && (
                      <div className="ml-2 w-5 h-5 rounded-full bg-[#D73F09] text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                        {tab.selectedCount}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right pane — file grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold text-white">
                    {activeTeam
                      ? activeTeam.teamName
                      : activeAthlete?.name || "Select an athlete"}
                  </div>
                  {activeTeam && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#D73F09] bg-[#D73F09]/10 px-1.5 py-0.5 rounded">
                      Team
                    </span>
                  )}
                  {activeFolder && (
                    <div className="text-xs text-gray-500">
                      / {activeFolder.folderName}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Filter buttons */}
                  <div className="flex bg-white/5 rounded-lg p-0.5">
                    {(["all", "image", "video"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${
                          filterType === type
                            ? "bg-white/10 text-white"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {/* Bulk actions (athlete or team view) */}
                  {displayFiles.length > 0 && (
                    <>
                      <button
                        onClick={selectAllCurrent}
                        className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 hover:text-white"
                      >
                        Select All
                      </button>
                      <button
                        onClick={clearCurrent}
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
                {!activeTeamFolderId && !activeAthlete ? (
                  <div className="text-center text-gray-500 mt-20">
                    <div className="text-sm">Select an athlete or team</div>
                  </div>
                ) : displayFiles.length === 0 ? (
                  <div className="text-center text-gray-500 mt-20">
                    <div className="text-sm">
                      {isTeamView ? (
                        "No files in this team folder"
                      ) : (
                        <>
                          No content for{" "}
                          <span className="text-white font-bold">{activeAthlete?.name}</span>
                        </>
                      )}
                    </div>
                    {!isTeamView && (
                      <div className="text-xs mt-2">
                        No personal folder match and no team pool files.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {displayFiles.map(({ file, teamName }) => {
                      const isVideo = file.mimeType.startsWith("video/");
                      const isSelected = currentSelectedIds.has(file.id);
                      const wasAssigned = assignedFileIds.has(file.id);
                      return (
                        <div
                          key={file.id}
                          onClick={() => toggleCurrent(file.id)}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? "border-[#D73F09] ring-2 ring-[#D73F09]/30"
                              : "border-white/10 hover:border-white/30"
                          }`}
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
                            {/* Team-pool tag — only in an athlete's combined view */}
                            {!isTeamView && teamName && (
                              <div className="absolute bottom-2 left-2 bg-[#D73F09]/90 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide text-white max-w-[90%] truncate">
                                {teamName}
                              </div>
                            )}
                            {wasAssigned && !isSelected && (
                              <div className="absolute top-2 right-2 bg-green-600/90 px-1.5 py-0.5 rounded text-[8px] font-black text-white">
                                ✓
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-[#D73F09]/20 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-[#D73F09] flex items-center justify-center">
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="3"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="px-2 py-1.5 bg-black/60">
                            <div className="text-[10px] text-gray-400 truncate">
                              {file.name}
                            </div>
                            <div className="text-[9px] text-gray-600">{file.size}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {mode === "selecting" && driveData && !isLoading && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-black/40">
            <div className="text-xs text-gray-400 flex items-center gap-3">
              {isTeamView && (
                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-white/10">
                  {(["feed", "reel"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSlot(s)}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-colors ${
                        activeSlot === s
                          ? "bg-[#D73F09] text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {isTeamView ? (
                collabMsg ? (
                  <span className="text-gray-300">{collabMsg}</span>
                ) : teamPoolSelection.size > 0 ? (
                  <>
                    <span className="font-bold text-white">{teamPoolSelection.size}</span> files
                    selected for {activeSlot === "feed" ? "Feed" : "Reel"}
                  </>
                ) : (
                  "No files selected"
                )
              ) : totalSelected > 0 ? (
                <>
                  <span className="font-bold text-white">{totalSelected}</span> files
                  selected across{" "}
                  <span className="font-bold text-white">{athletesWithSelections}</span>{" "}
                  athletes
                </>
              ) : (
                "No files selected"
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:text-white disabled:opacity-30"
              >
                Cancel
              </button>
              {isTeamView ? (
                <button
                  onClick={handleImportCollab}
                  disabled={teamPoolSelection.size === 0 || collabImporting}
                  className="px-6 py-2 text-xs font-black uppercase bg-[#D73F09] text-white rounded-lg hover:bg-[#ff5722] disabled:bg-gray-800 disabled:text-gray-600 transition-colors flex items-center gap-2"
                >
                  {collabImporting
                    ? "Importing…"
                    : `Import${teamPoolSelection.size > 0 ? ` ${teamPoolSelection.size}` : ""} to ${activeSlot === "feed" ? "Feed" : "Reel"}`}
                </button>
              ) : (
                <button
                  onClick={handleImport}
                  disabled={totalSelected === 0 || isImporting}
                  className="px-6 py-2 text-xs font-black uppercase bg-[#D73F09] text-white rounded-lg hover:bg-[#ff5722] disabled:bg-gray-800 disabled:text-gray-600 transition-colors flex items-center gap-2"
                >
                  <>Import {totalSelected > 0 ? `${totalSelected} files` : ""}</>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
