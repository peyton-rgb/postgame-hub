// ============================================================
// "You're in" confirmation (mockup screen 3)
//
// Shown right after a successful opt-in. Reassures the athlete and points
// them at My deals.
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAthlete } from "@/lib/athlete-auth";
import { getDealBySlug } from "@/lib/athlete-deals";

export const dynamic = "force-dynamic";

function Step({ n, text, active }: { n: number; text: string; active?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 9 }}>
      <div
        className="a-d"
        style={{ width: 22, height: 22, borderRadius: "50%", background: active ? "var(--a-orange)" : "rgba(255,255,255,0.12)", color: active ? "#fff" : "rgba(250,248,245,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flex: "none" }}
      >
        {n}
      </div>
      <span style={{ fontSize: 13, color: "rgba(250,248,245,0.8)" }}>{text}</span>
    </div>
  );
}

export default async function JoinedPage({ params }: { params: { slug: string } }) {
  await requireAthlete();
  const deal = await getDealBySlug(params.slug);
  if (!deal) notFound();
  const brandName = deal.brand?.name || "the brand";

  return (
    <div>
      <div style={{ padding: "30px 22px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 74, height: 74, borderRadius: "50%", background: "rgba(52,199,89,0.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
          <svg viewBox="0 0 24 24" style={{ width: 38, height: 38, stroke: "var(--a-green)", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
          </svg>
        </div>
        <div className="a-d" style={{ fontSize: 30 }}>YOU&rsquo;RE IN</div>
        <div style={{ fontSize: 13, color: "rgba(250,248,245,0.65)", marginTop: 6, lineHeight: 1.5 }}>
          You&rsquo;ve opted into <b style={{ color: "var(--a-off)" }}>{brandName} — {deal.title}</b>. We&rsquo;ll send your content brief shortly.
        </div>
      </div>

      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="a-card" style={{ textAlign: "left" }}>
          <div className="a-d" style={{ fontSize: 16, marginBottom: 11 }}>WHAT HAPPENS NEXT</div>
          <Step n={1} text="Postgame sends your brief + posting dates" active />
          <Step n={2} text="Create + submit your content for approval" />
          <Step n={3} text="Post it, then get paid" />
        </div>
        <Link href="/athlete/my-deals" className="a-cta" style={{ textDecoration: "none" }}>
          <span className="a-d" style={{ fontSize: 18 }}>VIEW IN MY DEALS</span>
        </Link>
        <Link href="/athlete" className="a-ghost" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 13 }}>Back to deals</span>
        </Link>
      </div>
    </div>
  );
}
