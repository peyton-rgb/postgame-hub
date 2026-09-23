// ============================================================
// /dashboard/posting-instructions/[campaignId] — the staff roster + editor
// for one posting campaign. Staff only: /dashboard/* is gated in
// src/middleware.ts, and every API it calls checks access_level again.
// ============================================================

import { Suspense } from 'react';
import type { Metadata } from 'next';
import PostingRoster from './PostingRoster';
import '../posting.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Posting instructions' };

export default function Page({ params }: { params: { campaignId: string } }) {
  return (
    <Suspense fallback={<div className="pi"><p className="lab">Loading…</p></div>}>
      <PostingRoster campaignId={params.campaignId} />
    </Suspense>
  );
}
