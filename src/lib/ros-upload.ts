// ============================================================
// Run-of-show upload box — server-side helpers
//
// Crew upload footage from the public shoot page straight to the Postgame Mac
// Studio (a tus server). The Hub never sees the files; it only
//   1. signs a short-lived upload token for a shoot, and
//   2. checks the signature on the Studio's "file landed" reports.
//
// Both use the same shared secret, ROS_UPLOAD_SECRET. The Studio keys its HMAC
// with the secret AS TEXT (the 64 hex characters as-is, not decoded to bytes),
// so this file must too — hex-decoding it here would make every token and
// every report fail the signature check.
//
// SERVER ONLY: the secret must never reach the browser. The browser only ever
// sees the signed token.
// ============================================================

import { createHmac, timingSafeEqual } from "crypto";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.ROS_UPLOAD_SECRET;
  if (!s) throw new Error("ROS_UPLOAD_SECRET is not set");
  return s;
}

export function isRosUploadConfigured(): boolean {
  return Boolean(process.env.ROS_UPLOAD_SECRET && process.env.NEXT_PUBLIC_ROS_UPLOAD_URL);
}

export interface RosUploadTokenPayload {
  v: 1;
  shoot_id: string;
  dest_base: string;
  exp: number; // unix seconds
}

// base64url(JSON) + "." + base64url(HMAC_SHA256(secret, JSON)). The signature
// covers the exact JSON text that is encoded, so the Studio verifies the same bytes.
export function signUploadToken(payload: RosUploadTokenPayload): string {
  const json = JSON.stringify(payload);
  const sig = createHmac("sha256", secret()).update(json).digest();
  return `${Buffer.from(json).toString("base64url")}.${sig.toString("base64url")}`;
}

// Report check: header x-ros-signature = hex HMAC_SHA256(secret, raw body).
export function verifyReportSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret()).update(rawBody).digest();
  const given = Buffer.from(signature.trim().toLowerCase(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// `ros_shoots.date` is free text. "Friday, October 9, 2026" parses; "March 28th"
// has no year and comes back null, as does anything else we can't read.
export function parseShootDate(raw: string | null | undefined): Date | null {
  const m = (raw || "").match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (!m) return null;
  const month = MONTHS.findIndex((name) => name.startsWith(m[1].toLowerCase()));
  if (month === -1) return null;
  const date = new Date(Date.UTC(Number(m[3]), month, Number(m[2])));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Token expiry in unix seconds: 3 days after the shoot date, or 24h from now
// when the date can't be read. The shoot day is counted to its end, UTC, so a
// west-coast evening wrap isn't cut off early.
export function tokenExpiry(shootDate: Date | null, now = Date.now()): number {
  const ms = shootDate ? shootDate.getTime() + 4 * DAY_MS : now + DAY_MS;
  return Math.floor(ms / 1000);
}

// One folder name: no slashes (they would add a level) and no stray spaces.
// The Studio sanitizes again; this only keeps the shape of dest_base honest.
function segment(s: string): string {
  return s.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim();
}

// "ohio" → "Ohio", "baton-rouge" → "Baton Rouge".
function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// <Brand>/<Year> - <Brand>/<lucid_campaign_folder>/<Stop>
export function buildDestBase(opts: {
  brand: string;
  year: number;
  campaignFolder: string;
  shootSlug: string;
}): string {
  const brand = segment(opts.brand);
  return [
    brand,
    `${opts.year} - ${brand}`,
    segment(opts.campaignFolder),
    segment(titleCaseSlug(opts.shootSlug)),
  ].join("/");
}
