// src/app/submit/[token]/page.tsx
// ─────────────────────────────────────────────────────────────
// PUBLIC athlete content upload page. No login.
//
// Design: the approved DARK direction (submit-form-dark.html, signed off
// 12 Aug 2026). Black ground (#07070A), translucent white surfaces, sticky
// header carrying the real Postgame mark over a 4px orange rule. Type: Bebas
// Neue (display), Anton (brand-name fallback only), Arial (body), JetBrains
// Mono (labels and counts).
//
// The upload pipeline (resumable relay through /api/submit/[token]) is
// UNCHANGED. What is new on top of it:
//   · two upload zones on the videographer path — edited files and raw files,
//     stored as tier3_submissions.file_class ('edit' | 'raw')
//   · the videographer path collects no school, phone or email
//
// Four states: FORM → UPLOADING → (PARTIAL) → DONE.
// ─────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Anton } from "next/font/google";

// Anton is used for exactly one thing: the brand-name fallback shown when a
// client has no usable logo. 38 of 130 brands are in that position, so this is
// a real path rather than a defensive branch.
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
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

/** Which zone a file came through. 'edit' is the finished cut, 'raw' is
 *  original camera footage. null on the athlete path, which has one zone. */
type FileClass = "edit" | "raw" | null;

interface Picked {
  id: string;
  file: File;
  kind: FileKind;
  fileClass: FileClass;
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

// ── Design tokens (approved dark mockup) ──────────────────────
const BLACK = "#07070A";
const ORANGE = "#D73F09";
const SUCCESS = "#7ee2a8";
/** Off-white ink at a given opacity. The page is dark, so every text and
 *  hairline value is this colour stepped down, never a grey hex. */
const ink = (a: number) => `rgba(250,248,245,${a})`;
const MONO = "var(--font-mono), ui-monospace, monospace";
const BODY = "Arial, Helvetica, sans-serif";

type Phase = "form" | "uploading" | "partial" | "done";

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
  const [vidFirst, setVidFirst] = useState("");
  const [vidLast, setVidLast] = useState("");
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
  const editInputRef = useRef<HTMLInputElement>(null);
  const rawInputRef = useRef<HTMLInputElement>(null);
  const [clientLogoDead, setClientLogoDead] = useState(false);

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

  const locked = phase !== "form";
  const readOnlyFields = phase === "done";

  // Counts that gate the submission. Raw camera footage is collected but is
  // NOT deliverable content, so it never counts toward the minimums — without
  // that split a videographer could satisfy "3 photos and 1 video" with four
  // raw stills. null (the athlete path) counts, exactly as it always did.
  const counting = files.filter((f) => f.fileClass !== "raw");
  const photoCount = counting.filter((f) => f.kind === "photo").length;
  const videoCount = counting.filter((f) => f.kind === "video").length;
  const rawFiles = files.filter((f) => f.fileClass === "raw");

