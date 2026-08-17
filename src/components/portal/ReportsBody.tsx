import type { PortalBrand } from "@/lib/portal-data";
import { ORANGE, CARD, CARD_B, RADIUS, BLUR, BEBAS, ANTON, MONO, INK_BODY, INK_LABEL } from "@/lib/portal";

// Reports tab. asset_metrics is empty (0 rows), so every figure on this page is
// a labelled placeholder. The layout ships so the client can see what reporting
// will look like, but there are NO numbers here — not invented, not sampled,
// not greyed-out fakes. An em dash behind an "Awaiting verified data" chip is
// the only honest rendering until real metrics land.



const PANELS: { title: string; sub: string; span: string }[] = [
  { title: "Total impressions", sub: "All campaigns", span: "lg:col-span-3" },
  { title: "Engagement rate", sub: "Weighted average", span: "lg:col-span-3" },
  { title: "Total posts", sub: "Feed and reel", span: "lg:col-span-3" },
  { title: "Total reach", sub: "Unique accounts", span: "lg:col-span-3" },
  { title: "Impressions by month", sub: "Trailing twelve months", span: "lg:col-span-7" },
  { title: "Split by content type", sub: "Photo vs video", span: "lg:col-span-5" },
  { title: "Top performing posts", sub: "Ranked by engagement", span: "lg:col-span-12" },
];

export default async function ReportsBody({ brand, basePath }: { brand: PortalBrand; basePath: string }) {

  const Chip = () => (
    <span
      className="inline-block rounded-[3px] px-2 py-[5px]"
      style={{ ...MONO, fontSize: 10, background: "rgba(250,248,245,.07)", border: `1px solid ${CARD_B}`, color: "rgba(250,248,245,.60)" }}
    >
      Awaiting verified data
    </span>
  );

  return (
    <main className="mx-auto max-w-[1248px] px-5 md:px-10 lg:px-24 pt-10 pb-24">
      <div className="flex items-end justify-between gap-5 flex-wrap mb-6">
        <div>
          <div style={{ ...MONO, fontSize: 11, letterSpacing: ".18em", color: ORANGE }}>Reports</div>
          <h1 className="uppercase mt-2.5" style={{ ...BEBAS, fontSize: "clamp(30px,5vw,40px)", lineHeight: 1, letterSpacing: ".012em" }}>
            Campaign reporting
          </h1>
        </div>
        <Chip />
      </div>

      <p style={{ fontSize: 16, lineHeight: 1.7, color: INK_BODY, maxWidth: 640 }} className="mb-7">
        Performance reporting is not yet connected to this portal. Every figure below is a
        placeholder — no estimates and no sample numbers are shown. Today campaign performance
        arrives as a shared spreadsheet.
      </p>

      <div className="pv2-reports-grid grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3.5">
        {PANELS.map((p) => (
          <div
            key={p.title}
            className={`md:col-span-6 ${p.span} p-5 relative`}
            style={{ background: CARD, border: `1px solid ${CARD_B}`, borderRadius: 10, backdropFilter: BLUR, WebkitBackdropFilter: BLUR, minHeight: 150 }}
          >
            <div className="uppercase" style={{ ...BEBAS, fontSize: 20, letterSpacing: ".012em" }}>{p.title}</div>
            <div style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: INK_LABEL }}>{p.sub}</div>
            <div className="mt-4" style={{ ...ANTON, fontSize: 40, lineHeight: .94, color: "rgba(250,248,245,.30)" }}>
              &mdash;
            </div>
            <div className="mt-3">
              <Chip />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
