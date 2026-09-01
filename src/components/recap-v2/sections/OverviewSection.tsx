// #overview — prose column plus a spec table, 1.15fr / 1fr on desktop and
// stacked below 1000px. Either half can be missing; the section only renders
// when at least one of them has something (see guards).
import { SECTION_HEADING, hasRichText, specRows } from "@/lib/recap-v2/guards";
import { Section, SectionHead } from "../ui";
import type { Campaign } from "@/lib/types";

export function OverviewSection({ campaign }: { campaign: Campaign }) {
  const s = campaign.settings || {};
  const rows = specRows(campaign);
  const h = SECTION_HEADING.overview;

  return (
    <Section id="overview">
      <SectionHead kicker={h.kicker} title={h.title} />
      <div className="grid grid-cols-1 items-start gap-11 min-[1001px]:grid-cols-[1.15fr_1fr] min-[1001px]:gap-[var(--s5)]">
        <div>
          {hasRichText(s.description) ? (
            <div
              className="max-w-[62ch] text-[17.5px] leading-[1.72] text-[color:var(--rv-dim)] [&_b]:font-bold [&_b]:text-[color:var(--rv-white)] [&_p+p]:mt-[var(--s2)] [&_strong]:font-bold [&_strong]:text-[color:var(--rv-white)]"
              dangerouslySetInnerHTML={{ __html: s.description as string }}
            />
          ) : null}
        </div>

        {/* Every row is individually guarded upstream — a campaign with only a
            name yields one row, not seven blanks. */}
        {rows.length > 0 ? (
          <dl className="m-0">
            {rows.map((r, i) => (
              <div
                key={r.key}
                className={`flex items-baseline justify-between gap-6 border-b border-[color:var(--rv-soft)] py-[15px] ${
                  i === 0 ? "border-t border-t-[color:var(--rv-line)]" : ""
                }`}
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--rv-dim2)]">
                  {r.label}
                </dt>
                <dd className="text-right text-[15px]">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Section>
  );
}
