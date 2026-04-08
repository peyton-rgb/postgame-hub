import { listPendingSubmissions } from "@/lib/tier3";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Tier3QueuePage() {
  const submissions = await listPendingSubmissions();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div
        className="border-b px-8 py-5 flex items-center justify-between"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm hover:opacity-80"
            style={{ color: "var(--text-3)" }}
          >
            ← Dashboard
          </Link>
          <h1 className="text-xl font-black" style={{ color: "var(--text)" }}>
            Tier 3 Content Queue
          </h1>
        </div>
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          {submissions.length} pending
        </span>
      </div>

      {/* Content */}
      <div className="p-8">
        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="text-4xl mb-4">📭</div>
            <h2
              className="text-lg font-black uppercase tracking-wide mb-2"
              style={{ color: "var(--text)" }}
            >
              No submissions yet
            </h2>
            <p
              className="text-sm max-w-md text-center"
              style={{ color: "var(--text-3)" }}
            >
              Tier 3 content submissions will appear here once athletes submit
              via the Google Form and the Apps Script pushes data to Supabase.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {/* Thumbnail */}
                <div className="aspect-square relative bg-black/30">
                  {s.drive_thumbnail_url ? (
                    <img
                      src={s.drive_thumbnail_url}
                      alt={s.file_name || "Submission"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span style={{ color: "var(--text-4)" }} className="text-xs font-bold uppercase">
                        No preview
                      </span>
                    </div>
                  )}
                  {/* Asset type badge */}
                  <span
                    className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: s.asset_type === "video" ? "var(--orange)" : "var(--glass-bg-2)",
                      color: "var(--text)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {s.asset_type}
                  </span>
                  {/* Status badge */}
                  <span
                    className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: s.status === "scored" ? "var(--orange-dim)" : "var(--glass-bg-2)",
                      color: s.status === "scored" ? "var(--orange)" : "var(--text-3)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {s.status.replace("_", " ")}
                  </span>
                </div>
                {/* Info */}
                <div className="p-3">
                  <div
                    className="text-sm font-bold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {s.athlete_name}
                  </div>
                  <div
                    className="text-xs truncate mt-0.5"
                    style={{ color: "var(--text-3)" }}
                  >
                    {s.file_name || "Untitled"}
                  </div>
                  {s.score_composite != null && (
                    <div
                      className="text-xs font-bold mt-1"
                      style={{ color: "var(--orange)" }}
                    >
                      Score: {s.score_composite}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
