"use client";

import { useState, useEffect, useCallback } from "react";

interface Submission {
  id: string;
  file_name: string | null;
  drive_thumbnail_url: string | null;
  score_composite: number | null;
  asset_type: string | null;
  tags: string[] | null;
}

interface Props {
  recapId: string;
  brandCampaignId: string;
  athleteId: string;
  athleteName: string;
  onClose: () => void;
  onImported: (media: any) => void;
}

export default function Tier3Picker({
  recapId,
  brandCampaignId,
  athleteId,
  athleteName,
  onClose,
  onImported,
}: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tier3/list?campaign_id=${encodeURIComponent(brandCampaignId)}&athlete_id=${encodeURIComponent(athleteId)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSubmissions(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [brandCampaignId, athleteId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleImport = async (sub: Submission) => {
    setImportingId(sub.id);
    setImportError(null);
    try {
      const res = await fetch("/api/tier3/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: sub.id, recap_id: recapId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { media } = await res.json();
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      onImported(media);
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[90vw] max-w-4xl max-h-[85vh] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#D73F09] uppercase">
              Tier 3 Content
            </div>
            <h2 className="text-xl font-black text-white">{athleteName}</h2>
            <div className="text-xs text-gray-500 mt-0.5">
              Select scored submissions to import into the recap
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Import error banner */}
          {importError && (
            <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
              {importError}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
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
                  Loading submissions...
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <div className="text-4xl mb-3">⚠️</div>
                <div className="text-sm font-bold text-red-400 mb-2">
                  Failed to load submissions
                </div>
                <div className="text-xs text-gray-500 mb-4">{error}</div>
                <button
                  onClick={fetchSubmissions}
                  className="px-6 py-2 text-xs font-black uppercase bg-[#D73F09] text-white rounded-lg hover:bg-[#ff5722] transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && submissions.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <div className="text-sm text-gray-400">
                  No tier 3 submissions for{" "}
                  <span className="text-white font-bold">{athleteName}</span>{" "}
                  yet. They&apos;ll appear here after the athlete submits content
                  via the campaign form.
                </div>
              </div>
            </div>
          )}

          {/* Submission grid */}
          {!isLoading && !error && submissions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {submissions.map((sub) => {
                const isImporting = importingId === sub.id;
                return (
                  <div
                    key={sub.id}
                    onClick={() => !isImporting && !importingId && handleImport(sub)}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      isImporting
                        ? "border-[#D73F09]/50 opacity-60"
                        : importingId
                          ? "border-white/10 opacity-40 cursor-not-allowed"
                          : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-black relative">
                      {sub.drive_thumbnail_url ? (
                        <img
                          src={sub.drive_thumbnail_url}
                          alt={sub.file_name || "Submission"}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                          No preview
                        </div>
                      )}

                      {/* Score badge */}
                      {sub.score_composite != null && (
                        <div className="absolute top-2 right-2 bg-black/70 border border-white/20 px-2 py-0.5 rounded text-[10px] font-black text-white">
                          {Math.round(sub.score_composite)}
                        </div>
                      )}

                      {/* Asset type badge */}
                      {sub.asset_type && (
                        <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-black text-white uppercase">
                          {sub.asset_type === "video" ? "VIDEO" : "PHOTO"}
                        </div>
                      )}

                      {/* Import spinner overlay */}
                      {isImporting && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <svg
                            className="animate-spin h-6 w-6 text-[#D73F09]"
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
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="px-2 py-1.5 bg-black/60">
                      <div className="text-[10px] text-gray-400 truncate">
                        {sub.file_name || "Unnamed"}
                      </div>
                      {/* Tags */}
                      {sub.tags && sub.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {sub.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500"
                            >
                              {tag}
                            </span>
                          ))}
                          {sub.tags.length > 3 && (
                            <span className="text-[8px] text-gray-600">
                              +{sub.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
