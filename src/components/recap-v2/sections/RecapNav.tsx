// Nav is built from the presence list, never from a static array — so it can
// only ever link to a section that actually rendered. A campaign with no
// metrics and no photos gets a two-item nav, not six items with four dead
// anchors.
import { SECTION_LABEL, type SectionId } from "@/lib/recap-v2/guards";

export function RecapNav({ sections, brandName }: { sections: SectionId[]; brandName: string }) {
  // One surviving section makes the nav pointless — it links to the only thing
  // on screen. Nothing to navigate, so nothing to render.
  if (sections.length < 2) return null;
  return (
    <nav data-recap-v2="nav" aria-label={`${brandName} recap sections`}>
      <ul>
        {sections.map((id) => (
          <li key={id}>
            <a href={`#${id}`}>{SECTION_LABEL[id]}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
