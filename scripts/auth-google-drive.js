#!/usr/bin/env node
// One-time helper to refresh GOOGLE_REFRESH_TOKEN in .env.local.
// Uses a loopback redirect (http://127.0.0.1:<random-port>) because the
// OOB flow (urn:ietf:wg:oauth:2.0:oob) was retired by Google.
//
// Run with:  node --env-file=.env.local scripts/auth-google-drive.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');

const CID = process.env.GOOGLE_CLIENT_ID;
const CSEC = process.env.GOOGLE_CLIENT_SECRET;
if (!CID || !CSEC) {
  console.error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Run with --env-file=.env.local');
  process.exit(1);
}

async function main() {
  // 1. Bind a one-shot HTTP server on a free port on 127.0.0.1.
  //    Using 127.0.0.1 (not "localhost") so the redirect URI Google sees
  //    matches the one we register exactly — avoids IPv6/::1 surprises.
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const redirectUri = `http://127.0.0.1:${port}`;

  const oauth2 = new google.auth.OAuth2(CID, CSEC, redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a fresh refresh_token
    scope: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  console.log(`\nLocal redirect listener: ${redirectUri}`);
  console.log('\nOpen this URL in a browser signed in as the account with access to "Internal All":\n');
  console.log(url);
  console.log('\nWaiting for Google to redirect back (5 min timeout)...');
  console.log('If the browser shows Error 400 redirect_uri_mismatch, stop and tell me — I\'ll print the exact URI to whitelist in the Console.\n');

  // 2. Wait for Google to redirect to our loopback.
  let timer;
  const code = await new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('timeout waiting for redirect')), 5 * 60 * 1000);
    server.on('request', (req, res) => {
      const u = new URL(req.url, redirectUri);
      const err = u.searchParams.get('error');
      const c = u.searchParams.get('code');
      if (err) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Auth failed</h1><p>${err}</p><p>You can close this tab.</p></body></html>`);
        return reject(new Error(`Google returned: ${err}`));
      }
      if (c) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Authorization received.</h1><p>You can close this tab and return to the terminal.</p></body></html>`);
        return resolve(c);
      }
      // favicon and other noise
      res.writeHead(204).end();
    });
  }).finally(() => {
    clearTimeout(timer);
    server.close();
  });

  // 3. Exchange and persist.
  console.log('Got authorization code. Exchanging for tokens...');
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nNo refresh_token returned. Revoke the app at https://myaccount.google.com/permissions and re-run (the prompt=consent above usually forces one, but if Google has a previous grant cached it may skip it).');
    process.exit(2);
  }

  const envPath = path.resolve(__dirname, '..', '.env.local');
  let env = fs.readFileSync(envPath, 'utf8');
  if (/^GOOGLE_REFRESH_TOKEN=/m.test(env)) {
    env = env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } else {
    env += (env.endsWith('\n') ? '' : '\n') + `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
  }
  fs.writeFileSync(envPath, env);
  console.log(`\nSaved new GOOGLE_REFRESH_TOKEN to ${envPath}`);
}

main().catch(e => { console.error('Auth failed:', e.message); process.exit(1); });
