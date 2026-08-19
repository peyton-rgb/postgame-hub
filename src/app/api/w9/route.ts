// src/app/api/w9/route.ts
// ─────────────────────────────────────────────────────────────
// PUBLIC videographer W-9 submission — NO session, NO token.
//
//   POST /api/w9   multipart/form-data, single request, no chunking.
//
// This is the most exposed write in the app: a public door with no token in
// front of it. Everything the client sends is untrusted, so every rule the
// form enforces is re-enforced here, and the row lands in its own table
// (videographer_w9_submissions) rather than on `videographers`. A human links
// a submission to a real videographer later, in admin.
//
// Order of operations is deliberate: validate → Drive → Supabase. The PDF is
// the irreplaceable half (the submitter can't easily re-sign and re-scan), the
// row is cheap to recreate. So the file lands first, and if the insert then
// fails we hand the client back the Drive pointer and let it retry THE RECORD
// ONLY — re-posting the file would leave duplicate PDFs in the folder. The
// submit page handles the same failure with its `recordFailed` state.
//
// Size cap is 4MB, NOT the 10MB an earlier mockup showed: Vercel caps request
// bodies around 4.5MB and this route relays the bytes through our own function
// rather than handing the browser a resumable session. The real W-9s already in
// the folder are 174KB and 325KB, so 4MB is generous. If a scanned W-9 ever
// exceeds it, the fallback is the chunked relay in /api/submit/[token].
//
// Reuses getDriveClient()/ensureFolder() — the same refresh-token Drive path
// the staff routes use — but WITHOUT their auth guard. Drive gotcha that has
// bitten this repo before: corpora "allDrives", never "user,allDrives" (400).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { createServiceSupabase } from "@/lib/supabase";
import { getDriveClient, ensureFolder } from "@/lib/google-drive";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel's body cap is ~4.5MB; stay under it with room for the form fields. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** A public door with no token: 5 submissions per IP per hour. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** A clock-skewed phone must not lose a submission — see stampAck(). */
const ACK_SKEW_MS = 24 * 60 * 60 * 1000;

// ── Errors ────────────────────────────────────────────────────

/** Every rejection carries a message written for the person filling the form,
 *  not for a log. The client renders `error` verbatim. */
class SubmitError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── Field validation ──────────────────────────────────────────
// Each helper throws a SubmitError naming the field in the submitter's own
// language ("ZIP code", not "postal_code"). The client gate mirrors these, but
// these are the ones that count — the client is a convenience, not a control.

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function required(form: FormData, key: string, label: string): string {
  const v = str(form, key);
  if (!v) throw new SubmitError(`${label} is required.`);
  return v;
}

/** Optional text → null, so the column stays NULL rather than holding "". */
function optional(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

/** Deliberately loose: something@something.something. A public form is not the
 *  place to argue with a valid-but-unusual address; the strict check is a human
 *  reading the row before a 1099 goes out. */
function email(form: FormData): string {
  const v = required(form, "email", "Email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    throw new SubmitError("That email address doesn't look right.");
  }
  return v.toLowerCase();
}

/** Stored digits-only so "(941) 555-0143" and "941-555-0143" are the same row
 *  to anyone searching later. 10 digits is the US minimum; a leading 1 or a
 *  country code just makes it longer, which is fine. */
function phone(form: FormData): string {
  const raw = required(form, "phone", "Phone number");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) {
    throw new SubmitError("That phone number doesn't look right — we need at least 10 digits.");
  }
  return digits;
}

function state(form: FormData): string {
  const v = required(form, "state", "State");
  if (!/^[A-Za-z]{2}$/.test(v)) {
    throw new SubmitError("Use the 2-letter state code (like FL).");
  }
  return v.toUpperCase();
}

function postalCode(form: FormData): string {
  const v = required(form, "postal_code", "ZIP code");
  if (!/^\d{5}(-\d{4})?$/.test(v)) {
    throw new SubmitError("ZIP code should be 12345 or 12345-6789.");
  }
  return v;
}

/**
 * The tick timestamp the client reported, trusted only if it's within a day of
 * server time. A phone with a wrong clock is common and is not the submitter's
 * fault, so a skewed value is replaced rather than rejected — losing a
 * completed W-9 over a bad clock would be the worse failure.
 */
function stampAck(form: FormData): string {
  const raw = str(form, "ack_accurate_at");
  if (!raw) throw new SubmitError("Please confirm your W-9 is accurate, signed and dated.");
  const now = Date.now();
  const t = Date.parse(raw);
  if (Number.isNaN(t) || Math.abs(now - t) > ACK_SKEW_MS) {
    return new Date(now).toISOString();
  }
  return new Date(t).toISOString();
}

