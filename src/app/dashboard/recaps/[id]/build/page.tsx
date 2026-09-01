// ============================================================
// Recap Builder — /dashboard/recaps/[id]/build
//
// Phase 1: the scaffold and shared chrome only. The step bodies
// (Athletes, Overview, Hero, Performers) land in phases 2–5;
// Content / Takeaways / Sections are stubs from phase 6.
//
// This route is NEW. The existing editor at /dashboard/[id]
// is untouched, and nothing here writes to the publish path —
// every builder write is draft state, added per step later.
//
// The step is carried in ?step= so each one is linkable, and
// defaults to the first step.
//
// Chrome ported from docs/recap-builder/prototypes/*.html —
// see builder-chrome.css. Do not re-derive visual values here.
// ============================================================

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import StepRail from '@/components/recap-builder/StepRail';
import BuilderFooter from '@/components/recap-builder/BuilderFooter';
import PreviewPanel, { type PreviewDevice } from '@/components/recap-builder/PreviewPanel';
import { useAutosaveStatus } from '@/components/recap-builder/useAutosaveStatus';
import { STEPS, stepIndex, stepSlug } from '@/components/recap-builder/steps';
import AthletesStep from '@/components/recap-builder/athletes/AthletesStep';
import './athletes-step.css';

type RecapHeader = {
  id: string;
  name: string | null;
  slug: string | null;
  client_name: string | null;
  status: string | null;
  published: boolean | null;
  athletes: { count: number }[] | null;
};

// useSearchParams needs a Suspense boundary or the route opts out of
// static rendering at build time.
export default function RecapBuilderPage() {
  return (
    <Suspense fallback={<div className="rb-root" />}>
      <RecapBuilder />
    </Suspense>
  );
}

function RecapBuilder() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const recapId = params?.id;

  const active = useMemo(() => {
    const i = stepIndex(search?.get('step') ?? '');
    return i < 0 ? 0 : i;
  }, [search]);

  const [recap, setRecap] = useState<RecapHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [expanded, setExpanded] = useState(false);
  const { status, touch } = useAutosaveStatus();

  useEffect(() => {
    if (!recapId) return;
    let cancelled = false;

    (async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from('campaign_recaps')
        .select('id, name, slug, client_name, status, published, athletes(count)')
        .eq('id', recapId)
        .single();

      if (!cancelled) {
        setRecap((data as RecapHeader | null) ?? null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recapId]);

  const goToStep = (i: number) => {
    router.push(`/dashboard/recaps/${recapId}/build?step=${stepSlug(STEPS[i])}`);
  };

  const athleteCount = recap?.athletes?.[0]?.count ?? 0;
  const metaBits = [
    `${athleteCount} athletes`,
    recap?.published ? 'Published' : (recap?.status ?? 'Draft'),
  ];

  return (
    <div className={`rb-root${expanded ? ' pvfull' : ''}`}>
      <div className="main">
        <div className="wrap">
          <div className="head">
            <div>
              <h1>{loading ? 'Loading…' : (recap?.name ?? 'Untitled recap')}</h1>
              <div className="meta">
                <b>{recap?.client_name ?? '—'}</b>
                {` · ${metaBits.join(' · ')}`}
              </div>
            </div>
            <div className="actions">
              <button className="btn ghost">Preview</button>
              <button
                className="btn primary"
                disabled={!recap?.slug}
                onClick={() => recap?.slug && window.open(`/recap/${recap.slug}`, '_blank')}
              >
                View live ↗
              </button>
            </div>
          </div>

          <StepRail active={active} onSelect={goToStep} />

          <div className="split">
            <div>
              {active === 0 && recapId ? (
                <AthletesStep recapId={recapId} onTouch={touch} />
              ) : (
                /* Remaining step bodies land in phases 3–6. */
                <p style={{ color: 'rgba(250,248,245,.45)', fontSize: 13 }}>
                  {STEPS[active]} — designed next, in-app.
                </p>
              )}
            </div>

            <PreviewPanel
              device={device}
              onDeviceChange={setDevice}
              expanded={expanded}
              onToggleExpanded={() => setExpanded((v) => !v)}
            >
              {/* The recap page render is bound per step in phases 3–5. */}
              <div style={{ height: 320 }} />
            </PreviewPanel>
          </div>
        </div>

        <BuilderFooter
          backLabel={active > 0 ? STEPS[active - 1] : null}
          nextLabel={active < STEPS.length - 1 ? STEPS[active + 1] : null}
          status={status}
          onBack={() => goToStep(active - 1)}
          onNext={() => goToStep(active + 1)}
        />
      </div>
    </div>
  );
}
