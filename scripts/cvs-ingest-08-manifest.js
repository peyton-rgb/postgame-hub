#!/usr/bin/env node
// scripts/cvs-ingest-08-manifest.js
// ─────────────────────────────────────────────────────────────
// Brief 08 Phase 1 — generate the per-campaign manifest that
// scripts/import-campaign-media.js consumes, from the Drive subfolder names
// under each campaign's drive_content_folder_id.
//
// The importer is manifest-driven (athlete → Drive folder URL) and matches
// manifest rows against the campaign's roster by name. Rather than write a
// parallel ingest, this generates that manifest from the folder convention
// "Athlete Name (CVS …)".
//
// Nothing is guessed. A row is emitted only when the folder name resolves to
// exactly one athlete already on the roster. Everything else is reported as
// unmatched and left for a human.
//
// Handles three folder shapes:
//   "Rocco Becht (CVS EBD - Jan.)"                    → one athlete
//   "Teagan Kavan and Isa Torres (CVS Epic - Aug)"    → two athletes, one folder
//   "kiki Final" / "Olivia Final"                     → first name only
//
// Run:  node --env-file=.env.local scripts/cvs-ingest-08-manifest.js
// Writes scripts/data/cvs-ingest-08/<slug>.csv
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const OUT_DIR = path.resolve(__dirname, 'data', 'cvs-ingest-08');
const CAMPAIGNS = [
  '6e8b601f-1abc-4051-b17c-7ab03beddbde', // CVS - Spotted at CVS
  '971d344d-a526-4d3b-a221-00fef445972a', // CVS Epic Beauty
  'f2223120-0c9f-433a-91c0-a932a55c1162', // CVS June
  '66fb2d1f-2942-4cc6-991b-3ed940b52732', // Epic Beauty + Unaltered Beauty
  '165332db-856d-4a1a-a85d-6b1663577a7e', // Extra Extra Big Deals January
  'ec697283-d195-43ac-9644-f8e26421f5cd', // Valentine's Day
  'c6fc9c9d-c010-4c1b-809c-6b7cecaa38f7', // Fall ExtraCare x Epic
];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });
const COMMON = { supportsAllDrives: true, includeItemsFromAllDrives: true };

// Same normalisation the importer uses, so a row we emit is a row it will match.
const ACCENT_RE = /[̀-ͯ]/g;
const norm = (s) => (s || '').normalize('NFD').replace(ACCENT_RE, '').toLowerCase().replace(/['’`]/g, '').replace(/\s+/g, ' ').trim();
const csvCell = (v) => /[",\n]/.test(v ?? '') ? `"${String(v).replace(/"/g, '""')}"` : (v ?? '');

/** Strip the "(CVS …)" suffix and trailing marker words from a folder name. */
function cleanFolderName(name) {
  return name.replace(/\(.*?\)/g, ' ').replace(/\b(final|finals|content|selects|extras)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Resolve a folder name to roster athletes. Returns [] when not confidently resolvable. */
function resolve(folderName, roster) {
  const cleaned = cleanFolderName(folderName);
  if (!cleaned) return { athletes: [], why: 'folder name empty after cleaning' };

  // 1. Whole cleaned name is a roster athlete.
  const exact = roster.filter((a) => norm(a.name) === norm(cleaned));
  if (exact.length === 1) return { athletes: exact, why: 'exact' };

  // 2. "A and B" / "A & B" — a shared team folder.
  const parts = cleaned.split(/\s+(?:and|&|\+)\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const hits = [];
    for (const p of parts) {
      const m = roster.filter((a) => norm(a.name) === norm(p));
      if (m.length === 1) hits.push(m[0]);
    }
    if (hits.length === parts.length) return { athletes: hits, why: `pair (${parts.length})` };
    if (hits.length) return { athletes: [], why: `pair partially matched (${hits.length}/${parts.length}) — needs a human` };
  }

  // 3. First name only — accept only when exactly one roster athlete has it.
  if (!cleaned.includes(' ')) {
    const first = roster.filter((a) => norm(a.name).split(' ')[0] === norm(cleaned));
    if (first.length === 1) return { athletes: first, why: 'first-name (unique)' };
    if (first.length > 1) return { athletes: [], why: `first name "${cleaned}" matches ${first.length} athletes — ambiguous` };
  }

  return { athletes: [], why: 'no roster match' };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let totalRows = 0, totalUnmatched = 0;

  for (const id of CAMPAIGNS) {
    const { data: camp } = await supabase.from('campaign_recaps')
      .select('id,name,slug,client_name,drive_content_folder_id').eq('id', id).single();
    const { data: roster } = await supabase.from('athletes').select('id,name,ig_handle').eq('campaign_id', id);

    const kids = await drive.files.list({
      q: `'${camp.drive_content_folder_id}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
      fields: 'files(id,name)', pageSize: 1000, ...COMMON,
    });
    const subs = kids.data.files ?? [];

    const lines = ['brand,campaign,athlete,ig_handle,drive_content_folder_url,match_confidence'];
    const unmatched = [];
    for (const f of subs) {
      const { athletes, why } = resolve(f.name, roster ?? []);
      if (!athletes.length) { unmatched.push([f.name, why]); continue; }
      for (const a of athletes) {
        lines.push([camp.client_name || 'CVS', camp.name, a.name, a.ig_handle || '',
          `https://drive.google.com/drive/folders/${f.id}`, why].map(csvCell).join(','));
      }
    }

    const out = path.join(OUT_DIR, `${camp.slug}.csv`);
    fs.writeFileSync(out, lines.join('\n') + '\n');
    const rows = lines.length - 1;
    totalRows += rows; totalUnmatched += unmatched.length;

    console.log(`\n── ${camp.name}   roster=${roster.length}  subfolders=${subs.length}`);
    console.log(`   manifest rows: ${rows}   →  scripts/data/cvs-ingest-08/${camp.slug}.csv`);
    if (unmatched.length) {
      console.log(`   UNMATCHED (${unmatched.length}) — not guessed, left out:`);
      unmatched.forEach(([n, w]) => console.log(`      "${n}"  — ${w}`));
    }
  }
  console.log(`\n${'='.repeat(70)}\nTOTAL manifest rows: ${totalRows}   unmatched folders: ${totalUnmatched}`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
