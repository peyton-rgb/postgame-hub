import type { PullQuoteSectionData } from "@/types/pitch";

export default function PullQuoteSection({
  data,
}: {
  data: PullQuoteSectionData;
}) {
  if (!data.visible) return null;
  return (
    <section className="pitch-pull">
      <div className="wrap pitch-pull__inner">
        <q className="fade">{data.quote}</q>
        <div className="pitch-pull__cite">{data.cite}</div>
      </div>
    </section>
  );
}
