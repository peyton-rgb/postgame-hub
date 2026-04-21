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

            {/* Wave B placeholders — not yet implemented. */}
            <div className="mt-6 bg-[#0a0a0a] border border-dashed border-gray-800 rounded-xl px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                TODO · Wave B
              </div>
              <ul className="text-sm text-gray-500 list-disc list-inside space-y-1">
                <li>Hold posting toggle (PATCH hold_posting)</li>
                <li>Retry Sheet Sync button (re-runs appendBtsRow)</li>
                <li>Download button (proxy route for download headers)</li>
                <li>Copy link button (clipboard the video_url)</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
