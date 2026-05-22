import type { TickerItem } from "@/types/pitch";

/**
 * Continuously scrolling, edge-to-edge band of brand logos.
 *
 * Used in two places that must stay in sync:
 *   - athlete pitch pages (via the `ticker` section in pitch_templates)
 *   - the public homepage's brand_partners slot
 *
 * Both render the SAME logo list — items live in
 * pitch_templates.default.sections[].items and are fetched by the
 * page that mounts this component, so editing the list once updates
 * both surfaces.
 *
 * Backward-compat: items can be plain strings (rendered as text
 * headlines, original ticker behavior) or `{ alt, logoUrl }` image
 * items. Styles are self-contained so the component works inside or
 * outside the `.pitch-page` wrapper.
 */
export default function BrandCarousel({ items }: { items: TickerItem[] }) {
  if (!items || items.length === 0) return null;
  const doubled: TickerItem[] = [...items, ...items];

  return (
    <div className="pitch-ticker" aria-hidden="true">
      <style>{BRAND_CAROUSEL_CSS}</style>
      <div className="pitch-ticker__inner">
        {doubled.map((item, i) => {
          if (typeof item === "string") {
            return <span key={i}>{item}</span>;
          }
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

const BRAND_CAROUSEL_CSS = `
.pitch-ticker {
  position: relative;
  background: transparent;
  color: var(--text-2, rgba(255,255,255,0.62));
  border-bottom: none;
  overflow: hidden;
  padding: 28px 0;
  font-family: var(--sans, Arial, sans-serif);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
}
.pitch-ticker__inner {
  display: flex;
  white-space: nowrap;
  padding: 11px 0;
  animation: pitch-scroll 60s linear infinite;
  width: max-content;
}
.pitch-ticker__inner span { padding: 0 28px; display: inline-flex; align-items: center; gap: 10px; }
.pitch-ticker__inner span::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--orange, #D73F09); margin-left: 18px; }
.pitch-ticker__inner span:last-child::after { display: none; }
.pitch-ticker__logo {
  height: 60px;
  width: 165px;
  object-fit: contain;
  display: block;
}
@media (max-width: 640px) {
  .pitch-ticker__logo { height: 38px; width: 110px; }
  .pitch-ticker__inner span { padding: 0 18px; }
  .pitch-ticker__inner span::after { margin-left: 12px; }
}
.pitch-ticker__logo[alt="Armani"] {
  transform: scale(1.55);
  transform-origin: center;
}
.pitch-ticker__logo[alt="Coach"] {
  filter: brightness(0) invert(1);
}
@keyframes pitch-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
`;
