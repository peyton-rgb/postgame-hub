// src/app/submit/[token]/page.tsx
// ─────────────────────────────────────────────────────────────
// PUBLIC athlete content upload page. No login.
//
// Design: the approved "orange section tabs" direction (submission-form-final.html,
// approved 30 Jul 2026). Light ground (#FAF8F5), white cards, full-width orange
// header tab per card. Type: Bebas Neue (display), Arimo (body), JetBrains Mono
// (labels). Palette is the three Postgame colours only.
//
// The upload pipeline (resumable relay through /api/submit/[token]) is UNCHANGED —
// this file is a re-skin plus six identity fields, two acknowledgements, and the
// parent `submissions` row write. No internal "Tier 3" language.
//
// Four states: FORM → UPLOADING → (PARTIAL) → DONE.
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
  briefUrl: string | null;
  deliverables: number | null;
  expiresAt: string | null;
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
  /** tier3_submissions.id returned by `finalize`, so we can link it to the
   *  parent `submissions` row once the whole submission lands. */
  rowId?: string;
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

// ── Design tokens (approved mockup) ───────────────────────────
const BLACK = "#07070A";
const ORANGE = "#D73F09";
const OFF = "#FAF8F5";
const ink = (a: number) => `rgba(7,7,10,${a})`;
const MONO = "var(--font-mono), monospace";
const BODY = "var(--font-arimo), Arial, sans-serif";

type Phase = "form" | "uploading" | "partial" | "done";

