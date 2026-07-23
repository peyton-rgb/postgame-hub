// ============================================================
// List outstanding (incomplete) campaign recaps
//
// Prints the campaign recaps that still need to be completed,
// from two independent sources:
//   • Supabase `campaign_recaps` — rows with status = 'draft'
//     (created but not yet published/live).
//   • Slack "Recap Queue List" — intake requests with
//     completed = false (requested but not yet built).
//
// Read-only: this script never writes to either source.
//
// Run with:
//   npm run recaps:outstanding
//   npm run recaps:outstanding -- --source db
//   npm run recaps:outstanding -- --source slack
//   npm run recaps:outstanding -- --json
//
// That npm script wraps:
//   node --import ./scripts/register-alias.mjs --env-file=.env.local \
//     scripts/list-outstanding-recaps.ts
// The --import hook resolves the "@/" path alias that shared app
// modules (e.g. src/lib/slack-recap-queue.ts) use internally, which
// bare Node type-stripping cannot resolve on its own.
//
// Node native type-stripping runs this .ts file directly, so the
// shared module is imported by RELATIVE path with an explicit .ts
// extension — the "@/" alias is a bundler concern and won't resolve
// under bare node.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { getRecapQueue, type RecapRequest } from '../src/lib/slack-recap-queue.ts';

// --- Args: --source db|slack|all (default all), --json ---
type Source = 'db' | 'slack' | 'all';

function parseSource(argv: string[]): Source {
  const idx = argv.indexOf('--source');
  if (idx === -1) return 'all';
  const raw = argv[idx + 1];
  if (raw === 'db' || raw === 'slack' || raw === 'all') return raw;
  console.error(`Invalid --source value: ${raw}. Must be one of: db, slack, all.`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const source = parseSource(argv);
const asJson = argv.includes('--json');

const wantDb = source === 'db' || source === 'all';
const wantSlack = source === 'slack' || source === 'all';

// --- Env guard (only require what the chosen source needs) ---
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

const missing: string[] = [];
if (wantDb && !NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (wantDb && !SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (wantSlack && !SLACK_BOT_TOKEN) missing.push('SLACK_BOT_TOKEN');
if (missing.length) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      `Run with: npm run recaps:outstanding`
  );
  process.exit(1);
}

interface DraftRecap {
  id: string;
  name: string;
  slug: string;
  client_name: string;
  status: string;
  published: boolean | null;
  created_at: string | null;
}

async function fetchDrafts(): Promise<DraftRecap[]> {
  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase
    .from('campaign_recaps')
    .select('id, name, slug, client_name, status, published, created_at')
    .eq('status', 'draft')
    .order('created_at', { ascending: true });
  if (error) {
    console.error(`Supabase query failed: ${error.message}`);
    process.exit(1);
  }
  return (data ?? []) as DraftRecap[];
}

async function fetchPendingRequests(): Promise<RecapRequest[]> {
  const { requests } = await getRecapQueue({ token: SLACK_BOT_TOKEN });
  return requests.filter((r) => !r.completed);
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

async function main() {
  const drafts = wantDb ? await fetchDrafts() : [];
  const pending = wantSlack ? await fetchPendingRequests() : [];

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          draftRecaps: drafts,
          pendingRequests: pending.map((r) => ({
            itemId: r.itemId,
            campaignName: r.campaignName,
            brand: r.brand,
            assignee: r.assignee ?? null,
            campaignManager: r.campaignManager ?? null,
            dueDate: r.dueDate ?? null,
            recapLink: r.recapLink ?? null,
            comments: r.comments ?? null,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  if (wantDb) {
    console.log(`\n=== Draft recaps in Supabase (status = 'draft') — ${drafts.length} ===`);
    if (drafts.length === 0) {
      console.log('  (none — every recap is published or archived)');
    } else {
      for (const d of drafts) {
        console.log(
          `  • ${d.name}  [${d.client_name}]  slug=${d.slug}  created=${fmtDate(d.created_at)}`
        );
      }
    }
  }

  if (wantSlack) {
    console.log(`\n=== Pending intake requests in Slack Recap Queue (completed = false) — ${pending.length} ===`);
    if (pending.length === 0) {
      console.log('  (none — every queued request is marked completed)');
    } else {
      for (const r of pending) {
        const who = r.assignee
          ? `assignee=${r.assignee}`
          : r.campaignManager
            ? `mgr=${r.campaignManager}`
            : 'unassigned';
        console.log(
          `  • ${r.campaignName}  [${r.brand || '—'}]  due=${fmtDate(r.dueDate)}  ${who}`
        );
      }
    }
  }

  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
