// src/app/submit/[token]/page.tsx
// ─────────────────────────────────────────────────────────────
// PUBLIC athlete content upload page. No login. Design: Postgame
// "floating glass sheet" (variant G / G2), Liquid Glass Dark.
//
// Every translucent surface is off-white (#FAF8F5) at low alpha over the
// #07070A ground — never a grey hex. Type: Bebas Neue (display), Arimo
// (body), JetBrains Mono (labels). No internal "Tier 3" language.
//
// Upload logic (resumable relay through /api/submit/[token]) is unchanged —
// this file is a styling pass plus per-row retry.
// ─────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Arimo } from "next/font/google";

const arimo = Arimo({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-arimo",
  display: "swap",
});

// 4MB chunks (a multiple of 256KB per Google's resumable protocol, and under
// Vercel's ~4.5MB request-body cap since each chunk is relayed through our own
// route — Google's session URL has no CORS, so the browser can't PUT directly).
const CHUNK_SIZE = 4 * 1024 * 1024;

interface LinkConfig {
  campaignName: string;
  brandName: string | null;
  minPhotos: number;
  minVideos: number;
  maxFiles: number;
  postgameLogoUrl: string | null;
  clientLogoUrl: string | null;
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
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Resumable upload, RELAYED through our own route (Drive session has no CORS) ──

type ChunkResult = { done: boolean; fileId?: string | null; rangeEnd?: number | null };

function relayChunk(
  token: string,
  sessionUrl: string,
  blob: Blob,
  range: string,
  onLoaded: (loaded: number) => void
): Promise<ChunkResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/submit/${encodeURIComponent(token)}?action=chunk`, true);
    xhr.setRequestHeader("x-goog-session", sessionUrl);
    xhr.setRequestHeader("x-goog-range", range);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as ChunkResult);
        } catch {
          reject(new Error("Unexpected server response"));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const b = JSON.parse(xhr.responseText);
          if (b?.error) msg = b.error;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network interrupted"));
    xhr.send(blob);
  });
}

async function resumableUpload(
  token: string,
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
      const r = await relayChunk(
        token,
        sessionUrl,
        file.slice(offset, end),
        `bytes ${offset}-${end - 1}/${total}`,
        (loaded) => onProgress(Math.min((base + loaded) / total, 0.999))
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
      // Re-sync the offset from the session before retrying this chunk.
      const q = await relayChunk(token, sessionUrl, new Blob([]), `bytes */${total}`, () => {});
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

// ── Design tokens ─────────────────────────────────────────────
const OFF = "#FAF8F5";
const ORANGE = "#D73F09";
const off = (a: number) => `rgba(250,248,245,${a})`;
const orange = (a: number) => `rgba(215,63,9,${a})`;
const MONO = "var(--font-mono), monospace";
const BODY = "var(--font-arimo), Arial, sans-serif";

type Phase = "form" | "uploading" | "partial" | "done";

// ── Page ──────────────────────────────────────────────────────

export default function SubmitPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [config, setConfig] = useState<LinkConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deadLogo, setDeadLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [school, setSchool] = useState("");

  const [files, setFiles] = useState<Picked[]>([]);
  const [phase, setPhase] = useState<Phase>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Resolve the link → campaign name, branding + requirements.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/submit/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setDeadLogo(body.postgameLogoUrl ?? null);
          throw new Error(body.error || "This upload link isn't active.");
        }
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

  useEffect(() => {
    return () => {
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conclude the upload pass once nothing is queued/uploading anymore.
  useEffect(() => {
    if (phase !== "uploading") return;
    if (files.length === 0) return;
    const active = files.some((f) => f.status === "uploading" || f.status === "queued");
    if (active) return;
    setPhase(files.every((f) => f.status === "done") ? "done" : "partial");
  }, [files, phase]);

  const photoCount = files.filter((f) => f.kind === "photo").length;
  const videoCount = files.filter((f) => f.kind === "video").length;
  const locked = phase !== "form";

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!config) return;
      setSubmitError(null);
      setFiles((prev) => {
        const room = config.maxFiles - prev.length;
        if (room <= 0) return prev;
        const next = [...prev];
        for (const file of incoming.slice(0, room)) {
          const kind = classify(file);
          next.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            kind,
            previewUrl:
              kind === "photo" && file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
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

  const fieldsFilled = firstName.trim() && lastName.trim() && igHandle.trim() && school.trim();
  const meetsPhotos = config ? photoCount >= config.minPhotos : false;
  const meetsVideos = config ? videoCount >= config.minVideos : false;
  const canSubmit = !!fieldsFilled && files.length > 0 && meetsPhotos && meetsVideos && phase === "form";
  const hasFailed = files.some((f) => f.status === "error");

  const setProgress = (id: string, fraction: number) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: fraction } : f)));
  const setFileStatus = (id: string, status: Picked["status"], error?: string) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, error } : f)));

  // Upload (or re-upload) a set of files: mint sessions for just those, then
  // relay + finalize each. The completion effect flips phase when it settles.
  const runUpload = async (targets: Picked[]) => {
    if (!token || targets.length === 0) return;
    setPhase("uploading");
    setSubmitError(null);
    const targetIds = new Set(targets.map((t) => t.id));
    setFiles((prev) =>
      prev.map((f) => (targetIds.has(f.id) ? { ...f, status: "uploading", progress: 0, error: undefined } : f))
    );

    const who = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      igHandle: igHandle.trim(),
      school: school.trim(),
    };

    let sessionByClient: Record<string, string> = {};
    try {
      const initRes = await fetch(`/api/submit/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init",
          ...who,
          files: targets.map((f) => ({
            clientId: f.id,
            name: f.file.name,
            mimeType: f.file.type,
            size: f.file.size,
          })),
        }),
      });
      const initBody = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(initBody.error || "Couldn't start the upload.");
      for (const u of initBody.uploads ?? []) sessionByClient[u.clientId] = u.sessionUrl;
    } catch (e: any) {
      setFiles((prev) =>
        prev.map((f) => (targetIds.has(f.id) ? { ...f, status: "error", error: e.message } : f))
      );
      return;
    }

    for (const f of targets) {
      const sessionUrl = sessionByClient[f.id];
      if (!sessionUrl) {
        setFileStatus(f.id, "error", "No upload slot");
        continue;
      }
      setFileStatus(f.id, "uploading");
      try {
        const fileId = await resumableUpload(token, f.file, sessionUrl, (frac) => setProgress(f.id, frac));
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
      }
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    runUpload(files);
  };
  const retryFile = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (f) runUpload([f]);
  };
  const retryFailed = () => runUpload(files.filter((f) => f.status === "error"));

  // ── States ──
  if (loading) {
    return (
      <Shell arimoVar={arimo.variable}>
        <div style={{ fontFamily: MONO, color: off(0.45), fontSize: 11, letterSpacing: "0.1em" }}>
          LOADING…
        </div>
      </Shell>
    );
  }

  if (loadError || !config) {
    // Dead link — minimal, leaks nothing.
    return (
      <Shell arimoVar={arimo.variable}>
        <BrandMarks postgame={deadLogo} client={null} />
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div className="d" style={{ fontSize: 40, lineHeight: 0.88, color: OFF }}>
            LINK UNAVAILABLE
          </div>
          <div style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.52, color: off(0.6), marginTop: 12 }}>
            This upload link isn&apos;t active.
          </div>
        </div>
      </Shell>
    );
  }

  const chip = [config.brandName, config.campaignName].filter(Boolean).join(" · ").toUpperCase();
  const reqSub = `${config.minPhotos} PHOTO${config.minPhotos === 1 ? "" : "S"} + ${config.minVideos} VIDEO${config.minVideos === 1 ? "" : "S"}`;

  if (phase === "done") {
    return (
      <Shell arimoVar={arimo.variable}>
        <BrandMarks postgame={config.postgameLogoUrl} client={config.clientLogoUrl} />
        <Sheet>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: orange(0.14),
              border: `1px solid ${orange(0.5)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ORANGE,
              fontSize: 26,
            }}
          >
            ✓
          </div>
          <div className="d" style={{ fontSize: 40, lineHeight: 0.88, color: OFF, textAlign: "center" }}>
            YOU&apos;RE ALL SET
          </div>
          <div style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.52, color: off(0.6), textAlign: "center" }}>
            Thanks, {firstName.trim()} — {files.length} file{files.length === 1 ? "" : "s"} uploaded for{" "}
            <span style={{ color: OFF }}>{config.campaignName}</span>.
          </div>
          <div style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.52, color: off(0.45), textAlign: "center" }}>
            Forgot something? Open this link again and add more. Your files stay together.
          </div>
        </Sheet>
      </Shell>
    );
  }

  return (
    <Shell arimoVar={arimo.variable}>
      <style>{`
        .pg-in:focus { border-color: ${orange(0.55)} !important; background: ${off(0.09)} !important; }
        .pg-in::placeholder { color: ${off(0.36)}; }
        .pg-drop.over { border-color: ${orange(0.6)} !important; background: ${orange(0.06)} !important; }
      `}</style>

      <BrandMarks postgame={config.postgameLogoUrl} client={config.clientLogoUrl} />

      <Sheet>
        {/* Campaign chip */}
        <div
          style={{
            borderRadius: 999,
            background: orange(0.14),
            border: `1px solid ${orange(0.4)}`,
            padding: "7px 14px",
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 9,
            letterSpacing: "0.12em",
            color: ORANGE,
          }}
        >
          {chip}
        </div>

        {/* Headline */}
        <div className="d" style={{ fontSize: 40, lineHeight: 0.88, color: OFF, textAlign: "center" }}>
          SUBMIT YOUR CONTENT
        </div>

        {/* Intro */}
        <div style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.52, color: off(0.6), textAlign: "center" }}>
          Photos and videos for this campaign. Originals, not screenshots.
        </div>

        {/* Fields */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, marginTop: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="FIRST NAME" value={firstName} onChange={setFirstName} placeholder="First" disabled={locked} />
            <Field label="LAST NAME" value={lastName} onChange={setLastName} placeholder="Last" disabled={locked} />
          </div>
          <Field label="INSTAGRAM HANDLE" value={igHandle} onChange={setIgHandle} placeholder="@yourhandle" disabled={locked} />
          <Field label="SCHOOL" value={school} onChange={setSchool} placeholder="Your school" disabled={locked} />
        </div>

        {/* Drop zone */}
        <div
          className={`pg-drop${dragOver ? " over" : ""}`}
          onClick={() => !locked && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = Array.from(e.dataTransfer.files);
            if (!locked && dropped.length) addFiles(dropped);
          }}
          style={{
            width: "100%",
            borderRadius: 18,
            border: `1px dashed ${off(0.18)}`,
            padding: "32px 16px",
            textAlign: "center",
            cursor: locked ? "default" : "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
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
              const picked = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              if (picked.length) addFiles(picked);
            }}
          />
          <div className="d" style={{ fontSize: 22, color: OFF }}>
            ADD YOUR CONTENT
          </div>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 9, letterSpacing: "0.1em", color: off(0.45) }}>
            {reqSub}
          </div>
        </div>

        {/* Requirement pills */}
        {files.length > 0 && (
          <div style={{ width: "100%", display: "flex", gap: 8 }}>
            <ReqPill label={`${photoCount}/${config.minPhotos} PHOTOS`} met={meetsPhotos} />
            <ReqPill label={`${videoCount}/${config.minVideos} VIDEO${config.minVideos === 1 ? "" : "S"}`} met={meetsVideos} />
          </div>
        )}

        {/* File rows */}
        {files.length > 0 && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f) => (
              <FileRow
                key={f.id}
                f={f}
                canRemove={phase === "form"}
                onRemove={() => removeFile(f.id)}
                onRetry={() => retryFile(f.id)}
              />
            ))}
          </div>
        )}

        {/* Partial-failure / error message — on-palette, no colour */}
        {phase === "partial" && (
          <div style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.5, color: off(0.72), textAlign: "center" }}>
            Some files didn&apos;t upload. Retry the ones marked below.
          </div>
        )}
        {submitError && (
          <div style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.5, color: off(0.72), textAlign: "center" }}>
            {submitError}
          </div>
        )}

        {/* Submit / retry */}
        {phase === "partial" ? (
          <SubmitButton label="RETRY FAILED" enabled={hasFailed} onClick={retryFailed} />
        ) : (
          <SubmitButton
            label={phase === "uploading" ? "UPLOADING…" : "SUBMIT CONTENT"}
            enabled={canSubmit}
            onClick={handleSubmit}
          />
        )}
      </Sheet>
    </Shell>
  );
}

// ── Presentational pieces ─────────────────────────────────────

function Shell({ children, arimoVar }: { children: React.ReactNode; arimoVar?: string }) {
  return (
    <div
      className={`pg-submit ${arimoVar ?? ""}`}
      style={{
        minHeight: "100vh",
        background: "#07070A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 26,
        padding: "46px 20px 34px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        {children}
      </div>
    </div>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        background: off(0.055),
        border: `1px solid ${off(0.13)}`,
        borderRadius: 24,
        padding: "30px 22px 26px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

function BrandMarks({ postgame, client }: { postgame: string | null; client: string | null }) {
  if (!postgame && !client) return null;
  return (
    <>
      <style>{`
        .pg-client-logo { max-width: 70px; max-height: 18px; width: auto; height: auto; object-fit: contain; }
        @media (min-width: 640px) { .pg-client-logo { max-width: 84px; max-height: 22px; } }
      `}</style>
      {/* Horizontal lockup: Postgame wordmark · 1px divider · client mark,
          all bare on the black ground (no plate). Divider only when both show. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {postgame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={postgame} alt="Postgame" width={122} height={25} style={{ width: 122, height: 25, objectFit: "contain" }} />
        )}
        {postgame && client && <div style={{ width: 1, height: 22, background: off(0.16) }} />}
        {client && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client} alt="" className="pg-client-logo" />
        )}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontFamily: MONO, fontWeight: 500, fontSize: 9, letterSpacing: "0.12em", color: off(0.45) }}>
        {label}
      </label>
      <input
        className="pg-in"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          height: 48,
          borderRadius: 999,
          paddingLeft: 18,
          paddingRight: 14,
          background: off(0.06),
          border: `1px solid ${off(0.13)}`,
          color: OFF,
          fontFamily: BODY,
          fontSize: 16,
          outline: "none",
          width: "100%",
        }}
      />
    </div>
  );
}

function ReqPill({ label, met }: { label: string; met: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        borderRadius: 999,
        padding: "8px 0",
        border: `1px solid ${met ? orange(0.5) : off(0.14)}`,
        color: met ? ORANGE : off(0.45),
        fontFamily: MONO,
        fontWeight: 500,
        fontSize: 9,
        letterSpacing: "0.06em",
      }}
    >
      {label}
    </div>
  );
}

function FileRow({
  f,
  canRemove,
  onRemove,
  onRetry,
}: {
  f: Picked;
  canRemove: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const failed = f.status === "error";
  const pct = Math.round(f.progress * 100);
  const statusText =
    f.status === "uploading"
      ? `${pct}% · ${humanSize(f.progress * f.file.size)} OF ${humanSize(f.file.size)}`
      : f.status === "done"
        ? "UPLOADED"
        : failed
          ? "UPLOAD FAILED"
          : `${f.kind.toUpperCase()} · ${humanSize(f.file.size)}`;
  // Failed status is stated at full contrast (not coloured) — orange is
  // reserved for the RETRY the athlete should tap. Rule 5: orange = destination.
  const statusColor = f.status === "done" ? orange(0.9) : failed ? OFF : off(0.45);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px 10px 10px",
        borderRadius: 14,
        background: off(0.05),
        // Brighter border (not colour) is what marks a failed row as different.
        border: `1px solid ${failed ? off(0.28) : off(0.1)}`,
      }}
    >
      {/* Thumb */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          flex: "0 0 auto",
          background: off(0.1),
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: off(0.45),
          fontSize: 15,
        }}
      >
        {f.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          "▶"
        )}
      </div>

      {/* Name + progress + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: BODY,
            fontSize: 15,
            color: OFF,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {f.file.name}
        </div>
        {f.status === "uploading" && (
          <div style={{ height: 4, borderRadius: 999, background: off(0.1), margin: "6px 0", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: ORANGE, transition: "width .2s" }} />
          </div>
        )}
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 9, letterSpacing: "0.04em", color: statusColor, marginTop: f.status === "uploading" ? 0 : 3 }}>
          {statusText}
        </div>
      </div>

      {/* Trailing action */}
      <div style={{ flex: "0 0 auto" }}>
        {failed ? (
          <button
            onClick={onRetry}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: ORANGE,
              fontFamily: MONO,
              fontWeight: 500,
              fontSize: 9,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            RETRY
          </button>
        ) : f.status === "done" ? (
          <span style={{ color: ORANGE, fontSize: 15 }}>✓</span>
        ) : canRemove ? (
          <button
            onClick={onRemove}
            aria-label="Remove"
            style={{ background: "none", border: "none", color: off(0.36), cursor: "pointer", fontSize: 16 }}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SubmitButton({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        width: "100%",
        borderRadius: 999,
        padding: "19px 0",
        border: "none",
        background: enabled ? ORANGE : off(0.08),
        color: enabled ? OFF : off(0.3),
        fontFamily: MONO,
        fontWeight: 500,
        fontSize: 11,
        letterSpacing: "0.12em",
        cursor: enabled ? "pointer" : "not-allowed",
        transition: "background .2s, color .2s",
      }}
    >
      {label}
    </button>
  );
}