  const addFiles = useCallback(
    (incoming: File[], fileClass: FileClass) => {
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
            fileClass,
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

  // The athlete's name and handle are required on both paths — they are what
  // the files file under. School, phone and email are asked for on the athlete
  // path only; a videographer is not expected to know any of the three.
  const athleteCoreFilled = !!firstName.trim() && !!lastName.trim() && !!igHandle.trim();
  const fieldsFilled = isVideographer
    ? athleteCoreFilled && !!vidFirst.trim() && !!vidLast.trim() && !!vidIg.trim()
    : athleteCoreFilled && !!phone.trim() && !!school.trim() && !!email.trim();

  const meetsPhotos = config ? photoCount >= config.minPhotos : false;
  const meetsVideos = config ? videoCount >= config.minVideos : false;
  const meetsEdits = meetsPhotos && meetsVideos;
  // The raw zone is labelled "required" in the approved design, so it gates the
  // send on the videographer path.
  const meetsRaw = !isVideographer || rawFiles.length > 0;
  const acked = !!ackInstructionsAt && !!ackMusicAt;

  const canSubmit =
    fieldsFilled && acked && files.length > 0 && meetsEdits && meetsRaw && phase === "form";

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
            // The placeholder reads "@ighandle" and the hint line is gone, but
            // the leading @ must still come off: ig_handle is the match key, and
            // "@marcus" and "marcus" must not become two different athletes.
            igHandle: igHandle.trim().replace(/^@+/, ""),
            phone: isVideographer ? "" : phone.replace(/\D/g, ""),
            school: isVideographer ? "" : school.trim(),
            email: isVideographer ? "" : email.trim(),
            submitterType: submitterType ?? "athlete",
            videographerName: isVideographer ? `${vidFirst.trim()} ${vidLast.trim()}`.trim() : null,
            // Lowercased to match the server: this handle is the de-facto
            // videographer identity until the directory can be linked by id.
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
      vidFirst,
      vidLast,
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

    // submitterType travels with every request so the server can relax the
    // school requirement for a videographer exactly as this form does.
    const who = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      igHandle: igHandle.trim(),
      school: isVideographer ? "" : school.trim(),
      submitterType: submitterType ?? "athlete",
    };

    const sessionByClient: Record<string, string> = {};
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
            fileClass: f.fileClass,
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
          body: JSON.stringify({ action: "finalize", ...who, fileId, fileClass: f.fileClass }),
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
      <Shell antonVar={anton.variable}>
        <Header postgame={null} onBack={null} />
        <div className="sf-page">
          <div className="sf-load">LOADING…</div>
        </div>
      </Shell>
    );
  }

  if (loadError || !config) {
    return (
      <Shell antonVar={anton.variable}>
        <Header postgame={deadLogo} onBack={null} />
        <div className="sf-page">
          <div className="sf-top">
            <h1 className="d sf-h1">Link unavailable</h1>
            <div className="sf-sub">This upload link isn&rsquo;t active.</div>
          </div>
        </div>
      </Shell>
    );
  }

  // Switching mode must not carry identity across: a videographer's name in the
  // athlete fields, or an athlete's phone on a videographer submission, would
  // both be wrong records rather than merely untidy ones. Files go too — a raw
  // file picked on the videographer path has no zone on the athlete path, and
  // would otherwise upload invisibly with file_class 'raw'.
  const resetPath = () => {
    setFirstName("");
    setLastName("");
    setIgHandle("");
    setPhone("");
    setSchool("");
    setEmail("");
    setVidFirst("");
    setVidLast("");
    setVidIg("");
    setFiles((prev) => {
      prev.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      return [];
    });
    setSubmitError(null);
  };

  const chooseMode = (mode: "athlete" | "videographer") => {
    resetPath();
    setSubmitterType(mode);
  };
  const backToChooser = () => {
    resetPath();
    setSubmitterType(null);
  };

  const clientMark = (
    <BrandMark
      url={clientLogoDead ? null : config.clientLogoUrl}
      name={config.brandName}
      onDead={() => setClientLogoDead(true)}
    />
  );

  // ── The chooser ──
  if (submitterType === null) {
    return (
      <Shell antonVar={anton.variable}>
        <Header postgame={config.postgameLogoUrl} onBack={null} />
        <div className="sf-page">
          <div className="sf-top">
            {clientMark}
            <h1 className="d sf-h1">{config.campaignName}</h1>
            <div className="sf-sub">Before you upload — who&rsquo;s submitting?</div>
          </div>

          <ChooserOption
            icon={<UserIcon />}
            title={<>I&rsquo;m the athlete</>}
            sub="Submitting my own content"
            onClick={() => chooseMode("athlete")}
          />
          <ChooserOption
            icon={<CamIcon />}
            title={<>I&rsquo;m a videographer</>}
            sub="Submitting for an athlete I shot"
            onClick={() => chooseMode("videographer")}
          />

          <Footer postgame={config.postgameLogoUrl} expiresAt={config.expiresAt} />
        </div>
      </Shell>
    );
  }

  // ── Derived status copy ──
  const failedCount = files.filter((f) => f.status === "error").length;
  const doneFiles = files.filter((f) => f.status === "done");
  const failedFiles = files.filter((f) => f.status === "error");

  let statusText = "";
  if (phase === "uploading") {
    statusText = recordFailed
      ? "Your files are uploaded. We couldn’t save your details."
      : recording
        ? "Saving your details…"
        : `Uploading ${files.filter((f) => f.status === "uploading" || f.status === "queued").length || files.length} ${plural(files.length, "file")}…`;
  } else if (phase === "partial") {
    statusText = `${failedCount} ${plural(failedCount, "file")} didn’t upload — retry or remove ${failedCount === 1 ? "it" : "them"}.`;
  }

  const submitEnabled = recordFailed ? !recording : canSubmit;
  const submitLabel = recordFailed
    ? "Try again"
    : recording
      ? "Saving…"
      : isVideographer
        ? "Send this athlete's content"
        : "Send my content";

  const editPill = `${Math.min(photoCount, config.minPhotos) + Math.min(videoCount, config.minVideos)} of ${config.minPhotos + config.minVideos}`;
  const requirementLine = `${config.minPhotos} ${plural(config.minPhotos, "photo")} and ${config.minVideos} ${plural(config.minVideos, "video")} required`;

  return (
    <Shell antonVar={anton.variable}>
      <Header postgame={config.postgameLogoUrl} onBack={locked ? null : backToChooser} />

      <div className="sf-page">
        <div className="sf-top">
          {clientMark}
          <h1 className="d sf-h1">{config.campaignName}</h1>
          <div className="sf-sub">
            <b>{isVideographer ? "Videographers" : "Athletes"}</b> — submit your content below.
          </div>
          {config.deliverables != null && (
            <div className="sf-sub sf-deliv">
              This covers {config.deliverables} {plural(config.deliverables, "post")}.
            </div>
          )}
        </div>

        {/* ── Your info ── */}
        <Card title="Your info">
          <div className="sf-two sf-fg">
            <Field label="First name">
              <Input
                value={isVideographer ? vidFirst : firstName}
                onChange={isVideographer ? setVidFirst : setFirstName}
                placeholder={isVideographer ? "Marcus" : "Jordan"}
                disabled={locked}
                readOnly={readOnlyFields}
              />
            </Field>
            <Field label="Last name">
              <Input
                value={isVideographer ? vidLast : lastName}
                onChange={isVideographer ? setVidLast : setLastName}
                placeholder={isVideographer ? "Reed" : "Blake"}
                disabled={locked}
                readOnly={readOnlyFields}
              />
            </Field>
          </div>

          <Field label="Instagram" className="sf-fg">
            <Input
              value={isVideographer ? vidIg : igHandle}
              onChange={isVideographer ? setVidIg : setIgHandle}
              placeholder="@ighandle"
              disabled={locked}
              readOnly={readOnlyFields}
            />
          </Field>

          {/* School, phone and email are the athlete's own contact details and
              are collected on the athlete path only. */}
          {!isVideographer && (
            <>
              <div className="sf-stack sf-fg">
                <Field label="Phone">
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={setPhone}
                    placeholder="(941) 555-0143"
                    disabled={locked}
                    readOnly={readOnlyFields}
                  />
                </Field>
                <Field label="School">
                  <Input
                    value={school}
                    onChange={setSchool}
                    placeholder="Texas Tech"
                    disabled={locked}
                    readOnly={readOnlyFields}
                  />
                </Field>
              </div>
              <Field label="Email">
                <Input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@school.edu"
                  disabled={locked}
                  readOnly={readOnlyFields}
                />
              </Field>
            </>
          )}
        </Card>

        {/* ── Athlete info (videographer path only) ── */}
        {isVideographer && (
          <Card title="Athlete info">
            <div className="sf-two sf-fg">
              <Field label="First name">
                <Input value={firstName} onChange={setFirstName} placeholder="Jordan" disabled={locked} readOnly={readOnlyFields} />
              </Field>
              <Field label="Last name">
                <Input value={lastName} onChange={setLastName} placeholder="Blake" disabled={locked} readOnly={readOnlyFields} />
              </Field>
            </div>
            <Field label="Instagram">
              <Input value={igHandle} onChange={setIgHandle} placeholder="@ighandle" disabled={locked} readOnly={readOnlyFields} />
            </Field>
          </Card>
        )}

        {/* ── The content ── */}
        <Card title={isVideographer ? "The content you shot" : "Your content"}>
          {phase === "done" ? (
            <ReceivedSummary files={doneFiles} />
          ) : (
            <>
              <input
                ref={editInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.heic,.heif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const picked = e.target.files ? Array.from(e.target.files) : [];
                  e.target.value = "";
                  if (picked.length) addFiles(picked, isVideographer ? "edit" : null);
                }}
              />
              <input
                ref={rawInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const picked = e.target.files ? Array.from(e.target.files) : [];
                  e.target.value = "";
                  if (picked.length) addFiles(picked, "raw");
                }}
              />

              <div className="sf-zones">
                <Zone
                  primary
                  icon={<PencilIcon />}
                  title={isVideographer ? "Edited files" : "Photos and video"}
                  sub={requirementLine}
                  pill={editPill}
                  pillOk={meetsEdits}
                  buttonLabel={isVideographer ? "Choose edited files" : "Choose from camera roll"}
                  onPick={() => !locked && editInputRef.current?.click()}
                  disabled={locked}
                  pips={
                    <div className="sf-pips">
                      {Array.from({ length: config.minPhotos }).map((_, i) => (
                        <span key={`p${i}`} className={`sf-pip${i < photoCount ? " on" : ""}`} />
                      ))}
                      {Array.from({ length: config.minVideos }).map((_, i) => (
                        <span key={`v${i}`} className={`sf-pip vid${i < videoCount ? " on" : ""}`} />
                      ))}
                    </div>
                  }
                />

                {isVideographer && (
                  <Zone
                    icon={<FolderIcon />}
                    title="Raw files"
                    sub="Everything you shot — required"
                    pill={rawFiles.length === 0 ? "none yet" : `${rawFiles.length} ${plural(rawFiles.length, "file")}`}
                    pillOk={rawFiles.length > 0}
                    buttonLabel="Choose raw files"
                    onPick={() => !locked && rawInputRef.current?.click()}
                    disabled={locked}
                    foot="Original camera footage and stills — .CR3, .ARW, .BRAW, ProRes, whatever you shot on."
                  />
                )}
              </div>

              {phase === "form" && files.length > 0 && (
                <div className="sf-thumbs">
                  {files.map((f) => (
                    <Thumb key={f.id} f={f} removable onRemove={() => removeFile(f.id)} />
                  ))}
                </div>
              )}

              {(phase === "uploading" || phase === "partial") && (
                <div className="sf-rows">
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

              {statusText && <div className="sf-status">{statusText}</div>}
            </>
          )}
        </Card>

        {/* ── Before you send ── */}
        <Card title="Before you send">
          <Check
            checked={!!ackInstructionsAt}
            disabled={locked}
            onToggle={(on) => setAckInstructionsAt(on ? new Date().toISOString() : null)}
          >
            I&rsquo;ve read the{" "}
            {config.briefUrl ? (
              <a
                href={config.briefUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                campaign instructions
              </a>
            ) : (
              "campaign instructions"
            )}{" "}
            and {isVideographer ? "this content follows" : "my content follows"} them.
          </Check>

          <Check
            checked={!!ackMusicAt}
            disabled={locked}
            onToggle={(on) => setAckMusicAt(on ? new Date().toISOString() : null)}
          >
            {isVideographer
              ? "If a Reel is cut from this, the music will be a copyright-free track from Instagram’s commercial library."
              : "If I add music to a Reel, I’ll use a copyright-free track from Instagram’s commercial library."}
          </Check>

          {submitError && !recordFailed && <div className="sf-err">{submitError}</div>}

          {phase === "done" ? (
            <div className="sf-done">Submitted {submittedAt ? formatStamp(submittedAt) : ""}</div>
          ) : (
            <button type="button" className="sf-send" disabled={!submitEnabled} onClick={handleSubmit}>
              {submitLabel}
            </button>
          )}
        </Card>

        <Footer postgame={config.postgameLogoUrl} expiresAt={config.expiresAt} />
      </div>
    </Shell>
  );
}