// "one" reads better than "1" in the intro sentence; everything else is numeric.
const spell = (n: number) => (n === 1 ? "one" : String(n));
const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatStamp(d: Date): string {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

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
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");

  // null until the chooser is answered — there is deliberately no default.
  // Some athletes have a videographer shoot their content, and who actually
  // shot it is cheap to capture now and impossible to recover later.
  const [submitterType, setSubmitterType] = useState<"athlete" | "videographer" | null>(null);
  const [vidName, setVidName] = useState("");
  const [vidIg, setVidIg] = useState("");
  const isVideographer = submitterType === "videographer";

  // Acknowledgements: the timestamp is captured at the moment of the tick,
  // not at submit time — that is what goes into submissions.ack_*_at.
  const [ackInstructionsAt, setAckInstructionsAt] = useState<string | null>(null);
  const [ackMusicAt, setAckMusicAt] = useState<string | null>(null);

  const [files, setFiles] = useState<Picked[]>([]);
  const [phase, setPhase] = useState<Phase>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recordFailed, setRecordFailed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
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

  // Don't let a 300MB upload be closed out from under the athlete silently.
  useEffect(() => {
    if (phase !== "uploading") return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [phase]);

  const photoCount = files.filter((f) => f.kind === "photo").length;
  const videoCount = files.filter((f) => f.kind === "video").length;
  const locked = phase !== "form";
  const readOnlyFields = phase === "done";

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

  // The athlete's identity is required either way — it's what the files file
  // under. Phone and email relax only for a videographer, who isn't expected to
  // hand over the athlete's contact details.
  const athleteCoreFilled =
    !!firstName.trim() && !!lastName.trim() && !!igHandle.trim() && !!school.trim();
  const fieldsFilled = isVideographer
    ? athleteCoreFilled && !!vidName.trim() && !!vidIg.trim()
    : athleteCoreFilled && !!phone.trim() && !!email.trim();
  const meetsPhotos = config ? photoCount >= config.minPhotos : false;
  const meetsVideos = config ? videoCount >= config.minVideos : false;
  const acked = !!ackInstructionsAt && !!ackMusicAt;
  const hasFailed = files.some((f) => f.status === "error");
  // Both acknowledgements AND both minimums, every time. The old Google Form
  // did not gate this and let a "NO" through.
  const canSubmit =
    fieldsFilled && acked && files.length > 0 && meetsPhotos && meetsVideos && phase === "form";

  const setProgress = (id: string, fraction: number) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: fraction } : f)));
  const setFileStatus = (id: string, status: Picked["status"], error?: string) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status, error } : f)));
  const setRowId = (id: string, rowId: string) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, rowId } : f)));

  // Write the parent `submissions` row, then stamp submission_id onto every
  // tier3_submissions row this upload produced. Runs once every file has landed.
  const recordSubmission = useCallback(
    async (rows: Picked[]) => {
      if (!token) return false;
      setRecording(true);
      setSubmitError(null);
      try {
        const res = await fetch(`/api/submit/${encodeURIComponent(token)}/submission`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            igHandle: igHandle.trim().replace(/^@+/, ""),
            phone: phone.replace(/\D/g, ""),
            school: school.trim(),
            email: email.trim(),
            submitterType: submitterType ?? "athlete",
            // Lowercased to match the server: this handle is the de-facto
            // videographer identity until the directory can be linked by id.
            videographerName: isVideographer ? vidName.trim() : null,
            videographerIg: isVideographer ? vidIg.trim().replace(/^@+/, "").toLowerCase() : null,
            ackInstructionsAt,
            ackMusicAt,
            fileRowIds: rows.map((r) => r.rowId).filter(Boolean),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Couldn't save your details.");
        setRecordFailed(false);
        setSubmittedAt(body.submittedAt ? new Date(body.submittedAt) : new Date());
        setPhase("done");
        return true;
      } catch (e: any) {
        setRecordFailed(true);
        setSubmitError(e.message || "Couldn't save your details.");
        return false;
      } finally {
        setRecording(false);
      }
    },
    [
      token,
      firstName,
      lastName,
      igHandle,
      phone,
      school,
      email,
      submitterType,
      isVideographer,
      vidName,
      vidIg,
      ackInstructionsAt,
      ackMusicAt,
    ]
  );

  // Conclude the upload pass once nothing is queued/uploading anymore.
  useEffect(() => {
    if (phase !== "uploading") return;
    if (files.length === 0) return;
    if (recording || recordFailed) return;
    const active = files.some((f) => f.status === "uploading" || f.status === "queued");
    if (active) return;
    if (files.every((f) => f.status === "done")) {
      void recordSubmission(files);
    } else {
      setPhase("partial");
    }
  }, [files, phase, recording, recordFailed, recordSubmission]);

  // Upload (or re-upload) a set of files: mint sessions for just those, then
  // relay + finalize each. The completion effect concludes the pass.
  const runUpload = async (targets: Picked[]) => {
    if (!token || targets.length === 0) return;
    setPhase("uploading");
    setSubmitError(null);
    setRecordFailed(false);
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
        const finBody = await finRes.json().catch(() => ({}));
        if (!finRes.ok) throw new Error(finBody.error || "Couldn't save the file.");
        if (finBody.submissionId) setRowId(f.id, String(finBody.submissionId));
        setFileStatus(f.id, "done");
        setProgress(f.id, 1);
      } catch (e: any) {
        setFileStatus(f.id, "error", e.message || "Upload failed");
      }
    }
  };

  const handleSubmit = () => {
    if (recordFailed) {
      void recordSubmission(files);
      return;
    }
    if (!canSubmit) return;
    runUpload(files);
  };
  const retryFile = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (f) runUpload([f]);
  };

  // ── Load / dead-link states ──
  if (loading) {
    return (
      <Shell arimoVar={arimo.variable}>
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.14em",
            color: ink(0.42),
          }}
        >
          LOADING…
        </div>
      </Shell>
    );
  }

  if (loadError || !config) {
    return (
      <Shell arimoVar={arimo.variable}>
        <Lockup postgame={deadLogo} client={null} />
        <div className="sf-intro" style={{ textAlign: "center" }}>
          <h1
            className="d sf-h1"
            style={{ color: BLACK, textTransform: "uppercase", letterSpacing: ".015em", lineHeight: 0.96 }}
          >
            Link unavailable
          </h1>
          <p className="sf-sub" style={{ color: ink(0.66), margin: "12px auto 0", maxWidth: "42ch" }}>
            This upload link isn&rsquo;t active.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Derived copy ──
  const introLine = `Upload what you shot for this campaign. You need at least ${config.minPhotos} ${plural(
    config.minPhotos,
    "photo"
  )} and ${spell(config.minVideos)} ${plural(config.minVideos, "video")}.`;

  const photosShort = Math.max(0, config.minPhotos - photoCount);
  const videosShort = Math.max(0, config.minVideos - videoCount);
  const shortParts: string[] = [];
  if (photosShort > 0) shortParts.push(`${photosShort} ${plural(photosShort, "photo")}`);
  if (videosShort > 0) shortParts.push(`${videosShort} ${plural(videosShort, "video")}`);

  const failedCount = files.filter((f) => f.status === "error").length;
  const doneFiles = files.filter((f) => f.status === "done");
  const failedFiles = files.filter((f) => f.status === "error");
  const donePhotos = doneFiles.filter((f) => f.kind === "photo").length;
  const doneVideos = doneFiles.filter((f) => f.kind === "video").length;

  let statusText = "";
  let statusTone: "todo" | "ok" = "ok";
  if (phase === "form") {
    if (shortParts.length) {
      statusText = `${shortParts.join(" and ")} needed`;
      statusTone = "todo";
    } else if (files.length > 0) {
      statusText = "Ready to send";
    }
  } else if (phase === "uploading") {
    statusText = recordFailed
      ? "Your files are uploaded. We couldn’t save your details."
      : recording
        ? "Saving your details…"
        : `Uploading ${files.filter((f) => f.status === "uploading" || f.status === "queued").length || files.length} ${plural(
            files.length,
            "file"
          )}…`;
    statusTone = recordFailed ? "todo" : "ok";
  } else if (phase === "partial") {
    statusText = `${failedCount} ${plural(failedCount, "file")} didn’t upload — retry or remove ${
      failedCount === 1 ? "it" : "them"
    }.`;
    statusTone = "todo";
  }

  const submitEnabled = recordFailed ? !recording : canSubmit;
  const submitLabel = recordFailed ? "Try again" : recording ? "Saving…" : "Submit content";

  // Switching mode must not carry identity across: a videographer's name in the
  // athlete fields, or an athlete's phone on a videographer submission, would
  // both be wrong records rather than merely untidy ones.
  const clearIdentity = () => {
    setFirstName("");
    setLastName("");
    setIgHandle("");
    setPhone("");
    setSchool("");
    setEmail("");
    setVidName("");
    setVidIg("");
  };

  const chooseMode = (mode: "athlete" | "videographer") => {
    clearIdentity();
    setSubmitterType(mode);
  };

  // ── The chooser ──
  if (submitterType === null) {
    return (
      <Shell arimoVar={arimo.variable}>
        <Lockup postgame={config.postgameLogoUrl} client={config.clientLogoUrl} />
        <div className="sf-intro" style={{ textAlign: "center" }}>
          <div
            className="sf-eyebrow"
            style={{
              fontFamily: MONO,
              fontWeight: 500,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: ORANGE,
              marginBottom: 9,
            }}
          >
            {config.campaignName}
          </div>
          <h1
            className="d sf-h1"
            style={{ color: BLACK, textTransform: "uppercase", letterSpacing: ".015em", lineHeight: 0.96 }}
          >
            Who&rsquo;s submitting?
          </h1>
          <p className="sf-sub" style={{ color: ink(0.66), margin: "12px auto 0", maxWidth: "42ch" }}>
            So we file the content under the right athlete.
          </p>
        </div>

        <div className="sf-wrap">
          <ChooserOption
            title="I’m the athlete"
            sub="Submitting my own content"
            onClick={() => chooseMode("athlete")}
          />
          <ChooserOption
            title="I’m a videographer"
            sub="Submitting on behalf of an athlete"
            onClick={() => chooseMode("videographer")}
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell arimoVar={arimo.variable}>
      <Lockup postgame={config.postgameLogoUrl} client={config.clientLogoUrl} />

      {/* Intro */}
      <div className="sf-intro" style={{ textAlign: "center" }}>
        <div
          className="sf-eyebrow"
          style={{
            fontFamily: MONO,
            fontWeight: 500,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: ORANGE,
            marginBottom: 9,
          }}
        >
          {config.campaignName}
        </div>
        <h1
          className="d sf-h1"
          style={{ color: BLACK, textTransform: "uppercase", letterSpacing: ".015em", lineHeight: 0.96 }}
        >
          Content submission
        </h1>
        <p className="sf-sub" style={{ color: ink(0.66), margin: "12px auto 0", maxWidth: "42ch" }}>
          {introLine}
        </p>
        {config.deliverables != null && (
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: ink(0.5),
              margin: "8px auto 0",
              maxWidth: "42ch",
            }}
          >
            This covers {config.deliverables} {plural(config.deliverables, "post")}.
          </p>
        )}
      </div>

      <div className="sf-wrap">
        {/* Which mode this submission is in, and the way back out of it. */}
        <div className="sf-mode">
          <span className="sf-mode-t">
            {isVideographer ? "Submitting as a videographer" : "Submitting as the athlete"}
          </span>
          {!locked && (
            <button type="button" className="sf-mode-b" onClick={() => setSubmitterType(null)}>
              Change
            </button>
          )}
        </div>

        {/* ── Card A · the videographer's own details (videographer path only) ── */}
        {isVideographer && (
          <Card title="Your details">
            <div className="sf-two-d">
              <div>
                <FieldLabel>Your name</FieldLabel>
                <Input value={vidName} onChange={setVidName} placeholder="Full name" disabled={locked} readOnly={readOnlyFields} />
              </div>
              <div>
                <FieldLabel>Your Instagram</FieldLabel>
                <Input value={vidIg} onChange={setVidIg} placeholder="@yourhandle" disabled={locked} readOnly={readOnlyFields} />
              </div>
            </div>
          </Card>
        )}

        {/* ── Card 1 / Card B · the athlete. These columns describe the athlete
             on both paths — the videographer is attribution, not the filing key. ── */}
        <Card title={isVideographer ? "The athlete you shot" : "Your details"}>
          <div className="sf-two">
            <div>
              <FieldLabel>First name</FieldLabel>
              <Input value={firstName} onChange={setFirstName} placeholder="First" disabled={locked} readOnly={readOnlyFields} />
            </div>
            <div>
              <FieldLabel>Last name</FieldLabel>
              <Input value={lastName} onChange={setLastName} placeholder="Last" disabled={locked} readOnly={readOnlyFields} />
            </div>
          </div>

          {/* Row order differs by path: the athlete path is left exactly as it
              ships (handle beside phone, school beside email), while the
              videographer path groups the two optional contact fields together
              so "(optional)" reads as one idea rather than two stray ones. */}
          <div className="sf-two-d">
            <div>
              <FieldLabel>{isVideographer ? "Athlete Instagram" : "Instagram handle"}</FieldLabel>
              <Input
                value={igHandle}
                onChange={setIgHandle}
                placeholder={isVideographer ? "@handle" : "@yourhandle"}
                disabled={locked}
                readOnly={readOnlyFields}
              />
              <div style={{ fontSize: 12, lineHeight: 1.5, color: ink(0.48), marginTop: 6 }}>
                {isVideographer ? "The handle they’ll post from." : "Use the handle you’ll post from."}
              </div>
            </div>
            <div>
              {isVideographer ? (
                <>
                  <FieldLabel>School</FieldLabel>
                  <Input value={school} onChange={setSchool} placeholder="School" disabled={locked} readOnly={readOnlyFields} />
                </>
              ) : (
                <>
                  <FieldLabel>Phone number</FieldLabel>
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={setPhone}
                    placeholder="(555) 555-5555"
                    disabled={locked}
                    readOnly={readOnlyFields}
                  />
                </>
              )}
            </div>
          </div>

          <div className="sf-two-d">
            <div>
              {isVideographer ? (
                <>
                  <FieldLabel optional>Phone number</FieldLabel>
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={setPhone}
                    placeholder="(555) 555-5555"
                    disabled={locked}
                    readOnly={readOnlyFields}
                  />
                </>
              ) : (
                <>
                  <FieldLabel>School</FieldLabel>
                  <Input value={school} onChange={setSchool} placeholder="School" disabled={locked} readOnly={readOnlyFields} />
                </>
              )}
            </div>
            <div>
              <FieldLabel optional={isVideographer}>Email</FieldLabel>
              <Input
                type="email"
                inputMode="email"
                value={email}
                onChange={setEmail}
                placeholder="you@email.com"
                disabled={locked}
                readOnly={readOnlyFields}
              />
            </div>
          </div>
        </Card>

        {isVideographer && (
          <div style={{ fontSize: 13, lineHeight: 1.6, color: ink(0.5), marginTop: 12 }}>
            One athlete per submission. Shot more than one? Send them separately.
          </div>
        )}

        {/* ── Card 2 · Your content ── */}
        <Card title="Your content">
          {phase === "done" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: ORANGE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                }}
              >
                <TickIcon />
              </span>
              <div>
                <div style={{ fontSize: 15, lineHeight: 1.5, color: ink(0.85) }}>Content received</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: ink(0.5), marginTop: 2 }}>
                  {doneFiles.length} {plural(doneFiles.length, "file")} · {donePhotos}{" "}
                  {plural(donePhotos, "photo")}, {doneVideos} {plural(doneVideos, "video")}
                </div>
              </div>
            </div>
          ) : (
            <>
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

              {/* Mobile: solid black button. Desktop: dashed drop zone. */}
              <button
                type="button"
                className="sf-upbtn"
                disabled={locked}
                onClick={() => !locked && fileInputRef.current?.click()}
              >
                <CloudIcon color="#fff" size={20} />
                Add files
              </button>

              <div
                className={`sf-drop${dragOver ? " over" : ""}${locked ? " off" : ""}`}
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
              >
                <div className="sf-dicon">
                  <CloudIcon color={ORANGE} size={24} />
                </div>
                <b>Drag files here, or browse</b>
                <span>JPG, PNG, HEIC, MP4, MOV · up to {config.maxFiles} files</span>
              </div>

              {/* FORM: every file as a thumbnail. PARTIAL: only the ones that landed. */}
              {(phase === "form" ? files : phase === "partial" ? doneFiles : []).length > 0 && (
                <div className="sf-thumbs">
                  {(phase === "form" ? files : doneFiles).map((f) => (
                    <Thumb
                      key={f.id}
                      f={f}
                      removable={phase === "form"}
                      onRemove={() => removeFile(f.id)}
                    />
                  ))}
                </div>
              )}

              {/* UPLOADING: every file as a progress row. PARTIAL: only the failures. */}
              {(phase === "uploading" || phase === "partial") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                  {(phase === "uploading" ? files : failedFiles).map((f) => (
                    <UploadRow
                      key={f.id}
                      f={f}
                      onRetry={() => retryFile(f.id)}
                      onRemove={() => removeFile(f.id)}
                      removable={phase === "partial"}
                    />
                  ))}
                </div>
              )}

              {statusText && (
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: statusTone === "todo" ? ORANGE : ink(0.55),
                  }}
                >
                  {statusText}
                </div>
              )}
            </>
          )}
        </Card>

        {/* ── Card 3 · Before you send ── */}
        <Card title="Before you send">
          <Check
            checked={!!ackInstructionsAt}
            disabled={locked}
            onToggle={(on) => setAckInstructionsAt(on ? new Date().toISOString() : null)}
          >
            <div style={{ fontSize: 15, lineHeight: 1.55, color: ink(0.85) }}>
              I&rsquo;ve read the{" "}
              {config.briefUrl ? (
                <a
                  href={config.briefUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: ORANGE, textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  campaign instructions
                </a>
              ) : (
                "campaign instructions"
              )}
              .
            </div>
          </Check>

          <Check
            checked={!!ackMusicAt}
            disabled={locked}
            onToggle={(on) => setAckMusicAt(on ? new Date().toISOString() : null)}
          >
            <div style={{ fontSize: 15, lineHeight: 1.55, color: ink(0.85) }}>
              I won&rsquo;t use copyrighted music.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: ink(0.5), marginTop: 3 }}>
              Copyright-free or instrumental only.
            </div>
          </Check>
        </Card>

        {submitError && !recordFailed && (
          <div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.5, color: ORANGE }}>{submitError}</div>
        )}

        {/* ── Submit ── */}
        {phase === "done" ? (
          <div
            style={{
              marginTop: 22,
              textAlign: "center",
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: ink(0.5),
              padding: "17px 0",
            }}
          >
            Submitted {submittedAt ? formatStamp(submittedAt) : ""}
          </div>
        ) : (
          <button
            type="button"
            className="sf-btn"
            disabled={!submitEnabled}
            onClick={handleSubmit}
          >
            {submitLabel}
          </button>
        )}

        {/* ── Footer ── */}
        <div className="sf-foot">
          {config.postgameLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sf-fmark" src={config.postgameLogoUrl} alt="Postgame" />
          ) : (
            <span />
          )}
          {config.expiresAt && formatDate(config.expiresAt) ? (
            <span className="sf-ft">Link expires {formatDate(config.expiresAt)}</span>
          ) : (
            <span />
          )}
        </div>
      </div>
    </Shell>
  );
}

