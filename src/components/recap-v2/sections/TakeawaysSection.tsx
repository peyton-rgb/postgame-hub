// #take — one large statement, then supporting cards.
//
// 50 of 82 campaigns have no key_takeaways at all, so this section is absent
// more often than present; the whole thing is guarded upstream.
//
// The prototype shows a headline plus three numbered cards, but the data is a
// single rich-text blob — there are no separate fields for statement and
// cards, and inventing three would need a schema change and an editor for it.
// So the blob is rendered as the statement, styled to the reference: the first
// paragraph large with <em> taking the orange, the rest as supporting note
// copy. That reproduces the rendered result for the campaigns that write it
// that way, and degrades to a single well-set statement for the rest.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import { Section, SectionHead } from "../ui";
import type { Campaign } from "@/lib/types";

export function TakeawaysSection({ campaign }: { campaign: Campaign }) {
  const s = campaign.settings || {};
  const h = SECTION_HEADING.take;

  return (
    <Section id="take">
      <SectionHead kicker={h.kicker} />
      <div
        className={[
          // First paragraph: the statement.
          "[&>p:first-child]:max-w-[36ch] [&>p:first-child]:font-display",
          "[&>p:first-child]:text-[clamp(42px,4.9vw,78px)] [&>p:first-child]:leading-[1.04]",
          // <em> is the reference's accent, not italics.
          "[&_em]:not-italic [&_em]:text-[color:var(--rv-orange)]",
          // Everything after it: note copy.
          "[&>p:not(:first-child)]:mt-[var(--s3)] [&>p:not(:first-child)]:max-w-[78ch]",
          "[&>p:not(:first-child)]:text-[16.5px] [&>p:not(:first-child)]:leading-[1.7]",
          "[&>p:not(:first-child)]:text-[color:var(--rv-dim)]",
          // Lists read as the reference's numbered cards.
          "[&_ul]:mt-[var(--s5)] [&_ul]:grid [&_ul]:list-none [&_ul]:gap-[var(--s2)]",
          "min-[1001px]:[&_ul]:grid-cols-3",
          "[&_ol]:mt-[var(--s5)] [&_ol]:grid [&_ol]:list-none [&_ol]:gap-[var(--s2)]",
          "min-[1001px]:[&_ol]:grid-cols-3",
          "[&_li]:border-t [&_li]:border-[color:var(--rv-line)] [&_li]:pt-[var(--s2)]",
          "[&_li]:text-[15px] [&_li]:leading-[1.62] [&_li]:text-[color:var(--rv-dim)]",
          "[&_b]:font-bold [&_b]:text-[color:var(--rv-white)]",
          "[&_strong]:font-bold [&_strong]:text-[color:var(--rv-white)]",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: s.key_takeaways as string }}
      />
    </Section>
  );
}
