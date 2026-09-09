"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";

/**
 * A single BTS submission row, shaped after the PostgREST join on
 * brands and campaign_recaps is normalized.
 */
type Submission = {
  id: string;
  athleteName: string;
  submitterName: string | null;
  holdPosting: boolean;
  videoPath: string;
  videoUrl: string;
  originalFilename: string;
  fileMimeType: string;
  fileSizeBytes: number;
  submittedAt: string;
  sheetSyncedAt: string | null;
  sheetSyncError: string | null;
  brandName: string | null;
  campaignName: string | null;
};

type HoldFilter = "all" | "held" | "not-held";

/** "Apr 21, 6:42 PM"-style timestamp for tile display. */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Client list view for BTS submissions.
 *
 * Fetches the 50 most recent submissions on mount, then renders a filter
 * bar (search + brand dropdown + hold filter) above a tile grid. Each
 * tile is a link to /dashboard/bts/[id].
 */
export default function BtsListClient() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [holdFilter, setHoldFilter] = useState<HoldFilter>("all");

  // Fetch on mount. The Supabase FK-embed syntax brings brand + campaign
  // names in one round trip; we normalize nulls/array-shapes below.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("bts_submissions")
        .select(
          `
            id,
            athlete_name,
            submitter_name,
            hold_posting,
            video_path,
            video_url,
            original_filename,
            file_mime_type,
            file_size_bytes,
            submitted_at,
            sheet_synced_at,
            sheet_sync_error,
            brand:brands ( name ),
            campaign:campaign_recaps ( name )
          `
        )
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setSubmissions([]);
        return;
      }

      const rows = (data ?? []).map((r: any) => ({
        id: r.id as string,
        athleteName: (r.athlete_name as string) ?? "",
        submitterName: (r.submitter_name as string | null) ?? null,
        holdPosting: !!r.hold_posting,
        videoPath: (r.video_path as string) ?? "",
        videoUrl: (r.video_url as string) ?? "",
        originalFilename: (r.original_filename as string) ?? "",
        fileMimeType: (r.file_mime_type as string) ?? "",
        fileSizeBytes: (r.file_size_bytes as number) ?? 0,
        submittedAt: (r.submitted_at as string) ?? "",
        sheetSyncedAt: (r.sheet_synced_at as string | null) ?? null,
        sheetSyncError: (r.sheet_sync_error as string | null) ?? null,
        brandName:
          (Array.isArray(r.brand) ? r.brand[0]?.name : r.brand?.name) ?? null,
        campaignName:
          (Array.isArray(r.campaign) ? r.campaign[0]?.name : r.campaign?.name) ?? null,
      }));

      setSubmissions(rows);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Unique brand names for the dropdown, alphabetized; nulls stripped.
  const brandOptions = useMemo(() => {
    if (!submissions) return [];
    const set = new Set<string>();
    for (const s of submissions) if (s.brandName) set.add(s.brandName);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [submissions]);

  // Apply search + brand + hold filters.
  const filtered = useMemo(() => {
    if (!submissions) return [];
    const q = search.toLowerCase().trim();
    return submissions.filter((s) => {
      if (holdFilter === "held" && !s.holdPosting) return false;
      if (holdFilter === "not-held" && s.holdPosting) return false;
      if (brandFilter && s.brandName !== brandFilter) return false;
      if (q) {
        const blob = [s.athleteName, s.brandName ?? "", s.campaignName ?? ""]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, brandFilter, holdFilter]);

  const inputCls =
    "w-full px-4 py-3 bg-ground border border-hairline rounded-lg text-ink-1 focus:border-accent outline-none text-sm";
  const selectCls = inputCls + " appearance-none cursor-pointer";

  // ── Loading / error shells ───────────────────────────────────────
  if (submissions === null) {
    return (
      <div className="text-sm text-ink-4">Loading submissions…</div>
    );
  }
  if (loadError) {
    return (
      <div className="text-sm text-status-bad">
        Failed to load submissions: {loadError}
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────
  return (
    <div>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <input
          type="text"
          className={inputCls}
          placeholder="Search athlete, brand, or campaign…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectCls}
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="">All brands</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={holdFilter}
          onChange={(e) => setHoldFilter(e.target.value as HoldFilter)}
        >
          <option value="all">All submissions</option>
          <option value="held">Held only</option>
          <option value="not-held">Not held</option>
        </select>
      </div>

      <div className="text-xs font-bold uppercase tracking-wider text-ink-4 mb-3">
        {filtered.length} {filtered.length === 1 ? "submission" : "submissions"}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-hairline-soft rounded-xl p-10 text-center text-sm text-ink-4">
          No submissions match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/bts/${s.id}`}
              className="block bg-surface-card border border-hairline-soft hover:border-hairline rounded-xl p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-base font-black text-ink-1 truncate">
                    {s.athleteName || "Unnamed athlete"}
                  </div>
                  <div className="text-xs text-ink-3 truncate">
                    {s.brandName ?? "(unlinked brand)"} ·{" "}
                    {s.campaignName ?? "(unlinked campaign)"}
                  </div>
                </div>
                {s.holdPosting && (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-accent/15 border border-accent/40 text-accent text-[10px] font-black uppercase tracking-wider">
                    HOLD
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-4">
                  {formatDate(s.submittedAt)}
                </span>
                {s.sheetSyncError && (
                  <span
                    className="text-xs font-bold text-status-warn"
                    title={s.sheetSyncError}
                  >
                    ⚠ Sheet sync failed
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