// ── Shell + shared styles ─────────────────────────────────────

function Shell({ children, arimoVar }: { children: React.ReactNode; arimoVar?: string }) {
  return (
    <div
      className={`sf ${arimoVar ?? ""}`}
      style={{ minHeight: "100vh", background: OFF, fontFamily: BODY, paddingBottom: 34 }}
    >
      <style>{`
        .sf *, .sf *::before, .sf *::after { box-sizing: border-box; }
        .sf-bar { height: 5px; background: ${ORANGE}; }
        .sf-page { max-width: 720px; margin: 0 auto; }

        .sf-lock { display:flex; align-items:center; justify-content:center; gap:16px; padding:26px 22px 0; }
        .sf-pgmark { height:20px; max-width:180px; width:auto; object-fit:contain; }
        .sf-lockdiv { width:1px; height:22px; background:${ink(0.18)}; flex:0 0 auto; }
        .sf-client { height:13px; max-width:70px; width:auto; object-fit:contain; }

        .sf-intro { padding:24px 18px 0; }
        .sf-eyebrow { font-size:10px; }
        .sf-h1 { font-size:44px; }
        .sf-sub { font-size:16px; line-height:1.6; }

        .sf-wrap { padding:22px; }
        .sf-card { background:#fff; border:1px solid ${ink(0.1)}; border-radius:14px; margin-top:14px; overflow:hidden; }
        .sf-chead { background:${ORANGE}; color:#fff; padding:11px 20px 10px; font-size:20px;
                    letter-spacing:.04em; text-transform:uppercase; line-height:1.1; }
        .sf-cbody { padding:20px; }

        .sf-fl { font-size:13px; font-weight:700; color:${ink(0.85)}; margin-top:18px; display:block; letter-spacing:.005em; }
        .sf-cbody > .sf-two:first-child .sf-fl,
        .sf-cbody > .sf-two-d:first-child .sf-fl { margin-top:0; }
        .sf-req { color:${ORANGE}; font-weight:400; }
        .sf-opt { color:${ink(0.4)}; font-weight:400; }

        .sf-choice { display:block; width:100%; text-align:left; background:#fff; border:1.5px solid ${ink(0.14)};
                     border-radius:14px; padding:20px; margin-top:14px; cursor:pointer; font-family:${BODY};
                     transition:border-color .18s, background .18s; }
        .sf-choice:hover { border-color:${ORANGE}; background:rgba(215,63,9,.03); }
        .sf-choice:focus-visible { outline:2px solid ${ORANGE}; outline-offset:3px; }
        .sf-choice-t { display:block; font-size:19px; font-weight:700; color:${BLACK}; letter-spacing:.005em; }
        .sf-choice-s { display:block; font-size:14px; line-height:1.5; color:${ink(0.5)}; margin-top:4px; }

        .sf-mode { display:flex; align-items:center; justify-content:space-between; gap:12px;
                   padding:11px 14px; border:1px solid ${ink(0.12)}; border-radius:10px; background:#fff; }
        .sf-mode-t { font-family:${MONO}; font-size:10px; letter-spacing:.14em; text-transform:uppercase;
                     color:${ink(0.55)}; }
        .sf-mode-b { border:0; background:transparent; padding:0; cursor:pointer; font-family:${MONO};
                     font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:${ORANGE}; }
        .sf-mode-b:hover { text-decoration:underline; }
        .sf-line { width:100%; border:0; border-bottom:1.5px solid ${ink(0.18)}; padding:9px 2px; font-size:16px;
                   font-family:${BODY}; color:${BLACK}; background:transparent; margin-top:5px; appearance:none; border-radius:0; }
        .sf-line::placeholder { color:${ink(0.3)}; }
        .sf-line:focus { outline:0; border-bottom-color:${ORANGE}; }
        .sf-line:disabled, .sf-line[readonly] { color:${ink(0.55)}; }
        .sf-two { display:flex; gap:16px; }
        .sf-two > div { flex:1; min-width:0; }
        .sf-two-d > div { min-width:0; }

        .sf-thumbs { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
        .sf-th { width:60px; height:60px; border-radius:10px; position:relative; overflow:hidden;
                 background:linear-gradient(150deg,#d8d3cc,#efeae3); border:1px solid ${ink(0.08)}; }
        .sf-th img { width:100%; height:100%; object-fit:cover; display:block; }
        .sf-th .sf-rm { position:absolute; right:4px; top:4px; width:16px; height:16px; border:0; padding:0;
                        border-radius:999px; background:${ink(0.6)}; display:flex; align-items:center;
                        justify-content:center; cursor:pointer; }

        .sf-upbtn { width:100%; margin-top:16px; display:flex; align-items:center; justify-content:center; gap:11px;
                    background:${BLACK}; border:0; border-radius:12px; padding:18px; font-family:${MONO};
                    font-size:12px; font-weight:500; letter-spacing:.16em; text-transform:uppercase; color:#fff; cursor:pointer; }
        .sf-upbtn:disabled { background:${ink(0.35)}; cursor:not-allowed; }
        .sf-drop { display:none; margin-top:16px; border:1.5px dashed ${ink(0.22)}; border-radius:12px; padding:38px;
                   text-align:center; cursor:pointer; transition:border-color .2s, background .2s; }
        .sf-drop.over { border-color:${ORANGE}; background:rgba(215,63,9,.05); }
        .sf-drop.off { cursor:default; opacity:.5; }
        .sf-dicon { width:50px; height:50px; border-radius:999px; background:rgba(215,63,9,.10);
                    display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
        .sf-drop b { display:block; font-size:16px; color:${BLACK}; }
        .sf-drop span { display:block; font-size:14px; color:${ink(0.5)}; margin-top:4px; }

        .sf-chk { display:flex; gap:11px; align-items:flex-start; margin-top:16px; cursor:pointer; }
        .sf-cbody > .sf-chk:first-child { margin-top:0; }
        .sf-chk.off { cursor:default; }
        .sf-chk:focus-visible { outline:2px solid ${ORANGE}; outline-offset:4px; border-radius:6px; }
        .sf-bx { width:20px; height:20px; border-radius:5px; border:1.5px solid ${ink(0.3)}; flex:0 0 auto;
                 margin-top:1px; display:flex; align-items:center; justify-content:center; background:transparent; }
        .sf-bx.on { background:${ORANGE}; border-color:${ORANGE}; }

        .sf-btn { width:100%; margin-top:22px; background:${ORANGE}; color:#fff; border:0; border-radius:10px;
                  padding:17px; font-family:${MONO}; font-size:12px; font-weight:500; letter-spacing:.16em;
                  text-transform:uppercase; cursor:pointer; transition:background .2s, color .2s; }
        .sf-btn:disabled { background:${ink(0.12)}; color:${ink(0.35)}; cursor:not-allowed; }

        .sf-foot { display:flex; align-items:center; justify-content:space-between; margin-top:20px;
                   padding-top:16px; border-top:1px solid ${ink(0.1)}; }
        .sf-fmark { height:14px; opacity:.4; width:auto; max-width:120px; object-fit:contain; }
        .sf-ft { font-family:${MONO}; font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:${ink(0.42)}; }

        @media (min-width: 640px) {
          .sf-lock { padding:32px 40px 0; gap:20px; }
          .sf-pgmark { height:23px; max-width:210px; }
          .sf-lockdiv { height:28px; }
          .sf-client { height:15px; max-width:84px; }
          .sf-intro { padding:28px 60px 0; }
          .sf-eyebrow { font-size:12px; }
          .sf-h1 { font-size:64px; }
          .sf-sub { font-size:18px; max-width:52ch; }
          .sf-wrap { padding:26px 40px 30px; }
          .sf-card { margin-top:18px; }
          .sf-chead { padding:13px 26px 12px; font-size:23px; }
          .sf-cbody { padding:26px; }
          .sf-two-d { display:flex; gap:16px; }
          .sf-two-d > div { flex:1; }
          .sf-upbtn { display:none; }
          .sf-drop { display:block; }
        }
      `}</style>
      <div className="sf-bar" />
      <div className="sf-page">{children}</div>
    </div>
  );
}

