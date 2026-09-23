// ============================================================
// Athlete posting instructions — /deliver/[token]
//
// One private link per athlete post. No login: the random token in the URL is
// the only gate. The page gives the athlete their files, their caption, a
// screenshot walkthrough for posting, and a box to send back their live link.
//
// Design: the approved Sept 18 artifact ("Caniac Ambassador — King Miller"),
// Liquid Glass Dark. Styles in ./deliver.css, interaction in ./DeliverPage.tsx.
//
// Data is loaded here, server-side, through the same helper as
// GET /api/deliver/[token] (src/lib/deliver-package.ts) — service-role, one row
// by exact token, curated fields only. A bad token of any shape gets the same
// "This link isn't valid" page, so nothing reveals whether other tokens exist.
// ============================================================

import type { Metadata } from 'next';
import { loadDeliverView, loadPostgameLogo } from '@/lib/deliver-package';
import DeliverPage from './DeliverPage';
import './deliver.css';

export const dynamic = 'force-dynamic';

// Same title for valid and invalid tokens, and never indexed.
export const metadata: Metadata = {
  title: 'Posting instructions',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: { token: string } }) {
  const view = await loadDeliverView(params.token);

  if (!view) {
    const postgameLogo = await loadPostgameLogo();
    return (
      <div className="dv">
        <main className="wrap">
          <header className="masthead">
            <div className="lockup">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {postgameLogo && <img className="pg" src={postgameLogo} alt="Postgame" />}
            </div>
          </header>
          <div className="invalid">
            <p className="lab" style={{ color: 'var(--orange)' }}>Posting instructions</p>
            <h1>This link isn&apos;t valid</h1>
            <p>
              Check that you opened the full link you were sent. If it still doesn&apos;t work,
              reply to the message it came in and we&apos;ll send a new one.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return <DeliverPage token={params.token} view={view} />;
}
