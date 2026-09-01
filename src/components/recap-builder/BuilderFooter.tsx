// ============================================================
// Recap Builder — footer bar
//
// Ported from the prototypes:
//
//   <div class="bar">
//     <button class="btn ghost">← Athletes</button>
//     <div class="status" id="status"><span class="dot"></span>All changes saved · 2:36 PM</div>
//     <button class="btn ghost">Save</button>
//     <button class="btn primary">Next · Hero →</button>
//   </div>
//
// Back/Next labels name the adjacent step, exactly as the
// prototypes do. Positioning lives in builder-chrome.css.
// ============================================================

'use client';

import type { AutosaveStatus } from './useAutosaveStatus';

export default function BuilderFooter({
  backLabel,
  nextLabel,
  status,
  onBack,
  onSave,
  onNext,
}: {
  /** Previous step name, or null on the first step. */
  backLabel: string | null;
  /** Next step name, or null on the last step. */
  nextLabel: string | null;
  status: AutosaveStatus;
  onBack?: () => void;
  onSave?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="bar">
      <button className="btn ghost" disabled={!backLabel} onClick={onBack}>
        {backLabel ? `← ${backLabel}` : '←'}
      </button>

      <div className="status">
        {status.kind === 'unsaved' ? (
          'Unsaved changes'
        ) : status.kind === 'saved' ? (
          <>
            <span className="dot" />
            {`Saved ${status.at}`}
          </>
        ) : (
          <>
            <span className="dot" />
            All changes saved
          </>
        )}
      </div>

      <button className="btn ghost" onClick={onSave}>
        Save
      </button>
      <button className="btn primary" disabled={!nextLabel} onClick={onNext}>
        {nextLabel ? `Next · ${nextLabel} →` : 'Next →'}
      </button>
    </div>
  );
}
