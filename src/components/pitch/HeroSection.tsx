import type { HeroSectionData } from "@/types/pitch";

export default function HeroSection({ data }: { data: HeroSectionData }) {
  if (!data.visible) return null;
  return (
    <>
      <header className="wrap">
        <nav className="pitch-nav">
          <div className="pitch-nav__brand">{data.navBrand}</div>
          <div className="pitch-nav__meta">
            {data.navMeta.map((m, i) => (
              <span key={i}>
                {m.label} &rarr; <b>{m.value}</b>
              </span>
            ))}
          </div>
        </nav>
      </header>

      <section className="pitch-hero wrap">
        <div className="pitch-hero__top">
          <span>
            <span className="dot" />
            {data.topLeft}
          </span>
          <span>{data.topRight}</span>
        </div>

        <h1
          className="pitch-hero__title fade"
          dangerouslySetInnerHTML={{ __html: data.title }}
        />

        {data.stamp && (
          <style>{`.pitch-hero__title::after { content: "${data.stamp}"; }`}</style>
        )}

        <p
          className="pitch-hero__lede fade"
          dangerouslySetInnerHTML={{ __html: data.lede }}
        />

        <div className="pitch-hero__grid">
          <div
            className="pitch-hero__deck fade"
            dangerouslySetInnerHTML={{
              __html: data.deckParagraphs
                .map((p) => `<p>${p}</p>`)
                .join(""),
            }}
          />

          <div className="pitch-hero__stats">
            {data.stats.map((s, i) => (
              <div key={i}>
                <span className="num">{s.value}</span>
                <span className="lab">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
