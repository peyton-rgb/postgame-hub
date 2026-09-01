// ============================================================
// Recap Builder — hero render (spec §3, §4, §6, §7)
//
// The element structure below is LOAD-BEARING and the names are
// fixed by the spec:
//
//   .rp-imgwrap  (#rpWrap)   absolute box, overflow hidden,
//                            background #07070A — geometry here
//     .rp-imginner (#rpInner)  fade carrier
//       .rp-img      (#rpImg)    the photo. Side mode insets it
//                                2px left/top/bottom so it never
//                                touches a fading edge.
//       .rp-blend    (#rpBlend)  luminance wash
//       .rp-fadeL/T/B            full-box overlays, inset -2px
//
// Geometry and gradients are applied imperatively, as the
// prototype does, so dragging a slider does not rebuild the
// tree — and so the box can read its own measured height.
//
// Bleed structure: .rp-hero.side is overflow:visible z-index 2
// and .rp-next is position:relative z-index 3, so section copy
// always renders ABOVE the faded photo no matter the Scale.
// No divider under a bleed hero.
// ============================================================

'use client';

import { useLayoutEffect, useRef } from 'react';
import {
  alphaOf,
  bleedFades,
  heroUrl,
  isSide,
  isSquare,
  sideFades,
  sideGeometry,
  type Frame,
} from './fades';

export default function HeroPreview({
  photoUrl,
  ratio,
  frame,
  device,
  brandLogoUrl,
  brandLogoNudge,
  kicker,
  name,
  slots,
  activeSlot,
  onSlotChange,
  descHtml,
  pageRef,
}: {
  photoUrl: string | null;
  ratio: number;
  frame: Frame;
  device: 'desktop' | 'mobile';
  brandLogoUrl: string | null;
  /** Per-logo whitespace compensation in px (spec §6: measure, do not hardcode). */
  brandLogoNudge: { desktop: number; mobile: number };
  kicker: string;
  name: string;
  slots: number;
  activeSlot: number;
  onSlotChange: (i: number) => void;
  descHtml: string;
  /** The .pvpage element, needed to cap the box at the page bottom. */
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);
  const blendRef = useRef<HTMLDivElement | null>(null);
  const fadeLRef = useRef<HTMLDivElement | null>(null);
  const fadeTRef = useRef<HTMLDivElement | null>(null);
  const fadeBRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    const page = pageRef.current;
    if (!hero || !wrap || !img) return;

    if (photoUrl) {
      img.style.backgroundImage = `url("${heroUrl(photoUrl)}")`;
    } else {
      img.style.backgroundImage = 'none';
    }
    img.style.backgroundPosition = `${frame.x}% ${frame.y}%`;
    // No transform at rest — only when Zoom differs from 100.
    img.style.transform = frame.z !== 100 ? `scale(${frame.z / 100})` : 'none';

    const a = alphaOf(frame);
    const side = isSide(ratio);
    hero.classList.toggle('side', side);
    hero.classList.toggle('sq', isSquare(ratio));

    if (side) {
      const g = sideGeometry(
        ratio,
        frame,
        device,
        hero.offsetHeight,
        hero.offsetTop,
        page?.offsetHeight ?? hero.offsetHeight,
      );
      wrap.style.width = g.widthPx + 'px';
      wrap.style.height = g.heightPct;
      wrap.style.top = g.topPct;

      const f = sideFades(a, isSquare(ratio));
      if (fadeLRef.current) fadeLRef.current.style.background = f.left;
      if (fadeTRef.current) fadeTRef.current.style.background = f.top;
      if (fadeBRef.current) fadeBRef.current.style.background = f.bottom;
      if (blendRef.current) blendRef.current.style.background = f.blend;
    } else {
      wrap.style.width = '';
      wrap.style.height = '';
      wrap.style.top = '';

      const f = bleedFades(a);
      if (fadeLRef.current) fadeLRef.current.style.background = f.left;
      if (fadeTRef.current) fadeTRef.current.style.background = f.top;
      if (fadeBRef.current) fadeBRef.current.style.background = f.bottom;
    }
    if (maskRef.current) maskRef.current.style.background = 'none';
  }, [photoUrl, ratio, frame, device, pageRef, descHtml]);

  const nudge = device === 'desktop' ? brandLogoNudge.desktop : brandLogoNudge.mobile;

  return (
    <>
      <div className="rp-hero" ref={heroRef}>
        <div className="rp-imgwrap" ref={wrapRef}>
          <div className="rp-imginner">
            <div className="rp-img" ref={imgRef} />
            <div className="rp-blend" ref={blendRef} />
            <div className="rp-fadeL" ref={fadeLRef} />
            <div className="rp-fadeT" ref={fadeTRef} />
            <div className="rp-fadeB" ref={fadeBRef} />
          </div>
        </div>
        <div className="rp-wash" />
        <div className="rp-mask" ref={maskRef} />
        <div className="rp-plate" />
        <div className="rp-copy">
          {brandLogoUrl && (
            /* Brand logo, never typography (spec §6). */
            // eslint-disable-next-line @next/next/no-img-element
            <img className="rp-brand" src={brandLogoUrl} alt="" style={{ marginLeft: nudge }} />
          )}
          <div className="rp-kick">{kicker}</div>
          <div className="rp-name">{name.toUpperCase()}</div>
        </div>
        <div className="rp-dots">
          {Array.from({ length: slots }, (_, i) => (
            <span
              key={i}
              className={'rp-dot' + (i === activeSlot ? ' on' : '')}
              onClick={() => onSlotChange(i)}
            />
          ))}
        </div>
      </div>

      {/* z-index 3: section copy always sits above a bleeding hero */}
      <div className="rp-next">
        <div className="rp-skick">What we ran</div>
        <div className="rp-sh">Overview</div>
        <div className="rp-prose" dangerouslySetInnerHTML={{ __html: descHtml }} />
      </div>
    </>
  );
}
