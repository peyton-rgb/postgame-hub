// Fixed top bar. Built from the presence list, never from a static array — so
// it can only ever link to a section that actually rendered. A campaign with
// no metrics and no photos gets a two-item nav, not six items with four dead
// anchors.
//
// Links are hidden below 1000px rather than collapsed into a drawer: six
// anchors on a page this long is a convenience, not the only way to navigate,
// and a second drawer pattern would fight the one the dashboard just grew.
import { SECTION_LABEL, type SectionId } from "@/lib/recap-v2/guards";
import { PostgameLogo } from "@/components/PostgameLogo";

export function RecapNav({
  sections,
  brandName,
}: {
  sections: SectionId[];
  brandName: string;
}) {
  // One surviving section makes the nav pointless — it links to the only thing
  // on screen. Nothing to navigate, so nothing to render.
  if (sections.length < 2) return null;
  return (
    <nav
      data-recap-v2="nav"
      aria-label={`${brandName} recap sections`}
      className="fixed inset-x-0 top-0 z-40 flex h-[var(--nav-h)] items-center justify-between gap-6 border-b border-[color:var(--rv-line)] bg-[color:var(--rv-black)] px-[var(--gutter)]"
    >
      {/* The Postgame mark is a file, never typography — see PostgameLogo. */}
      <PostgameLogo size="sm" />
      <ul className="hidden gap-[30px] min-[1001px]:flex">
        {sections.map((id) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-[rgba(250,248,245,0.68)] transition-colors hover:text-[color:var(--rv-white)]"
            >
              {SECTION_LABEL[id]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
