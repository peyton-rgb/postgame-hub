import type { TickerSectionData, TickerItem } from "@/types/pitch";

export default function TickerSection({ data }: { data: TickerSectionData }) {
  if (!data.visible) return null;
  // Duplicate items for seamless infinite scroll
  const doubled: TickerItem[] = [...data.items, ...data.items];
  return (
    <div className="pitch-ticker" aria-hidden="true">
      <div className="pitch-ticker__inner">
        {doubled.map((item, i) => {
          if (typeof item === "string") {
            return <span key={i}>{item}</span>;
          }
          // Image (brand logo) item
          return (
            <span key={i} className="pitch-ticker__logo-wrap">
              <img
                className="pitch-ticker__logo"
                src={item.logoUrl}
                alt={item.alt}
                loading="lazy"
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
