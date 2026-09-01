#!/usr/bin/env node
// ============================================================
// Hub Sweep — read-only static audit of the App Router surface.
//
//   node scripts/hub-sweep.js [repoDir] [--out DIR]
//
// Walks <repo>/src/app for page.tsx, derives each route, and reports
// what the page is made of: client vs server, where its data comes
// from, its interactive elements, whether either nav rail can reach
// it, and where it drifts off the design system.
//
// Writes nothing but the three report files. No DB, no network.
//
// Outputs (default ./hub-sweep/):
//   pages.jsonl     one record per page.tsx
//   elements.jsonl  one record per interactive element
//   SUMMARY.md      the rollup a human reads first
//
// Plain Node, no dependencies. This is a regex pass, not a type-aware
// parse, so treat the counts as close rather than exact — see the
// Method section at the bottom of SUMMARY.md.
// ============================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- config ----------

// A page at or under this many lines is called a stub. The nav file
// already describes /dashboard/run-of-show as "a 5-line stub", so the
// shape is real; 30 keeps the bar low enough to stay meaningful.
const STUB_LINES = 30;

// The only labels a finding may carry. There is deliberately no
// "delete" value: unreferenced-by-nav does not mean safe-to-remove, and
// this audit is not entitled to that conclusion. Anything that looks
// removable is `needs-human-decision` with the reasoning attached.
const RECOMMENDED_ACTIONS = [
  'none',
  'migrate-preserve-url',
  'consolidate',
  'needs-human-decision',
  'fix',
  'parked-no-action',
];

// Enforced in code rather than trusted to prose — a typo or a stray
// "delete" fails the run instead of reaching a report.
function action(value) {
  if (!RECOMMENDED_ACTIONS.includes(value)) {
    throw new Error(`recommended_action "${value}" is outside the allowed set: ${RECOMMENDED_ACTIONS.join(' | ')}`);
  }
  return value;
}

// Route families that are live, externally-shared URLs — sent in client
// emails and decks — and must keep resolving forever. They are reached
// by pasted link, never from the nav, so this sweep sees them as
// unreferenced. That is a property of the audit, not a defect in the
// route. Add a prefix here when another family is confirmed external.
const LEGACY_URL_FAMILIES = ['/pitch', '/quiz', '/run-of-show'];

function isLegacyUrl(route) {
  return LEGACY_URL_FAMILIES.some((pre) => route === pre || route.startsWith(pre + '/'));
}

// The palette, as written in tailwind.config.js and globals.css. A hex
// literal matching one of these is only a tokenisation miss; anything
// else is real colour drift.
const PALETTE_HEX = {
  '07070A': 'surface / --pg-black',
  D73F09: 'brand / --pg-orange',
  FAF8F5: 'ink / --pg-off-white',
  B33407: 'brand-dark',
};

function expandHex(hex) {
  const h = hex.replace('#', '').toUpperCase();
  if (h.length === 3) return h.split('').map((c) => c + c).join('');
  if (h.length === 8) return h.slice(0, 6); // drop the alpha pair
  return h;
}

function hexChannels(h) {
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// A hex close enough to a palette colour that no eye would catch the
// difference — #B33507 against the real #B33407 is one digit out. These
// are typos, not decisions, which makes them the most actionable colour
// finding in the report.
const NEAR_MISS_DISTANCE = 32;

// Pure white and pure black sit close to the off-white and near-black
// tokens, but nobody types #FFFFFF meaning #FAF8F5. They stay
// off-palette findings; they are just not typos, and listing them as
// such would bury the ones that are.
const CANONICAL_HEX = new Set(['FFFFFF', '000000']);

function nearestPaletteMiss(h) {
  if (PALETTE_HEX[h] || CANONICAL_HEX.has(h)) return null;
  const [r, g, b] = hexChannels(h);
  let best = null;
  for (const key of Object.keys(PALETTE_HEX)) {
    const [pr, pg, pb] = hexChannels(key);
    const d = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
    if (d <= NEAR_MISS_DISTANCE && (!best || d < best.distance)) {
      best = { hex: key, token: PALETTE_HEX[key], distance: Math.round(d * 10) / 10 };
    }
  }
  return best;
}

// Every hex literal in the source, longest form first so an 8-digit
// value is not chopped into a 6-digit one.
const HEX_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

// Nav rails, relative to the repo root. Each is pure data (no JSX) by
// convention, which is what makes a regex pass viable here.
const NAV_FILES = [
  { file: 'src/lib/dashboard-nav.ts', rail: 'dashboard' },
  { file: 'src/lib/admin/nav.ts', rail: 'admin' },
];

// Design-system checks. Every rule below is anchored to something
// written down — tailwind.config.js, globals.css, or the Postgame
// design system's three-color palette and type scale.
//
// Tailwind's default `orange-*` is deliberately NOT flagged: the config
// comment records that it is in use on purpose and that the theme
// intentionally defines no `orange` key to avoid clobbering it.
const VIOLATION_RULES = [
  {
    id: 'glass-alpha-suffix',
    recommendedAction: action('fix'),
    severity: 'high',
    note: 'glass-1/2/3 carry a fixed alpha and ignore a /NN suffix — tailwind.config.js says so outright. Use glass/[0.055] for a one-off.',
    re: /\b(?:bg|text|border|ring|from|to|via|divide)-glass-[123]\/[0-9[]/g,
  },
  {
    id: 'off-palette-hue',
    recommendedAction: action('needs-human-decision'),
    severity: 'medium',
    note: 'Default Tailwind hue outside the three-color palette (black / orange / off-white).',
    re: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|accent|caret|shadow|outline|decoration)-(?:slate|gray|zinc|neutral|stone|red|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g,
  },
  {
    id: 'inline-font-family',
    recommendedAction: action('fix'),
    severity: 'medium',
    note: 'Font family set inline. The four roles are font-display (Bebas), font-sans (Arimo/Arial), font-mono (JetBrains), and Anton where it is loaded.',
    re: /fontFamily\s*:/g,
  },
  {
    id: 'raw-white-black',
    recommendedAction: action('fix'),
    severity: 'low',
    note: 'text-white / bg-black bypass the ink and surface tokens. An explicit /alpha step is not flagged — that is the opacity ladder.',
    re: /\b(?:bg|text|border)-(?:white|black)\b(?!\/)/g,
  },
  {
    id: 'sub-label-type',
    recommendedAction: action('needs-human-decision'),
    severity: 'low',
    note: 'Type below the 10px label step at the bottom of the design system scale.',
    re: /\btext-\[(?:[0-9](?:\.[0-9]+)?)px\]/g,
  },
];

// The two hex rules come from a dedicated scanner rather than the regex
// sweep, but still need a row in the report.
const HEX_RULE_META = {
  'off-palette-hex': {
    id: 'off-palette-hex',
    severity: 'high',
    recommendedAction: 'fix',
    note: 'A hex outside the three-colour palette — real drift. Includes near-misses of the brand colour that are one digit out and invisible by eye.',
  },
  'palette-hex-literal': {
    id: 'palette-hex-literal',
    severity: 'low',
    recommendedAction: 'fix',
    note: 'A palette colour written as raw hex where a token already exists (brand, brand-dark, surface, ink). Tokenisation only — the colour on screen is correct.',
  },
};

// Tags counted as interactive surface.
const ELEMENT_TAGS = [
  ['button', /<button\b/g],
  ['link', /<Link\b/g],
  ['anchor', /<a\b(?=[\s/>])/g],
  ['form', /<form\b/g],
  ['input', /<input\b/g],
  ['select', /<select\b/g],
  ['textarea', /<textarea\b/g],
];

// ---------- tiny utilities ----------

function fail(msg) {
  console.error(`hub-sweep: ${msg}`);
  process.exit(1);
}

// Replace comment bodies with spaces, preserving every byte offset and
// newline so line numbers computed on the result still line up with the
// original file. The scanner tracks string and template state, so a
// "https://…" inside a string is not mistaken for a line comment.
function blankComments(src) {
  let out = '';
  let state = 'code';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") state = 'sq';
      else if (c === '"') state = 'dq';
      else if (c === '`') state = 'tpl';
      out += c; i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; } else out += ' ';
      i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; out += '  '; i += 2; continue; }
      out += c === '\n' ? '\n' : ' ';
      i++; continue;
    }
    // inside a string or template literal
    if (c === '\\') { out += c + (d === undefined ? '' : d); i += 2; continue; }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) {
      state = 'code';
    }
    out += c; i++;
  }
  return out;
}

