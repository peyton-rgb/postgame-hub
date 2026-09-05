// ============================================================
// Public Clients Page — /clients
//
// Server component. Reads the roster from Supabase (public.brands joined to
// public.brand_logos) and hands it to the client component, which owns Lenis,
// ScrollTrigger, the shear motion and the hover.
//
// This page no longer reads src/lib/data/brands.ts. That file is unchanged and
// still backs /clients/[slug] and other routes.
//
// SiteNav hides itself on this exact path, so the header card is the first
// thing in the document.
// ============================================================

import ClientsPageClient from './ClientsPageClient';
import { loadClientsPage } from '@/lib/data/clients-page';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function ClientsPage() {
  const { bands, silentBands, tiles } = await loadClientsPage();

  return <ClientsPageClient bands={bands} silentBands={silentBands} tiles={tiles} />;
}
