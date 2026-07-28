// src/app/submit/[token]/page.tsx
// ─────────────────────────────────────────────────────────────
// PUBLIC athlete content upload page. No login. The athlete opens a
// tokenized link, enters their details, and drops up to max_files
// photos/videos. Files upload straight to Google Drive via a
// server-minted resumable session (chunked + resume-on-drop, built for
// 100–300MB video on campus wifi), then each is finalized server-side.
//
// Design: Postgame Liquid Glass Dark (globals.css tokens). This page is
// athlete-facing — no internal language ("Tier 3") appears anywhere.
// ─────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

// 16MB chunks (a multiple of 256KB, as Google's resumable protocol requires).
const CHUNK_SIZE = 16 * 1024 * 1024;

interface LinkConfig {
  campaignName: string;
  minPhotos: number;
  minVideos: number;
  maxFiles: number;
}

type FileKind = "photo" | "video";

interface Picked {
  id: string;
  file: File;
  kind: FileKind;
  previewUrl: string | null;
  progress: number; // 0..1
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

function classify(file: File): FileKind {
  if (file.type.startsWith("video/")) return "video";
  // Some browsers report an empty type for HEIC — treat by extension.
  return "photo";
}

function humanSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Resumable upload to a Drive session URL (chunked, resume-on-drop) ──

function putChunk(
  sessionUrl: string,
  blob: Blob,
  start: number,
  end: number,
  total: number,
  onLoaded: (loaded: number) => void
): Promise<{ done: boolean; fileId?: string | null; rangeEnd?: number | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl, true);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${total}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        let fileId: string | null = null;
        try {
          fileId = JSON.parse(xhr.responseText).id ?? null;
        } catch {
          /* ignore — parent verification will still catch a bad id */
        }
        resolve({ done: true, fileId });
      } else if (xhr.status === 308) {
        const range = xhr.getResponseHeader("Range");
        const m = range?.match(/bytes=0-(\d+)/);
        resolve({ done: false, rangeEnd: m ? parseInt(m[1], 10) : null });
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network interrupted"));
    xhr.send(blob);
  });
}