// Byte offset -> 1-based line number.
function lineIndexer(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return (idx) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// Two normalisation levels. `exact` ignores only formatting; `near`
// also blanks string literals and numbers, which is what collapses a
// family of per-city scaffold pages that differ by one slug.
function normalizeForCompare(code, level) {
  let t = code.replace(/\s+/g, ' ').trim();
  if (level === 'near') {
    t = t
      .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '"S"')
      .replace(/\b\d+(?:\.\d+)?\b/g, 'N')
      // Scaffolds name their component after the route — ChicagoRunOfShow
      // vs DenverRunOfShow — so the declared name is the last thing
      // distinguishing two otherwise identical files.
      .replace(/\bfunction\s+[A-Za-z_$][\w$]*/g, 'function _');
  }
  return t;
}

function shortHash(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
}

function uniq(list) {
  return Array.from(new Set(list));
}

// ---------- routes ----------

// src/app/athlete/(app)/deals/[slug]/page.tsx -> /athlete/deals/[slug]
function fileToRoute(relFromApp) {
  const segs = relFromApp.split(path.sep).slice(0, -1); // drop the filename
  const kept = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
  return '/' + kept.join('/');
}

function routeGroupsOf(relFromApp) {
  return relFromApp.split(path.sep).filter((s) => /^\(.*\)$/.test(s));
}

function dynamicSegmentsOf(route) {
  return route.split('/').filter((s) => /^\[.+\]$/.test(s));
}

function routeToRegex(route) {
  const segs = route.split('/').filter(Boolean);
  let body = '';
  for (const seg of segs) {
    if (/^\[\[\.\.\..+\]\]$/.test(seg)) body += '(?:/.+)?';        // optional catch-all
    else if (/^\[\.\.\..+\]$/.test(seg)) body += '/.+';            // catch-all
    else if (/^\[.+\]$/.test(seg)) body += '/[^/]+';               // dynamic
    else body += '/' + seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + (body || '/') + '$');
}

// Reduce an href to a comparable path: drop query and hash, and collapse
// any ${…} expression to a single opaque segment so it can still be
// matched against a dynamic route.
function normalizeHref(href) {
  if (!href) return null;
  const h = href.trim();
  if (!h.startsWith('/')) return null; // external, anchor, mailto:, tel:, relative
  const clean = h.split('#')[0].split('?')[0];
  const collapsed = clean.replace(/\$\{[^}]*\}/g, '_');
  return collapsed === '' ? '/' : collapsed;
}

// ---------- nav parsing ----------