// ── Shell + styles ────────────────────────────────────────────

function Shell({ children, antonVar }: { children: React.ReactNode; antonVar?: string }) {
  return (
    <div className={`sf ${antonVar ?? ""}`}>
      <style>{`
        .sf { min-height:100vh; background:${BLACK}; color:${ink(0.82)};
              font:15px/1.6 ${BODY}; -webkit-font-smoothing:antialiased; }
        .sf *, .sf *::before, .sf *::after { box-sizing:border-box; }
        .sf img { display:block; }
        .sf button { font-family:${BODY}; cursor:pointer; border:none; background:none; color:inherit; }

        /* ── header ── */
        .sf-hdr { background:rgba(7,7,10,.92); backdrop-filter:blur(18px);
                  -webkit-backdrop-filter:blur(18px); position:sticky; top:0; z-index:10;
                  border-bottom:1px solid ${ink(0.14)}; }
        .sf-hdr-in { max-width:560px; margin:0 auto; padding:15px 20px; display:flex;
                     align-items:center; justify-content:center; position:relative; }
        .sf-hdr img { height:24px; width:auto; }
        .sf-back { position:absolute; left:20px; top:50%; transform:translateY(-50%);
                   width:32px; height:32px; border-radius:9px; display:flex; align-items:center;
                   justify-content:center; color:${ink(0.62)}; }
        .sf-back:hover { background:${ink(0.07)}; color:${ink(1)}; }
        .sf-back:focus-visible { outline:2px solid ${ORANGE}; outline-offset:2px; }
        .sf-back svg { width:18px; height:18px; }
        .sf-rule { height:4px; background:${ORANGE}; }

        .sf-page { max-width:560px; margin:0 auto; padding:0 20px 60px; }
        .sf-load { padding:60px 20px; text-align:center; font-family:${MONO}; font-size:11px;
                   letter-spacing:.14em; color:${ink(0.45)}; }

        /* ── top ── */
        .sf-top { padding:26px 0 20px; text-align:center; }
        .sf-mark { height:54px; width:auto; max-width:70%; margin:0 auto 16px; object-fit:contain; }
        .sf-markfb { height:54px; display:flex; align-items:center; justify-content:center;
                     font-family:var(--font-anton), Arial, sans-serif; font-size:21px;
                     letter-spacing:.02em; color:${ink(0.45)}; margin-bottom:16px;
                     text-transform:uppercase; }
        .sf-h1 { font-size:32px; color:${ink(1)}; letter-spacing:.02em; line-height:1.02; margin:0 0 10px; }
        .sf-sub { font-size:14px; color:${ink(0.82)}; line-height:1.6; }
        .sf-sub b { color:${ink(1)}; font-weight:normal; }
        .sf-deliv { color:${ink(0.62)}; margin-top:6px; }

        /* ── chooser ── */
        .sf-pick { background:${ink(0.07)}; border:1.5px solid ${ink(0.14)}; border-radius:13px;
                   padding:16px; display:flex; gap:13px; align-items:center; text-align:left;
                   width:100%; margin-bottom:11px; }
        .sf-pick:hover { border-color:${ORANGE}; }
        .sf-pick:focus-visible { outline:2px solid ${ORANGE}; outline-offset:3px; }
        .sf-pick-ic { width:42px; height:42px; border-radius:11px; background:rgba(215,63,9,.14);
                      color:${ORANGE}; display:flex; align-items:center; justify-content:center; flex:0 0 auto; }
        .sf-pick-ic svg { width:20px; height:20px; }
        .sf-pick-tx b { display:block; color:${ink(1)}; font-size:15.5px; font-weight:normal; line-height:1.3; }
        .sf-pick-tx span { font-size:13px; color:${ink(0.62)}; }
        .sf-pick-go { margin-left:auto; color:${ink(0.45)}; display:flex; }
        .sf-pick-go svg { width:16px; height:16px; }

        /* ── cards ── */
        .sf-card { background:${ink(0.07)}; border:1px solid ${ink(0.14)}; border-radius:13px;
                   overflow:hidden; margin-bottom:12px; }
        .sf-ct { background:${ORANGE}; color:#fff; padding:9px 15px; font-family:${MONO};
                 font-size:9.5px; letter-spacing:.16em; text-transform:uppercase; }
        .sf-cb { padding:15px; }

        .sf-fl { display:block; font-family:${MONO}; font-size:9px; letter-spacing:.12em;
                 text-transform:uppercase; color:${ink(0.62)}; margin-bottom:5px; }
        /* Inputs sit DARKER than the card they're in, not lighter. */
        .sf-fi { width:100%; border:1px solid ${ink(0.14)}; border-radius:9px; padding:12px 13px;
                 font-size:16px; color:${ink(1)}; font-family:${BODY}; background:rgba(0,0,0,.32);
                 appearance:none; }
        .sf-fi:focus { outline:none; border-color:${ORANGE}; }
        .sf-fi::placeholder { color:${ink(0.45)}; }
        .sf-fi:disabled, .sf-fi[readonly] { color:${ink(0.62)}; }
        .sf-two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .sf-stack { display:grid; grid-template-columns:1fr; gap:10px; }
        .sf-fg { margin-bottom:12px; }

        /* ── upload zones ── */
        .sf-zones { border:1px solid ${ink(0.14)}; border-radius:12px; overflow:hidden; background:rgba(0,0,0,.22); }
        .sf-zn { padding:16px; }
        .sf-zn + .sf-zn { border-top:1px solid ${ink(0.14)}; }
        .sf-zn.pri { background:rgba(215,63,9,.07); }
        .sf-zh { display:flex; gap:11px; align-items:flex-start; margin-bottom:12px; }
        .sf-zic { width:34px; height:34px; border-radius:10px; display:flex; align-items:center;
                  justify-content:center; flex:0 0 auto; }
        .sf-zic svg { width:17px; height:17px; }
        .sf-zn.pri .sf-zic { background:${ORANGE}; color:#fff; }
        .sf-zn.sec .sf-zic { background:${ink(0.1)}; color:${ink(0.62)}; }
        .sf-ztl { flex:1; min-width:0; }
        .sf-ztl .a { font-size:15.5px; color:${ink(1)}; line-height:1.25; }
        .sf-ztl .b { font-size:12.5px; color:${ink(0.62)}; margin-top:2px; }
        .sf-zst { font-family:${MONO}; font-size:11px; color:${ink(0.45)}; white-space:nowrap;
                  padding:4px 9px; border-radius:20px; background:${ink(0.1)}; }
        .sf-zst.ok { background:rgba(126,226,168,.14); color:${SUCCESS}; }
        .sf-pips { display:flex; gap:5px; margin-bottom:12px; flex-wrap:wrap; }
        .sf-pip { height:5px; flex:1; min-width:26px; border-radius:3px; background:${ink(0.1)}; }
        .sf-pip.on { background:${ORANGE}; }
        .sf-pip.vid { background:${ink(0.06)}; border:1px dashed ${ink(0.22)}; }
        .sf-pip.vid.on { background:${ORANGE}; border-style:solid; border-color:${ORANGE}; }
        .sf-zbtn { width:100%; border:1px solid ${ink(0.14)}; border-radius:9px; padding:12px;
                   font-size:14.5px; color:${ink(1)}; background:rgba(0,0,0,.28); display:flex;
                   gap:8px; align-items:center; justify-content:center; }
        .sf-zbtn:hover:not(:disabled) { border-color:${ORANGE}; color:${ORANGE}; }
        .sf-zbtn:focus-visible { outline:2px solid ${ORANGE}; outline-offset:2px; }
        .sf-zbtn:disabled { opacity:.5; cursor:not-allowed; }
        .sf-zbtn svg { width:15px; height:15px; }
        .sf-zfoot { font-size:11.5px; color:${ink(0.45)}; margin-top:9px; line-height:1.5; }

        /* ── thumbs + rows ── */
        .sf-thumbs { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
        .sf-th { width:60px; height:60px; border-radius:10px; position:relative; overflow:hidden;
                 background:${ink(0.1)}; border:1px solid ${ink(0.14)}; }
        .sf-th img { width:100%; height:100%; object-fit:cover; }
        .sf-th .sf-badge { position:absolute; left:0; bottom:0; right:0; font-family:${MONO};
                           font-size:7.5px; letter-spacing:.1em; text-transform:uppercase;
                           text-align:center; padding:2px 0; background:rgba(0,0,0,.62); color:${ink(0.82)}; }
        .sf-th .sf-rm { position:absolute; right:4px; top:4px; width:16px; height:16px; padding:0;
                        border-radius:999px; background:rgba(0,0,0,.62); display:flex;
                        align-items:center; justify-content:center; }
        .sf-th .sf-ph { position:absolute; inset:0; display:flex; align-items:center;
                        justify-content:center; color:${ink(0.45)}; font-size:15px; }
        .sf-rows { display:flex; flex-direction:column; gap:8px; margin-top:14px; }
        .sf-row { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px;
                  border:1px solid ${ink(0.14)}; background:rgba(0,0,0,.22); }
        .sf-row-th { width:40px; height:40px; border-radius:9px; flex:0 0 auto; overflow:hidden;
                     background:${ink(0.1)}; display:flex; align-items:center; justify-content:center;
                     color:${ink(0.45)}; font-size:14px; }
        .sf-row-th img { width:100%; height:100%; object-fit:cover; }
        .sf-row-n { font-size:14px; color:${ink(1)}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sf-row-m { font-size:12px; color:${ink(0.62)}; }
        .sf-bar { height:4px; border-radius:999px; background:${ink(0.1)}; margin:6px 0; overflow:hidden; }
        .sf-bar > i { display:block; height:100%; background:${ORANGE}; transition:width .2s; }
        .sf-retry { font-family:${MONO}; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:${ORANGE}; }
        .sf-status { margin-top:12px; font-size:13px; color:${ink(0.62)}; }
        .sf-err { margin-top:12px; font-size:13px; color:${ORANGE}; }

        /* ── acknowledgements + send ── */
        .sf-ack { display:flex; gap:11px; align-items:flex-start; padding:12px 0;
                  border-top:1px solid ${ink(0.08)}; cursor:pointer; }
        .sf-cb > .sf-ack:first-child { border-top:none; padding-top:0; }
        .sf-ack.off { cursor:default; }
        .sf-ack:focus-visible { outline:2px solid ${ORANGE}; outline-offset:3px; border-radius:6px; }
        .sf-box { width:21px; height:21px; border-radius:6px; border:1.5px solid ${ink(0.22)};
                  flex:0 0 auto; margin-top:1px; display:flex; align-items:center; justify-content:center; }
        .sf-box.on { background:${ORANGE}; border-color:${ORANGE}; color:#fff; }
        .sf-box svg { width:12px; height:12px; }
        .sf-ack-tx { font-size:13px; line-height:1.55; color:${ink(0.82)}; min-width:0; }
        .sf-ack-tx a { color:${ORANGE}; }
        .sf-send { width:100%; background:${ORANGE}; color:#fff; border-radius:11px; padding:15px;
                   font-size:16px; font-weight:bold; margin-top:16px; }
        .sf-send:disabled { background:${ink(0.08)}; color:${ink(0.45)}; cursor:not-allowed; }
        .sf-done { margin-top:16px; text-align:center; font-family:${MONO}; font-size:11px;
                   letter-spacing:.14em; text-transform:uppercase; color:${ink(0.62)}; padding:15px 0; }
        .sf-recv { display:flex; align-items:center; gap:12px; }
        .sf-recv-ic { width:26px; height:26px; border-radius:999px; background:${ORANGE}; flex:0 0 auto;
                      display:flex; align-items:center; justify-content:center; }
        .sf-recv-ic svg { width:12px; height:12px; }

        /* ── footer ── */
        .sf-foot { text-align:center; padding:28px 0 0; border-top:1px solid ${ink(0.08)}; margin-top:24px; }
        .sf-foot img { height:17px; width:auto; margin:0 auto 12px; opacity:.55; }
        .sf-foot .q { font-size:13px; color:${ink(0.82)}; }
        .sf-ln { display:flex; flex-direction:column; gap:9px; margin-top:11px; align-items:center; }
        .sf-ln a { font-size:13px; color:${ORANGE}; text-decoration:none; display:inline-flex;
                   gap:6px; align-items:center; }
        .sf-ln a:hover { text-decoration:underline; }
        .sf-ln svg { width:14px; height:14px; }
        .sf-exp { display:block; margin-top:14px; font-family:${MONO}; font-size:9px;
                  letter-spacing:.14em; text-transform:uppercase; color:${ink(0.45)}; }

        /* first/last stay paired until 380px */
        @media (max-width:380px) {
          .sf-two { grid-template-columns:1fr; }
          .sf-h1 { font-size:29px; }
          .sf-page { padding:0 16px 56px; }
        }

        @media (min-width:640px) {
          .sf-hdr-in { padding:18px 22px; }
          .sf-hdr img { height:28px; }
          .sf-page { padding:0 22px 70px; }
          .sf-top { padding:34px 0 26px; }
          .sf-mark, .sf-markfb { height:68px; margin-bottom:20px; }
          .sf-h1 { font-size:42px; margin-bottom:13px; }
          .sf-sub { font-size:15px; }
          .sf-cb { padding:19px; }
          .sf-ct { padding:11px 19px; font-size:10px; }
          /* 16px on mobile keeps iOS Safari from zooming the page on focus;
             below that it always zooms, and the athlete has to pinch back out. */
          .sf-fi { font-size:15px; }
          .sf-ack-tx { font-size:14px; }
          .sf-pick { padding:18px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sf * { transition:none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}

function Header({ postgame, onBack }: { postgame: string | null; onBack: (() => void) | null }) {
  return (
    <>
      <header className="sf-hdr">
        <div className="sf-hdr-in">
          {onBack && (
            <button type="button" className="sf-back" onClick={onBack} aria-label="Back">
              <BackIcon />
            </button>
          )}
          {postgame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={postgame} alt="Postgame" />
          ) : (
            <span style={{ height: 24 }} />
          )}
        </div>
      </header>
      <div className="sf-rule" />
    </>
  );
}

// The client mark identifies the brand, so no brand-name text sits under it.
// When there is no usable logo — 38 of 130 brands — the name itself is the
// mark, set in Anton at 45%.
function BrandMark({ url, name, onDead }: { url: string | null; name: string | null; onDead: () => void }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="sf-mark" src={url} alt={name ?? ""} onError={onDead} />;
  }
  if (!name) return null;
  return <div className="sf-markfb">{name}</div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sf-card">
      <div className="sf-ct">{title}</div>
      <div className="sf-cb">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="sf-fl">{label}</label>
      {children}
    </div>
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
      className="sf-fi"
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

function ChooserOption({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="sf-pick" onClick={onClick}>
      <span className="sf-pick-ic">{icon}</span>
      <span className="sf-pick-tx">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      <span className="sf-pick-go">
        <ChevronIcon />
      </span>
    </button>
  );
}

// One upload zone. Each states its own requirement inside it — there is no
// separate checklist above them, which duplicated this and was rejected.
function Zone({
  primary,
  icon,
  title,
  sub,
  pill,
  pillOk,
  pips,
  buttonLabel,
  onPick,
  disabled,
  foot,
}: {
  primary?: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  pill: string;
  pillOk: boolean;
  pips?: React.ReactNode;
  buttonLabel: string;
  onPick: () => void;
  disabled: boolean;
  foot?: string;
}) {
  return (
    <div className={`sf-zn ${primary ? "pri" : "sec"}`}>
      <div className="sf-zh">
        <span className="sf-zic">{icon}</span>
        <span className="sf-ztl">
          <span className="a" style={{ display: "block" }}>
            {title}
          </span>
          <span className="b" style={{ display: "block" }}>
            {sub}
          </span>
        </span>
        <span className={`sf-zst${pillOk ? " ok" : ""}`}>{pill}</span>
      </div>
      {pips}
      <button type="button" className="sf-zbtn" onClick={onPick} disabled={disabled}>
        <UploadIcon />
        {buttonLabel}
      </button>
      {foot && <div className="sf-zfoot">{foot}</div>}
    </div>
  );
}

function ReceivedSummary({ files }: { files: Picked[] }) {
  const photos = files.filter((f) => f.kind === "photo" && f.fileClass !== "raw").length;
  const videos = files.filter((f) => f.kind === "video" && f.fileClass !== "raw").length;
  const raw = files.filter((f) => f.fileClass === "raw").length;
  return (
    <div className="sf-recv">
      <span className="sf-recv-ic">
        <TickIcon />
      </span>
      <div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: ink(1) }}>Content received</div>
        <div className="sf-row-m" style={{ marginTop: 2 }}>
          {files.length} {plural(files.length, "file")} · {photos} {plural(photos, "photo")}, {videos}{" "}
          {plural(videos, "video")}
          {raw > 0 ? ` · ${raw} raw` : ""}
        </div>
      </div>
    </div>
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
      className={`sf-ack${disabled ? " off" : ""}`}
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
      <span className={`sf-box${checked ? " on" : ""}`}>{checked && <TickIcon />}</span>
      <div className="sf-ack-tx">{children}</div>
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
        <span className="sf-ph">▶</span>
      )}
      {f.fileClass === "raw" && <span className="sf-badge">raw</span>}
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
    <div className="sf-row" style={failed ? { borderColor: ink(0.28) } : undefined}>
      <div className="sf-row-th">
        {f.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.previewUrl} alt="" />
        ) : (
          "▶"
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sf-row-n">{f.file.name}</div>
        {f.status === "uploading" && (
          <div className="sf-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="sf-row-m" style={{ marginTop: f.status === "uploading" ? 0 : 3 }}>
          {meta}
        </div>
      </div>

      {failed && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <button type="button" className="sf-retry" onClick={onRetry}>
            Retry
          </button>
          {removable && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${f.file.name}`}
              style={{ color: ink(0.45), fontSize: 15 }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Footer({ postgame, expiresAt }: { postgame: string | null; expiresAt: string | null }) {
  return (
    <div className="sf-foot">
      {postgame && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={postgame} alt="Postgame" />
      )}
      <div className="q">Have a question?</div>
      <div className="sf-ln">
        <a href="sms:">
          <MsgIcon /> Text your Postgame contact
        </a>
        <a href="https://instagram.com/postgame" target="_blank" rel="noopener noreferrer">
          <IgIcon /> DM @postgame
        </a>
      </div>
      {expiresAt && formatDate(expiresAt) && (
        <span className="sf-exp">Link expires {formatDate(expiresAt)}</span>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────

const S = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...S} aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...S} aria-hidden="true">
      <path d="m22 8-6 4 6 4V8z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...S} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...S} aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.9" {...S} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...S} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...S} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v13" />
    </svg>
  );
}

function MsgIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...S} aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 4 11.5a8.4 8.4 0 0 1 8.5-8.4h.5a8.4 8.4 0 0 1 8 8z" />
    </svg>
  );
}

function IgIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...S} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="3" {...S} aria-hidden="true">
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...S} width="9" height="9" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
