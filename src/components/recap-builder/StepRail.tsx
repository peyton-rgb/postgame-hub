// ============================================================
// Recap Builder — step rail
//
// Ported from the prototypes' shared rail code:
//
//   STEPS.forEach((s,i) => {
//     el.className = 'step' + (i===active?' active':'') + (i<active?' done':'');
//     el.innerHTML = `<span class="n"></span><span class="t">${s}</span>`;
//   });
//
// Orange states come from builder-chrome.css (.step.active /
// .step.done) — do not restyle here.
// ============================================================

'use client';

import { STEPS, type StepName } from './steps';

export default function StepRail({
  active,
  onSelect,
}: {
  /** Index of the current step within STEPS. */
  active: number;
  /** Optional: called with the step index when a step is clicked. */
  onSelect?: (index: number, step: StepName) => void;
}) {
  return (
    <nav className="rail">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={'step' + (i === active ? ' active' : '') + (i < active ? ' done' : '')}
          onClick={() => onSelect?.(i, s)}
        >
          <span className="n" />
          <span className="t">{s}</span>
        </div>
      ))}
    </nav>
  );
}
