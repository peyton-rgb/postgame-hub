"use client";

// Upload content (mockup screen 4b): one drop-zone per deliverable (feed /
// reel). The browser uploads straight to the campaign-media bucket (handles
// large reels), then registers the file via /api/athlete/deliverables/upload
// which stamps media.slot and advances the deliverable. Submit-for-approval
// requires every deliverable uploaded.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { slotLabel, type DeliverableStatus } from "@/lib/deliverable-status";

type Deliv = {
  id: string;
  slot: string;
  status: DeliverableStatus;
  media?: { file_url: string; type: string | null } | null;
};

const BUCKET = "campaign-media";

function acceptFor(slot: string) {
  if (slot === "reel") return "video/*";
  if (slot === "feed") return "image/*";
  return "image/*,video/*";
}

export default function UploadDeliverables({
  optinId,
  campaignId,
  athleteId,
  deliverables,
}: {
  optinId: string;
  campaignId: string;
  athleteId: string;
  deliverables: Deliv[];
}) {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const uploadedCount = deliverables.filter((d) => d.media || d.status !== "to_upload").length;
  const total = deliverables.length;
  const allUploaded = deliverables.every((d) => d.media && d.status !== "to_upload" && d.status !== "changes_requested");

  async function handleFile(deliverable: Deliv, file: File) {
    setError("");
    setBusySlot(deliverable.slot);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `athlete/${athleteId}/${campaignId}/${deliverable.slot}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const res = await fetch("/api/athlete/deliverables/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optinId,
          slot: deliverable.slot,
          storagePath: path,
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setBusySlot(null);
    }
  }

  async function submitForApproval() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/athlete/deliverables/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optinId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't submit.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Couldn't submit.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 13 }}>
      {/* progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,245,0.45)" }}>Your uploads</span>
          <span style={{ fontSize: 12, color: "var(--a-off)" }}>{uploadedCount} of {total} uploaded</span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${total ? (uploadedCount / total) * 100 : 0}%`, height: "100%", background: "var(--a-orange)" }} />
        </div>
      </div>

      {deliverables.map((d) => {
        const hasFile = !!d.media;
        const busy = busySlot === d.slot;
        const isVideo = d.media?.type === "video";
        return (
          <div key={d.id} style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div className="a-d" style={{ fontSize: 15, flex: 1, color: "var(--a-off)" }}>{slotLabel(d.slot).toUpperCase()}</div>
              {hasFile && (
                <span className="a-pill a-pill-ok">{d.status === "changes_requested" ? "Re-upload" : "Uploaded"}</span>
              )}
            </div>

            {hasFile ? (
              <div className="a-card" style={{ display: "flex", alignItems: "center", gap: 11, padding: 13, borderColor: "rgba(52,199,89,0.3)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 9, overflow: "hidden", flex: "none", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isVideo ? (
                    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "#fff" }}><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.media!.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--a-off)" }}>{slotLabel(d.slot)} {isVideo ? "video" : "image"}</div>
                  <div style={{ fontSize: 11, color: "rgba(250,248,245,0.5)" }}>{busy ? "Uploading…" : "Ready"}</div>
                </div>
                <label style={{ fontSize: 11, color: "var(--a-orange)", cursor: "pointer" }}>
                  {busy ? "…" : "Replace"}
                  <input type="file" accept={acceptFor(d.slot)} style={{ display: "none" }} disabled={busy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(d, f); }} />
                </label>
              </div>
            ) : (
              <label style={{ display: "block", border: "1.5px dashed rgba(255,255,255,0.24)", borderRadius: 14, padding: "26px 14px", textAlign: "center", cursor: busy ? "wait" : "pointer" }}>
                <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, stroke: "rgba(250,248,245,0.7)", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M12 16V6M8 10l4-4 4 4" /><path d="M5 18h14" />
                </svg>
                <div style={{ fontSize: 13, color: "var(--a-off)", marginTop: 8 }}>{busy ? "Uploading…" : `Tap to upload your ${slotLabel(d.slot).toLowerCase()}`}</div>
                <div style={{ fontSize: 11, color: "rgba(250,248,245,0.45)", marginTop: 3 }}>{d.slot === "reel" ? "MP4 or MOV · up to 500 MB" : "JPG or PNG"}</div>
                <input type="file" accept={acceptFor(d.slot)} style={{ display: "none" }} disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(d, f); }} />
              </label>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 11 }}>
        <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: "rgba(250,248,245,0.6)", strokeWidth: 2, fill: "none", flex: "none", marginTop: 1 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 8v.5M12 11v5" />
        </svg>
        <span style={{ fontSize: 12, lineHeight: 1.45, color: "rgba(250,248,245,0.7)" }}>
          Postgame and the brand review your content before you post. You&rsquo;ll get a notification the moment it&rsquo;s approved.
        </span>
      </div>

      {error && <div className="a-err">{error}</div>}

      <button className="a-cta" onClick={submitForApproval} disabled={!allUploaded || submitting}>
        <span className="a-d" style={{ fontSize: 18 }}>{submitting ? "SUBMITTING…" : "SUBMIT FOR APPROVAL"}</span>
      </button>
      {!allUploaded && (
        <div style={{ fontSize: 11, color: "rgba(250,248,245,0.4)", textAlign: "center" }}>Upload all {total} deliverables to submit.</div>
      )}
    </div>
  );
}
