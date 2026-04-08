import type { ThesisSectionData } from "@/types/pitch";

export default function ThesisSection({ data }: { data: ThesisSectionData }) {
  if (!data.visible) return null;
  return (
    <section className="pitch-thesis" data-bg-word={data.bgWord}>
      <div className="wrap pitch-thesis__inner">
        <div className="pitch-thesis__num">{data.sectionLabel}</div>
        <div className="pitch-thesis__body">
          <h2
            className="fade"
            dangerouslySetInnerHTML={{ __html: data.heading }}
          />
          {data.paragraphs.map((p, i) => (
            <p
              key={i}
              className="fade"
              dangerouslySetInnerHTML={{ __html: p }}
            />
          ))}

          {data.pillars.length > 0 && (
            <div className="pitch-thesis__three">
              {data.pillars.map((pillar, i) => (
                <div key={i}>
                  <h3>{pillar.label}</h3>
                  <p dangerouslySetInnerHTML={{ __html: pillar.text }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
