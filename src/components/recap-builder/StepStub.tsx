// ============================================================
// Recap Builder — placeholder for a step not yet designed
//
// Phase 6: Content, Takeaways and Sections get rail entries and
// an empty shell. Their real designs come from the adopted
// imports in the handoff and get built against the preview with
// the planner thread, in-app rather than as HTML prototypes.
//
// Each stub names what is coming so the page is not a dead end,
// and the footer still walks the wizard through it.
// ============================================================

'use client';

import type { StepName } from './steps';

const PLANNED: Record<string, string> = {
  Content: 'Per-athlete content boxes, the full asset grid with an athlete filter, and hero / best-in-class selection.',
  Takeaways:
    'One statement headline with orange emphasis phrases and two hairline-topped support lines. Renders after the Roster on the public page.',
  Sections:
    'Order and visibility for every section, plus the publish gate — including the thumbnail flags raised on the Performers step.',
};

export default function StepStub({ step }: { step: StepName }) {
  return (
    <div className="sec">
      <div className="slabel">
        {step} <span>designed next, in-app</span>
      </div>
      <div className="stub">
        <p>{PLANNED[step] ?? 'Designed next, in-app.'}</p>
        <p className="stub-note">
          Nothing on this step writes yet. The rail, preview panel and footer are live, so the
          design can be built straight against the preview.
        </p>
      </div>
    </div>
  );
}
