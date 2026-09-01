// ============================================================
// Recap Builder — wizard steps
//
// Final order, per the master brief and the handoff doc. This
// REVERSES the older single-scrolling-editor instruction: the
// builder is a page-per-step wizard.
//
// Note the public page renders Takeaways AFTER the Roster, near
// the end — that is a section-order concern (step 7), not this
// rail's order.
// ============================================================

export const STEPS = [
  'Athletes',
  'Overview',
  'Hero',
  'Performers',
  'Content',
  'Takeaways',
  'Sections',
] as const;

export type StepName = (typeof STEPS)[number];

/** URL slug for a step, e.g. "Athletes" -> "athletes". */
export const stepSlug = (s: StepName): string => s.toLowerCase();

/** Index of a step in the wizard, or -1 when unknown. */
export const stepIndex = (s: string): number =>
  STEPS.findIndex((x) => stepSlug(x) === s.toLowerCase());
