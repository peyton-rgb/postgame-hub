"use client";

// Run-of-show upload box. Crew pick their name, then drop a whole SD card
// folder; files go straight from this browser to the Postgame Mac Studio over
// tus (resumable uploads), three at a time. The Hub only issues the signed
// token (/api/ros-upload/token) and relays the Studio's "saved" reports
// (/api/ros-upload/status). This page never builds a LucidLink path and never
// tries to download an upload back.

import { useEffect, useReducer, useRef, useState } from "react";
import * as tus from "tus-js-client";

const CHUNK_SIZE = 50 * 1024 * 1024;
const RETRY_DELAYS = [0, 3000, 5000, 10000, 20000, 60000];
const PARALLEL_FILES = 3;
const POLL_MS = 10_000;
const OFFLINE_RETRY_MS = 30_000;
const TOKEN_REFRESH_MARGIN_S = 10 * 60;
// A card can hold thousands of files; only this many rows are ever in the page.
const MAX_ACTIVE_ROWS = 50;
const MAX_SAVED_ROWS = 200;

const MSG_OFFLINE =
  "The upload server isn't responding. Your progress is saved — keep this page open, it will retry automatically.";
const MSG_EXPIRED =
  "This upload link has expired. Contact your Postgame point of contact.";
const MSG_NO_SPACE =
  "The upload server is out of space. Your progress is saved — let your Postgame point of contact know, then press Retry.";
const MSG_BAD_NAME = "This file's name can't be saved. Rename it and add it again.";

export interface CrewMember {
  name: string;
  role: string;
}

type FileKind = "raw" | "working";
type ItemStatus = "queued" | "uploading" | "received" | "saved" | "failed";

interface PickedFile {
  file: File;
  relativePath: string; // path inside the dropped folder, "" for a loose file
}

interface Item extends PickedFile {
  id: number;
  key: string;
  status: ItemStatus;
  sent: number;
  uploadId: string | null;
  error: string | null;
  uploaderName: string;
  uploaderRole: string;
  fileKind: FileKind;
}

interface UploadToken {
  token: string;
  uploadUrl: string;
  expiresAt: number;
}

class TokenError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// "Dave Jordan (Video)" → { name: "Dave Jordan", role: "VIDEO" }. Empty and
// "TBD" slots are dropped.
export function parseCrew(raw: Array<string | null | undefined>): CrewMember[] {
  const crew: CrewMember[] = [];
  for (const entry of raw) {
    const text = (entry || "").trim();
    if (!text || text.toUpperCase() === "TBD") continue;
    const m = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    const name = (m ? m[1] : text).trim();
    if (!name) continue;
    crew.push({ name, role: (m ? m[2] : "").trim().toUpperCase() || "CREW" });
  }
  return crew;
}

// Hidden and system files, and anything inside a hidden folder
// (.Spotlight-V100, .Trashes …), are skipped without a word.
function isJunk(path: string): boolean {
  return path.split("/").some((part) => {
    const p = part.toLowerCase();
    return p.startsWith(".") || p === "thumbs.db" || p === "desktop.ini";
  });
}

const fileKey = (f: PickedFile) =>
  `${f.relativePath || f.file.name}|${f.file.size}|${f.file.lastModified}`;

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return bytes > 0 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : "0 KB";
}

function formatTimeLeft(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return "under a minute left";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min left`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min left`;
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1, dot + 5).toUpperCase() : "FILE";
};

// The receiver turns a file down with JSON { code, message }.
function readRejection(err: unknown): { code: string; message: string } | null {
  const body = (err as tus.DetailedError)?.originalResponse?.getBody?.();
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    return typeof parsed?.code === "string"
      ? { code: parsed.code, message: String(parsed.message || "") }
      : null;
  } catch {
    return null;
  }
}

