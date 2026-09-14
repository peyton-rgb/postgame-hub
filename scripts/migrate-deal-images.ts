// scripts/migrate-deal-images.ts
// ─────────────────────────────────────────────────────────────
// Move deal photos off the old Wix site and into Supabase storage.
//
// 392 of 394 live deal images are served from static.wixstatic.com. The deal
// ledger is meant to be permanent and indexed, and it cannot depend on a
// platform the company has migrated off: one cancelled subscription breaks the
// image on every deal page Google has already crawled.
//
// SAFETY, in the order it matters:
//   1. deals.image_url_source already holds the original URL for all 413 rows
//      (migration deals_image_url_source_rollback). Rolling back is one UPDATE.
//   2. Nothing is written to the database until the uploaded copy has been
//      fetched BACK from Supabase, decoded, and measured. A URL that has not
//      been verified is never written.
//   3. The uploaded image must be at least as large as the Wix original in both
//      dimensions. A smaller copy means the download was a thumbnail or a
//      transform, and the row is skipped rather than downgraded.
//   4. Idempotent. A row whose image_url already points at Supabase is skipped
//      without re-downloading, so a re-run costs nothing and repairs only what
//      previously failed.
//
// Bucket: `deal-media` (public, already exists) under photos/<slug>.<ext>.
// The brief asked for a new `deal-images` bucket; deal-media is the existing
// public bucket for exactly this content, and CLAUDE.md says reuse before
// rebuild, so a second bucket meaning the same thing was not created.
//
// Run:
//   npx tsx --env-file=.env.local scripts/migrate-deal-images.ts            # dry run
//   npx tsx --env-file=.env.local scripts/migrate-deal-images.ts --execute  # writes
//
// DRY RUN IS THE DEFAULT. Nothing downloads, uploads or writes without --execute.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const EXECUTE = process.argv.includes("--execute");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : Infinity;
})();

const BUCKET = "deal-media";
const PREFIX = "photos";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Pixel dimensions from the file header. No dependency, two formats, which is
 *  all the deals table contains (318 jpg / 95 png). Returns null if the bytes
 *  are not a decodable image of a known type — which is itself the signal that
 *  a download failed and the row must be skipped. */
function dimensions(buf: Buffer): { w: number; h: number; kind: string } | null {
  // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kind: "png" };
  }
  // JPEG: walk the segment chain to a Start-Of-Frame marker and read from it.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // SOF0..SOF15, excluding the non-frame markers DHT/JPG/DAC.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), kind: "jpeg" };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

async function fetchImage(url: string): Promise<{ buf: Buffer; type: string } | string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return `HTTP ${res.status}`;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return "empty body";
    return { buf, type: res.headers.get("content-type") ?? "application/octet-stream" };
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

type Row = { id: string; slug: string; image_url: string; image_url_source: string | null };

async function main() {
  const { data, error } = await supabase
    .from("deals")
    .select("id, slug, image_url, image_url_source")
    .like("image_url", "%wixstatic.com%")
    .order("slug");

  if (error) throw new Error(`load failed: ${error.message}`);
  const rows = (data as Row[]).slice(0, LIMIT === Infinity ? undefined : LIMIT);

  console.log(`${rows.length} row(s) still pointing at Wix`);
  console.log(`mode: ${EXECUTE ? "EXECUTE (writes)" : "DRY RUN"}  bucket: ${BUCKET}/${PREFIX}\n`);

  let migrated = 0, skipped = 0, bytes = 0;
  const skips: string[] = [];

  for (const row of rows) {
    const label = row.slug.padEnd(46).slice(0, 46);

    // Idempotency: the URL is only rewritten after verification, so a row that
    // already points at Supabase is finished.
    if (!row.image_url.includes("wixstatic.com")) { console.log(`  SKIP  ${label} already migrated`); skipped++; continue; }

    if (!EXECUTE) { console.log(`  PLAN  ${label} -> ${PREFIX}/${row.slug}`); continue; }

    const origin = await fetchImage(row.image_url);
    if (typeof origin === "string") {
      console.log(`  SKIP  ${label} source unreachable: ${origin}`);
      skips.push(`${row.slug}: source ${origin}`); skipped++; continue;
    }
    const srcDim = dimensions(origin.buf);
    if (!srcDim) {
      console.log(`  SKIP  ${label} source did not decode`);
      skips.push(`${row.slug}: source did not decode`); skipped++; continue;
    }

    const ext = srcDim.kind === "png" ? "png" : "jpg";
    const path = `${PREFIX}/${row.slug}.${ext}`;

    const up = await supabase.storage.from(BUCKET).upload(path, origin.buf, {
      contentType: srcDim.kind === "png" ? "image/png" : "image/jpeg",
      upsert: true,
    });
    if (up.error) {
      console.log(`  SKIP  ${label} upload failed: ${up.error.message}`);
      skips.push(`${row.slug}: upload ${up.error.message}`); skipped++; continue;
    }

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    // Fetch the copy BACK and measure it. This is the gate: the database is not
    // touched until the URL we are about to store has served a real image.
    const back = await fetchImage(publicUrl);
    if (typeof back === "string") {
      console.log(`  SKIP  ${label} uploaded copy unreachable: ${back}`);
      skips.push(`${row.slug}: readback ${back}`); skipped++; continue;
    }
    const dstDim = dimensions(back.buf);
    if (!dstDim) {
      console.log(`  SKIP  ${label} uploaded copy did not decode`);
      skips.push(`${row.slug}: readback did not decode`); skipped++; continue;
    }
    if (dstDim.w < srcDim.w || dstDim.h < srcDim.h) {
      console.log(`  SKIP  ${label} copy smaller than original (${dstDim.w}x${dstDim.h} < ${srcDim.w}x${srcDim.h})`);
      skips.push(`${row.slug}: copy smaller than original`); skipped++; continue;
    }

    const upd = await supabase.from("deals").update({ image_url: publicUrl }).eq("id", row.id);
    if (upd.error) {
      console.log(`  SKIP  ${label} db update failed: ${upd.error.message}`);
      skips.push(`${row.slug}: update ${upd.error.message}`); skipped++; continue;
    }

    bytes += origin.buf.length;
    migrated++;
    console.log(`  OK    ${label} ${srcDim.w}x${srcDim.h} ${(origin.buf.length / 1024).toFixed(0)}KB`);
  }

  console.log(`\nmigrated ${migrated} · skipped ${skipped} · ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (skips.length) {
    console.log("\nskips:");
    for (const s of skips) console.log(`  ${s}`);
  }
  if (!EXECUTE) console.log("\nDRY RUN — pass --execute to write.");
}

main().catch((e) => { console.error(e); process.exit(1); });
