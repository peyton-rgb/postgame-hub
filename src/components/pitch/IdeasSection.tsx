import type { IdeasSectionData } from "@/types/pitch";

export default function IdeasSection({ data }: { data: IdeasSectionData }) {
  if (!data.visible) return null;
  return (
    <section className="pitch-ideas">
      <div className="wrap">
        <header className="pitch-ideas__head">
          <div>
            <span className="pitch-ideas__tag">{data.sectionTag}</span>
            <h2
              className="fade"
              dangerouslySetInnerHTML={{ __html: data.heading }}
            />
          </div>
          <p dangerouslySetInnerHTML={{ __html: data.description }} />
        </header>

        <div className="pitch-ideas__list">
          {data.ideas.map((idea, i) => (
            <div key={i} className="pitch-idea">
              <div className="pitch-idea__num">{idea.number}</div>
              <div>
                <div className="pitch-idea__name">{idea.name}</div>
              </div>
              <div className="pitch-idea__desc">{idea.description}</div>
              <div className="pitch-idea__channel">
                <b>{idea.channelLabel}</b>
                {idea.channelValue}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