function Lockup({ postgame, client }: { postgame: string | null; client: string | null }) {
  if (!postgame && !client) return null;
  return (
    <div className="sf-lock">
      {postgame && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="sf-pgmark" src={postgame} alt="Postgame" />
      )}
      {postgame && client && <div className="sf-lockdiv" />}
      {client && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="sf-client" src={client} alt="" />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sf-card">
      <div className="d sf-chead">{title}</div>
      <div className="sf-cbody">{children}</div>
    </div>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="sf-fl">
      {children}{" "}
      {optional ? <span className="sf-opt">(optional)</span> : <span className="sf-req">*</span>}
    </label>
  );
}

// One of the two answers to "Who's submitting?". A button rather than a radio:
// picking it is the action, and there is no separate confirm step.
function ChooserOption({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" className="sf-choice" onClick={onClick}>
      <span className="sf-choice-t">{title}</span>
      <span className="sf-choice-s">{sub}</span>
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  type = "text",
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  readOnly?: boolean;
  type?: string;
  inputMode?: "text" | "tel" | "email";
}) {
  return (
    <input
      className="sf-line"
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      disabled={disabled && !readOnly}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// A div rather than a <button>/<label> on purpose: acknowledgement 1 contains a
// real link, and interactive content nested inside a button or label is invalid
// HTML. role="checkbox" + tabIndex + keyboard handling gives the same semantics.
function Check({
  checked,
  disabled,
  onToggle,
  children,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  const toggle = () => {
    if (!disabled) onToggle(!checked);
  };
  return (
    <div
      className={`sf-chk${disabled ? " off" : ""}`}
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span className={`sf-bx${checked ? " on" : ""}`}>{checked && <TickIcon />}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Thumb({ f, removable, onRemove }: { f: Picked; removable: boolean; onRemove: () => void }) {
  return (
    <div className="sf-th">
      {f.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.previewUrl} alt="" />
      ) : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: ink(0.45),
            fontSize: 15,
          }}
        >
          ▶
        </span>
      )}
      {removable && (
        <button type="button" className="sf-rm" aria-label={`Remove ${f.file.name}`} onClick={onRemove}>
          <XIcon />
        </button>
      )}
    </div>
  );
}