/**
 * Tax year, derived server-side — never from the client, which would let anyone
 * file into any year's folder.
 *
 * Resolved in America/New_York rather than the runtime's zone on purpose:
 * Vercel runs Node at TZ=UTC, so a W-9 sent at 8pm ET on 31 Dec is already
 * 1 Jan in UTC and would file into next year's folder. The business is in ET,
 * so the calendar that matters is ET.
 */
function currentTaxYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    }).format(new Date())
  );
}

// ── The file ──────────────────────────────────────────────────

/**
 * Validate the upload and hand back its bytes.
 *
 * The type check reads the BYTES, not the name: `file.type` comes from the
 * browser's guess off the extension, and renaming `payload.exe` to `w9.pdf` is
 * a two-second operation. A real PDF starts `%PDF-`. Both checks must pass.
 */
async function readPdf(form: FormData): Promise<{ buffer: Buffer; size: number }> {
  const entries = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (entries.length === 0) throw new SubmitError("Attach your signed W-9 as a PDF.");
  if (entries.length > 1) throw new SubmitError("Attach one PDF, not several.");

  const file = entries[0];
  if (file.size > MAX_FILE_BYTES) {
    throw new SubmitError("That file is over 4MB. Try saving the PDF at a smaller size.", 413);
  }
  if (file.type !== "application/pdf") {
    throw new SubmitError("Your W-9 needs to be a PDF.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new SubmitError("That file isn't a real PDF. Re-save your W-9 as a PDF and try again.");
  }
  return { buffer, size: buffer.length };
}

/**
 * Drive filename, matching the convention already in the folder
 * ("CHRIS GRESSMAN MEDIA LLC W9.pdf", "Varsity House Prod W9.pdf"):
 * the payee in caps, then " W9.pdf".
 *
 * The business name wins when present — that is who the 1099 is made out to.
 */
function derivedFileName(businessName: string | null, first: string, last: string): string {
  const base = businessName || `${first} ${last}`;
  const name = base
    .trim()
    .toUpperCase()
    // characters Drive and every OS choke on
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${name || "UNNAMED"} W9.pdf`;
}

/**
 * Names already taken in the folder, so a collision can step aside instead of
 * overwriting. Two people can legitimately share a name, and silently replacing
 * someone's signed tax document is unrecoverable — there is no undo for that.
 */
async function takenNames(folderId: string): Promise<Set<string>> {
  const drive = getDriveClient();
  const names = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      // "allDrives", never "user,allDrives" — the latter is a 400 from Drive.
      corpora: "allDrives",
      fields: "nextPageToken, files(name)",
      pageSize: 200,
      pageToken,
    });
    for (const f of res.data.files ?? []) if (f.name) names.add(f.name);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return names;
}

/** "NAME W9.pdf" → "NAME W9 (2).pdf" → "NAME W9 (3).pdf" … */
function freeName(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) return desired;
  const stem = desired.replace(/\.pdf$/i, "");
  for (let n = 2; n < 500; n++) {
    const candidate = `${stem} (${n}).pdf`;
    if (!taken.has(candidate)) return candidate;
  }
  // 500 people with one name is not a real scenario, but never overwrite.
  return `${stem} (${Date.now()}).pdf`;
}

// ── Route ─────────────────────────────────────────────────────

interface Payee {
  business_name: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  ack_accurate_at: string;
}

function readPayee(form: FormData): Payee {
  return {
    business_name: optional(form, "business_name"),
    first_name: required(form, "first_name", "First name"),
    last_name: required(form, "last_name", "Last name"),
    email: email(form),
    phone: phone(form),
    address_line1: required(form, "address_line1", "Street address"),
    address_line2: optional(form, "address_line2"),
    city: required(form, "city", "City"),
    state: state(form),
    postal_code: postalCode(form),
    ack_accurate_at: stampAck(form),
  };
}

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit. Best-effort: src/lib/rate-limit is per-process and
    //    serverless instances don't share state, so this thins abuse rather
    //    than stopping it. The real controls are the size cap, the PDF magic
    //    number, and the fact that nothing can read this table back out.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!rateLimit(`w9:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: "You've sent this a few times already. Try again in an hour." },
        { status: 429 }
      );
    }

    // ── Reject an oversized body BEFORE parsing it, so a 50MB post doesn't get
    //    buffered into the function's memory just to be thrown away.
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_FILE_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: "That file is over 4MB. Try saving the PDF at a smaller size." },
        { status: 413 }
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new SubmitError("We couldn't read that submission. Please try again.");
    }

    const payee = readPayee(form);
    const taxYear = currentTaxYear();
    const supabase = createServiceSupabase();

    // ── Retry path: the upload already succeeded on an earlier attempt and only
    //    the insert failed. The client sends back the pointer we gave it and NO
    //    file, so we re-insert the record without re-uploading the PDF — a
    //    second upload would leave a duplicate in the folder that a human has to
    //    reconcile against someone's tax documents.
    const retryFileId = str(form, "drive_file_id");
    if (retryFileId) {
      const drive = getDriveClient();
      // The pointer is client-supplied, so confirm it is a real file that
      // actually sits in this year's W-9 folder before trusting it into a row.
      const { id: yearFolderId } = await ensureFolder(`${taxYear} W-9s`, parentFolderId());
      let meta;
      try {
        meta = await drive.files.get({
          fileId: retryFileId,
          supportsAllDrives: true,
          fields: "id, name, size, parents, webViewLink",
        });
      } catch {
        throw new SubmitError("We couldn't find that upload. Please start again.", 404);
      }
      if (!meta.data.parents?.includes(yearFolderId)) {
        throw new SubmitError("We couldn't find that upload. Please start again.", 404);
      }

      const row = await insertRow(supabase, payee, taxYear, {
        driveFileId: meta.data.id!,
        driveViewUrl: meta.data.webViewLink ?? null,
        fileName: meta.data.name ?? "W9.pdf",
        fileSizeBytes: Number(meta.data.size ?? 0) || null,
      });
      return NextResponse.json({
        ok: true,
        id: row.id,
        fileName: meta.data.name,
        fileSizeBytes: Number(meta.data.size ?? 0) || null,
        receivedAt: row.created_at,
      });
    }

    // ── Normal path: validate the bytes, then Drive, then the row.
    const { buffer, size } = await readPdf(form);

    const { id: yearFolderId } = await ensureFolder(`${taxYear} W-9s`, parentFolderId());
    const desired = derivedFileName(payee.business_name, payee.first_name, payee.last_name);
    const fileName = freeName(desired, await takenNames(yearFolderId));

    const drive = getDriveClient();
    // The W-9 folders live on a SHARED drive, so supportsAllDrives is required
    // on the write as well as on ensureFolder's lookup.
    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        mimeType: "application/pdf",
        parents: [yearFolderId],
      },
      media: { mimeType: "application/pdf", body: Readable.from(buffer) },
      fields: "id, name, webViewLink",
    });
    const driveFileId = created.data.id;
    if (!driveFileId) {
      throw new SubmitError("Drive didn't accept the upload. Please try again.", 502);
    }

    // ── The row. From here the PDF is safely in Drive, so a failure below is
    //    recoverable and must NOT ask for the file again.
    try {
      const row = await insertRow(supabase, payee, taxYear, {
        driveFileId,
        driveViewUrl: created.data.webViewLink ?? null,
        fileName,
        fileSizeBytes: size,
      });
      return NextResponse.json({
        ok: true,
        id: row.id,
        fileName,
        fileSizeBytes: size,
        receivedAt: row.created_at,
      });
    } catch (err) {
      console.error("[w9] upload landed but insert failed", err);
      return NextResponse.json(
        {
          error:
            "Your W-9 uploaded, but we couldn't save your details. Tap retry — we won't upload the file twice.",
          recordFailed: true,
          driveFileId,
          fileName,
          fileSizeBytes: size,
        },
        { status: 500 }
      );
    }
  } catch (err) {
    if (err instanceof SubmitError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[w9] unexpected failure", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Parent of the per-year folders — "Internal All / W9" in Drive. Held in an env
 * var rather than the year folder itself so January 2027 needs no code change:
 * ensureFolder finds-or-creates "2027 W-9s" underneath it on the first
 * submission of the year, exactly as the 2023/2025/2026 folders already exist.
 *
 * Vercel note: adding this variable does not trigger a redeploy on its own. It
 * has to be added AND the project redeployed, or this route 500s on first use.
 */
function parentFolderId(): string {
  const id = process.env.W9_DRIVE_PARENT_FOLDER_ID;
  if (!id) {
    throw new SubmitError(
      "W-9 uploads aren't configured yet. Please let your Postgame contact know.",
      500
    );
  }
  return id;
}

async function insertRow(
  supabase: ReturnType<typeof createServiceSupabase>,
  payee: Payee,
  taxYear: number,
  doc: {
    driveFileId: string;
    driveViewUrl: string | null;
    fileName: string;
    fileSizeBytes: number | null;
  }
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await supabase
    .from("videographer_w9_submissions")
    .insert({
      tax_year: taxYear,
      ...payee,
      drive_file_id: doc.driveFileId,
      drive_view_url: doc.driveViewUrl,
      file_name: doc.fileName,
      file_size_bytes: doc.fileSizeBytes,
    })
    .select("id, created_at")
    .single();

  // Always destructure .error — a silent failure here looks like a successful
  // submission with an empty row, which is the one outcome nobody would catch.
  if (error || !data) {
    throw new Error(`insert failed: ${error?.message ?? "no row returned"}`);
  }
  return data as { id: string; created_at: string };
}
