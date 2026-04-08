import type { CtaSectionData } from "@/types/pitch";

export default function CtaSection({ data }: { data: CtaSectionData }) {
  if (!data.visible) return null;
  return (
    <>
      <section className="pitch-cta">
        <div className="wrap pitch-cta__inner">
          <div className="pitch-cta__kicker">
            <span className="dot" />
            {data.kicker}
          </div>
          <h2
            className="fade"
            dangerouslySetInnerHTML={{ __html: data.heading }}
          />
          <a className="pitch-cta__btn" href={data.buttonHref}>
            {data.buttonText}
            <span className="arrow">&rarr;</span>
          </a>
        </div>
      </section>

      <footer className="pitch-foot">
        <div className="wrap pitch-foot__row">
          <div className="pitch-foot__brand">{data.footerBrand}</div>
          <div className="pitch-foot__meta">{data.footerMeta}</div>
        </div>
      </footer>
    </>
  );
}
