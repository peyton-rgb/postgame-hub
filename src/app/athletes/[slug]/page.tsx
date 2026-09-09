// /athletes/[slug] — permanently moved to /deals/[slug].
//
// This route never read the `athletes` table. It queried `deals` by slug and
// rendered a deal, under a URL that said "athletes" — so the deal detail page
// already existed, just at the wrong noun. The page itself moved to
// /deals/[slug]; this file is the redirect that keeps existing links and any
// indexed URLs working.
//
// 308, not 307: the move is permanent, and a permanent redirect passes the link
// equity to the new URL instead of asking crawlers to keep checking this one.

import { permanentRedirect } from "next/navigation";

export default function AthleteSlugRedirect({ params }: { params: { slug: string } }) {
  permanentRedirect(`/deals/${params.slug}`);
}
