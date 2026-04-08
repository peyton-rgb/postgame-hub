import type { CapabilitiesSectionData } from "@/types/pitch";

export default function CapabilitiesSection({
  data,
}: {
  data: CapabilitiesSectionData;
}) {
  if (!data.visible) return null;
  return (
    <section className="pitch-cap wrap">
      <header className="pitch-cap__head">
        <h2
          className="fade"
          dangerouslySetInnerHTML={{ __html: data.heading }}
        />
        <p dangerouslySetInnerHTML={{ __html: data.description }} />
      </header>

      <div className="pitch-cap__grid">
        {data.items.map((item, i) => (
          <div key={i} className="pitch-cap__cell">
            <div className="ix">{item.index}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
