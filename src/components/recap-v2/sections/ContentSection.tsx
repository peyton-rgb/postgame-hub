"use client";

// #bic — "The content": one box per ATHLETE, not one per asset.
//
// Per-asset tiles meant a roster of 76 produced hundreds of boxes and the same
// face six times over. One box per athlete makes the section a roster of work
// rather than a contact sheet, and gives the hover somewhere to go: the Liquid
// Glass fog carries a single orange "View insights" button, and that opens the
// SAME AssetModal the current recap opens — reused, not reimplemented.
//
// Guarded upstream on there being any non-thumbnail media; campaigns with no
// photography lose the section outright.
import { useState } from "react";
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import { Foot, Section, SectionHead } from "../ui";
import { RecapImage } from "../RecapImage";
import AssetModal, { type PortalAthlete } from "@/app/portal/[token]/library/AssetModal";

export interface GalleryCard {
  athleteId: string;
  name: string;
  school: string | null;
  handle: string | null;
  /** The still on the front of the box. */
  coverUrl: string;
  assetCount: number;
  portalAthlete: PortalAthlete;
  /** Which tab the modal opens on — the athlete's reel where they have one. */
  startPostIndex: number;
}

// A first screenful, then on request. The gallery is the heaviest thing here.
const INITIAL = 12;

export function ContentSection({ cards }: { cards: GalleryCard[] }) {
  const [expanded, setExpanded] = useState(false);
  // Assets the transformer refuses (over its source-file ceiling). Counted so
  // the footer can say so rather than the section quietly showing fewer boxes.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<GalleryCard | null>(null);

  const h = SECTION_HEADING.bic;
  const usable = cards.filter((c) => !skipped.has(c.athleteId));
  const shown = expanded ? usable : usable.slice(0, INITIAL);
  const remaining = usable.length - shown.length;

  return (
    <Section id="bic">
      <SectionHead kicker={h.kicker} title={h.title} tight />

      <ul
        data-slot="gmason"
        data-count={usable.length}
        className="m-0 grid list-none grid-cols-2 gap-[var(--s1)] min-[701px]:grid-cols-3 min-[1001px]:grid-cols-4"
      >
        {shown.map((c) => (
          <li key={c.athleteId}>
            <button
              type="button"
              onClick={() => setOpen(c)}
              className="rv-tile rv-vignette group relative block aspect-[4/5] w-full overflow-hidden rounded-[20px] text-left"
              aria-label={`View insights for ${c.name}`}
            >
              <RecapImage
                src={c.coverUrl}
                alt={`${c.name} — campaign content`}
                width={900}
                className="h-full w-full object-cover"
                onUnavailable={() =>
                  setSkipped((s) => (s.has(c.athleteId) ? s : new Set(s).add(c.athleteId)))
                }
              />

              {/* Liquid Glass: the fog blurs the photo behind it on hover and
                  the copy rises into place. See .rv-fog in recap-v2.css. */}
              <span className="rv-fog absolute inset-0 z-[3] flex flex-col items-center justify-center p-5 text-center">
                <span className="block font-display text-[30px] leading-none">{c.name}</span>
                {c.school ? (
                  <span className="mt-2 block font-mono text-[12px] font-bold tracking-[0.2em] text-[#FF6A2B]">
                    {c.school.toUpperCase()}
                  </span>
                ) : null}
                {c.handle ? (
                  <span className="mt-2 block font-mono text-[12px] text-[color:var(--rv-white)]">
                    @{c.handle.replace(/^@/, "")}
                  </span>
                ) : null}
                <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--rv-orange)] px-[22px] py-[12px] font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_6px_24px_rgba(215,63,9,.45),inset_0_2px_3px_rgba(255,255,255,.25)]">
                  View insights
                </span>
              </span>

              {c.assetCount > 1 ? (
                <span className="absolute right-2 top-2 z-[2] rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                  {c.assetCount}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-[var(--s3)] cursor-pointer rounded-full border border-[color:var(--rv-line)] bg-transparent px-[26px] py-[14px] font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-[color:var(--rv-white)] transition-colors hover:border-white/35"
        >
          Show all {usable.length}
        </button>
      ) : null}

      <Foot>
        {usable.length} {usable.length === 1 ? "athlete" : "athletes"} with content.
        {skipped.size > 0 ? (
          <> {skipped.size} too large for the image transformer to render.</>
        ) : null}
      </Foot>

      {/* The portal's modal, reused. */}
      {open ? (
        <AssetModal
          athletes={[open.portalAthlete]}
          startIndex={0}
          startPostIndex={open.startPostIndex >= 0 ? open.startPostIndex : 0}
          onClose={() => setOpen(null)}
          showToggleHint
        />
      ) : null}
    </Section>
  );
}
