// #take — key takeaways.
//
// 50 of 82 campaigns have none at all, so the section is absent more often
// than present; the whole thing is guarded upstream.
//
// The 32 that do have takeaways store them in ONE rich-text field in three
// incompatible shapes, so the blob is classified in lib/recap-v2/takeaways.ts
// and each shape is styled on its own terms. The editor's inline colour and
// font-size are stripped there too — one campaign shipped
// `style="color: rgb(255,255,255); font-size: 14px"` on its spans, which
// overrode the page's palette and type scale.
//
// Shared list styling across shapes: a list is the campaign's discrete points,
// so it gets the numbered-card treatment from the reference rather than
// browser bullets.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import type { ResolvedTakeaways } from "@/lib/recap-v2/resolve";
import { Section, SectionHead } from "../ui";

const POINTS = [
  // Discrete points, laid out as cards. counter-* turns the list index into
  // the reference's "01 ·" marker without needing it in the content.
  "[&_ul]:grid [&_ul]:list-none [&_ul]:gap-[var(--s2)] min-[701px]:[&_ul]:grid-cols-2 min-[1001px]:[&_ul]:grid-cols-3",
  "[&_ol]:grid [&_ol]:list-none [&_ol]:gap-[var(--s2)] min-[701px]:[&_ol]:grid-cols-2 min-[1001px]:[&_ol]:grid-cols-3",
  "[&_ul]:[counter-reset:pt] [&_ol]:[counter-reset:pt]",
  "[&_li]:[counter-increment:pt] [&_li]:relative [&_li]:border-t [&_li]:border-[color:var(--rv-line)]",
  "[&_li]:pt-[var(--s2)] [&_li]:text-[15px] [&_li]:leading-[1.62] [&_li]:text-[color:var(--rv-dim)]",
  "[&_li]:before:block [&_li]:before:content-[counter(pt,decimal-leading-zero)]",
  "[&_li]:before:font-mono [&_li]:before:text-[10.5px] [&_li]:before:tracking-[0.2em]",
  "[&_li]:before:text-[color:var(--rv-orange)] [&_li]:before:mb-3",
  // The editor nests <p> inside <li>; it must not inherit paragraph spacing.
  "[&_li_p]:m-0 [&_li_p+p]:mt-3",
].join(" ");

const EMPHASIS = [
  "[&_b]:font-bold [&_b]:text-[color:var(--rv-white)]",
  "[&_strong]:font-bold [&_strong]:text-[color:var(--rv-white)]",
  "[&_em]:not-italic [&_em]:text-[color:var(--rv-orange)]",
  "[&_a]:text-[color:var(--rv-orange)] [&_a]:underline [&_a]:underline-offset-2",
].join(" ");

const HEADINGS = [
  "[&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h4]:font-display",
  "[&_h1]:text-[32px] [&_h2]:text-[30px] [&_h3]:text-[28px] [&_h4]:text-[24px]",
  "[&_h1]:leading-tight [&_h2]:leading-tight [&_h3]:leading-tight [&_h4]:leading-tight",
  "[&_h1]:mt-[var(--s4)] [&_h2]:mt-[var(--s4)] [&_h3]:mt-[var(--s4)] [&_h4]:mt-[var(--s4)]",
  "[&_h1]:mb-[var(--s2)] [&_h2]:mb-[var(--s2)] [&_h3]:mb-[var(--s2)] [&_h4]:mb-[var(--s2)]",
  "[&_h1]:text-[color:var(--rv-white)] [&_h2]:text-[color:var(--rv-white)]",
  "[&_h3]:text-[color:var(--rv-white)] [&_h4]:text-[color:var(--rv-white)]",
].join(" ");

