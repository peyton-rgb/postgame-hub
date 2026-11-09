// ============================================================
// /dashboard/carousels — every athlete with an IG feed carousel to build.
// Rows come from carousel_athletes (migration 099).
// ============================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getHubStaff } from '@/lib/staff-auth';
import { createLiveServiceSupabase } from '@/lib/supabase-server';

export const metadata: Metadata = { title: 'Carousels' };
export const dynamic = 'force-dynamic';

export default async function CarouselsIndex() {
  const staff = await getHubStaff();
  if (!staff.ok) redirect(staff.reason === 'anon' ? '/login' : '/');

  const { data: athletes } = await createLiveServiceSupabase()
    .from('carousel_athletes')
    .select('slug, name, campaign')
    .order('sort_order');

  const campaign = athletes?.[0]?.campaign ?? '';

  return (
    <div className="px-5 py-8 md:px-10">
      <p className="text-[12px] font-bold uppercase tracking-[.16em] text-ink-4">{campaign} · IG feed carousels</p>
      <h1 className="mt-1 font-display text-[44px] leading-[.95] md:text-[56px]">Carousels</h1>
      <p className="mt-3 max-w-[640px] text-[16px] leading-relaxed text-ink-3">
        Pick an athlete to lay out their five-slide carousel. Footage comes live from their Frame.io SELECTED CLIPS
        and anything marked Approved.
      </p>
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(athletes ?? []).map((a) => (
          <li key={a.slug}>
            <Link
              href={`/dashboard/carousels/${a.slug}`}
              className="flex min-h-[56px] items-center justify-between rounded-2xl border border-hairline-soft bg-surface-card px-5 py-4 text-[16px] font-bold text-ink-1 transition-colors hover:border-hairline hover:bg-surface-raised"
            >
              {a.name}
              <span aria-hidden className="text-accent">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
