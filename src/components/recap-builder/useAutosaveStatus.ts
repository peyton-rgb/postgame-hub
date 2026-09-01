// ============================================================
// Recap Builder — autosave status
//
// Ported verbatim from the prototypes' touch():
//
//   function touch(){
//     st.innerHTML = 'Unsaved changes';
//     clearTimeout(window._t);
//     window._t = setTimeout(()=>{ st.innerHTML =
//       '<span class="dot"></span>Saved ' +
//       new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
//     }, 1600);
//   }
//
// The 1600ms debounce and the time format are the prototype's —
// keep them. This hook only tracks the STATUS LINE; the actual
// draft write is wired per-step in later phases.
// ============================================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Prototype debounce before the line flips back to "Saved". */
export const AUTOSAVE_SETTLE_MS = 1600;

export type AutosaveStatus =
  | { kind: 'idle' }
  | { kind: 'unsaved' }
  | { kind: 'saved'; at: string };

export function useAutosaveStatus() {
  const [status, setStatus] = useState<AutosaveStatus>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touch = useCallback(() => {
    setStatus({ kind: 'unsaved' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStatus({
        kind: 'saved',
        at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      });
    }, AUTOSAVE_SETTLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { status, touch };
}
