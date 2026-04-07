import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const SUPABASE_URL = "https://xqaybwhpgxillpbbqtks.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYXlid2hwZ3hpbGxwYmJxdGtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NTU5OCwiZXhwIjoyMDg4MTYxNTk4fQ.3wVhzjvJ5hUJ6HnDkxnj2KNhPvxovFrkFA8zJ4tpf30";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "campaign-media";
const RAW_EXTS = ["cr2", "nef", "arw", "raf", "dng", "orf", "rw2", "pef", "srw", "tiff", "tif", "bmp", "heic", "heif"];
const WORK_DIR = join(tmpdir(), "postgame-convert");

function getExt(name) {
  return name.split(".").pop().toLowerCase();
}

try { mkdirSync(WORK_DIR, { recursive: true }); } catch {}

async function listAllFiles(prefix = "") {
  const allFiles = [];
  const { data: folders, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });

  if (error) {
    console.error("Error listing", prefix, error.message);
    return allFiles;
  }

  for (const item of folders || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.metadata) {
      const subFiles = await listAllFiles(fullPath);
      allFiles.push(...subFiles);
    } else {
      allFiles.push(fullPath);
    }
  }
  return allFiles;
}

async function main() {
  console.log("Scanning campaign-media bucket...\n");

  const allFiles = await listAllFiles();
  const rawFiles = allFiles.filter((f) => RAW_EXTS.includes(getExt(f)));

  console.log(`Found ${allFiles.length} total files, ${rawFiles.length} need conversion.\n`);

  if (rawFiles.length === 0) {
    console.log("Nothing to convert.");
    return;
  }

  let converted = 0;
  let failed = 0;
  let skipped = 0;

  for (const filePath of rawFiles) {
    const jpgPath = filePath.replace(/\.[^.]+$/, ".jpg");

    if (allFiles.includes(jpgPath)) {
      console.log(`SKIP (jpg exists): ${filePath}`);
      skipped++;
      continue;
    }

    console.log(`Converting: ${filePath}`);

    try {
      // Download
      const { data: fileData, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .download(filePath);

      if (dlErr) {
        console.error(`  Download failed: ${dlErr.message}`);
        failed++;
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const inputFile = join(WORK_DIR, "input_" + Date.now() + "." + getExt(filePath));
      const outputFile = join(WORK_DIR, "output_" + Date.now() + ".jpg");

      writeFileSync(inputFile, buffer);

      // Convert with vips
      try {
        execSync(`vipsthumbnail "${inputFile}" -s 99999x99999 -o "${outputFile}[Q=92]"`, {
          timeout: 60000,
          stdio: "pipe",
        });
      } catch (vipsErr) {
        // Try alternative vips command
        execSync(`vips copy "${inputFile}" "${outputFile}[Q=92]"`, {
          timeout: 60000,
          stdio: "pipe",
        });
      }

      const jpegBuffer = readFileSync(outputFile);

      // Upload JPEG
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(jpgPath, jpegBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (upErr) {
        console.error(`  Upload failed: ${upErr.message}`);
        failed++;
      } else {
        console.log(`  -> ${jpgPath} (${(jpegBuffer.length / 1024).toFixed(0)}KB)`);
        converted++;
      }

      // Cleanup temp files
      try { unlinkSync(inputFile); } catch {}
      try { unlinkSync(outputFile); } catch {}

    } catch (err) {
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Converted: ${converted}, Failed: ${failed}, Skipped: ${skipped}`);
}

main();
