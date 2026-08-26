// #take — one large statement plus numbered cards. 50 of 82 campaigns have no
// key_takeaways at all, so this section is absent more often than present.
// The whole section is guarded upstream; nothing here renders a placeholder.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import type { Campaign } from "@/lib/types";

export function TakeawaysSection({ campaign }: { campaign: Campaign }) {
  const s = campaign.settings || {};
  const h = SECTION_HEADING.take;
  return (
    <section id="take" data-recap-v2="take">
      <p data-slot="kicker">{h.kicker}</p>
      {/* Stored as one rich-text blob. The prototype's statement + 3 numbered
          cards is a presentation of that blob, not extra fields — splitting it
          is Step 2's problem, and needs no schema change. */}
      <div data-slot="takeaways" dangerouslySetInnerHTML={{ __html: s.key_takeaways as string }} />
    </section>
  );
}
