// ============================================================
// /dashboard/order-forms — one card per athlete order form.
//
// The forms themselves are static pages in public/order-forms/<slug>/,
// served at /order/<slug> (rewrite in next.config.js) with no login. The
// list is ORDER_FORMS in src/lib/order-forms.ts — add a campaign there.
//
// Server component on purpose: "Connected" means the form's Apps Script URL
// env var is set, and that is checked here so only a boolean reaches the
// browser — the URL itself never does. Styling is Posting instructions'
// (.pi, posting.css) so the two pages read as siblings.
// ============================================================

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getHubStaff } from '@/lib/staff-auth';
import { createLiveServiceSupabase } from '@/lib/supabase-server';
import { loadBrandLockup } from '@/lib/deliver-package';
import { ORDER_FORMS, orderFormPath } from '@/lib/order-forms';
import CopyLink from './CopyLink';
import '../posting-instructions/posting.css';
import './order-forms.css';

export const metadata: Metadata = { title: 'Order forms' };
export const dynamic = 'force-dynamic';

// brandName → brands row. ILIKE + TRIM per CLAUDE.md: names carry stray
// spaces and duplicates, so match loosely, then require an exact trimmed hit.
async function brandIdFor(name: string): Promise<string | null> {
  const want = name.trim().toLowerCase();
  const { data } = await createLiveServiceSupabase()
    .from('brands')
    .select('id, name')
    .ilike('name', `%${want}%`);
  const hit = (data ?? []).find((b) => (b.name ?? '').trim().toLowerCase() === want);
  return hit?.id ?? null;
}

export default async function OrderFormsIndex() {
  // Middleware already keeps non-staff off /dashboard; this page also reads
  // with the service client, so it checks again rather than lean on that.
  const staff = await getHubStaff();
  if (!staff.ok) redirect(staff.reason === 'anon' ? '/login' : '/');

  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : '';

  const cards = await Promise.all(
    ORDER_FORMS.map(async (f) => {
      const brandId = await brandIdFor(f.brandName);
      const lockup = await loadBrandLockup(brandId);
      return {
        ...f,
        brandLogo: lockup.brand,
        brandLabel: lockup.brandName ?? f.brandName,
        path: orderFormPath(f.slug),
        connected: Boolean(process.env[f.sheetEnv]),
      };
    })
  );

  return (
    <div className="pi of">
      <p className="eye">Set up a campaign</p>
      <h1 className="title">Order forms</h1>
      <p className="hint" style={{ marginTop: 8 }}>
        Each form is a public athlete link. Orders land in that campaign&apos;s Google Sheet.
      </p>

      {cards.length === 0 && (
        <p className="empty" style={{ marginTop: 20 }}>No order forms yet.</p>
      )}

      <div className="of-list">
        {cards.map((c) => (
          <section key={c.slug} className="of-card">
            <div className="of-top">
              {c.brandLogo && (
                <div className="plate">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.brandLogo} alt={c.brandLabel} />
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="aname" style={{ fontSize: 26 }}>{c.title}</div>
                <div className="ameta">{c.brandLabel}</div>
              </div>
              <div className="of-chips">
                {c.status === 'live' ? (
                  <span className="st rev"><i />Live</span>
                ) : (
                  <span className="st none"><i />Closed</span>
                )}
                {c.connected ? (
                  <span className="st of-conn ok"><i />Connected</span>
                ) : (
                  <span className="st of-conn bad" title={`Set ${c.sheetEnv} in Vercel`}><i />Not connected</span>
                )}
              </div>
            </div>

            <CopyLink url={`${origin}${c.path}`} />

            <div className="actions of-actions">
              <a className="btn g sm" href={c.path} target="_blank" rel="noopener noreferrer">Open form</a>
              <a className="btn g sm" href={c.sheetLink} target="_blank" rel="noopener noreferrer">Open sheet</a>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
