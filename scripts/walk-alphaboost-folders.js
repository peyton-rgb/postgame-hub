#!/usr/bin/env node
/**
 * walk-alphaboost-folders.js
 *
 * Walks every Google Drive folder linked from the adidas AlphaBoost Campaign
 * tab and writes a single JSON file with every file's metadata, ready to be
 * pasted back into Claude to build the asset picker.
 *
 * Usage:
 *   node walk-alphaboost-folders.js > alphaboost_picker_data.json
 *
 * Reads Drive OAuth credentials from ~/postgame/hub/.env.local
 * Requires Node 18+ (for built-in fetch).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// =============================================================================
// 1. Load OAuth credentials from .env.local
// =============================================================================
const ENV_PATH = path.join(os.homedir(), 'postgame', 'hub', '.env.local');

function parseEnvFile(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Could not find env file at ${filepath}`);
  }
  const content = fs.readFileSync(filepath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function findVar(env, candidates) {
  for (const c of candidates) if (env[c]) return { key: c, value: env[c] };
  return null;
}

let env;
try {
  env = parseEnvFile(ENV_PATH);
} catch (err) {
  console.error(`ERROR loading env file: ${err.message}`);
  process.exit(1);
}

const clientIdMatch = findVar(env, [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_ID',
]);
const clientSecretMatch = findVar(env, [
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'GOOGLE_OAUTH_CLIENT_SECRET',
]);
const refreshTokenMatch = findVar(env, [
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_DRIVE_REFRESH_TOKEN',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
]);

if (!clientIdMatch || !clientSecretMatch || !refreshTokenMatch) {
  console.error('ERROR: missing one or more Google OAuth env vars.');
  console.error('Looked for:');
  console.error('  client_id     - GOOGLE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_ID, GOOGLE_OAUTH_CLIENT_ID');
  console.error('  client_secret - GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_OAUTH_CLIENT_SECRET');
  console.error('  refresh_token - GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_OAUTH_REFRESH_TOKEN');
  console.error(`Found in .env.local: client_id=${!!clientIdMatch}, client_secret=${!!clientSecretMatch}, refresh_token=${!!refreshTokenMatch}`);
  const googleKeys = Object.keys(env).filter((k) => k.toLowerCase().includes('google'));
  if (googleKeys.length) {
    console.error('Keys containing "google":', googleKeys.join(', '));
  }
  process.exit(1);
}

const CLIENT_ID = clientIdMatch.value;
const CLIENT_SECRET = clientSecretMatch.value;
const REFRESH_TOKEN = refreshTokenMatch.value;

console.error(`Loaded creds from ${ENV_PATH}`);
console.error(`  client_id     ← ${clientIdMatch.key}`);
console.error(`  client_secret ← ${clientSecretMatch.key}`);
console.error(`  refresh_token ← ${refreshTokenMatch.key}`);

// =============================================================================
// 2. Athletes embedded in the script (from the AlphaBoost tab)
// =============================================================================
const CAMPAIGN_RECAP_ID = '8f428dc1-aee3-4cbd-858b-7b83e9090991';
const CAMPAIGN_SLUG = 'adidas-alphaboost';
const CAMPAIGN_NAME = 'adidas AlphaBoost';

const ATHLETES = [
  { row:   2, name: "Myles Crawley", school: "Grambling", sport: "Football", ig_handle: "mj7crawley", folder_id: "1YdZnVu4bCVGdLrVSXcNfrdRNI5XGKLoW" },
  { row:   3, name: "Adriana Pratt", school: "Grambling", sport: "WSOC", ig_handle: "adrianna_p_", folder_id: "1cCLcei1MTpiwiJEPoWM7vuvj-sseRTQ1" },
  { row:   4, name: "Kailin Newsome", school: "MS State", sport: "Volleyball", ig_handle: "kailin_newsome", folder_id: "1OSUl0g1OmEtAt8YIr1R9Jn46Phb93DsY" },
  { row:   5, name: "Brylan Lanier", school: "MS State", sport: "Football", ig_handle: "1gsbrylo", folder_id: "1HOJrtO6E3tQpDEz0cwsijq3lnqiSOUCn" },
  { row:   6, name: "Estella Zatechka", school: "ASU", sport: "Volleyball", ig_handle: "estella.zatechka", folder_id: "1MbtdQ_BKKt0Bg6bCTeLewTMzcu4kOzX3" },
  { row:   7, name: "DeAndra Pierce", school: "Georgia Tech", sport: "Volleyball", ig_handle: "deandrapierce", folder_id: "1IcF2ZgNG_ErKfu78JP1mXyuEO8e9jcL6" },
  { row:   8, name: "Justice Ellison", school: "Indiana", sport: "Football", ig_handle: "_justiceellison", folder_id: "1MrkTbgsxHYLqyF2NhycW6Ul77JSZCRa-" },
  { row:   9, name: "Camryn Turner", school: "Kansas", sport: "Volleyball", ig_handle: "camrynturnerr", folder_id: "1ksEU35jE2MV8UWRBZ2A6Mbno28A8wMh2" },
  { row:  10, name: "Elena Scott", school: "Louisville", sport: "Volleyball", ig_handle: "elenaascott", folder_id: "1WU9MKGP7LAef0xsj1ewEiLqCnU0S2EzW" },
  { row:  11, name: "Jordan Waters", school: "NC State", sport: "Football", ig_handle: "j.waters7", folder_id: "1uLsLgcgOBMeIiX7dDBpbLA2z1X-hCnva" },
  { row:  12, name: "Mark Fletcher", school: "Miami", sport: "Football", ig_handle: "4qmf_", folder_id: "1Zlxvh4wq6ws5NKg9z3Sy1Wgt_SbJnJV-" },
  { row:  13, name: "Brynn Williams", school: "Texas Tech", sport: "Volleyball", ig_handle: "brynn.taylorr", folder_id: "1ORU_3-BiK0Xk2sJl2fQFu_FiMlzE1kXx" },
  { row:  14, name: "Gisselle Kozarski", school: "Miami", sport: "Soccer", ig_handle: "gissellekozarski", folder_id: "1eYh34NX1scS0gjZRL_etImEhZNbA1WJ8" },
  { row:  15, name: "Josh Jones", school: "Louisville", sport: "Mens Soccer", ig_handle: "josh.jones13", folder_id: "1ITzrw2yGvMyRj3V6BDRhA5NwM1DWF0U6" },
  { row:  16, name: "Sarah Weber", school: "Nebraska", sport: "Soccer", ig_handle: "ssarahweberrr", folder_id: "1qJVMTmPA3GD-k81EaZpw3kEHPSZ0mk8L" },
  { row:  17, name: "Camryn Haworth", school: "Indiana", sport: "Volleyball", ig_handle: "_camryn.haworth_", folder_id: "1bjZxGxO7IsTEKsTumnmVn85oOpPdHFas" },
  { row:  18, name: "Naomi Cabello", school: "NC State", sport: "Volleyball", ig_handle: "naomicabelloo", folder_id: "1P205L7lkKlnX5WOuG7UtX6mneevcDN7X" },
  { row:  19, name: "DALAYAH DANIELS", school: "Washington", sport: "Basketball", ig_handle: "dalayup", folder_id: "103mfYXIhE-U2UYtotQBbxpxiSvgvGky-" },
  { row:  20, name: "ELLE LADINE", school: "Washington", sport: "Basketball", ig_handle: "elleladine", folder_id: "1lbWUKy7AShvF7NX8nI7t2izUsbs1OcOh" },
  { row:  21, name: "Clayton PowellLee", school: "Georgia Tech", sport: "Football", ig_handle: "", folder_id: "1-fQfjewM6lyTusrfLl2DtR1ecHeSaYY4" },
  { row:  22, name: "Cameron Lendhardt", school: "Nebraska", sport: "Football", ig_handle: "cam11lenhardt", folder_id: "1huobtA3fGrVXHji5txd7M0sH2r27IyE6" },
  { row:  23, name: "Carolyn Calzada", school: "TAMU", sport: "Soccer", ig_handle: "carolyncalzada", folder_id: "1SpmYMihTpQGtMxQtO6zwU4L-jxM5pND3" },
  { row:  24, name: "Taurean York", school: "TAMU", sport: "Football", ig_handle: "mktraps", folder_id: "1qDCeqUiVXi1S0SRU131dh2BOp54wWB34" },
  { row:  25, name: "Tahj Brooks", school: "Texas Tech", sport: "Football", ig_handle: "thetahjbrooks", folder_id: "1kDEFEh6D3osc4ewSwOewfmzf5NmQqhC_" },
];

// =============================================================================
// 3. OAuth: exchange refresh_token for access_token
// =============================================================================
async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }).toString();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth refresh failed (HTTP ${res.status}): ${text}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`OAuth response missing access_token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// =============================================================================
// 4. List all files in one Drive folder (paginated, includes shared drives)
// =============================================================================
async function listFolderContents(accessToken, folderId) {
  const collected = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webViewLink, videoMediaMetadata, imageMediaMetadata)',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Drive list failed (HTTP ${res.status}): ${text}`);
    }
    const data = await res.json();
    collected.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return collected;
}

// =============================================================================
// 5. Main
// =============================================================================
async function main() {
  console.error(`\nWalking ${ATHLETES.length} folders for campaign: ${CAMPAIGN_NAME}\n`);
  const accessToken = await getAccessToken();
  console.error('  ✓ Got access token\n');

  const results = await Promise.allSettled(
    ATHLETES.map(async (athlete) => {
      try {
        const rawFiles = await listFolderContents(accessToken, athlete.folder_id);
        const files = rawFiles.map((f) => ({
          drive_file_id: f.id,
          name: f.name,
          mime_type: f.mimeType,
          file_size_bytes: f.size ? Number(f.size) : null,
          created_time: f.createdTime || null,
          modified_time: f.modifiedTime || null,
          thumbnail_url: f.thumbnailLink || `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`,
          web_view_url: f.webViewLink || null,
          is_folder: f.mimeType === 'application/vnd.google-apps.folder',
          is_image: (f.mimeType || '').startsWith('image/'),
          is_video: (f.mimeType || '').startsWith('video/'),
        }));
        console.error(`  ✓ ${athlete.name.padEnd(28)} ${files.length} files`);
        return { ...athlete, files, error: null };
      } catch (err) {
        console.error(`  ✗ ${athlete.name.padEnd(28)} ERROR: ${err.message}`);
        return { ...athlete, files: [], error: err.message };
      }
    })
  );

  const output = {
    campaign_name: CAMPAIGN_NAME,
    campaign_recap_id: CAMPAIGN_RECAP_ID,
    campaign_slug: CAMPAIGN_SLUG,
    walked_at: new Date().toISOString(),
    athletes: results.map((r) => r.value),
  };

  process.stdout.write(JSON.stringify(output, null, 2));

  const totalFiles = output.athletes.reduce((s, a) => s + a.files.length, 0);
  const failedAthletes = output.athletes.filter((a) => a.error).length;
  const emptyAthletes = output.athletes.filter((a) => !a.error && a.files.length === 0).length;

  console.error(`\nSummary:`);
  console.error(`  Athletes walked:  ${output.athletes.length}`);
  console.error(`  Total files:      ${totalFiles}`);
  console.error(`  Empty folders:    ${emptyAthletes}`);
  console.error(`  Failed folders:   ${failedAthletes}`);
  console.error(`\nJSON written to stdout. Use \`> filename.json\` to save it.\n`);
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