// Read a dropped folder recursively, keeping each file's path inside it.
async function readEntry(entry: FileSystemEntry, out: PickedFile[]): Promise<void> {
  if (entry.name.startsWith(".")) return;
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject)
    );
    const path = entry.fullPath.replace(/^\//, "");
    out.push({ file, relativePath: path.includes("/") ? path : "" });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries hands back one page at a time; an empty page means done.
  for (;;) {
    const page = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );
    if (page.length === 0) break;
    for (const child of page) await readEntry(child, out);
  }
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mt-5 text-[15px] font-bold text-gray-900">
      <span className="w-6 h-6 rounded-full bg-gray-900 text-white grid place-items-center text-xs flex-none">
        {n}
      </span>
      {children}
    </div>
  );
}

function FileRow({ item, onRetry }: { item: Item; onRetry: (item: Item) => void }) {
  const size = item.file.size;
  const done = item.status === "received" || item.status === "saved";
  const pct = done ? 100 : size ? Math.min(100, Math.floor((item.sent / size) * 100)) : 0;
  return (
    <li className="flex items-center gap-3 border border-[#e7e7e4] rounded-[10px] px-3 py-2.5">
      <div className="flex-none w-[38px] h-[38px] rounded-lg bg-[#f3e3df] text-[#D73F09] grid place-items-center text-[10px] font-bold">
        {extensionOf(item.file.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-2.5 text-[13px] font-bold text-gray-900">
          <span className="truncate" title={item.relativePath || item.file.name}>
            {item.file.name}
          </span>
          <span className="flex-none font-normal text-gray-500 tabular-nums">
            {item.status === "queued" ? "Waiting" : `${pct}%`}
          </span>
        </div>
        <div className="h-1.5 bg-[#ececea] rounded-full mt-[7px] overflow-hidden">
          <i
            className="block h-full bg-[#D73F09] rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] mt-[5px] text-gray-400">
          {formatBytes(size)} ·{" "}
          {item.status === "queued" && "Queued"}
          {item.status === "uploading" && "Uploading"}
          {item.status === "received" && "Received"}
          {item.status === "saved" && (
            <span className="text-green-700 font-bold">Saved to LucidLink</span>
          )}
          {item.status === "failed" && (
            <span className="text-red-600 font-bold">
              Failed —{" "}
              <button type="button" onClick={() => onRetry(item)} className="underline">
                Retry
              </button>
              {item.error && <span className="font-normal"> · {item.error}</span>}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function UploadBox({ shootId, crew }: { shootId: string; crew: CrewMember[] }) {
  // "crew:<index>" or "other"
  const [selected, setSelected] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [kind, setKind] = useState<FileKind>("raw");
  const [staged, setStaged] = useState<PickedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [unfinished, setUnfinished] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // The upload queue lives in refs: progress events arrive many times a second
  // and re-rendering on each would crawl with a full card. `bump` re-renders
  // at most ~6 times a second instead.
  const itemsRef = useRef<Item[]>([]);
  const nextIdRef = useRef(1);
  const activeRef = useRef(0);
  const haltedRef = useRef(false);
  const batchIdRef = useRef("");
  const tokenRef = useRef<UploadToken | null>(null);
  const tokenRequestRef = useRef<Promise<UploadToken> | null>(null);
  const speedRef = useRef(0);
  const bumpTimerRef = useRef<number | null>(null);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const storagePrefix = `ros-${shootId}-`;

  function bump() {
    if (bumpTimerRef.current != null) return;
    bumpTimerRef.current = window.setTimeout(() => {
      bumpTimerRef.current = null;
      forceRender();
    }, 150);
  }

  // On load: are there uploads this browser started for this shoot and never
  // finished? tus keeps one localStorage entry per unfinished file. If so, keep
  // the same batch id so their "saved" reports still match this page.
  useEffect(() => {
    let hasUnfinished = false;
    let storedBatch: string | null = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)?.startsWith(`tus::${storagePrefix}`)) hasUnfinished = true;
      }
      storedBatch = localStorage.getItem(`ros-upload-batch:${shootId}`);
    } catch {
      // Private windows can block storage; uploads still work, just without resume.
    }
    const batchId = hasUnfinished && storedBatch ? storedBatch : crypto.randomUUID();
    batchIdRef.current = batchId;
    try {
      localStorage.setItem(`ros-upload-batch:${shootId}`, batchId);
    } catch {}
    setUnfinished(hasUnfinished);
  }, [shootId, storagePrefix]);

  // ---- token ----

  async function getToken(): Promise<UploadToken> {
    const cached = tokenRef.current;
    if (cached && cached.expiresAt - Date.now() / 1000 > TOKEN_REFRESH_MARGIN_S) return cached;
    if (!tokenRequestRef.current) {
      tokenRequestRef.current = (async () => {
        const res = await fetch("/api/ros-upload/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shootId }),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token || !data.uploadUrl) {
          throw new TokenError(data.code || (res.status >= 500 ? "server" : "uploads_off"));
        }
        tokenRef.current = data as UploadToken;
        return tokenRef.current;
      })().finally(() => {
        tokenRequestRef.current = null;
      });
    }
    return tokenRequestRef.current;
  }

  // ---- queue ----

  function pump() {
    while (activeRef.current < PARALLEL_FILES && !haltedRef.current) {
      const next = itemsRef.current.find((i) => i.status === "queued");
      if (!next) break;
      activeRef.current++;
      next.status = "uploading";
      void startUpload(next);
    }
    bump();
  }
  // tus callbacks and timers outlive the render that created them.
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  function release() {
    activeRef.current = Math.max(0, activeRef.current - 1);
    pumpRef.current();
  }

  // Server unreachable: put the file back in line and try again shortly. tus
  // remembers how far it got, so the retry continues instead of restarting.
  function waitAndRetry(item: Item) {
    item.status = "queued";
    activeRef.current = Math.max(0, activeRef.current - 1);
    setNotice(MSG_OFFLINE);
    bump();
    window.setTimeout(() => pumpRef.current(), OFFLINE_RETRY_MS);
  }

  function stopEverything(message: string) {
    haltedRef.current = true;
    setFatal(message);
  }

  async function startUpload(item: Item) {
    let token: UploadToken;
    try {
      token = await getToken();
    } catch (e) {
      const code = e instanceof TokenError ? e.code : "network";
      if (code === "token_expired" || code === "uploads_off" || code === "not_configured") {
        item.status = "queued";
        activeRef.current = Math.max(0, activeRef.current - 1);
        stopEverything(
          code === "token_expired"
            ? MSG_EXPIRED
            : "Uploads aren't open for this shoot right now. Contact your Postgame point of contact."
        );
        bump();
      } else {
        waitAndRetry(item);
      }
      return;
    }

    const upload = new tus.Upload(item.file, {
      endpoint: token.uploadUrl,
      chunkSize: CHUNK_SIZE,
      retryDelays: RETRY_DELAYS,
      // One stream per file — the receiver does not accept tus "parallel uploads".
      parallelUploads: 1,
      removeFingerprintOnSuccess: true,
      metadata: {
        token: token.token,
        filename: item.file.name,
        relativePath: item.relativePath,
        filetype: item.file.type || "application/octet-stream",
        uploaderName: item.uploaderName,
        uploaderRole: item.uploaderRole,
        fileKind: item.fileKind,
        uploadBatchId: batchIdRef.current,
      },
      // Same file, same place, same uploader → same fingerprint, which is what
      // lets a re-chosen folder pick up where it stopped after a refresh.
      fingerprint: async () =>
        [
          storagePrefix.slice(0, -1),
          item.uploaderName,
          item.fileKind,
          item.relativePath || item.file.name,
          item.file.size,
          item.file.lastModified,
        ].join("-"),
      // A file the receiver turned down will be turned down again; only
      // connection trouble and server errors are worth another try.
      onShouldRetry: (err) => {
        if (readRejection(err)) return false;
        const status = err.originalResponse?.getStatus() ?? 0;
        return !(status >= 400 && status < 500) || status === 409 || status === 423;
      },
      onProgress: (sent) => {
        item.sent = sent;
        bump();
      },
      onSuccess: () => {
        item.status = "received";
        item.sent = item.file.size;
        item.uploadId = upload.url?.split("?")[0].split("/").filter(Boolean).pop() || null;
        setNotice(null);
        release();
      },
      onError: (err) => {
        const rejection = readRejection(err);
        const status = (err as tus.DetailedError).originalResponse?.getStatus() ?? 0;

        if (rejection?.code === "ignored_file") {
          itemsRef.current = itemsRef.current.filter((i) => i !== item);
          release();
          return;
        }
        if (rejection?.code === "bad_token" || rejection?.code === "token_expired") {
          tokenRef.current = null;
          item.status = "failed";
          item.error = null;
          stopEverything(MSG_EXPIRED);
          release();
          return;
        }
        if (rejection || (status >= 400 && status < 500)) {
          item.status = "failed";
          item.error =
            rejection?.code === "bad_name"
              ? MSG_BAD_NAME
              : rejection?.code === "bad_req_space"
              ? "Server out of space."
              : rejection?.message || null;
          if (rejection?.code === "bad_req_space") setNotice(MSG_NO_SPACE);
          release();
          return;
        }
        waitAndRetry(item);
      },
    });

    try {
      const previous = await upload.findPreviousUploads();
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
    } catch {
      // No stored progress to resume from — start fresh.
    }
    upload.start();
  }

  function retry(item: Item) {
    item.status = "queued";
    item.error = null;
    item.sent = 0;
    item.uploadId = null;
    setNotice(null);
    pump();
  }

  // ---- adding files ----

  function stage(picked: PickedFile[]) {
    const taken = new Set([...itemsRef.current.map((i) => i.key), ...staged.map(fileKey)]);
    const fresh: PickedFile[] = [];
    for (const f of picked) {
      if (isJunk(f.relativePath || f.file.name)) continue;
      const key = fileKey(f);
      if (taken.has(key)) continue;
      taken.add(key);
      fresh.push(f);
    }
    if (fresh.length > 0) setStaged((s) => [...s, ...fresh]);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    stage(files.map((file) => ({ file, relativePath: file.webkitRelativePath || "" })));
    e.target.value = "";
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!uploader) return;
    // Entries must be collected before the first await — the browser empties
    // the drop's item list as soon as this handler yields.
    const entries = Array.from(e.dataTransfer.items)
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));
    const loose = Array.from(e.dataTransfer.files);
    if (entries.length === 0) {
      stage(loose.map((file) => ({ file, relativePath: "" })));
      return;
    }
    setReading(true);
    const picked: PickedFile[] = [];
    try {
      for (const entry of entries) await readEntry(entry, picked);
    } finally {
      setReading(false);
    }
    stage(picked);
  }

  function startStaged() {
    if (!uploader || staged.length === 0) return;
    for (const f of staged) {
      itemsRef.current.push({
        ...f,
        id: nextIdRef.current++,
        key: fileKey(f),
        status: "queued",
        sent: 0,
        uploadId: null,
        error: null,
        uploaderName: uploader.name,
        uploaderRole: uploader.role,
        fileKind: kind,
      });
    }
    setStaged([]);
    setUnfinished(false);
    pump();
  }

  // ---- derived state ----

  const uploader: CrewMember | null =
    selected === "other"
      ? otherName.trim()
        ? { name: otherName.trim(), role: "CREW" }
        : null
      : selected
      ? crew[Number(selected.split(":")[1])] || null
      : null;
  const firstName = uploader?.name.split(/\s+/)[0] || "";
  const locked = !uploader;

  const items = itemsRef.current;
  const failed = items.filter((i) => i.status === "failed");
  const uploading = items.filter((i) => i.status === "uploading");
  const received = items.filter((i) => i.status === "received");
  const queued = items.filter((i) => i.status === "queued");
  const saved = items.filter((i) => i.status === "saved");
  const activeRows = [...failed, ...uploading, ...received, ...queued];
  const busy = uploading.length + queued.length > 0;
  const awaitingStudio = received.length > 0;
  const allSaved = items.length > 0 && saved.length === items.length;

  const totalBytes = items.reduce((sum, i) => sum + i.file.size, 0);
  const sentBytes = items.reduce(
    (sum, i) => sum + (i.status === "received" || i.status === "saved" ? i.file.size : i.sent),
    0
  );
  const filesDone = received.length + saved.length;
  const overallPct = totalBytes ? Math.min(100, (sentBytes / totalBytes) * 100) : 0;
  const stagedBytes = staged.reduce((sum, f) => sum + f.file.size, 0);

  // ---- timers ----

  // Speed: bytes sent over the last ~10 seconds.
  const sentBytesRef = useRef(0);
  sentBytesRef.current = sentBytes;
  const isUploading = uploading.length > 0;
  useEffect(() => {
    if (!isUploading) {
      speedRef.current = 0;
      return;
    }
    const samples: Array<[number, number]> = [[Date.now(), sentBytesRef.current]];
    const timer = window.setInterval(() => {
      samples.push([Date.now(), sentBytesRef.current]);
      if (samples.length > 10) samples.shift();
      const [t0, b0] = samples[0];
      const [t1, b1] = samples[samples.length - 1];
      speedRef.current = t1 > t0 ? Math.max(0, ((b1 - b0) / (t1 - t0)) * 1000) : 0;
      forceRender();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isUploading]);

  // "Received" → "Saved to LucidLink" once the Studio has reported on the file.
  useEffect(() => {
    if (!awaitingStudio) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(
          `/api/ros-upload/status?shootId=${shootId}&batchId=${encodeURIComponent(batchIdRef.current)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const { uploads } = (await res.json()) as {
          uploads: Array<{ upload_id: string; status: string; error: string | null }>;
        };
        const byId = new Map(uploads.map((u) => [u.upload_id, u]));
        for (const item of itemsRef.current) {
          if (item.status !== "received" || !item.uploadId) continue;
          const report = byId.get(item.uploadId);
          if (!report) continue;
          if (report.status === "in_lucid") item.status = "saved";
          else {
            item.status = "failed";
            item.error = report.error || "The server couldn't save this file.";
          }
        }
        forceRender();
      } catch {
        // Next poll will try again.
      }
    }
    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [awaitingStudio, shootId]);

  // Browser's own "leave this page?" warning while anything is still uploading.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // ---- render ----

  const rowBase =
    "flex items-center gap-2.5 w-full text-left rounded-[10px] border-[1.5px] px-3 py-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D73F09]";
  const personRow = (isOn: boolean) =>
    `${rowBase} ${isOn ? "border-[#D73F09] bg-[#fff7f4]" : "border-[#e7e7e4] bg-white hover:border-gray-300"}`;
  const check = (isOn: boolean) => (
    <span
      aria-hidden="true"
      className={`w-6 h-6 rounded-full border-[1.5px] grid place-items-center text-[13px] flex-none ${
        isOn ? "bg-[#D73F09] border-[#D73F09] text-white" : "border-[#e7e7e4] text-transparent"
      }`}
    >
      ✓
    </span>
  );
  const timeLeft =
    speedRef.current > 0 ? formatTimeLeft((totalBytes - sentBytes) / speedRef.current) : "";

  return (
    <section
      aria-labelledby="ros-upload-title"
      className="bg-white border border-gray-200 rounded-xl p-5 mb-10"
    >
      <h2 id="ros-upload-title" className="text-xl font-black text-gray-900">
        Upload Your Footage
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Pick your name, then add your files. Keep this page open until everything says Saved.
      </p>

      {unfinished && items.length === 0 && (
        <div className="mt-4 rounded-[10px] border-[1.5px] border-[#D73F09] bg-[#fff7f4] px-4 py-3 text-sm font-bold text-[#D73F09]">
          You have unfinished uploads — choose the same folder again to resume.
        </div>
      )}

      {/* 1 — Who are you? */}
      <StepTitle n={1}>Who are you?</StepTitle>
      <div role="radiogroup" aria-label="Select your name" className="flex flex-col gap-1.5 mt-2.5">
        {crew.map((person, i) => {
          const isOn = selected === `crew:${i}`;
          return (
            <button
              key={`${person.name}-${i}`}
              type="button"
              role="radio"
              aria-checked={isOn}
              onClick={() => setSelected(`crew:${i}`)}
              className={personRow(isOn)}
            >
              {check(isOn)}
              <span className="flex-1 min-w-0 flex justify-between items-baseline gap-2.5">
                <b className="text-[15px] text-gray-900 truncate">{person.name}</b>
                <small className="text-[11px] tracking-[0.12em] uppercase font-bold text-gray-400 flex-none">
                  {person.role}
                </small>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={selected === "other"}
          onClick={() => setSelected("other")}
          className={personRow(selected === "other")}
        >
          {check(selected === "other")}
          <b className="text-[15px] text-gray-900">Someone else</b>
        </button>
        {selected === "other" && (
          <input
            autoFocus
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            placeholder="Your full name"
            aria-label="Your full name"
            maxLength={80}
            className="w-full rounded-[10px] border-[1.5px] border-[#e7e7e4] px-3 py-[11px] text-[15px] text-gray-900 outline-none focus:border-[#D73F09]"
          />
        )}
      </div>

      {/* 2 — What are you uploading? */}
      <div className={locked ? "opacity-40 pointer-events-none" : ""} aria-disabled={locked}>
        <StepTitle n={2}>What are you uploading?</StepTitle>
        <div className="grid grid-cols-2 gap-1.5 mt-2.5 sm:max-w-md">
          {(["raw", "working"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              disabled={locked}
              onClick={() => setKind(value)}
              className={`rounded-[10px] border-[1.5px] px-3 py-[11px] text-sm font-bold ${
                kind === value
                  ? "border-[#D73F09] bg-[#fff7f4] text-[#D73F09]"
                  : "border-[#e7e7e4] bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {value === "raw" ? "Raw footage" : "Working files"}
            </button>
          ))}
        </div>
      </div>

      {/* 3 — Add your files */}
      <StepTitle n={3}>{firstName ? `Add your files, ${firstName}` : "Add your files"}</StepTitle>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!locked) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center text-center gap-1.5 mt-2.5 rounded-xl border-2 border-dashed px-4 py-9 sm:py-12 transition-colors ${
          locked
            ? "border-[#e7e7e4] bg-[#f4f4f2]"
            : dragOver
            ? "border-[#D73F09] bg-[#f3e3df]"
            : "border-[#d4d4cf] bg-[#fafaf8]"
        }`}
      >
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className={`w-[46px] h-[46px] text-[#D73F09] ${locked ? "opacity-40" : ""}`}
        >
          <path
            d="M14 36h-2a9 9 0 0 1-1.2-17.9A12 12 0 0 1 34 14a8 8 0 0 1 4.5 14.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M24 40V24m0 0-6 6m6-6 6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className={`font-bold text-base text-gray-900 ${locked ? "opacity-40" : ""}`}>
          {reading ? "Reading your folder…" : "Drag your SD card folder or files here"}
        </div>
        {locked ? (
          <div className="inline-block text-[13px] font-bold text-[#D73F09] bg-white border border-[#D73F09] rounded-full px-3 py-[5px] mt-1">
            Pick your name above to start
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="rounded-lg bg-gray-900 text-white text-sm font-bold px-4 py-2.5"
            >
              Choose folder
            </button>
            <button
              type="button"
              onClick={() => filesInputRef.current?.click()}
              className="rounded-lg border border-[#e7e7e4] bg-white text-gray-900 text-sm font-bold px-4 py-2.5"
            >
              Choose files
            </button>
          </div>
        )}
        <div className={`text-[11px] text-gray-400 mt-1.5 ${locked ? "opacity-40" : ""}`}>
          MP4 · MOV · BRAW · MXF · JPG · RAW photos · any size
        </div>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          hidden
          onChange={onInputChange}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />
        <input ref={filesInputRef} type="file" multiple hidden onChange={onInputChange} />
      </div>

      {staged.length > 0 && !fatal && (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button
            type="button"
            onClick={startStaged}
            disabled={locked}
            className="flex-1 min-w-[240px] rounded-lg bg-[#D73F09] text-white text-base font-bold text-center px-4 py-3.5 disabled:opacity-40"
          >
            {staged.length.toLocaleString()} {staged.length === 1 ? "file" : "files"} ·{" "}
            {formatBytes(stagedBytes)} — Start upload
          </button>
          <button
            type="button"
            onClick={() => setStaged([])}
            className="text-sm font-bold text-gray-500 underline"
          >
            Clear
          </button>
        </div>
      )}

      {fatal && (
        <div role="alert" className="mt-4 rounded-[10px] border-[1.5px] border-red-600 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {fatal}
        </div>
      )}
      {notice && !fatal && (
        <div role="status" className="mt-4 rounded-[10px] border-[1.5px] border-[#D73F09] bg-[#fff7f4] px-4 py-3 text-sm font-bold text-[#D73F09]">
          {notice}
        </div>
      )}

      {allSaved && (
        <div role="status" className="mt-4 rounded-xl bg-green-50 border-[1.5px] border-green-600 px-4 py-5 text-center text-xl font-black text-green-700">
          All {items.length.toLocaleString()} {items.length === 1 ? "file" : "files"} saved ✓
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Overall progress */}
          <div className="mt-4 rounded-[10px] border border-[#e7e7e4] px-3.5 py-3">
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] font-bold text-gray-900 tabular-nums">
              <span>
                {filesDone.toLocaleString()} / {items.length.toLocaleString()} files
              </span>
              <span>
                {formatBytes(sentBytes)} / {formatBytes(totalBytes)}
              </span>
            </div>
            <div className="h-2 bg-[#ececea] rounded-full mt-2 overflow-hidden">
              <i
                className="block h-full bg-[#D73F09] rounded-full transition-[width] duration-300"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 text-[11px] text-gray-500 mt-1.5 tabular-nums min-h-[16px]">
              <span>{speedRef.current > 0 ? `${formatBytes(speedRef.current)}/s` : ""}</span>
              <span>{timeLeft}</span>
            </div>
          </div>

          {/* In progress and failed first */}
          {activeRows.length > 0 && (
            <ul aria-label="Uploads" className="flex flex-col gap-2.5 mt-3.5">
              {activeRows.slice(0, MAX_ACTIVE_ROWS).map((item) => (
                <FileRow key={item.id} item={item} onRetry={retry} />
              ))}
            </ul>
          )}
          {activeRows.length > MAX_ACTIVE_ROWS && (
            <div className="text-xs text-gray-500 mt-2.5 text-center">
              + {(activeRows.length - MAX_ACTIVE_ROWS).toLocaleString()} more waiting
            </div>
          )}

          {/* Saved group, collapsed */}
          {saved.length > 0 && (
            <div className="mt-3.5">
              <button
                type="button"
                aria-expanded={showSaved}
                onClick={() => setShowSaved((v) => !v)}
                className="w-full flex justify-between items-center rounded-[10px] border border-[#e7e7e4] px-3.5 py-3 text-sm font-bold text-green-700"
              >
                <span>✓ {saved.length.toLocaleString()} saved</span>
                <span className="text-gray-400 font-normal">{showSaved ? "Hide" : "Show"}</span>
              </button>
              {showSaved && (
                <ul aria-label="Saved files" className="flex flex-col gap-2.5 mt-2.5">
                  {saved.slice(0, MAX_SAVED_ROWS).map((item) => (
                    <FileRow key={item.id} item={item} onRetry={retry} />
                  ))}
                  {saved.length > MAX_SAVED_ROWS && (
                    <li className="text-xs text-gray-500 text-center">
                      + {(saved.length - MAX_SAVED_ROWS).toLocaleString()} more saved
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-[11.5px] text-gray-500 mt-3">
        Keep this page open until every file says <b>Saved to LucidLink</b>.
      </p>
    </section>
  );
}
