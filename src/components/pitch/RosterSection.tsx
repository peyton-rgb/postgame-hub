import type { RosterSectionData } from "@/types/pitch";

const sizeClass: Record<string, string> = {
  feature: "pitch-athlete--feature",
  wide: "pitch-athlete--wide",
  std: "pitch-athlete--std",
};

const tagClass: Record<string, string> = {
  default: "tag",
  live: "tag live",
  poy: "tag poy",
};

export default function RosterSection({ data }: { data: RosterSectionData }) {
  if (!data.visible) return null;
  return (
    <section className="pitch-roster wrap">
      <header className="pitch-roster__head">
        <h2
          className="fade"
          dangerouslySetInnerHTML={{ __html: data.heading }}
        />
        <div className="meta">
          <b dangerouslySetInnerHTML={{ __html: data.metaLabel }} />
          {data.metaDetail}
        </div>
      </header>

      <div className="pitch-roster__grid">
        {data.athletes.map((a, i) => (
          <article
            key={i}
            className={`pitch-athlete ${sizeClass[a.size] || "pitch-athlete--std"}`}
          >
            <div className="pitch-athlete__hd">
              <span className="num">{a.number}</span>
              <span className={tagClass[a.tagStyle] || "tag"}>
                {a.tagStyle === "live" ? `● ${a.tag}` : a.tag}
              </span>
            </div>
            <div className="pitch-athlete__photo">
              {a.photoUrl ? (
                <img src={a.photoUrl} alt={a.name} />
              ) : (
                "[ photo placeholder ]"
              )}
            </div>
            <h3 className="pitch-athlete__name">{a.name}</h3>
            <div className="pitch-athlete__role">{a.role}</div>
            <p
              className="pitch-athlete__moment"
              dangerouslySetInnerHTML={{ __html: a.moment }}
            />
            <div className="pitch-athlete__date">{a.date}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