function UploadRow({
  f,
  onRetry,
  onRemove,
  removable,
}: {
  f: Picked;
  onRetry: () => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const failed = f.status === "error";
  const pct = Math.round(f.progress * 100);
  const meta = failed
    ? f.error || "Upload failed"
    : f.status === "done"
      ? "Uploaded"
      : f.status === "uploading"
        ? `${pct}% · ${humanSize(f.progress * f.file.size)} of ${humanSize(f.file.size)}`
        : "Waiting…";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${failed ? ink(0.28) : ink(0.1)}`,
        background: "#fff",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 9,
          flex: "0 0 auto",
          overflow: "hidden",
          background: "linear-gradient(150deg,#d8d3cc,#efeae3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: ink(0.45),
          fontSize: 14,
        }}
      >
        {f.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          "▶"
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: ink(0.85),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {f.file.name}
        </div>
        {f.status === "uploading" && (
          <div style={{ height: 4, borderRadius: 999, background: ink(0.1), margin: "6px 0", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: ORANGE, transition: "width .2s" }} />
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            color: failed ? ink(0.7) : ink(0.5),
            marginTop: f.status === "uploading" ? 0 : 3,
          }}
        >
          {meta}
        </div>
      </div>

      {failed && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              color: ORANGE,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
          {removable && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${f.file.name}`}
              style={{ background: "none", border: 0, padding: 0, color: ink(0.4), cursor: "pointer", fontSize: 15 }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Icons (from the approved mockup) ──────────────────────────

function CloudIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "0 0 auto" }}
      aria-hidden="true"
    >
      <path d="M8.4 17.6H6.7a4.2 4.2 0 0 1-1.8-8 5.6 5.6 0 0 1 10.7-2.1 4.8 4.8 0 0 1 .4 9.5h-1.9" />
      <path d="M12 21.4V9.6" />
      <path d="M8.5 13.1 12 9.6l3.5 3.5" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 9 7" fill="none" aria-hidden="true">
      <path d="M1 3.5L3.3 6 8 1" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="M1 1l6 6M7 1l-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
