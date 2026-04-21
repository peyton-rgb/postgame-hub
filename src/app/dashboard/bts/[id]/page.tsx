"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PostgameLogo } from "@/components/PostgameLogo";
import { createBrowserSupabase } from "@/lib/supabase";

/** "2026-04-21, 6:42 PM EDT"-style timestamp for the detail page. */
function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Byte count → human-readable size string. */
function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

type Row = {
  id: string;
  athlete_name: string | null;
  submitter_name: string | null;
  hold_posting: boolean | null;
  video_path: string | null;
  video_url: string | null;
  original_filename: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  submitted_at: string | null;
  sheet_synced_at: string | null;
  sheet_sync_error: string | null;
  brand: { name: string } | { name: string }[] | null;
  campaign: { name: string } | { name: string }[] | null;
};

/**
 * /dashboard/bts/[id] — read-only detail view for one submission.
 *
 * Wave A: inline video player + metadata table. Wave B will add Hold
 * toggle, Retry Sync, Download proxy, and Copy link actions.
 */
export default function BtsSubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [row, setRow] = useState<Row | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Wave B action state
  const [actionBusy, setActionBusy] = useState<"hold" | "sync" | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
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
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      if (!data) {
        setNotFound(true);
        return;
      }
      setRow(data as unknown as Row);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── Wave B action handlers ─────────────────────────────────────────

  /** Flip hold_posting via PATCH /api/bts/[id]. Optimistically updates
   *  local state on success; surfaces server error messages inline. */
  async function toggleHold() {
    if (!row) return;
    const next = !row.hold_posting;
    setActionBusy("hold");
    setActionError(null);
    try {
      const res = await fetch(`/api/bts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdPosting: next }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? "Toggle failed");
      }
      const data = await res.json();
      setRow({ ...row, hold_posting: !!data.holdPosting });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setActionBusy(null);
    }
  }

  /** Retry the sheet append via POST /api/bts/[id]. Always HTTP 200 —
   *  branch on data.synced to decide success vs logged failure. */
  async function retrySync() {
    if (!row) return;
    setActionBusy("sync");
    setActionError(null);
    try {
      const res = await fetch(`/api/bts/${id}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.synced) {
        setRow({ ...row, sheet_synced_at: data.sheetSyncedAt, sheet_sync_error: null });
      } else {
        const errMsg = data.error ?? "Sync failed";
        setRow({ ...row, sheet_sync_error: errMsg });
        setActionError(errMsg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setActionError(msg);
    } finally {
      setActionBusy(null);
    }
  }

  /** Copy video_url to clipboard with brief visual feedback. */
  async function copyLink() {
    if (!row?.video_url) return;
    try {
      await navigator.clipboard.writeText(row.video_url);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(null), 1600);
    } catch {
      setCopyFeedback("Copy failed");
      setTimeout(() => setCopyFeedback(null), 1600);
    }
  }

  // Normalize the FK-embed results (Supabase types them as arrays when the
  // relation isn't marked unique; we've seen both shapes).
  const brandName =
    row
      ? Array.isArray(row.brand)
        ? row.brand[0]?.name ?? null
        : row.brand?.name ?? null
      : null;
  const campaignName =
    row
      ? Array.isArray(row.campaign)
        ? row.campaign[0]?.name ?? null
        : row.campaign?.name ?? null
      : null;

  const metadata: Array<{ label: string; value: string }> = row
    ? [
        { label: "Athlete", value: row.athlete_name || "—" },
        { label: "Brand", value: brandName ?? "(unlinked)" },
        { label: "Campaign", value: campaignName ?? "(unlinked)" },
        { label: "Submitter", value: row.submitter_name || "—" },
        { label: "Submitted", value: formatTimestamp(row.submitted_at) },
        { label: "Filename", value: row.original_filename || "—" },
        { label: "Size", value: formatSize(row.file_size_bytes) },
        { label: "MIME type", value: row.file_mime_type || "—" },
        { label: "Hold posting", value: row.hold_posting ? "YES" : "NO" },
        {
          label: "Sheet sync",
          value: row.sheet_sync_error
            ? `Failed: ${row.sheet_sync_error}`
            : row.sheet_synced_at
              ? `Synced ${formatTimestamp(row.sheet_synced_at)}`
              : "Pending",
        },
      ]
    : [];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5">
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
          <Link
            href="/dashboard/bts"
            className="text-sm font-bold text-gray-500 hover:text-white transition-colors"
          >
            BTS Submissions
          </Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-sm font-black text-white truncate">
            {row?.athlete_name || (notFound ? "Not found" : "Submission")}
          </h1>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 max-w-4xl">
        {loadError && (
          <div className="text-sm text-red-400 mb-6">
            Failed to load submission: {loadError}
          </div>
        )}
        {notFound && !loadError && (
          <div className="border border-gray-800 rounded-xl p-10 text-center">
            <div className="text-sm text-gray-400 mb-4">
              This submission couldn&apos;t be found.
            </div>
            <Link
              href="/dashboard/bts"
              className="text-sm font-bold text-[#D73F09] hover:underline"
            >
              ← Back to all submissions
            </Link>
          </div>
        )}

        {!row && !loadError && !notFound && (
          <div className="text-sm text-gray-500">Loading submission…</div>
        )}

        {row && (
          <>
            {/* Inline video player */}
            <div className="bg-black border border-gray-800 rounded-xl overflow-hidden mb-6">
              {row.video_url ? (
                <video
                  controls
                  src={row.video_url}
                  className="w-full max-h-[70vh] bg-black"
                />
              ) : (
                <div className="aspect-video flex items-center justify-center text-gray-500 text-sm">
                  No video URL on this submission.
                </div>
              )}
            </div>

            {/* Metadata */}
            <dl className="bg-[#111] border border-gray-800 rounded-xl divide-y divide-gray-800">
              {metadata.map(({ label, value }) => (
                <div key={label} className="flex items-start gap-4 px-5 py-3">
                  <dt className="w-36 shrink-0 text-xs font-bold uppercase tracking-wider text-gray-500 pt-0.5">
                    {label}
                  </dt>
                  <dd className="text-sm text-white break-words">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Sheet-sync failure banner — only when we have an error */}
            {row.sheet_sync_error && (
              <div className="mt-6 bg-yellow-500/10 border border-yellow-500/40 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wider text-yellow-400 mb-1">
                    ⚠ Sheet sync failed
                  </div>
                  <div className="text-sm text-yellow-100/80 break-words">
                    {row.sheet_sync_error}
                  </div>
                </div>
                <button
                  onClick={retrySync}
                  disabled={actionBusy === "sync"}
                  className="shrink-0 px-4 py-2 bg-yellow-500 rounded-lg text-black font-bold text-xs uppercase tracking-wider hover:bg-yellow-400 disabled:opacity-50 min-h-[40px]"
                >
                  {actionBusy === "sync" ? "Retrying…" : "Retry Sync"}
                </button>
              </div>
            )}

            {/* Action row — Download · Hold toggle · Copy Link */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Download — native browser download via Content-Disposition */}
              <a
                href={`/api/bts/${row.id}/download`}
                download
                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#D73F09] rounded-lg text-white font-bold text-sm uppercase tracking-wider hover:bg-[#B33407] min-h-[48px]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </a>

              {/* Hold toggle — styling flips with current state */}
              <button
                onClick={toggleHold}
                disabled={actionBusy === "hold"}
                className={
                  row.hold_posting
                    ? "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-[#D73F09] bg-[#D73F09]/15 text-[#D73F09] font-bold text-sm uppercase tracking-wider hover:bg-[#D73F09]/25 disabled:opacity-50 min-h-[48px]"
                    : "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-700 bg-black text-gray-300 font-bold text-sm uppercase tracking-wider hover:border-gray-500 disabled:opacity-50 min-h-[48px]"
                }
              >
                {actionBusy === "hold"
                  ? "Updating…"
                  : row.hold_posting
                    ? "Hold: YES"
                    : "Hold: NO"}
              </button>

              {/* Copy link — navigator.clipboard with transient feedback */}
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-700 bg-black rounded-lg text-gray-300 font-bold text-sm uppercase tracking-wider hover:border-gray-500 min-h-[48px]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copyFeedback ?? "Copy Link"}
              </button>
            </div>

            {actionError && (
              <div className="mt-3 text-xs text-red-400">{actionError}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
