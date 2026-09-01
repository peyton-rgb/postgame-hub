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

// ---------- config ----------

// A page at or under this many lines is called a stub. The nav file
// already describes /dashboard/run-of-show as "a 5-line stub", so the
// shape is real; 30 keeps the bar low enough to stay meaningful.
const STUB_LINES = 30;

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
    id: 'raw-brand-hex',
    severity: 'high',
    note: 'Brand hex written literally. tailwind.config.js exposes brand / surface / ink for these.',
    re: /#(?:D73F09|07070A|FAF8F5)\b/gi,
  },
  {
    id: 'glass-alpha-suffix',
    severity: 'high',
    note: 'glass-1/2/3 carry a fixed alpha and ignore a /NN suffix — tailwind.config.js says so outright. Use glass/[0.055] for a one-off.',
    re: /\b(?:bg|text|border|ring|from|to|via|divide)-glass-[123]\/[0-9[]/g,
  },
  {
    id: 'arbitrary-color',
    severity: 'medium',
    note: 'Arbitrary hex in a utility instead of a palette token. Excludes the three brand hexes, which `raw-brand-hex` owns, so the two rules never count the same characters twice.',
    re: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|decoration|divide|accent|caret)-\[#(?!(?:D73F09|07070A|FAF8F5)\])[0-9a-f]{3,8}\]/gi,
  },
  {
    id: 'off-palette-hue',
    severity: 'medium',
    note: 'Default Tailwind hue outside the three-color palette (black / orange / off-white).',
    re: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|accent|caret|shadow|outline|decoration)-(?:slate|gray|zinc|neutral|stone|red|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g,
  },
  {
    id: 'inline-font-family',
    severity: 'medium',
    note: 'Font family set inline. The four roles are font-display (Bebas), font-sans (Arimo/Arial), font-mono (JetBrains), and Anton where it is loaded.',
    re: /fontFamily\s*:/g,
  },
  {
    id: 'raw-white-black',
    severity: 'low',
    note: 'text-white / bg-black bypass the ink and surface tokens. An explicit /alpha step is not flagged — that is the opacity ladder.',
    re: /\b(?:bg|text|border)-(?:white|black)\b(?!\/)/g,
  },
  {
    id: 'sub-label-type',
    severity: 'low',
    note: 'Type below the 10px label step at the bottom of the design system scale.',
    re: /\btext-\[(?:[0-9](?:\.[0-9]+)?)px\]/g,
  },
];

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
  for (const rule of VIOLATION_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
      violations.push({
        rule: rule.id,
        severity: rule.severity,
        line: lineOf(m.index),
        text: m[0].slice(0, 60),
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // A trailing newline must not read as an extra line, so this agrees with wc -l.
  const lines = raw === '' ? 0 : raw.replace(/\n$/, '').split('\n').length;

  return {
    record: {
      route,
      file: relFile,
      lines,
      bytes: Buffer.byteLength(raw),
      rendering,
      routeGroups: routeGroupsOf(relFromApp),
      dynamicSegments: dynamicSegmentsOf(route),
      routeExports,
      data: { kind: dataKind, clients, tables, apiRoutes },
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
    p.flags = flags;
  }

  // Nav entries pointing at a route that has no page.tsx.
  const navDangling = navEntries.filter((n) => !resolveToPage(n.path));

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
  fs.writeFileSync(summaryPath, buildSummary({ repoRoot, pages, allElements, navEntries, navDangling, navMissing, apiRoutes }));

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

function buildSummary({ repoRoot, pages, allElements, navEntries, navDangling, navMissing, apiRoutes }) {
  const L = [];
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
  const entryPoints = orphans.filter((p) => p.flags.includes('url-entry-point'));
  const deadEnds = orphans.filter((p) => !p.flags.includes('url-entry-point'));

  if (deadEnds.length) {
    L.push(`### Unreferenced routes (${deadEnds.length})`);
    L.push('');
    L.push('A static route with no nav entry and no link to it anywhere in `src`. These are the real deletion candidates — but check `middleware.ts` and any redirect first.');
    L.push('');
    L.push(table(
      ['Route', 'Lines', 'Data', 'File'],
      deadEnds.map((p) => [`\`${p.route}\``, String(p.lines), p.data.kind, `\`${p.file}\``])
    ));
    L.push('');
  }

  if (entryPoints.length) {
    L.push(`### URL entry points (${entryPoints.length})`);
    L.push('');
    L.push('Orphaned by the same test, but each takes a slug or token — the shape of a page opened from an emailed or shared link. Expected to have no nav entry; listed so the count is accounted for rather than hidden.');
    L.push('');
    L.push(table(
      ['Route', 'Lines', 'Data'],
      entryPoints.map((p) => [`\`${p.route}\``, String(p.lines), p.data.kind])
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
    L.push(`### Nav links with no page (${navDangling.length})`);
    L.push('');
    L.push('An href on a rail that no `page.tsx` answers. A visible one renders a 404 when clicked.');
    L.push('');
    L.push(table(
      ['Href', 'Label', 'Rail', 'Hidden'],
      navDangling.map((n) => [`\`${n.href}\``, n.label || '—', n.rail, n.hidden ? 'yes' : '**no**'])
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
  if (topTables.length) {
    L.push('### Most-queried tables');
    L.push('');
    L.push(table(['Table', 'Pages'], topTables.map(([t, n]) => [`\`${t}\``, String(n)])));
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
  const ruleMeta = Object.fromEntries(VIOLATION_RULES.map((r) => [r.id, r]));
  const ruleRows = Object.entries(byRule)
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      const d = rank[ruleMeta[a[0]].severity] - rank[ruleMeta[b[0]].severity];
      return d !== 0 ? d : b[1] - a[1];
    })
    .map(([id, n]) => [`\`${id}\``, ruleMeta[id].severity, String(n), String(filesByRule[id].size), ruleMeta[id].note]);
  if (ruleRows.length) {
    L.push(table(['Rule', 'Severity', 'Hits', 'Files', 'Why'], ruleRows));
  } else {
    L.push('No findings.');
  }
  L.push('');

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
  L.push('- Style findings are lint, not judgement. `off-palette-hue` in particular flags every non-palette Tailwind hue, including deliberate status colours; Tailwind\'s default `orange-*` is exempt because `tailwind.config.js` records it as intentional.');
  L.push('');
  L.push('Records: `pages.jsonl` (one per page), `elements.jsonl` (one per element). Both are newline-delimited JSON — `jq` reads them directly.');
  L.push('');

  return L.join('\n');
}

main(process.argv.slice(2));