// Shape 1 — opens with a paragraph. That paragraph is the lede and is set at
// display size; everything after it is supporting copy.
const LEDE = [
  "[&>p:first-child]:max-w-[36ch] [&>p:first-child]:font-display",
  "[&>p:first-child]:text-[clamp(38px,4.4vw,68px)] [&>p:first-child]:leading-[1.04]",
  "[&>p:first-child]:text-[color:var(--rv-white)]",
  "[&>p:not(:first-child)]:mt-[var(--s3)] [&>p:not(:first-child)]:max-w-[78ch]",
  "[&>p:not(:first-child)]:text-[16.5px] [&>p:not(:first-child)]:leading-[1.7]",
  "[&>p:not(:first-child)]:text-[color:var(--rv-dim)]",
  "[&>ul]:mt-[var(--s5)] [&>ol]:mt-[var(--s5)]",
].join(" ");

// Shape 2 — opens with a list (or a heading). There is no lede to promote, so
// nothing is set at display size and the points carry the section.
const POINTS_FIRST = [
  "[&>p]:mt-[var(--s3)] [&>p]:max-w-[78ch] [&>p]:text-[16.5px]",
  "[&>p]:leading-[1.7] [&>p]:text-[color:var(--rv-dim)]",
  "[&>ul:first-child]:mt-0 [&>ol:first-child]:mt-0",
  "[&>ul]:mt-[var(--s4)] [&>ol]:mt-[var(--s4)]",
].join(" ");

// Shape 3 — plain text with no markup at all. Rendered as prose, paragraph
// split on blank lines only. No invented bullets: the author wrote prose.
const PROSE = [
  "max-w-[78ch] text-[17.5px] leading-[1.72] text-[color:var(--rv-dim)]",
  "[&>p:first-child]:text-[color:var(--rv-white)] [&>p:first-child]:text-[19px]",
  "[&>p+p]:mt-[var(--s2)]",
].join(" ");

export function TakeawaysSection({ takeaways }: { takeaways: ResolvedTakeaways }) {
  const h = SECTION_HEADING.take;
  if (takeaways.kind === "none") return null;

  return (
    <Section id="take">
      {/* tight, like #perf and #bic: this section now often opens straight
          into cards, and the wider head margin read as a hole above them. */}
      <SectionHead kicker={h.kicker} tight />
      {takeaways.kind === "structured" ? (
        <Structured headline={takeaways.headline} points={takeaways.points} />
      ) : (
        <Legacy html={takeaways.html} shape={takeaways.shape} />
      )}
    </Section>
  );
}

/**
 * What the builder writes: a headline and discrete points, each its own field.
 * No parsing, no shape detection, no inline styles to strip — which is the
 * whole reason the builder exists.
 */
function Structured({ headline, points }: { headline: string; points: string[] }) {
  return (
    <div data-shape="structured">
      {headline ? (
        <p className="max-w-[36ch] font-display text-[clamp(38px,4.4vw,68px)] leading-[1.04] text-[color:var(--rv-white)]">
          {headline}
        </p>
      ) : null}
      {points.length > 0 ? (
        <ol
          className={`m-0 grid list-none gap-[var(--s2)] [counter-reset:pt] min-[701px]:grid-cols-2 min-[1001px]:grid-cols-3 ${
            headline ? "mt-[var(--s5)]" : ""
          }`}
        >
          {points.map((p, i) => (
            <li
              key={i}
              className="border-t border-[color:var(--rv-line)] pt-[var(--s2)] text-[15px] leading-[1.62] text-[color:var(--rv-dim)]"
            >
              <span className="mb-3 block font-mono text-[10.5px] tracking-[0.2em] text-[color:var(--rv-orange)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {p}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/**
 * The 32 campaigns that already have takeaways, in the three shapes they were
 * typed in. Unchanged behaviour — a legacy blob stays legacy until someone
 * restructures it in the builder.
 */
function Legacy({ html, shape }: { html: string; shape: "lede" | "points" | "prose" }) {
  const shapeClass = shape === "lede" ? LEDE : shape === "points" ? POINTS_FIRST : PROSE;
  // Prose has no lists or headings to style — it is escaped plain text.
  const rich = shape === "prose" ? "" : `${POINTS} ${EMPHASIS} ${HEADINGS}`;
  return (
    <div
      data-shape={shape}
      className={`${shapeClass} ${rich}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
