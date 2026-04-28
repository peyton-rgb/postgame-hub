import type { CtaSectionData } from "@/types/pitch";

export default function CtaSection({ data }: { data: CtaSectionData }) {
  if (!data.visible) return null;

  const mode = data.mode ?? "full";
  const showHeading = mode === "full" || mode === "heading";
  const showFooter = mode === "full" || mode === "footer";

  return (
    <>
      {showHeading ? (
        <section className="pitch-cta">
          <div className="wrap pitch-cta__inner">
            {data.kicker ? (
              <div className="pitch-cta__kicker">
                <span className="dot" />
                {data.kicker}
              </div>
            ) : null}
            {data.heading ? (
              <h2
                className="fade"
                dangerouslySetInnerHTML={{ __html: data.heading }}
              />
            ) : null}
            {data.buttonText ? (
              <a className="pitch-cta__btn" href={data.buttonHref ?? "#"}>
                {data.buttonText}
                <span className="arrow">&rarr;</span>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {showFooter ? (
      <footer className="pitch-foot">
        <div className="wrap pitch-foot__inner">
          {data.footerLogoUrl ? (
            <img
              className="pitch-foot__logo"
              src={data.footerLogoUrl}
              alt="Postgame"
            />
          ) : null}

          {data.contacts && data.contacts.length > 0 ? (
            <div className="pitch-foot__contacts">
              {data.contacts.map((c, i) => (
                <div className="pitch-foot__contact" key={i}>
                  <div className="pitch-foot__contact-name">{c.name}</div>
                  {c.role ? (
                    <div className="pitch-foot__contact-role">{c.role}</div>
                  ) : null}
                  {c.email ? (
                    <a
                      className="pitch-foot__contact-link"
                      href={`mailto:${c.email}`}
                    >
                      {c.email}
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a
                      className="pitch-foot__contact-link"
                      href={`tel:${c.phone.replace(/\D/g, "")}`}
                    >
                      {c.phone}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="pitch-foot__row">
            <div className="pitch-foot__brand">{data.footerBrand}</div>
            <div className="pitch-foot__meta">{data.footerMeta}</div>
          </div>
        </div>
      </footer>
      ) : null}
    </>
  );
}