// Ask the session how many bytes it already has, so we can resume.
function queryOffset(
  sessionUrl: string,
  total: number
): Promise<{ done: boolean; fileId?: string | null; rangeEnd?: number | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl, true);
    xhr.setRequestHeader("Content-Range", `bytes */${total}`);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        let fileId: string | null = null;
        try {
          fileId = JSON.parse(xhr.responseText).id ?? null;
        } catch {
          /* ignore */
        }
        resolve({ done: true, fileId });
      } else if (xhr.status === 308) {
        const range = xhr.getResponseHeader("Range");
        const m = range?.match(/bytes=0-(\d+)/);
        resolve({ done: false, rangeEnd: m ? parseInt(m[1], 10) : null });
      } else {
        reject(new Error(`Resume check failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network interrupted"));
    xhr.send(null);
  });
}

async function resumableUpload(
  file: File,
  sessionUrl: string,
  onProgress: (fraction: number) => void
): Promise<string> {
  const total = file.size;
  if (total === 0) throw new Error("File is empty");
  let offset = 0;
  let attempts = 0;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    try {
      const base = offset;
      const r = await putChunk(sessionUrl, file.slice(offset, end), offset, end, total, (loaded) =>
        onProgress(Math.min((base + loaded) / total, 0.999))
      );
      attempts = 0;
      if (r.done) {
        onProgress(1);
        if (!r.fileId) throw new Error("Upload finished without a file id");
        return r.fileId;
      }
      offset = r.rangeEnd != null ? r.rangeEnd + 1 : end;
      onProgress(offset / total);
    } catch (err) {
      attempts++;
      if (attempts > 5) throw err;
      await sleep(1000 * attempts);
      // Re-sync from the server before retrying this chunk.
      const q = await queryOffset(sessionUrl, total);
      if (q.done) {
        onProgress(1);
        if (!q.fileId) throw new Error("Upload finished without a file id");
        return q.fileId;
      }
      if (q.rangeEnd != null) offset = q.rangeEnd + 1;
    }
  }
  throw new Error("Upload did not complete");
}

// ── Page ──────────────────────────────────────────────────────

export default function SubmitPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [config, setConfig] = useState<LinkConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [school, setSchool] = useState("");

  const [files, setFiles] = useState<Picked[]>([]);
  const [phase, setPhase] = useState<"form" | "uploading" | "done">("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Resolve the link → campaign name + requirements.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/submit/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "This upload link isn't valid.");
        if (!cancelled) setConfig(body);
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photoCount = files.filter((f) => f.kind === "photo").length;
  const videoCount = files.filter((f) => f.kind === "video").length;

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (!config) return;
      // Snapshot on entry — never read a (possibly live) FileList inside the
      // deferred setFiles updater, which runs AFTER the caller's event handler
      // (e.g. after an input's value="" reset would have emptied it).
      const list = Array.from(incoming);
      setSubmitError(null);
      setFiles((prev) => {
        const room = config.maxFiles - prev.length;
        if (room <= 0) return prev;
        const next = [...prev];
        for (const file of list.slice(0, room)) {
          const kind = classify(file);
          next.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            kind,
            previewUrl: kind === "photo" && file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
            progress: 0,
            status: "queued",
          });
        }
        return next;
      });
    },
    [config]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const fieldsFilled =
    firstName.trim() && lastName.trim() && igHandle.trim() && school.trim();
  const meetsPhotos = config ? photoCount >= config.minPhotos : false;
  const meetsVideos = config ? videoCount >= config.minVideos : false;
  const canSubmit =
    !!fieldsFilled && files.length > 0 && meetsPhotos && meetsVideos && phase === "form";

  const setProgress = (id: string, fraction: number) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: fraction } : f)));
  const setFileStatus = (id: string, status: Picked["status"], error?: string) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, error } : f)));

  const handleSubmit = async () => {
    if (!token || !config || !canSubmit) return;
    setPhase("uploading");
    setSubmitError(null);

    const who = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      igHandle: igHandle.trim(),
      school: school.trim(),
    };

    try {
      // 1. Mint a resumable session per file.
      const initRes = await fetch(`/api/submit/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init",
          ...who,
          files: files.map((f) => ({
            clientId: f.id,
            name: f.file.name,
            mimeType: f.file.type,
            size: f.file.size,
          })),
        }),
      });
      const initBody = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(initBody.error || "Couldn't start the upload.");

      const sessionByClient: Record<string, string> = {};
      for (const u of initBody.uploads ?? []) sessionByClient[u.clientId] = u.sessionUrl;

      // 2. Upload sequentially (kinder to campus wifi), finalize each.
      let anyFailed = false;
      for (const f of files) {
        const sessionUrl = sessionByClient[f.id];
        if (!sessionUrl) {
          setFileStatus(f.id, "error", "No upload slot");
          anyFailed = true;
          continue;
        }
        setFileStatus(f.id, "uploading");
        try {
          const fileId = await resumableUpload(f.file, sessionUrl, (frac) => setProgress(f.id, frac));
          const finRes = await fetch(`/api/submit/${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "finalize", ...who, fileId }),
          });
          if (!finRes.ok) {
            const b = await finRes.json().catch(() => ({}));
            throw new Error(b.error || "Couldn't save the file.");
          }
          setFileStatus(f.id, "done");
          setProgress(f.id, 1);
        } catch (e: any) {
          setFileStatus(f.id, "error", e.message || "Upload failed");
          anyFailed = true;
        }
      }

      if (anyFailed) {
        setSubmitError("Some files didn't finish. Fix the ones marked in red and submit again.");
        setPhase("form");
      } else {
        setPhase("done");
      }
    } catch (e: any) {
      setSubmitError(e.message || "Something went wrong. Please try again.");
      setPhase("form");
    }
  };

  // ── Styles (Liquid Glass Dark tokens from globals.css) ──
  const mono: React.CSSProperties = { fontFamily: "var(--font-mono), monospace" };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: "var(--r-sm)",
    padding: "13px 15px",
    color: "var(--text)",
    fontSize: 15,
    fontFamily: "Arial, sans-serif",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    ...mono,
    fontSize: 10.5,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-3)",
    marginBottom: 7,
    display: "block",
  };

  // ── States ──
  if (loading) {
    return (
      <Shell>
        <div style={{ ...mono, color: "var(--text-3)", fontSize: 12, letterSpacing: "0.1em" }}>
          LOADING…
        </div>
      </Shell>
    );
  }

  if (loadError || !config) {
    return (
      <Shell>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div className="d" style={{ fontSize: 40, marginBottom: 10 }}>
            LINK UNAVAILABLE
          </div>
          <div style={{ color: "var(--text-3)", fontSize: 14 }}>{loadError}</div>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    const total = files.length;
    return (
      <Shell>
        <div className="glass" style={{ maxWidth: 520, width: "100%", padding: 40, textAlign: "center", borderRadius: "var(--r-lg)" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--orange-dim)",
              border: "1.5px solid var(--orange)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              color: "var(--orange)",
              fontSize: 30,
            }}
          >
            ✓
          </div>
          <div className="d" style={{ fontSize: 44, lineHeight: 0.95, marginBottom: 12 }}>
            YOU&apos;RE ALL SET
          </div>
          <div style={{ color: "var(--text-2)", fontSize: 15, lineHeight: 1.5 }}>
            Thanks, {firstName.trim()} — {total} file{total === 1 ? "" : "s"} uploaded for{" "}
            <span style={{ color: "var(--text)" }}>{config.campaignName}</span>. Our team takes it from here.
          </div>
        </div>
      </Shell>
    );
  }

  const busy = phase === "uploading";

  return (
    <Shell>
      <style>{`
        .sub-input:focus { border-color: var(--orange) !important; background: var(--glass-bg-2) !important; }
        .sub-input::placeholder { color: var(--text-4); }
        .drop-zone.over { border-color: var(--orange) !important; background: var(--orange-dim) !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 720 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--orange)" }}>
            {config.campaignName}
          </div>
          <div className="d" style={{ fontSize: 52, lineHeight: 0.92, marginTop: 8 }}>
            SUBMIT YOUR CONTENT
          </div>
          <div style={{ color: "var(--text-3)", fontSize: 14, marginTop: 10, lineHeight: 1.5, maxWidth: 480 }}>
            Add your best photos and videos from the shoot. Upload up to {config.maxFiles} files —
            at least {config.minPhotos} photo{config.minPhotos === 1 ? "" : "s"} and {config.minVideos}{" "}
            video{config.minVideos === 1 ? "" : "s"}.
          </div>
        </div>

        {/* Details */}
        <div className="glass" style={{ padding: 22, borderRadius: "var(--r-md)", marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input className="sub-input" style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={busy} placeholder="First" />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input className="sub-input" style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={busy} placeholder="Last" />
            </div>
            <div>
              <label style={labelStyle}>Instagram Handle</label>
              <input className="sub-input" style={inputStyle} value={igHandle} onChange={(e) => setIgHandle(e.target.value)} disabled={busy} placeholder="@yourhandle" />
            </div>
            <div>
              <label style={labelStyle}>School</label>
              <input className="sub-input" style={inputStyle} value={school} onChange={(e) => setSchool(e.target.value)} disabled={busy} placeholder="Your school" />
            </div>
          </div>
        </div>

        {/* Dropzone */}
        <div
          className={`drop-zone glass${dragOver ? " over" : ""}`}
          onClick={() => !busy && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            // Snapshot to an array — dataTransfer.files is a live collection and
            // addFiles reads it later inside a setFiles updater (see onChange note).
            const dropped = Array.from(e.dataTransfer.files);
            if (!busy && dropped.length) addFiles(dropped);
          }}
          style={{
            borderRadius: "var(--r-md)",
            border: "1.5px dashed var(--glass-border)",
            padding: "34px 22px",
            textAlign: "center",
            cursor: busy ? "default" : "pointer",
            marginBottom: 18,
            transition: "border-color .2s, background .2s",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.heic,.heif"
            style={{ display: "none" }}
            onChange={(e) => {
              // Snapshot to a real array BEFORE clearing the input — e.target.files
              // is a *live* FileList, and addFiles reads it later inside a setFiles
              // updater. Clearing value="" would empty it before that read.
              const picked = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              if (picked.length) addFiles(picked);
            }}
          />
          <div className="d" style={{ fontSize: 24, color: "var(--text-2)" }}>
            DROP FILES OR TAP TO BROWSE
          </div>
          <div style={{ ...mono, fontSize: 11, color: "var(--text-4)", marginTop: 8, letterSpacing: "0.05em" }}>
            PHOTOS &amp; VIDEOS · UP TO {config.maxFiles} FILES · LARGE VIDEO OK
          </div>
        </div>

        {/* Requirement meter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <Req label={`${photoCount}/${config.minPhotos} photos`} met={meetsPhotos} />
          <Req label={`${videoCount}/${config.minVideos} video${config.minVideos === 1 ? "" : "s"}`} met={meetsVideos} />
          <Req label={`${files.length}/${config.maxFiles} files`} met={files.length <= config.maxFiles && files.length > 0} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {files.map((f) => (
              <div
                key={f.id}
                className="glass-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  borderRadius: "var(--r-sm)",
                  border: f.status === "error" ? "1px solid rgba(255,80,80,.5)" : "1px solid var(--glass-border)",
                }}
              >
                {/* Thumb */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    flex: "0 0 auto",
                    background: "var(--glass-bg-2)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "var(--text-3)",
                  }}
                >
                  {f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : f.kind === "video" ? (
                    "▶"
                  ) : (
                    "🖼"
                  )}
                </div>

                {/* Name + progress */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.file.name}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: "var(--text-4)", marginTop: 2 }}>
                    {f.kind.toUpperCase()} · {humanSize(f.file.size)}
                    {f.status === "error" && f.error ? ` · ${f.error}` : ""}
                  </div>
                  {(f.status === "uploading" || f.status === "done") && (
                    <div style={{ height: 3, background: "var(--glass-border)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(f.progress * 100)}%`,
                          background: "var(--orange)",
                          transition: "width .2s",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Status / remove */}
                <div style={{ flex: "0 0 auto", ...mono, fontSize: 11, color: "var(--text-3)" }}>
                  {f.status === "done" ? (
                    <span style={{ color: "var(--orange)" }}>✓</span>
                  ) : f.status === "uploading" ? (
                    `${Math.round(f.progress * 100)}%`
                  ) : f.status === "error" ? (
                    <span style={{ color: "rgb(255,110,110)" }}>!</span>
                  ) : (
                    !busy && (
                      <button
                        onClick={() => removeFile(f.id)}
                        style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 16 }}
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {submitError && (
          <div style={{ ...mono, fontSize: 12, color: "rgb(255,120,120)", marginBottom: 14, lineHeight: 1.5 }}>
            {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="d"
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "var(--r-md)",
            border: "none",
            fontSize: 22,
            letterSpacing: "0.04em",
            cursor: canSubmit ? "pointer" : "not-allowed",
            color: canSubmit ? "#fff" : "var(--text-4)",
            background: canSubmit ? "var(--orange)" : "var(--glass-bg)",
            transition: "background .2s, color .2s",
          }}
        >
          {busy ? "UPLOADING…" : "SUBMIT CONTENT"}
        </button>
      </div>
    </Shell>
  );
}

// ── Small presentational bits ─────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 20px 80px",
      }}
    >
      {children}
    </div>
  );
}

function Req({ label, met }: { label: string; met: boolean }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "7px 12px",
        borderRadius: 8,
        border: `1px solid ${met ? "var(--orange)" : "var(--glass-border)"}`,
        color: met ? "var(--orange)" : "var(--text-3)",
        background: met ? "var(--orange-dim)" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>{met ? "✓" : "○"}</span>
      {label}
    </div>
  );
}
