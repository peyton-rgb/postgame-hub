// src/hooks/useDriveMedia.ts
// ─────────────────────────────────────────────────────────────
// React hook for the Upload Content tab.
// Fetches Drive media and fuzzy-matches athlete folders to
// recap athletes by name.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  createdTime: string | null;
  // Computed client-side:
  thumbnailUrl: string; // proxied through our API
  isVideo: boolean;
}

export interface AthleteFolder {
  folderName: string;
  folderId: string;
  files: DriveFile[];
}

export interface DriveMediaResult {
  parentFolderId: string;
  parentFolderName: string;
  athletes: AthleteFolder[];
  totalFiles: number;
  scannedAt: string;
}

export interface AthleteMatch {
  athleteId: string | number;
  athleteName: string;
  folder: AthleteFolder | null;
  matchConfidence: "exact" | "fuzzy" | "none";
}

// ── Name matching ─────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (Eloïse → Eloise)
    .replace(/[^a-z]/g, "");         // strip non-alpha
}

function matchAthleteToFolder(
  athleteName: string,
  folders: AthleteFolder[]
): { folder: AthleteFolder; confidence: "exact" | "fuzzy" } | null {
  const norm = normalizeName(athleteName);

  // Exact match (after normalization)
  const exact = folders.find((f) => normalizeName(f.folderName) === norm);
  if (exact) return { folder: exact, confidence: "exact" };

  // Fuzzy: check if all parts of the athlete name appear in a folder name
  const parts = athleteName
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 2);

  for (const folder of folders) {
    const folderNorm = folder.folderName.toLowerCase();
    const allPartsMatch = parts.every((part) => folderNorm.includes(part));
    if (allPartsMatch && parts.length >= 2) {
      return { folder, confidence: "fuzzy" };
    }
  }

  return null;
}

// ── Hook ──────────────────────────────────────────────────────

interface RecapAthlete {
  id: string | number;
  name: string;
  [key: string]: any;
}

export function useDriveMedia() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveData, setDriveData] = useState<DriveMediaResult | null>(null);
  const [matches, setMatches] = useState<AthleteMatch[]>([]);

  /**
   * Fetch Drive media and match to recap athletes.
   */
  const fetchAndMatch = useCallback(
    async (folderId: string, athletes: RecapAthlete[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/drive/campaign-media?folderId=${encodeURIComponent(folderId)}`
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const data: DriveMediaResult = await res.json();

        // Enrich files with computed fields
        for (const athlete of data.athletes) {
          for (const file of athlete.files) {
            (file as DriveFile).thumbnailUrl = `/api/drive/thumbnail/${file.id}`;
            (file as DriveFile).isVideo = file.mimeType.startsWith("video/");
          }
        }

        setDriveData(data);

        // Match athletes
        const athleteMatches: AthleteMatch[] = athletes.map((a) => {
          const result = matchAthleteToFolder(a.name, data.athletes);
          return {
            athleteId: a.id,
            athleteName: a.name,
            folder: result?.folder ?? null,
            matchConfidence: result?.confidence ?? "none",
          };
        });

        setMatches(athleteMatches);
        return { data, matches: athleteMatches };
      } catch (err: any) {
        const msg = err.message || "Failed to fetch Drive media";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ── Stats ─────────────────────────────────────────────────

  const stats = {
    matched: matches.filter((m) => m.folder && m.folder.files.length > 0)
      .length,
    empty: matches.filter((m) => m.folder && m.folder.files.length === 0)
      .length,
    unmatched: matches.filter((m) => !m.folder).length,
    totalFiles: driveData?.totalFiles ?? 0,
    totalFolders: driveData?.athletes.length ?? 0,
  };

  return {
    isLoading,
    error,
    driveData,
    matches,
    stats,
    fetchAndMatch,
  };
}
