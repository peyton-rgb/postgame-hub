"use client";

// The recap intro lockup.
//
// A full-viewport black panel: the Postgame wordmark, a thin rule, then the
// client's brand mark, wiping in left to right on ONE TYPE BASELINE. Hold,
// then the panel lifts away to the recap.
//
// The motion is approved and ported from recap-lockup-reveal-cvs.html rather
// than reinterpreted. Every number below comes from that file:
//
//   wordmark box     8790 x 1799  ->  height is 0.20467 of its width
//   the "o" slot     centre 19.00% / 45.44%, diameter 13.22% of width
//   --lift           0.2235 of the wordmark box height. This is the descender
//                    depth: the three elements are bottom-aligned and then the
//                    rule and the brand mark are lifted by it, so all three sit
//                    on the type baseline rather than the box bottom. It is the
//                    whole reason the lockup reads as one line.
//   --gap            0.075 of the wordmark width, either side of the rule
//   timeline         200ms of black, a 1500ms wipe, then hold to 2600ms
//
// Both Postgame assets are vendored into /public rather than fetched from the
// brand-kit bucket. The geometry above is measured off those exact files — the
// app's own /postgame-logo-white.png is 2130x465 (ratio 4.58, and it already
// has the icon baked into the "o"), so the slot percentages would not land on
// it. It also keeps PostgameLogo's rule: a core brand mark never depends on a
// remote fetch.
import { useEffect, useRef, useState } from "react";

/**
 * The mockup ships three review speeds and opens on 0.5x — which is what an
 * approver watching that file saw, and what makes the brief's "five-second
 * wipe" true. So the shipped motion is the timeline at half rate: 400ms of
 * black, a 3000ms wipe, 5200ms in total. One constant if 2.6s was meant.
 */
const PLAYBACK_RATE = 0.5;
const T = 2600;
const WIPE_START = 200;
const WIPE_DUR = 1500;
/** How long the panel takes to lift away once the hold is over. */
const EXIT_MS = 700;

const WORDMARK = "/postgame-wordmark-lockup.png";
const ICON = "/postgame-icon-lockup.png";

/** Fallback when a brand has no usable mark: the Postgame mark, alone. */
export const DEFAULT_LOCKUP_SCALE = 0.68;

function sessionKey(slug: string) {
  return `recap-intro:${slug}`;
}

export function RecapIntroLockup({
  slug,
  brandMarkUrl,
  brandName,
  lockupScale,
}: {
  slug: string;
  /** Null when the brand has no usable logo — 57 brands, 3 published recaps. */
  brandMarkUrl: string | null;
  brandName: string | null;
  lockupScale: number | null;
}) {
  // null = not decided yet. Nothing renders until the client has decided, so a
  // repeat visitor never sees a frame of it.
  const [show, setShow] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);
  const lockupRef = useRef<HTMLDivElement>(null);
  /**
   * The decision is made ONCE per mount.
   *
   * Without this the effect both writes sessionStorage and reads it, so React
   * StrictMode's double-invocation in development decides "unseen", writes the
   * key, then runs again, reads the key it just wrote, and hides the lockup —
   * broken in dev and working in production, which is the worst way round.
   */
  const decided = useRef(false);

  useEffect(() => {
    // Once per session, per recap: a first view gets it, back-navigation and
    // repeat reviews do not.
    if (decided.current) return;
    decided.current = true;

    let seen = false;
    try {
      seen = sessionStorage.getItem(sessionKey(slug)) === "1";
    } catch {
      // Private mode or blocked storage — treat as unseen rather than throwing.
    }
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (seen || reduced) {
      setShow(false);
      return;
    }
    setShow(true);
    try {
      sessionStorage.setItem(sessionKey(slug), "1");
    } catch {
      /* nothing to do */
    }
  }, [slug]);

  // The wipe. Held on the lockup itself, so the rule and both marks are
  // revealed by one clip rather than three animations that could drift.
  useEffect(() => {
    if (show !== true) return;
    const el = lockupRef.current;
    if (!el) return;

    document.body.style.overflow = "hidden";

    const anim = el.animate(
      [
        { clipPath: "inset(0 100% 0 0)", offset: 0 },
        {
          clipPath: "inset(0 100% 0 0)",
          offset: WIPE_START / T,
          easing: "cubic-bezier(.22,1,.36,1)",
        },
        { clipPath: "inset(0 0% 0 0)", offset: (WIPE_START + WIPE_DUR) / T },
        { clipPath: "inset(0 0% 0 0)", offset: 1 },
      ],
      { duration: T, fill: "both" },
    );
    anim.playbackRate = PLAYBACK_RATE;

    let exitTimer: ReturnType<typeof setTimeout>;
    const done = () => {
      setLeaving(true);
      exitTimer = setTimeout(() => {
        document.body.style.overflow = "";
        setShow(false);
      }, EXIT_MS);
    };
    anim.addEventListener("finish", done);

    return () => {
      anim.removeEventListener("finish", done);
      anim.cancel();
      clearTimeout(exitTimer);
      document.body.style.overflow = "";
    };
  }, [show]);

  if (show !== true) return null;

  const scale = lockupScale ?? DEFAULT_LOCKUP_SCALE;

  return (
    <div
      aria-hidden="true"
      data-recap-intro="lockup"
      // print:hidden — a recap printed while the panel is still up must not
      // carry a full black page. PPTX export never renders this component at
      // all (it builds slides server-side from pptx-export.ts), and neither
      // does the builder's live preview, which mounts CropControls rather than
      // the page shell.
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#07070A] transition-transform duration-[700ms] ease-[cubic-bezier(.22,1,.36,1)] print:hidden"
      style={{
        // The panel lifts away to reveal the recap beneath it.
        transform: leaving ? "translateY(-100%)" : "translateY(0)",
        // Set once here so the geometry below is all one system.
        ["--wm" as string]: "min(760px, 60vw)",
        ["--wmh" as string]: "calc(var(--wm) * 0.20467)",
        ["--gap" as string]: "calc(var(--wm) * 0.075)",
        ["--lift" as string]: "calc(var(--wmh) * 0.2235)",
        ["--markh" as string]: `calc(var(--wmh) * ${scale})`,
      }}
    >
      <div
        ref={lockupRef}
        className="flex items-end [gap:var(--gap)] [will-change:clip-path]"
        style={{ clipPath: "inset(0 100% 0 0)" }}
      >
        <div className="relative flex-none [aspect-ratio:8790/1799] [width:var(--wm)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={WORDMARK} alt="" className="absolute inset-0 block h-full w-full" />
          {/* The icon sits in the wordmark's empty "o". */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ICON}
            alt=""
            className="absolute block aspect-square -translate-x-1/2 -translate-y-1/2"
            style={{ left: "19.00%", top: "45.44%", width: "13.22%" }}
          />
        </div>

        {/* Rule and brand mark only when there IS a brand mark. The fallback is
            the Postgame mark alone — no rule, no empty slot, never text. */}
        {brandMarkUrl ? (
          <>
            <div
              className="flex-none bg-[rgba(250,248,245,0.30)] [height:var(--markh)] [margin-bottom:var(--lift)] [width:1.5px]"
            />
            <div className="flex-none [height:var(--markh)] [margin-bottom:var(--lift)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brandMarkUrl}
                alt={brandName ?? ""}
                className="block h-full w-auto"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
