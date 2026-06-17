"use client";

// Public videographer uploader. For each deliverable slot: pick a file →
// (1) get a signed upload URL from /api/v/upload-url, (2) upload straight to
// Supabase Storage via uploadToSignedUrl (no session, handles big reels),
// (3) register it on the deliverable via /api/v/register. Mirrors the athlete
// upload screen but has no submit-for-approval step.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

type Deliv = {
  id: string;
  slot: string;
  status: string;
  file_url?: string | null;
  media_type?: string | null;
};

function slotLabel(slot: string) {
  if (slot === "feed") return "Feed post";
  if (slot === "reel") return "Reel";
  if (slot === "story") return "Story";
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}
function acceptFor(slot: string) {
  if (slot === "reel") return "video/*";
  if (slot === "feed") return "image/*";
  return "image/*,video/*";
}

export default function VideographerUpload({ token, deliverables }: { token: string; deliverables: Deliv[] }) {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [doneSlots, setDoneSlots] = useState<Set<string>>(new Set());

  async function handleFile(slot: string, file: File) {
    setError("");
    setBusySlot(slot);
    try {
      // 1) signed upload URL
      const r1 = await fetch("/api/v/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slot, fileName: file.name, contentType: file.type, fileSize: file.size }),
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1.error || "Couldn't start the upload.");

      // 2) upload straight to storage (no session needed)
      const { error: upErr } = await supabase.storage
        .from(j1.bucket)
        .uploadToSignedUrl(j1.path, j1.token, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;

      // 3) register on the deliverable
      const r2 = await fetch("/api/v/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slot, path: j1.path, contentType: file.type, fileSize: file.size }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2.error || "Couldn't save your upload.");

      setDoneSlots((s) => new Set(s).add(slot));
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 13 }}>
      {deliverables.map((d) => {
        const busy = busySlot === d.slot;
        const hasFile = !!d.file_url || doneSlots.has(d.slot);
        const isVideo = d.media_type === "video" || d.slot === "reel";
        return (
          <div key={d.id} style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div className="a-d" style={{ fontSize: 15, flex: 1, color: "var(--a-off)" }}>{slotLabel(d.slot).toUpperCase()}</div>
              {hasFile && <span className="a-pill a-pill-ok">Uploaded</span>}
            </div>

            {hasFile && !busy ? (
              <div className="a-card" style={{ display: "flex", alignItems: "center", gap: 11, padding: 13, borderColor: "rgba(52,199,89,0.3)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 9, overflow: "hidden", flex: "none", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {!isVideo && d.file_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.file_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "#fff" }}><path d="M8 5v14l11-7z" /></svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--a-off)" }}>{slotLabel(d.slot)} {isVideo ? "video" : "image"} received</div>
                  <div style={{ fontSize: 11, color: "rgba(250,248,245,0.5)" }}>Postgame will review it</div>
                </div>
                <label style={{ fontSize: 11, color: "var(--a-orange)", cursor: "pointer" }}>
                  Replace
                  <input type="file" accept={acceptFor(d.slot)} style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(d.slot, f); }} />
                </label>
              </div>
            ) : (
              <label style={{ display: "block", border: "1.5px dashed rgba(255,255,255,0.24)", borderRadius: 14, padding: "26px 14px", textAlign: "center", cursor: busy ? "wait" : "pointer" }}>
                <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, stroke: "rgba(250,248,245,0.7)", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M12 16V6M8 10l4-4 4 4" /><path d="M5 18h14" />
                </svg>
                <div style={{ fontSize: 13, color: "var(--a-off)", marginTop: 8 }}>{busy ? "Uploading…" : `Tap to upload the ${slotLabel(d.slot).toLowerCase()}`}</div>
                <div style={{ fontSize: 11, color: "rgba(250,248,245,0.45)", marginTop: 3 }}>{d.slot === "reel" ? "MP4 or MOV · up to 500 MB" : "JPG or PNG · up to 50 MB"}</div>
                <input type="file" accept={acceptFor(d.slot)} style={{ display: "none" }} disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(d.slot, f); }} />
              </label>
            )}
          </div>
        );
      })}

      {error && <div className="a-err">{error}</div>}
    </div>
  );
}
