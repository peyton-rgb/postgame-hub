"use client";

// Ready to post (mockup screens 5 / 5b). For each approved deliverable: show
// the approved file with a download, the tag + #ad disclosure reminder, and a
// field to paste the live post link → submits for manager verification.
// Already-posted deliverables show their pending/verified state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slotLabel, type DeliverableStatus } from "@/lib/deliverable-status";

type Deliv = {
  id: string;
  slot: string;
  status: DeliverableStatus;
  live_url: string | null;
  file_url?: string | null;
  media_type?: string | null;
};

function PostCard({ d, brandName, onPosted }: { d: Deliv; brandName: string; onPosted: () => void }) {
  const [url, setUrl] = useState(d.live_url || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isVideo = d.media_type === "video";
  const hasFile = !!d.file_url;

  const posted = d.status === "pending_verification";
  const verified = d.status === "verified" || d.status === "paid";
  const canPost = d.status === "approved" || d.status === "to_post";

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/athlete/deliverables/post-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId: d.id, liveUrl: url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't submit your link.");
      onPosted();
    } catch (err: any) {
      setError(err?.message || "Couldn't submit your link.");
      setLoading(false);
    }
  }

  return (
    <div className="a-card" style={{ textAlign: "left", padding: 13, borderColor: verified ? "rgba(52,199,89,0.3)" : canPost ? "rgba(215,63,9,0.4)" : "rgba(255,255,255,0.09)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
        <div className="a-d" style={{ fontSize: 16, flex: 1 }}>{slotLabel(d.slot).toUpperCase()}</div>
        <span className={`a-pill ${verified ? "a-pill-ok" : posted ? "a-pill-neutral" : "a-pill-due"}`}>
          {verified ? "Verified" : posted ? "Pending verification" : "To post"}
        </span>
      </div>

      {/* approved content preview */}
      {hasFile && (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", height: 150, marginBottom: 11 }}>
          {isVideo ? (
            <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: 36, height: 36, fill: "#fff" }}><path d="M8 5v14l11-7z" /></svg>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.file_url!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      )}

      {hasFile && !verified && (
        <a href={d.file_url!} target="_blank" rel="noreferrer" download
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", textDecoration: "none", color: "var(--a-off)", marginBottom: 11 }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "currentColor", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
          </svg>
          <span style={{ fontSize: 13 }}>Download to post</span>
        </a>
      )}

      {!verified && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(215,63,9,0.12)", border: "1px solid rgba(215,63,9,0.3)", borderRadius: 10, padding: 10, marginBottom: 11 }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "var(--a-orange)", strokeWidth: 2, fill: "none", flex: "none", marginTop: 1 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" />
          </svg>
          <span style={{ fontSize: 12, lineHeight: 1.4, color: "rgba(250,248,245,0.8)" }}>
            Required by law: include <b>#ad</b> and tag <b>@{brandName}</b> so it&rsquo;s a clear paid partnership.
          </span>
        </div>
      )}

      {/* link field / state */}
      {canPost && (
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,245,0.45)", marginBottom: 6 }}>Paste your live post link</div>
          <input className="a-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/reel/..." />
          {error && <div className="a-err" style={{ marginTop: 8 }}>{error}</div>}
          <button className="a-cta" onClick={submit} disabled={loading || !url.trim()} style={{ marginTop: 9, padding: 12 }}>
            <span className="a-d" style={{ fontSize: 16 }}>{loading ? "SUBMITTING…" : "SUBMIT FOR VERIFICATION"}</span>
          </button>
          <div style={{ fontSize: 11, color: "rgba(250,248,245,0.45)", textAlign: "center", marginTop: 7 }}>
            Your manager checks the post is live, then this turns to <span style={{ color: "var(--a-green)" }}>Verified</span>.
          </div>
        </div>
      )}

      {posted && d.live_url && (
        <div style={{ fontSize: 12, color: "rgba(250,248,245,0.6)" }}>
          Submitted —{" "}
          <a href={d.live_url} target="_blank" rel="noreferrer" style={{ color: "#9cc3ff" }}>view your post</a>. Awaiting verification.
        </div>
      )}
    </div>
  );
}

export default function PostDeliverables({
  brandName,
  deliverables,
}: {
  brandName: string;
  deliverables: Deliv[];
}) {
  const router = useRouter();
  const doneCount = deliverables.filter((d) => d.status === "pending_verification" || d.status === "verified" || d.status === "paid").length;
  const total = deliverables.length;

  return (
    <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {total > 1 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,245,0.45)" }}>Your posts</span>
            <span style={{ fontSize: 12, color: "var(--a-off)" }}>{doneCount} of {total} done</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${total ? (doneCount / total) * 100 : 0}%`, height: "100%", background: "var(--a-orange)" }} />
          </div>
        </div>
      )}

      {deliverables.map((d) => (
        <PostCard key={d.id} d={d} brandName={brandName} onPosted={() => router.refresh()} />
      ))}

      <div style={{ fontSize: 11, color: "rgba(250,248,245,0.4)", textAlign: "center" }}>
        Payment releases once every post is live and verified.
      </div>
    </div>
  );
}
