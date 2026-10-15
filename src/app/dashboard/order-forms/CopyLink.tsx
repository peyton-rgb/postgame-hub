'use client';

// The athlete link as selectable text plus a Copy button. Clipboard API
// first; where it's unavailable or refused (older Safari, non-HTTPS preview)
// the text is selected instead so a long-press / ⌘C still works.

import { useRef, useState } from 'react';

export default function CopyLink({ url }: { url: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');

  const selectText = () => {
    input.current?.focus();
    input.current?.select();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      selectText();
      setState('selected');
    }
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className="of-link">
      <input
        ref={input}
        readOnly
        value={url}
        onFocus={selectText}
        aria-label="Athlete link"
        spellCheck={false}
      />
      <button type="button" className="btn p sm" onClick={copy}>
        {state === 'copied' ? 'Copied' : state === 'selected' ? 'Text selected' : 'Copy link'}
      </button>
    </div>
  );
}
