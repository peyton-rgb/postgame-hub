'use client';

// ============================================================
// /dashboard/posting-instructions — one card per posting campaign.
//
// Only Raising Cane's exists today, so this is a short list; the work
// happens on /dashboard/posting-instructions/[campaignId]. Counts come from
// GET /api/posting-campaigns, computed from the rows — never typed in.
// Creating a campaign is Phase 3 (campaign setup), not here.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './posting.css';

type CampaignCard = {
  id: string;
  title: string | null;
  seasonLabel: string | null;
  brandName: string | null;
  brandLogo: string | null;
  counts: { athletes: number; posts: number; linksSent: number; posted: number };
};

export default function PostingInstructionsIndex() {
  const [campaigns, setCampaigns] = useState<CampaignCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/posting-campaigns', { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Could not load posting campaigns.');
        setCampaigns(body.campaigns ?? []);
      })
      .catch((e) => setError(e?.message || 'Could not load posting campaigns.'));
  }, []);

  return (
    <div className="pi">
      <p className="eye">Posting instructions</p>
      <h1 className="title">Posting campaigns</h1>
      <p className="hint" style={{ marginTop: 8 }}>
        Each campaign lists its athletes&apos; posts: captions, files, dates and private links.
      </p>

      {error && <p className="err" role="alert" style={{ marginTop: 20 }}>{error}</p>}
      {!error && !campaigns && <p className="lab" style={{ marginTop: 20 }}>Loading…</p>}
      {campaigns && campaigns.length === 0 && (
        <p className="empty" style={{ marginTop: 20 }}>No posting campaigns yet.</p>
      )}

      <div style={{ display: 'grid', gap: 12, marginTop: 22, maxWidth: 820 }}>
        {(campaigns ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/posting-instructions/${c.id}`}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, borderRadius: 16, background: 'var(--surface-card)', border: '1px solid var(--hairline)', textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}
          >
            {c.brandLogo && (
              <div className="plate">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.brandLogo} alt={c.brandName ?? ''} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="aname" style={{ fontSize: 26 }}>
                {[c.title, c.seasonLabel].filter(Boolean).join(' · ') || 'Untitled campaign'}
              </div>
              <div className="ameta">{c.brandName ?? ''}</div>
            </div>
            <div className="lab" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span><b style={{ color: 'var(--ink-1)' }}>{c.counts.athletes}</b> athlete{c.counts.athletes === 1 ? '' : 's'}</span>
              <span><b style={{ color: 'var(--ink-1)' }}>{c.counts.posts}</b> post{c.counts.posts === 1 ? '' : 's'}</span>
              <span><b style={{ color: 'var(--ink-1)' }}>{c.counts.linksSent}</b> sent</span>
              <span><b style={{ color: 'var(--ink-1)' }}>{c.counts.posted}</b> posted</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
