// ============================================================
// Brand-portal preview pieces: the campaign row (prototype bpCampRow)
// and the review thumbnail (rvThumb). Server-safe.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Pill } from "@/components/admin/campaign/bits";
import type { ReviewPiece } from "@/lib/admin/view-as/types";

export function BpCampRow({
  base,
  c,
}: {
  base: string;
  c: { name: string; slug: string | null; live: boolean; quarter: string | null; athletes: number; campaignType?: string | null };
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-stone-900">{c.name}</div>
        <div className="truncate text-[12px] text-stone-500">
          {[c.quarter, c.campaignType, `${c.athletes.toLocaleString("en-US")} athlete${c.athletes === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
        </div>
      </div>
      <Pill tone={c.live ? "ok" : "muted"}>{c.live ? "In flight" : "Wrapped"}</Pill>
    </>
  );
  const cls = "flex items-center gap-3 border-t border-stone-100 px-4 py-3 text-[14px] first:border-t-0";
  return c.slug ? (
    <Link href={`${base}/campaigns/${encodeURIComponent(c.slug)}`} className={cls + " hover:bg-[#FAFAFB]"}>
      {inner}
    </Link>
  ) : (
    <div className={cls} title="This campaign has no portal page yet">
      {inner}
    </div>
  );
}

export function RvThumb({ p, big = false }: { p: ReviewPiece; big?: boolean }) {
  return (
    <div
      className={
        "relative grid aspect-[9/16] w-full place-items-center overflow-hidden bg-[#111] " + (big ? "max-h-[600px] rounded-xl" : "")
      }
      style={{ backgroundImage: p.thumbUrl ? undefined : "radial-gradient(circle at 50% 40%, #2a2a30, #111)" }}
    >
      {p.thumbUrl && <img src={p.thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {p.isVideo && (
        <span className="relative grid h-[38px] w-[38px] place-items-center rounded-full bg-white/20 pl-[3px] text-[14px] text-white backdrop-blur">
          ▶
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-[7px] py-0.5 text-[11px] font-semibold text-white">
        {p.isVideo ? "Video" : "Photo"}
      </span>
    </div>
  );
}

export const rvTone = (s: ReviewPiece["status"]) => (s === "Approved" ? "ok" : s === "Changes requested" ? "warn" : "muted") as "ok" | "warn" | "muted";
