import type { TickerSectionData } from "@/types/pitch";

export default function TickerSection({ data }: { data: TickerSectionData }) {
  if (!data.visible) return null;
  // Duplicate items for seamless infinite scroll
  const doubled = [...data.items, ...data.items];
  return (
    <div className="pitch-ticker" aria-hidden="true">
      <div className="pitch-ticker__inner">
        {doubled.map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  );
}
