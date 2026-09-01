// ============================================================
// Recap Builder — the zero rule
//
// "Anything at 0 hides itself." A metric tile, a breakdown row,
// or a whole platform box whose value reads as zero is hidden
// from the published page and shown in the builder as
// "0 · auto-hidden" rather than as something to toggle.
//
// isZero() is verbatim from the prototypes:
//
//   const isZero = v => /^\$?0(\.0+)?%?$/.test(String(v).trim());
//
// It matches the DISPLAY string, not a number, so "$0", "0",
// "0.00", "0%" are all zero while "0.4%" is not. Keep it that
// way — the builder and the page must agree on what is hidden.
// ============================================================

/** True when a formatted display value reads as zero. */
export const isZero = (v: unknown): boolean => /^\$?0(\.0+)?%?$/.test(String(v).trim());

/**
 * Applies the zero rule to a set of rows: any row at zero is forced
 * off, and the group is reported as all-zero when every row is.
 * Mirrors the prototypes' renderPboxes() preamble.
 */
export function applyZeroRule<T>(
  rows: T[],
  value: (row: T) => unknown,
  setVisible: (row: T, visible: boolean) => void,
): { allZero: boolean } {
  rows.forEach((r) => {
    if (isZero(value(r))) setVisible(r, false);
  });
  return { allZero: rows.every((r) => isZero(value(r))) };
}
