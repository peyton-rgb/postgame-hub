// ============================================================
// Recap Builder — focus-follow
//
// "Typing in a field highlights where it lands on the page."
// Ported verbatim from the prototypes:
//
//   s.addEventListener('focus', ()=>{
//     d.classList.add('pv-hl');
//     d.scrollIntoView({block:'center', behavior:'smooth'});
//   });
//   s.addEventListener('blur', ()=> d.classList.remove('pv-hl'));
//
// The highlight ring itself is .pv-hl in builder-chrome.css.
//
// Usage: give the field and its preview target the same key.
//
//   const follow = useFocusFollow();
//   <input {...follow.field('name')} />
//   <h1 ref={follow.target('name')}>…</h1>
// ============================================================

'use client';

import { useCallback, useRef } from 'react';

export function useFocusFollow() {
  const targets = useRef(new Map<string, HTMLElement | null>());

  const target = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      targets.current.set(key, el);
    },
    [],
  );

  const field = useCallback(
    (key: string) => ({
      onFocus: () => {
        const d = targets.current.get(key);
        if (!d) return;
        d.classList.add('pv-hl');
        d.scrollIntoView({ block: 'center', behavior: 'smooth' });
      },
      onBlur: () => {
        targets.current.get(key)?.classList.remove('pv-hl');
      },
    }),
    [],
  );

  return { field, target };
}
