// ============================================================
// Recap Builder — live preview panel
//
// Ported from the prototypes' shared preview code. The page is
// rendered at TRUE WIDTH (1280 desktop / 390 mobile) and scaled
// down to fit the panel, so every value inside the preview is
// the real published value — never a re-derived "preview size".
//
// fitPreview(), verbatim from the prototypes:
//
//   const avail = stage.parentElement.clientWidth - 2;
//   const pw = device==='desktop' ? 1280 : 390;
//   const s = Math.min(1, avail/pw);
//   scale.style.transform = `scale(${s})`;
//   scale.style.width = pw + 'px';
//   stage.style.width  = Math.round(pw*s) + 'px';
//   stage.style.height = Math.round(page.offsetHeight*s) + 'px';
//
// The prototypes re-ran fitPreview by wrapping renderPreview and
// on window resize. Here a ResizeObserver on the page element
// covers both, so the panel refits whenever step content grows
// or shrinks — same behaviour, no polling.
//
// Expand: the prototypes toggled body.pvfull and swapped the
// button label to "✕ Close", with Escape closing. The .pvfull
// class belongs to the .rb-root element, which the page owns —
// hence `expanded` / `onToggleExpanded` come in as props.
// ============================================================

'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export type PreviewDevice = 'desktop' | 'mobile';

/** True widths of the published recap page. Not preview sizes — do not change. */
export const DEVICE_WIDTH: Record<PreviewDevice, number> = { desktop: 1280, mobile: 390 };

export default function PreviewPanel({
  device,
  onDeviceChange,
  expanded,
  onToggleExpanded,
  exposePageRef,
  children,
}: {
  device: PreviewDevice;
  onDeviceChange: (d: PreviewDevice) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Receives the .pvpage element. The Hero step measures it to cap a
   *  bleeding photo at the page bottom (spec §3). */
  exposePageRef?: React.MutableRefObject<HTMLDivElement | null>;
  /** The recap page render for the current step. */
  children: React.ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  const fitPreview = useCallback(() => {
    const stage = stageRef.current;
    const scale = scaleRef.current;
    const page = pageRef.current;
    const host = bodyRef.current;
    if (!stage || !scale || !page || !host) return;

    const avail = host.clientWidth - 2;
    const pw = DEVICE_WIDTH[device];
    const s = Math.min(1, avail / pw);

    scale.style.transform = `scale(${s})`;
    scale.style.width = pw + 'px';
    stage.style.width = Math.round(pw * s) + 'px';
    stage.style.height = Math.round(page.offsetHeight * s) + 'px';
  }, [device]);

  // Refit synchronously after paint so the panel never flashes unscaled.
  useLayoutEffect(() => {
    fitPreview();
  }, [fitPreview, expanded]);

  // Refit when the panel is resized or the page content changes height.
  useEffect(() => {
    const page = pageRef.current;
    const host = bodyRef.current;
    if (!page || !host || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => fitPreview());
    ro.observe(page);
    ro.observe(host);
    window.addEventListener('resize', fitPreview);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fitPreview);
    };
  }, [fitPreview]);

  // Escape closes the expanded preview.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleExpanded();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, onToggleExpanded]);

  return (
    <div className="preview">
      <div className="pvhead">
        <span>Page preview</span>

        <span className="devtoggle">
          <span
            className={device === 'desktop' ? 'on' : undefined}
            onClick={() => onDeviceChange('desktop')}
          >
            Desktop
          </span>
          <span
            className={device === 'mobile' ? 'on' : undefined}
            onClick={() => onDeviceChange('mobile')}
          >
            Mobile
          </span>
        </span>

        <span className="live">● Live</span>

        <button className="pvexpand" onClick={onToggleExpanded}>
          {expanded ? '✕ Close' : '⤢ Expand'}
        </button>
      </div>

      <div className="pvbody" ref={bodyRef}>
        <div className="pvstage" ref={stageRef}>
          <div className="pvscale" ref={scaleRef}>
            <div
              className={`pvpage ${device}`}
              ref={(el) => {
                pageRef.current = el;
                if (exposePageRef) exposePageRef.current = el;
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
