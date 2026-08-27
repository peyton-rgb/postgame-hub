"use client";

// The four per-photo framing controls, and a preview that renders the hero the
// way the page does — pane on the right, copy on black to the left.
//
// The mapping is the whole point of this component, so it is stated once here
// and reused by the page:
//
//   Across   moves the PANE, not the image. A portrait photo fills the pane's
//            width, so there is no horizontal overflow to pan — pointing this
//            at object-position makes the slider move and the picture sit
//            still. It slides the pane within the frame instead.
//   Up/down  moves the IMAGE, as the Y of object-position. This is where the
//            overflow is, and it is what makes a tall photo usable.
//   Zoom     scales the image inside the pane.
//   Fade     where the horizontal gradient reaches zero. A busy left edge
//            needs the black to run further across than a clean one.
import { FOCAL_DEFAULTS, type FocalPoint } from "@/lib/recap-v2/config";
import { displayImage } from "@/components/recap-v2/media";
// The backdrop sizing and its edge mask live in one unscoped class shared with
// the page, so the preview cannot show a framing the published page will not.
import "@/components/recap-v2/recap-v2.css";
import { backdropTransform } from "./heroTransform";

// backdropTransform lives in its own module and is shared with the page's
// hero, so the preview and the published result cannot disagree about framing.

const CONTROLS: Array<{
  key: keyof FocalPoint;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  note: string;
}> = [
  { key: "x", label: "Across", min: 0, max: 100, step: 1, format: (v) => String(Math.round(v)), note: "slides the backdrop" },
  { key: "y", label: "Up/down", min: 0, max: 100, step: 1, format: (v) => String(Math.round(v)), note: "pans the backdrop" },
  { key: "scale", label: "Zoom", min: 0.85, max: 1.7, step: 0.01, format: (v) => `${v.toFixed(2)}×`, note: "" },
  { key: "fade", label: "Fade", min: 45, max: 92, step: 1, format: (v) => String(Math.round(v)), note: "where the black runs out" },
];

export function CropControls({
  url,
  focal,
  onChange,
  title,
  kicker,
  lede,
}: {
  url: string;
  focal: FocalPoint;
  onChange: (next: FocalPoint) => void;
  title: string;
  kicker: string | null;
  lede: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        {CONTROLS.map((c) => (
          <label key={c.key} className="flex items-center gap-3">
            <span className="w-16 flex-none text-[11px] text-neutral-500">{c.label}</span>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={focal[c.key]}
              onChange={(e) => onChange({ ...focal, [c.key]: Number(e.target.value) })}
              className="h-[3px] flex-1 cursor-pointer appearance-none rounded bg-white/20 accent-orange-500"
            />
            <span className="w-12 flex-none text-right text-[11px] tabular-nums text-neutral-500">
              {c.format(focal[c.key])}
            </span>
          </label>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...FOCAL_DEFAULTS })}
          className="text-[11px] text-neutral-500 underline hover:text-neutral-300"
        >
          Reset framing
        </button>
        <p className="pt-1 text-[11px] leading-relaxed text-neutral-600">
          The photo is a backdrop behind the hero and the overview, sized by
          height and overspilling the block, with its edges masked so it
          dissolves on all four sides. These move the backdrop; nothing is
          cropped.
        </p>
      </div>

      {/* The preview is the page's block — same backdrop sizing, same two
          gradients, same transform. */}
      <div className="relative aspect-[16/8] overflow-hidden rounded-lg border border-neutral-700 bg-[#07070A] [isolation:isolate]">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage(url)}
            alt=""
            className="rv-backdrop-img transition-transform duration-100"
            style={{ transform: backdropTransform(focal) }}
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: `linear-gradient(90deg,#07070A 0%,#07070A 16%,rgba(7,7,10,.92) 30%,rgba(7,7,10,.55) 46%,rgba(7,7,10,.15) calc(${focal.fade}% * .92),rgba(7,7,10,0) ${focal.fade}%),linear-gradient(180deg,rgba(7,7,10,.55) 0%,rgba(7,7,10,.05) 22%,rgba(7,7,10,.55) 62%,#07070A 96%)`,
          }}
        />
        <div className="absolute inset-y-0 left-0 z-[2] flex w-[56%] flex-col justify-end p-5">
          {kicker ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/75">{kicker}</p>
          ) : null}
          <p className="mt-1 font-display text-[clamp(20px,3.4vw,42px)] leading-[0.9] text-[#FAF8F5]">
            {title}
          </p>
          {lede ? (
            <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/70">
              {lede}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
