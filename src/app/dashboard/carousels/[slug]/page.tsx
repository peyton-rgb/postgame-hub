// ============================================================
// /dashboard/carousels/[slug] — one athlete's carousel editor.
// The page only resolves the athlete and its neighbours (for the ‹ › arrows);
// everything interactive lives in <CarouselEditor>.
// ============================================================

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getHubStaff } from '@/lib/staff-auth';
import { createLiveServiceSupabase } from '@/lib/supabase-server';
import CarouselEditor from '@/components/carousels/CarouselEditor';

export const metadata: Metadata = { title: 'Carousel editor' };
export const dynamic = 'force-dynamic';

export default async function CarouselEditorPage({ params }: { params: { slug: string } }) {
  const staff = await getHubStaff();
  if (!staff.ok) redirect(staff.reason === 'anon' ? '/login' : '/');

  const { data: athletes } = await createLiveServiceSupabase()
    .from('carousel_athletes')
    .select('slug, name, campaign')
    .order('sort_order');
  const list = athletes ?? [];
  const i = list.findIndex((a) => a.slug === params.slug);
  if (i < 0) notFound();

  return (
    <CarouselEditor
      athlete={list[i]}
      position={i + 1}
      total={list.length}
      prevSlug={list[(i - 1 + list.length) % list.length].slug}
      nextSlug={list[(i + 1) % list.length].slug}
    />
  );
}
