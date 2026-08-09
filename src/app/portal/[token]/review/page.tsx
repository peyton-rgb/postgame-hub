import type { Metadata } from "next";
import { getPortalBrand } from "@/lib/portal-data";
import { ORANGE, CARD, CARD_B, RADIUS, BLUR, BEBAS, MONO, INK_BODY, INK_LABEL } from "@/lib/portal";

// Review tab. review_sessions and review_comments are both empty (0 rows), so
// this ships as an honest empty state rather than being hidden — the client
// should be able to see the tab exists and that nothing is waiting on them.
// No sample queue, no invented assets, no placeholder counts on the nav badge.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const brand = await getPortalBrand(token);
  return {
    title: `${brand.name} — Review`,
    description: `Asset review for ${brand.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function PortalReviewPage({ params }: Props) {
  const { token } = await params;
  await getPortalBrand(token); // token gate

  return (
    <main className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 pt-10 pb-24">
      <div className="mb-8">
        <div style={{ ...MONO, fontSize: 11, letterSpacing: ".18em", color: ORANGE }}>Review</div>
        <h1 className="uppercase mt-2.5" style={{ ...BEBAS, fontSize: "clamp(30px,5vw,40px)", lineHeight: 1, letterSpacing: ".012em" }}>
          Asset review
        </h1>
      </div>

      <div
        className="flex flex-col items-start gap-4 px-6 py-14 md:py-20"
        style={{ border: `1px solid ${CARD_B}`, borderRadius: RADIUS, background: CARD, backdropFilter: BLUR, WebkitBackdropFilter: BLUR }}
      >
        <span
          className="inline-block rounded-[3px] px-2 py-[5px]"
          style={{ ...MONO, fontSize: 10, background: "rgba(250,248,245,.07)", border: `1px solid ${CARD_B}`, color: "rgba(250,248,245,.60)" }}
        >
          Awaiting verified data
        </span>
        <p style={{ ...BEBAS, fontSize: 28, letterSpacing: ".012em" }} className="uppercase">
          No assets awaiting your review.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: INK_BODY, maxWidth: 560 }}>
          When a campaign reaches the review stage, the assets needing your approval will appear
          here with comments and an approve or request-changes action.
        </p>
        <p style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: INK_LABEL }}>
          Review workflow not yet connected
        </p>
      </div>
    </main>
  );
}
