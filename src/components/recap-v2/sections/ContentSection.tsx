// #bic — "The content": masonry gallery plus the per-athlete insights modal.
// Guarded upstream on there being any non-thumbnail media; 4 campaigns have no
// photography at all and lose the section outright.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import type { Media } from "@/lib/types";

export function ContentSection({ items }: { items: Media[] }) {
  const h = SECTION_HEADING.bic;
  return (
    <section id="bic" data-recap-v2="bic">
      <p data-slot="kicker">{h.kicker}</p>
      <h2>{h.title}</h2>
      {/* Aspect ratio is measured client-side on load in Step 2: media.aspect_ratio
          is non-null on 0 of 4,434 rows and `resolution` on only ~9%, which is
          worse than none — a masonry laid out from it would be right for one
          item in eleven. */}
      <div data-slot="gmason" data-count={items.length} />
      {/* Modal mounts in Step 2. */}
      <div data-slot="insights" />
    </section>
  );
}