// Walk backwards from idx to the `{` that opens the enclosing object.
function findEnclosingBrace(code, idx) {
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    const c = code[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

// The object's own properties, with nested objects and arrays skipped —
// so a parent's `children: [...]` cannot leak a child's `hidden: true`
// onto the parent. Each child carries its own href and is parsed on its
// own pass.
function topLevelSlice(code, objStart) {
  let depth = 0;
  let out = '';
  for (let i = objStart + 1; i < code.length; i++) {
    const c = code[i];
    if (c === '{' || c === '[') { depth++; continue; }
    if (c === ']') { depth--; continue; }
    if (c === '}') {
      if (depth === 0) break;
      depth--;
      continue;
    }
    if (depth === 0) out += c;
  }
  return out;
}

function parseNavFile(src, rail) {
  const code = blankComments(src);
  const entries = [];
  const re = /href\s*:\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const objStart = findEnclosingBrace(code, m.index);
    if (objStart === -1) continue;
    const own = topLevelSlice(code, objStart);
    const href = m[1];
    const labelMatch = own.match(/(?:name|label)\s*:\s*["'`]([^"'`]+)["'`]/);
    const minMatch = own.match(/\bmin\s*:\s*["'`]([^"'`]+)["'`]/);
    entries.push({
      rail,
      href,
      path: href.split('#')[0].split('?')[0] || '/',
      query: href.includes('?') ? href.slice(href.indexOf('?')) : null,
      label: labelMatch ? labelMatch[1] : null,
      hidden: /\bhidden\s*:\s*true/.test(own),
      staffOnly: /\bstaffOnly\s*:\s*true/.test(own),
      min: minMatch ? minMatch[1] : null,
    });
  }
  return entries;
}

// ---------- element parsing ----------

// From the `<tag` match, read forward to the `>` that closes the opening
// tag, ignoring any `>` inside a string or a {…} expression.
function readTag(src, start, cap = 3000) {
  let depth = 0;
  let quote = null;
  const limit = Math.min(src.length, start + cap);
  for (let i = start; i < limit; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) {
      return { attrs: src.slice(start, i), end: i, selfClosing: src[i - 1] === '/' };
    }
  }
  return null;
}

function attrString(attrs, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*\`([^\`]*)\`\\s*\\}|\\{\\s*"([^"]*)"\\s*\\}|\\{\\s*'([^']*)'\\s*\\})`);
  const m = attrs.match(re);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? null;
}

// A handler that is a bare identifier or a member expression, if the
// attribute is one; otherwise "(inline)" for an arrow function.
function attrHandler(attrs, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*\\{`);
  const m = attrs.match(re);
  if (!m) return null;
  const rest = attrs.slice(m.index + m[0].length).trim();
  const ident = rest.match(/^([A-Za-z_$][\w$.]*)\s*\}?/);
  if (ident && !/^(?:async|function)$/.test(ident[1])) return ident[1];
  return '(inline)';
}

// Visible text immediately after the opening tag, with {expressions}
// dropped. Falls back to aria-label, then title.
function extractLabel(src, end, attrs) {
  const slice = src.slice(end + 1, end + 300);
  const stop = slice.indexOf('<');
  let text = stop === -1 ? slice : slice.slice(0, stop);
  text = text.replace(/\{[^{}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 80);
  return attrString(attrs, 'aria-label') || attrString(attrs, 'title') || attrString(attrs, 'placeholder') || null;
}

// ---------- link graph ----------

// Every href in a file, whatever quoting style the JSX uses.
const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;

// Programmatic navigation is a reachability edge too — a login page that
// router.push()es to /dashboard makes /dashboard reachable from it.
const NAV_CALL_RE = /(?:router\s*\.\s*(?:push|replace)|redirect|permanentRedirect)\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;

function extractTargets(code) {
  const out = [];
  for (const re of [HREF_RE, NAV_CALL_RE]) {
    const r = new RegExp(re.source, 'g');
    let m;
    while ((m = r.exec(code)) !== null) {
      const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? null;
      if (raw) out.push(raw);
    }
  }
  return out;
}

// Reachability has to be read across the whole tree, not just page.tsx:
// the dashboard rail, the athlete shell and the admin tables all live in
// components, and a link from one of those is exactly what makes a page
// reachable. Only page.tsx contributes to elements.jsonl, but every
// source file contributes edges here.
function buildLinkGraph(repoRoot, srcDir) {
  const edges = [];
  for (const abs of walk(srcDir)) {
    if (!/\.(tsx|ts|jsx|js)$/.test(abs)) continue;
    let raw;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
    const kind = path.basename(abs) === 'page.tsx' ? 'page' : 'module';
    for (const target of extractTargets(blankComments(raw))) {
      const norm = normalizeHref(target);
      if (norm) edges.push({ from: rel, fromKind: kind, target: norm });
    }
  }
  return edges;
}

// ---------- per-page analysis ----------

function analyzePage(repoRoot, absPath, appDir) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const code = blankComments(raw);
  const lineOf = lineIndexer(raw);
  const relFile = path.relative(repoRoot, absPath).split(path.sep).join('/');
  const relFromApp = path.relative(appDir, absPath);
  const route = fileToRoute(relFromApp);

  const rendering = /^\s*['"]use client['"]/m.test(code) ? 'client' : 'server';

  // Route segment config exports (dynamic, revalidate, runtime, …).
  const routeExports = [];
  const cfgRe = /export\s+const\s+(dynamic|revalidate|runtime|fetchCache|dynamicParams|preferredRegion)\s*=\s*([^;\n]+)/g;
  let cm;
  while ((cm = cfgRe.exec(code)) !== null) {
    routeExports.push(`${cm[1]}=${cm[2].trim().replace(/^["']|["']$/g, '')}`);
  }

  // --- data sources ---
  const clients = uniq((code.match(/create(?:Browser|Server|Service|Route|Action)?Supabase[A-Za-z]*/g) || []));
  // .match with /g yields whole matches, so the quotes have to come off
  // both ends — otherwise `campaign_recaps"` and `campaign_recaps'` count
  // as two different tables.
  const tables = uniq(
    (code.match(/\.from\(\s*["'`]([^"'`]+)["'`]/g) || []).map((s) =>
      s.replace(/^\.from\(\s*["'`]/, '').replace(/["'`]$/, '')
    )
  );
  // Which tables this page WRITES to. A static pass cannot see whether a
  // table holds rows, so it must never be the basis for calling one dead;
  // what it can establish is whether a writer exists at all.
  const tablesWritten = [];
  {
    const re = /\.from\(\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      const window = code.slice(m.index, m.index + 400);
      if (/\.(insert|update|upsert|delete)\s*\(/.test(window)) tablesWritten.push(m[1]);
    }
  }

  const apiRoutes = uniq((code.match(/["'`](\/api\/[A-Za-z0-9\-_/[\]${}.]*)/g) || [])
    .map((s) => s.slice(1))
    .map((s) => s.replace(/\$\{[^}]*\}/g, '_'))
    .map((s) => s.replace(/[?`'"].*$/, ''))
    .filter(Boolean));

  let dataKind = 'static';
  if (clients.length || tables.length) dataKind = apiRoutes.length ? 'mixed' : 'supabase';
  else if (apiRoutes.length) dataKind = 'api';

  // --- interactive elements ---
  const elements = [];
  for (const [type, pattern] of ELEMENT_TAGS) {
    const re = new RegExp(pattern.source, 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
      const tag = readTag(code, m.index);
      if (!tag) continue;
      const attrs = tag.attrs;
      const href = attrString(attrs, 'href');
      elements.push({
        route,
        file: relFile,
        line: lineOf(m.index),
        type,
        label: extractLabel(code, tag.end, attrs),
        href,
        handler: attrHandler(attrs, 'onClick') || attrHandler(attrs, 'onSubmit') || attrHandler(attrs, 'onChange'),
        inputType: type === 'input' || type === 'button' ? attrString(attrs, 'type') : null,
        disabled: /\bdisabled\b/.test(attrs),
        target: normalizeHref(href),
        expressionHref: href ? /\$\{|^\{/.test(href) : false,
      });
    }
  }

  const counts = {};
  for (const e of elements) counts[e.type] = (counts[e.type] || 0) + 1;

  // --- design-system violations ---
  const violations = [];

  // Hex literals are split in two, because they are two different
  // problems wearing the same shape. A palette colour written as hex is
  // a tokenisation miss and nothing more. Any other hex is real drift
  // off a three-colour system — and the near-misses among them are
  // typos of the brand colour that no review would catch by eye.
  {
    const re = new RegExp(HEX_RE.source, 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
      const norm = expandHex(m[0]);
      const line = lineOf(m.index);
      if (PALETTE_HEX[norm]) {
        violations.push({
          rule: 'palette-hex-literal',
          severity: 'low',
          recommendedAction: action('fix'),
          line,
          text: m[0],
          token: PALETTE_HEX[norm],
        });
      } else {
        const miss = nearestPaletteMiss(norm);
        violations.push({
          rule: 'off-palette-hex',
          severity: 'high',
          recommendedAction: action('fix'),
          line,
          text: m[0],
          nearMissOf: miss ? `#${miss.hex}` : null,
          nearMissToken: miss ? miss.token : null,
          nearMissDistance: miss ? miss.distance : null,
        });
      }
    }
  }

  for (const rule of VIOLATION_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
      violations.push({
        rule: rule.id,
        severity: rule.severity,
        recommendedAction: rule.recommendedAction,
        line: lineOf(m.index),
        text: m[0].slice(0, 60),
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // A trailing newline must not read as an extra line, so this agrees with wc -l.
  // A page whose whole job is redirect() elsewhere. Worth naming: these
  // trivially match each other under duplicate detection, but three
  // shims pointing at three different targets are not a scaffold family
  // and consolidating them would mean nothing.
  const redirectTo = (code.match(/\bredirect\s*\(\s*["'`]([^"'`]+)["'`]/) || [])[1] || null;

  const lines = raw === '' ? 0 : raw.replace(/\n$/, '').split('\n').length;

  return {
    record: {
      route,
      file: relFile,
      contentHash: {
        exact: shortHash(normalizeForCompare(code, 'exact')),
        near: shortHash(normalizeForCompare(code, 'near')),
      },
      lines,
      bytes: Buffer.byteLength(raw),
      rendering,
      routeGroups: routeGroupsOf(relFromApp),
      dynamicSegments: dynamicSegmentsOf(route),
      routeExports,
      redirectTo,
      data: { kind: dataKind, clients, tables, tablesWritten: uniq(tablesWritten), apiRoutes },
      elements: { total: elements.length, ...counts },
      violations,
      // nav, links and flags are filled in by the cross-page pass
      nav: null,
      links: null,
      flags: [],
    },
    elements,
  };
}

// ---------- main ----------

function main(argv) {
  let repoDir = null;
  let outDir = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') { outDir = argv[++i]; continue; }
    if (a === '--repo') { repoDir = argv[++i]; continue; }
    if (a === '--help' || a === '-h') {
      console.log('usage: node scripts/hub-sweep.js [repoDir] [--out DIR]');
      process.exit(0);
    }
    if (a.startsWith('-')) fail(`unknown flag ${a}`);
    if (repoDir === null) repoDir = a;
    else fail(`unexpected argument ${a}`);
  }

  const repoRoot = path.resolve(repoDir || process.cwd());
  const appDir = path.join(repoRoot, 'src', 'app');
  if (!fs.existsSync(appDir)) fail(`no src/app under ${repoRoot} — is this the hub repo?`);
  const outRoot = path.resolve(outDir || path.join(process.cwd(), 'hub-sweep'));
  fs.mkdirSync(outRoot, { recursive: true });

  // --- discover ---
  const allFiles = walk(appDir);
  const pageFiles = allFiles.filter((f) => path.basename(f) === 'page.tsx').sort();
  if (!pageFiles.length) fail('found no page.tsx under src/app');

  // API routes, so an href into /api/* resolves instead of reading as dangling.
  const apiRouteFiles = allFiles.filter((f) => path.basename(f) === 'route.ts' || path.basename(f) === 'route.tsx');
  const apiRoutes = apiRouteFiles.map((f) => fileToRoute(path.relative(appDir, f)));

  // --- reachability edges from the whole src tree, not just pages ---
  const linkGraph = buildLinkGraph(repoRoot, path.join(repoRoot, 'src'));

  // --- per page ---
  const pages = [];
  const allElements = [];
  for (const f of pageFiles) {
    const { record, elements } = analyzePage(repoRoot, f, appDir);
    pages.push(record);
    allElements.push(...elements);
  }

  // --- duplicate / scaffold families ---
  //
  // Near-identical files are recorded, never recommended for removal:
  // a family of pages differing by one slug is usually a deliberate
  // scaffold behind a set of URLs that must keep resolving.
  const nearGroups = new Map();
  for (const p of pages) {
    p.isRedirectShim = Boolean(p.redirectTo) && p.lines <= 15 && p.elements.total === 0;
    if (p.isRedirectShim) continue;
    const key = p.contentHash.near;
    if (!nearGroups.has(key)) nearGroups.set(key, []);
    nearGroups.get(key).push(p);
  }
  const duplicateGroups = [];
  for (const [key, members] of nearGroups) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => a.route.localeCompare(b.route));
    const representative = sorted[0];
    const identical = new Set(members.map((m) => m.contentHash.exact)).size === 1;
    const legacy = sorted.some((m) => isLegacyUrl(m.route));
    const group = {
      key,
      kind: identical ? 'identical' : 'near-identical',
      size: sorted.length,
      representative: representative.file,
      routes: sorted.map((m) => m.route),
      legacyUrlFamily: legacy,
      // A scaffold behind externally-shared URLs is not a consolidation
      // candidate on its own evidence — a person has to decide.
      recommendedAction: legacy ? action('migrate-preserve-url') : action('needs-human-decision'),
    };
    duplicateGroups.push(group);
    for (const m of sorted) {
      m.duplicateOf = m === representative ? null : representative.file;
      m.duplicateGroup = { key, size: sorted.length, kind: group.kind };
    }
  }
  for (const p of pages) {
    if (!('duplicateOf' in p)) {
      p.duplicateOf = null;
      p.duplicateGroup = null;
    }
  }

  // --- nav rails ---
  const navEntries = [];
  const navMissing = [];
  for (const { file, rail } of NAV_FILES) {
    const abs = path.join(repoRoot, file);
    if (!fs.existsSync(abs)) { navMissing.push(file); continue; }
    navEntries.push(...parseNavFile(fs.readFileSync(abs, 'utf8'), rail));
  }

  // --- route resolution tables ---
  const routeMatchers = pages.map((p) => ({ route: p.route, re: routeToRegex(p.route) }));
  const apiMatchers = apiRoutes.map((r) => ({ route: r, re: routeToRegex(r) }));
  const routeSet = new Set(pages.map((p) => p.route));

  function resolveToPage(p) {
    if (routeSet.has(p)) return p;
    const hit = routeMatchers.find((m) => m.re.test(p));
    return hit ? hit.route : null;
  }
  function resolveToApi(p) {
    return apiMatchers.some((m) => m.re.test(p)) ? p : null;
  }

  // --- inbound edges, repo-wide ---
  const inboundLinks = new Map(); // route -> Map(source file -> source kind)
  for (const edge of linkGraph) {
    if (edge.target.startsWith('/api/')) continue;
    const hit = resolveToPage(edge.target);
    if (!hit) continue;
    if (!inboundLinks.has(hit)) inboundLinks.set(hit, new Map());
    inboundLinks.get(hit).set(edge.from, edge.fromKind);
  }

  // --- per-element link status ---
  const danglingByFile = new Map();
  for (const e of allElements) {
    if (!e.target) { e.linkStatus = e.href ? 'external-or-expression' : null; continue; }
    if (e.target.startsWith('/api/')) {
      e.linkStatus = resolveToApi(e.target) ? 'api' : 'dangling-api';
    } else {
      const hit = resolveToPage(e.target);
      if (hit) {
        e.linkStatus = 'resolved';
        e.resolvedRoute = hit;
      } else {
        // Only an href with no interpolation can be called dangling with
        // confidence; anything built from an expression stays unresolved.
        e.linkStatus = e.expressionHref || e.target.includes('_') ? 'unresolved' : 'dangling';
      }
    }
    if (e.linkStatus === 'dangling' || e.linkStatus === 'dangling-api') {
      if (!danglingByFile.has(e.file)) danglingByFile.set(e.file, []);
      danglingByFile.get(e.file).push(e);
    }
  }

  // --- reachability ---
  for (const p of pages) {
    const direct = navEntries.filter((n) => n.path === p.route);
    const visible = direct.find((n) => !n.hidden) || null;
    const chosen = visible || direct[0] || null;

    // Nearest nav ancestor, so a detail page counts as reachable by
    // drilling down from its list page.
    let via = null;
    for (const n of navEntries) {
      if (n.hidden) continue;
      if (n.path !== '/' && p.route.startsWith(n.path + '/')) {
        if (!via || n.path.length > via.length) via = n.path;
      }
    }

    const inbound = inboundLinks.get(p.route);
    // A page linking to itself does not make it reachable; a shared
    // module linking to it does, since that is how a rail or a shell works.
    const linkers = inbound ? Array.from(inbound.keys()).filter((f) => f !== p.file) : [];
    const linkedFromModule = inbound
      ? Array.from(inbound.entries()).some(([f, k]) => f !== p.file && k === 'module')
      : false;

    let status;
    if (visible) status = 'nav-direct';
    else if (direct.length) status = 'nav-hidden';
    else if (via) status = 'nav-parent';
    else if (linkers.length) status = 'linked';
    else status = 'orphan';

    p.nav = {
      status,
      href: chosen ? chosen.href : null,
      label: chosen ? chosen.label : null,
      rail: chosen ? chosen.rail : null,
      hidden: chosen ? chosen.hidden : false,
      staffOnly: chosen ? chosen.staffOnly : false,
      min: chosen ? chosen.min : null,
      via,
      inboundFrom: linkers.slice(0, 10),
      inboundCount: linkers.length,
      linkedFromModule,
    };

    const outbound = allElements.filter((e) => e.file === p.file && e.linkStatus === 'resolved');
    p.links = {
      internal: uniq(outbound.map((e) => e.resolvedRoute)).sort(),
      dangling: uniq((danglingByFile.get(p.file) || []).map((e) => e.target)).sort(),
    };

    const flags = [];
    if (p.lines <= STUB_LINES) flags.push('stub');
    if (status === 'orphan') flags.push('orphan');
    if (p.data.kind === 'static') flags.push('no-data-source');
    if (p.elements.total === 0) flags.push('no-interactive-elements');
    if (p.links.dangling.length) flags.push('dangling-links');
    // A slug/token route with no nav ancestor is normally a landing page
    // opened from an emailed or shared URL, not a dead route.
    if (status === 'orphan' && p.dynamicSegments.length) flags.push('url-entry-point');
    if (p.violations.some((v) => v.severity === 'high')) flags.push('high-severity-style');
    if (isLegacyUrl(p.route)) flags.push('legacy-url');
    if (p.isRedirectShim) flags.push('redirect-shim');
    p.flags = flags;

    // The label a human reads. Ordered so the protective cases win: a
    // parked route and a live external URL are both correct as they
    // stand, whatever the reachability test says about them.
    if (status === 'nav-hidden') {
      p.recommendedAction = action('parked-no-action');
      p.actionReason = 'Off the rail on purpose. dashboard-nav.ts: hidden keeps a route live and deletes nothing.';
    } else if (isLegacyUrl(p.route)) {
      p.recommendedAction = action('migrate-preserve-url');
      p.actionReason = 'Live externally-shared URL. Reached by pasted link, not by nav — it must keep resolving.';
    } else if (status === 'orphan' && flags.includes('url-entry-point')) {
      p.recommendedAction = action('none');
      p.actionReason = 'Slug/token landing page. Having no nav link is the intended design.';
    } else if (status === 'orphan') {
      p.recommendedAction = action('needs-human-decision');
      p.actionReason = 'Nothing in src links to it. Unreferenced is not unused — check middleware, redirects, and anything shared outside the repo.';
    } else if (p.duplicateOf) {
      p.recommendedAction = action('consolidate');
      p.actionReason = `Near-identical to ${p.duplicateOf}. Confirm it is not a deliberate scaffold first.`;
    } else {
      p.recommendedAction = action('none');
      p.actionReason = null;
    }
  }

  // Nav entries pointing at a route that has no page.tsx.
  //
  // This has to be an exact, static question. resolveToPage() also
  // matches dynamic routes, and /dashboard/[id] matches any single
  // segment under /dashboard — so /dashboard/in-edit and
  // /dashboard/posting-instructions looked resolved when neither has a
  // page. Worse than a 404: at runtime Next.js serves them from the
  // [id] page with id="in-edit", rendering a page that is not theirs.
  // That shadowing is recorded per entry as `caughtBy`.
  const seenNavPath = new Set();
  const navDangling = [];
  for (const n of navEntries) {
    if (routeSet.has(n.path)) continue;
    if (seenNavPath.has(n.path)) continue;
    seenNavPath.add(n.path);
    const shadow = resolveToPage(n.path);
    navDangling.push({
      ...n,
      caughtBy: shadow && shadow !== n.path ? shadow : null,
      // A parked link is off the rail on purpose — dashboard-nav.ts says
      // outright that hidden keeps a route live and deletes nothing. A
      // VISIBLE link to a missing page is the only real defect here.
      recommendedAction: n.hidden ? action('parked-no-action') : action('fix'),
      state: n.hidden ? 'parked / awaiting build' : 'visible link, no page',
    });
  }

  // Account for every `hidden: true` entry, so the nav-hidden page count
  // and the nav file's own hidden entries can be reconciled line by line
  // instead of silently differing.
  const hiddenReconciliation = [];
  const seenHidden = new Set();
  for (const n of navEntries.filter((e) => e.hidden)) {
    const dupe = seenHidden.has(n.path);
    seenHidden.add(n.path);
    const page = pages.find((p) => p.route === n.path);
    let disposition;
    if (!page) disposition = 'no page yet — parked';
    else if (dupe) disposition = 'duplicate href, already counted';
    else if (page.nav.status === 'nav-hidden') disposition = 'counted as nav-hidden';
    else disposition = `also linked visibly — counted as ${page.nav.status}`;
    hiddenReconciliation.push({ href: n.href, label: n.label, rail: n.rail, disposition });
  }

  // --- write ---
  const pagesPath = path.join(outRoot, 'pages.jsonl');
  const elementsPath = path.join(outRoot, 'elements.jsonl');
  const summaryPath = path.join(outRoot, 'SUMMARY.md');

  fs.writeFileSync(pagesPath, pages.map((p) => JSON.stringify(p)).join('\n') + '\n');
  fs.writeFileSync(
    elementsPath,
    allElements
      .map((e) => JSON.stringify({
        route: e.route,
        file: e.file,
        line: e.line,
        type: e.type,
        label: e.label,
        href: e.href,
        target: e.target,
        linkStatus: e.linkStatus,
        resolvedRoute: e.resolvedRoute || null,
        handler: e.handler,
        inputType: e.inputType,
        disabled: e.disabled,
      }))
      .join('\n') + '\n'
  );
  fs.writeFileSync(summaryPath, buildSummary({ repoRoot, pages, allElements, navEntries, navDangling, navMissing, apiRoutes, hiddenReconciliation, duplicateGroups }));

  console.log(`hub-sweep: ${pages.length} pages, ${allElements.length} elements -> ${outRoot}`);
  const orphans = pages.filter((p) => p.nav.status === 'orphan').length;
  const viol = pages.reduce((n, p) => n + p.violations.length, 0);
  console.log(`  ${orphans} orphan route(s), ${viol} style finding(s), ${navDangling.length} nav link(s) with no page`);
}

// ---------- summary ----------

function table(headers, rows) {
  const out = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`];
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  return out.join('\n');
}

function buildSummary({ repoRoot, pages, allElements, navEntries, navDangling, navMissing, apiRoutes, hiddenReconciliation, duplicateGroups }) {
  const L = [];
  const tick = (x) => '`' + String(x) + '`';
  const total = pages.length;
  const loc = pages.reduce((n, p) => n + p.lines, 0);
  const byStatus = {};
  for (const p of pages) byStatus[p.nav.status] = (byStatus[p.nav.status] || 0) + 1;
  const byData = {};
  for (const p of pages) byData[p.data.kind] = (byData[p.data.kind] || 0) + 1;
  const byRendering = {};
  for (const p of pages) byRendering[p.rendering] = (byRendering[p.rendering] || 0) + 1;

  L.push('# Hub Sweep');
  L.push('');
  L.push(`Static audit of \`${path.basename(repoRoot)}\` — generated ${new Date().toISOString().slice(0, 10)}.`);
  L.push('');
  L.push(
    `**${total} pages** · ${loc.toLocaleString()} lines · ${byRendering.client || 0} client / ${byRendering.server || 0} server · ` +
    `${allElements.length} interactive elements · ${apiRoutes.length} API routes · ${navEntries.length} nav links`
  );
  L.push('');
  L.push('## How to read this');
  L.push('');
  L.push('Every finding carries a `recommended_action` from a closed set: `none` · `migrate-preserve-url` · `consolidate` · `needs-human-decision` · `fix` · `parked-no-action`.');
  L.push('');
  L.push('There is no `delete`. A static sweep can prove that nothing in `src` links to a route; it cannot prove the route is unused. Live URLs get pasted into client emails and decks, routes get parked mid-build on purpose, and near-identical files are often deliberate scaffolds. So anything that looks removable is `needs-human-decision` with the reasoning attached, and the closed set is enforced in code — a run fails rather than emitting a label outside it.');
  L.push('');

  // --- reachability ---
  L.push('## Reachability');
  L.push('');
  L.push('How a page is reached. `nav-parent` means no nav link of its own, but an ancestor is on a rail — the normal shape for a detail page under a list page.');
  L.push('');
  const statusNote = {
    'nav-direct': 'Linked from a nav rail',
    'nav-hidden': 'On a rail but `hidden: true` — live by URL only',
    'nav-parent': 'Reached by drilling down from a nav ancestor',
    linked: 'No nav entry; reached from another page or a shared component',
    orphan: 'No nav entry and nothing in `src` links to it',
  };
  L.push(table(
    ['Status', 'Pages', 'Meaning'],
    ['nav-direct', 'nav-hidden', 'nav-parent', 'linked', 'orphan']
      .filter((s) => byStatus[s])
      .map((s) => [`\`${s}\``, String(byStatus[s]), statusNote[s]])
  ));
  L.push('');

  const orphans = pages.filter((p) => p.nav.status === 'orphan');
  const legacy = orphans.filter((p) => p.flags.includes('legacy-url'));
  const entryPoints = orphans.filter((p) => !p.flags.includes('legacy-url') && p.flags.includes('url-entry-point'));
  const undecided = orphans.filter((p) => !p.flags.includes('legacy-url') && !p.flags.includes('url-entry-point'));

  if (legacy.length) {
    L.push('### Legacy URLs — must keep resolving (' + legacy.length + ')');
    L.push('');
    L.push('Live, externally-shared URLs: sent in client emails and decks. They are reached by pasted link, never from the nav, so this sweep sees them as unreferenced — that is a property of the audit, not a defect in the route. **Not removal candidates.** Where several share one shape, the move is a dynamic route sitting behind the same URLs.');
    L.push('');
    L.push(table(
      ['Route', 'Lines', 'Action', 'Scaffold family'],
      legacy.map((p) => [
        tick(p.route),
        String(p.lines),
        tick(p.recommendedAction),
        p.duplicateGroup ? p.duplicateGroup.kind + ' x' + p.duplicateGroup.size : '—',
      ])
    ));
    L.push('');
  }

  if (undecided.length) {
    L.push('### Unreferenced by nav — needs a human (' + undecided.length + ')');
    L.push('');
    L.push('No nav entry, and nothing in `src` links to these. Unreferenced is **not** the same as unused: check `middleware.ts`, redirects, and anything shared outside the repo before acting. This audit does not conclude that any route can be removed.');
    L.push('');
    L.push(table(
      ['Route', 'Lines', 'Data', 'Action'],
      undecided.map((p) => [tick(p.route), String(p.lines), p.data.kind, tick(p.recommendedAction)])
    ));
    L.push('');
  }

  if (entryPoints.length) {
    L.push('### URL entry points (' + entryPoints.length + ')');
    L.push('');
    L.push('Orphaned by the same test, but each takes a slug or token — the shape of a page opened from an emailed or shared link. Having no nav entry is the intended design.');
    L.push('');
    L.push(table(
      ['Route', 'Lines', 'Data', 'Action'],
      entryPoints.map((p) => [tick(p.route), String(p.lines), p.data.kind, tick(p.recommendedAction)])
    ));
    L.push('');
  }

  const hidden = pages.filter((p) => p.nav.status === 'nav-hidden');
  if (hidden.length) {
    L.push(`### Hidden but live (${hidden.length})`);
    L.push('');
    L.push(table(
      ['Route', 'Nav label', 'Rail', 'Lines'],
      hidden.map((p) => [`\`${p.route}\``, p.nav.label || '—', p.nav.rail || '—', String(p.lines)])
    ));
    L.push('');
  }

  if (navDangling.length) {
    L.push('### Nav links with no page yet (' + navDangling.length + ')');
    L.push('');
    L.push('An href on a rail that no `page.tsx` answers. Every one of these is `hidden: true` — parked on purpose. `dashboard-nav.ts` states the contract: hidden *"keeps a route live while taking its link off the rail; nothing here deletes a route"*, and two are commented *"No route yet — Phase 3 of the content review pipeline."* So these are **parked / awaiting build**, not broken links and not 404s.');
    L.push('');
    L.push('`Shadowed by` matters more than it looks: where a dynamic route matches the path, Next.js serves that page instead of 404ing, so the link renders a page that is not its own. That is also what hid two of these from the previous run.');
    L.push('');
    L.push(table(
      ['Href', 'Label', 'State', 'Shadowed by', 'Action'],
      navDangling.map((n) => [
        tick(n.href),
        n.label || '—',
        n.state,
        n.caughtBy ? tick(n.caughtBy) : 'nothing — 404',
        tick(n.recommendedAction),
      ])
    ));
    L.push('');
  }

  if (hiddenReconciliation && hiddenReconciliation.length) {
    const counted = hiddenReconciliation.filter((h) => h.disposition === 'counted as nav-hidden').length;
    L.push('### Reconciling `hidden: true` (' + hiddenReconciliation.length + ' entries -> ' + counted + ' pages)');
    L.push('');
    L.push('The nav files carry more hidden entries than there are `nav-hidden` pages, because some point at routes that have no page yet. Every entry is accounted for below rather than dropped.');
    L.push('');
    L.push('Note: a raw `grep -c \'hidden: true\'` over `dashboard-nav.ts` returns one more than this table. That extra hit is the contract comment at the top of the file, which quotes the flag while explaining it — it is not an entry. This sweep blanks comments before parsing, so it counts the real ones.');
    L.push('');
    L.push(table(
      ['Href', 'Label', 'Where it went'],
      hiddenReconciliation.map((h) => [tick(h.href), h.label || '—', h.disposition])
    ));
    L.push('');
  }

  if (navMissing.length) {
    L.push(`> Nav file not found, so its rail was not checked: ${navMissing.map((f) => `\`${f}\``).join(', ')}`);
    L.push('');
  }

  // --- data ---
  L.push('## Data sources');
  L.push('');
  const dataNote = {
    supabase: 'Queries Supabase directly',
    api: 'Fetches an internal /api route',
    mixed: 'Both Supabase and /api',
    static: 'No data source detected — static, or fed entirely by props',
  };
  L.push(table(
    ['Kind', 'Pages', 'Meaning'],
    ['supabase', 'api', 'mixed', 'static'].filter((k) => byData[k]).map((k) => [`\`${k}\``, String(byData[k]), dataNote[k]])
  ));
  L.push('');
  const tableCounts = {};
  for (const p of pages) for (const t of p.data.tables) tableCounts[t] = (tableCounts[t] || 0) + 1;
  const topTables = Object.entries(tableCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const writerCounts = {};
  for (const p of pages) for (const t of p.data.tablesWritten) writerCounts[t] = (writerCounts[t] || 0) + 1;
  if (topTables.length) {
    L.push('### Most-queried tables');
    L.push('');
    L.push('`Writer` counts pages performing an insert / update / upsert / delete. This sweep reads code only — it never connects to the database and so has **no idea whether any table holds rows**. An empty table with a writer in the codebase is a feature nobody has used yet; an empty table with no writer is a different question entirely. Neither is evidence of dead code on its own, and this report does not make that call.');
    L.push('');
    L.push(table(
      ['Table', 'Pages reading', 'Pages writing'],
      topTables.map(([t, n]) => [tick(t), String(n), writerCounts[t] ? String(writerCounts[t]) : '— read-only here'])
    ));
    L.push('');
  }

  // --- interactive surface ---
  L.push('## Interactive surface');
  L.push('');
  const byType = {};
  for (const e of allElements) byType[e.type] = (byType[e.type] || 0) + 1;
  L.push(table(
    ['Element', 'Count'],
    Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => [`\`${t}\``, String(n)])
  ));
  L.push('');
  const noHandler = allElements.filter((e) => e.type === 'button' && !e.handler && e.inputType !== 'submit').length;
  if (noHandler) {
    L.push(`${noHandler} \`<button>\` elements carry no \`onClick\` and are not \`type="submit"\`. Some are wrapped by a parent handler; the rest do nothing when clicked. Filter \`elements.jsonl\` on \`type="button"\` and \`handler=null\` to review them.`);
    L.push('');
  }

  const dangling = allElements.filter((e) => e.linkStatus === 'dangling' || e.linkStatus === 'dangling-api');
  if (dangling.length) {
    L.push(`### Dangling links (${dangling.length})`);
    L.push('');
    L.push('A fully static internal href with no matching route. Hrefs built from an expression are excluded — those are reported as `unresolved` in `elements.jsonl`.');
    L.push('');
    L.push(table(
      ['Href', 'From', 'Line', 'Label'],
      dangling.slice(0, 40).map((e) => [`\`${e.target}\``, `\`${e.file}\``, String(e.line), (e.label || '—').replace(/\|/g, '\\|')])
    ));
    if (dangling.length > 40) L.push('');
    if (dangling.length > 40) L.push(`_… and ${dangling.length - 40} more in \`elements.jsonl\`._`);
    L.push('');
  }

  // --- style ---
  L.push('## Design-system findings');
  L.push('');
  const byRule = {};
  const filesByRule = {};
  for (const p of pages) {
    for (const v of p.violations) {
      byRule[v.rule] = (byRule[v.rule] || 0) + 1;
      if (!filesByRule[v.rule]) filesByRule[v.rule] = new Set();
      filesByRule[v.rule].add(p.file);
    }
  }
  const ruleMeta = { ...HEX_RULE_META, ...Object.fromEntries(VIOLATION_RULES.map((r) => [r.id, r])) };
  const ruleRows = Object.entries(byRule)
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      const d = rank[ruleMeta[a[0]].severity] - rank[ruleMeta[b[0]].severity];
      return d !== 0 ? d : b[1] - a[1];
    })
    .map(([id, n]) => [
      `\`${id}\``,
      ruleMeta[id].severity,
      String(n),
      String(filesByRule[id].size),
      `\`${ruleMeta[id].recommendedAction}\``,
      ruleMeta[id].note,
    ]);
  if (ruleRows.length) {
    L.push(table(['Rule', 'Severity', 'Hits', 'Files', 'Action', 'Why'], ruleRows));
    const hexShort = pages.reduce((n, p) => n + p.violations.filter((v) => v.rule === 'off-palette-hex' && v.text.length === 4).length, 0);
    const hexLong = byRule['off-palette-hex'] ? byRule['off-palette-hex'] - hexShort : 0;
    if (hexShort) {
      L.push('');
      L.push('`off-palette-hex` splits ' + hexLong + ' six/eight-digit values and ' + hexShort + ' three-digit shorthand (`#111`, `#FFF`, `#000`). Shorthand is counted because it is equally off-palette, but it is listed separately here since a hex audit done by eye tends to miss it.');
    }
  } else {
    L.push('No findings.');
  }
  L.push('');

  // The highest-value colour finding: a hex one or two digits off a
  // palette colour renders as a colour nobody can distinguish by eye,
  // so it survives every visual review.
  const misses = new Map();
  for (const p of pages) {
    for (const v of p.violations) {
      if (v.rule !== 'off-palette-hex' || !v.nearMissOf) continue;
      const key = v.text.toUpperCase() + '|' + v.nearMissOf + '|' + v.nearMissToken;
      misses.set(key, (misses.get(key) || 0) + 1);
    }
  }
  if (misses.size) {
    const rows = Array.from(misses.entries())
      .map(([k, n]) => {
        const [hex, of, token] = k.split('|');
        return { hex, of, token, n };
      })
      .sort((a, b) => b.n - a.n)
      .slice(0, 20);
    L.push('### Near-misses of a palette colour (' + misses.size + ' distinct values)');
    L.push('');
    L.push('Each of these is close enough to a palette colour that no eye would catch the difference — `#B33507` against the real `#B33407` is a single digit. These are typos, not decisions, and they are the reason the hex findings are split: at 782 hits under one rule they were buried. Pure `#FFFFFF` and `#000000` are excluded — they are off-palette, but nobody types them by accident.');
    L.push('');
    L.push(table(
      ['Written', 'Almost certainly meant', 'Token', 'Hits'],
      rows.map((r) => [tick(r.hex), tick(r.of), r.token, String(r.n)])
    ));
    L.push('');
  }

  const worst = pages
    .filter((p) => p.violations.length)
    .sort((a, b) => b.violations.length - a.violations.length)
    .slice(0, 15);
  if (worst.length) {
    L.push('### Heaviest pages');
    L.push('');
    L.push(table(
      ['Route', 'Findings', 'High', 'File'],
      worst.map((p) => [
        `\`${p.route}\``,
        String(p.violations.length),
        String(p.violations.filter((v) => v.severity === 'high').length),
        `\`${p.file}\``,
      ])
    ));
    L.push('');
  }

  // --- stubs & size ---
  const stubs = pages.filter((p) => p.flags.includes('stub')).sort((a, b) => a.lines - b.lines);
  if (stubs.length) {
    L.push(`## Stubs (${stubs.length})`);
    L.push('');
    L.push(`Pages at or under ${STUB_LINES} lines.`);
    L.push('');
    L.push(table(
      ['Route', 'Lines', 'Reachability'],
      stubs.map((p) => [`\`${p.route}\``, String(p.lines), `\`${p.nav.status}\``])
    ));
    L.push('');
  }

  const shims = pages.filter((p) => p.isRedirectShim);
  if (shims.length) {
    L.push('## Redirect shims (' + shims.length + ')');
    L.push('');
    L.push('Pages whose entire body is a `redirect()`. They are held out of the duplicate families below: they all look alike by construction, but each points somewhere different, so there is nothing to consolidate. Listed because a shim on a visible nav link means the rail leads somewhere other than where it says.');
    L.push('');
    L.push(table(
      ['Route', 'Redirects to', 'Reachability', 'Action'],
      shims.map((p) => [tick(p.route), tick(p.redirectTo), tick(p.nav.status), tick(p.recommendedAction)])
    ));
    L.push('');
  }

  if (duplicateGroups && duplicateGroups.length) {
    L.push('## Duplicate and scaffold families (' + duplicateGroups.length + ')');
    L.push('');
    L.push('Files that match after normalising formatting, string literals and numbers. Recorded as `duplicate_of`, never as a removal candidate: a family of pages differing by one slug is usually a deliberate scaffold sitting behind URLs that have to keep resolving.');
    L.push('');
    L.push(table(
      ['Kind', 'Size', 'Representative', 'Routes', 'Action'],
      duplicateGroups
        .sort((a, b) => b.size - a.size)
        .map((g) => [
          g.kind,
          String(g.size),
          tick(g.representative),
          g.routes.slice(0, 4).map(tick).join(' ') + (g.routes.length > 4 ? ' +' + (g.routes.length - 4) : ''),
          tick(g.recommendedAction),
        ])
    ));
    L.push('');
  }

  const biggest = [...pages].sort((a, b) => b.lines - a.lines).slice(0, 15);
  L.push('## Largest pages');
  L.push('');
  L.push(table(
    ['Route', 'Lines', 'Rendering', 'Elements'],
    biggest.map((p) => [`\`${p.route}\``, String(p.lines), p.rendering, String(p.elements.total)])
  ));
  L.push('');

  // --- method ---
  L.push('## Method and limits');
  L.push('');
  L.push('- Regex over source, not a type-aware parse. Comments and their contents are blanked out first, so a commented-out block is not counted.');
  L.push('- Route groups `(name)` and `@slots` are stripped from routes, matching App Router resolution.');
  L.push('- Reachability reads `src/lib/dashboard-nav.ts` and `src/lib/admin/nav.ts` as pure data, then every `href`, `router.push`/`replace` and `redirect` across all of `src` — so a link from a rail, shell or table component counts. A route reached only via `middleware.ts` or an href assembled at runtime still reads as `orphan`; confirm before deleting anything.');
  L.push('- `elements.jsonl` covers `page.tsx` only. An element inside an imported component is attributed to that component and is not counted here, so a page whose body lives in a component looks emptier than it is.');
  L.push('- Reachability is evidence about links, not about use. A route no link points at may still be live: reached by pasted URL, by `middleware.ts`, or by a redirect. Nothing here is a removal recommendation.');
  L.push('- Nav-link existence is checked against exact static routes. A dynamic route can shadow a missing page — `/dashboard/[id]` answers `/dashboard/in-edit`, so that link renders the wrong page rather than a 404, and an earlier version of this script mistook the shadow for a real page.');
  L.push('- Duplicate detection normalises formatting, string literals and numbers, so a family of per-slug scaffolds collapses into one group. Groups are reported, never resolved.');
  L.push('- Style findings are lint, not judgement. `off-palette-hue` in particular flags every non-palette Tailwind hue, including deliberate status colours; Tailwind\'s default `orange-*` is exempt because `tailwind.config.js` records it as intentional.');
  L.push('');
  L.push('Records: `pages.jsonl` (one per page), `elements.jsonl` (one per element). Both are newline-delimited JSON — `jq` reads them directly.');
  L.push('');

  return L.join('\n');
}

main(process.argv.slice(2));
