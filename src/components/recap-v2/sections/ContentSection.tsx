"use client";

// #bic — "The content": a three-column masonry that fogs on hover.
//
// Guarded upstream on there being any non-thumbnail media; 4 campaigns have no
// photography at all and lose the section outright.
//
// CSS columns rather than a JS masonry: the tiles have no known heights until
// they load (media.aspect_ratio is non-null on 0 of 4,434 rows), and columns
// reflow on their own as images arrive. Each tile carries the ratio it
// measures on load so the column stops jumping once it settles.
import { useState } from "react";
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import { Foot, Section, SectionHead } from "../ui";
import { RecapImage } from "../RecapImage";

export interface GalleryTile {
  id: string;
  url: string;
  athleteName: string | null;
  school: string | null;
  handle: string | null;
  postUrl: string | null;
}

// The gallery is the heaviest thing on the page. Show a first screenful and
// let the reader ask for the rest, rather than mounting 400 tiles up front.
const INITIAL = 18;

export function ContentSection({ tiles }: { tiles: GalleryTile[] }) {
  const [expanded, setExpanded] = useState(false);
  // Assets Supabase refuses to transform (over ~25MB). Counted so the footer
  // can say so instead of the gallery quietly rendering fewer than delivered.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const h = SECTION_HEADING.bic;
  const usable = tiles.filter((t) => !skipped.has(t.id));
  const shown = expanded ? usable : usable.slice(0, INITIAL);
  const remaining = usable.length - shown.length;

  return (
    <Section id="bic">
      <SectionHead kicker={h.kicker} title={h.title} tight />

      <div
        data-slot="gmason"
        data-count={tiles.length}
        className="columns-1 gap-[var(--s1)] min-[701px]:columns-2 min-[1001px]:columns-3"
      >
        {shown.map((t) => (
          <Tile
            key={t.id}
            tile={t}
            onUnavailable={() => setSkipped((sk) => new Set(sk).add(t.id))}
          />
        ))}
      </div>

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
        {usable.length} {usable.length === 1 ? "asset" : "assets"} shown.
        {skipped.size > 0 ? (
          <>
            {" "}
            {skipped.size} too large to render a preview for — over the ~25MB
            ceiling Supabase&rsquo;s image transformer will process.
          </>
        ) : null}
      </Foot>
    </Section>
  );
}

function Tile({
  tile,
  onUnavailable,
}: {
  tile: GalleryTile;
  onUnavailable: () => void;
}) {
  // Until the image loads we do not know its shape. 4/5 is the commonest
  // portrait crop in the library and keeps the column from collapsing to
  // nothing on first paint.
  const [ratio, setRatio] = useState<number | null>(null);
  const Tag = tile.postUrl ? "a" : "div";

  return (
    <figure className="rv-tile rv-vignette relative mb-[var(--s1)] break-inside-avoid overflow-hidden rounded-[20px]">
      <Tag
        {...(tile.postUrl
          ? { href: tile.postUrl, target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-orange)]"
      >
        <div style={{ aspectRatio: ratio ? String(ratio) : "4 / 5" }} className="w-full">
          <RecapImage
            src={tile.url}
            alt={tile.athleteName ? `${tile.athleteName} — campaign content` : "Campaign content"}
            width={900}
            className="block h-full w-full object-cover"
            onRatio={setRatio}
            onUnavailable={onUnavailable}
          />
        </div>

        <figcaption className="rv-fog absolute inset-0 z-[3] flex flex-col items-center justify-center p-6 text-center">
          {tile.athleteName ? (
            <span className="font-display text-[40px] leading-none">{tile.athleteName}</span>
          ) : null}
          {tile.school ? (
            <span className="mt-3 font-mono text-[13px] font-bold tracking-[0.2em] text-[#FF6A2B]">
              {tile.school.toUpperCase()}
            </span>
          ) : null}
          {tile.handle ? (
            <span className="mt-3 font-mono text-[13px] text-[color:var(--rv-white)]">
              @{tile.handle}
            </span>
          ) : null}
          {tile.postUrl ? (
            <span className="mt-[26px] inline-flex items-center gap-[9px] rounded-full bg-[color:var(--rv-orange)] px-[26px] py-[14px] font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_6px_24px_rgba(215,63,9,.45),inset_0_2px_3px_rgba(255,255,255,.25)]">
              View post ↗
            </span>
          ) : null}
        </figcaption>
      </Tag>
    </figure>
  );
}
