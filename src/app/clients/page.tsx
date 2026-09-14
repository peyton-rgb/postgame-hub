// ============================================================
// Public Clients Page — /clients
//
// Server component. Reads the roster from Supabase (public.brands joined to
// public.brand_logos) and hands it to the client component.
//
// Structure: hero, intro + stats, the full client directory, the featured
// films as cards, CTA. SiteNav and SiteFooter come from the layout and the
// shared component, so the page sits inside the site like any other route.
//
// This page does not read src/lib/data/brands.ts. That file is unchanged and
// still backs /clients/[slug].
// ============================================================

import ClientsPageClient from './ClientsPageClient';
import { loadClientsPage } from '@/lib/data/clients-page';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function ClientsPage() {
  const { films, tiles } = await loadClientsPage();
  return <ClientsPageClient films={films} tiles={tiles} />;
}
