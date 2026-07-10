// Deal tracker card (postgame-app.html — mydeals): brand header, a status
// dot + letterspaced label, the 6-segment progress bar, and — only when a
// deliverable is actually awaiting the athlete — the orange ACTION NEEDED
// block. Presentational; the whole card links into the deal detail where the
// upload / post action is completed.

import Link from "next/link";
import { type DealStage } from "@/lib/deliverable-status";

const SEG_LABELS = ["OPT IN", "CREATE", "SUBMIT", "APPROVED", "POST", "PAID"];

// Stages where the athlete personally owes the next move.
const ACTION_COPY: Partial<Record<DealStage["key"], string>> = {
  content_due: "Shoot and upload your content to keep this deal on track.",
  ready_to_post: "You're approved — post your content and drop the live link.",
};

// Quiet status line for stages that are waiting on someone else.
const WAIT_COPY: Partial<Record<DealStage["key"], string>> = {
  in_review: "In review — Postgame and the brand are checking your content.",
  awaiting_verification: "Posted — we're verifying your live link. Nothing needed from you.",
  verified: "Verified — your payout is scheduled.",
  paid: "Complete — your payout has been released.",
};

export default function DealTrackerCard({
  optinId,
  brandName,
  brandLogo,
  title,
  stage,
}: {
  optinId: string;
  brandName: string | null;
  brandLogo: string | null;
  title: string;
  stage: DealStage;
}) {
  const actionCopy = ACTION_COPY[stage.key];
  const waitCopy = WAIT_COPY[stage.key];

  return (
    <Link href={`/athlete/my-deals/${optinId}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="a-card" style={{ padding: 16 }}>
        {/* Brand header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {brandLogo && (
            <span style={{ background: "rgba(255,255,255,0.94)", borderRadius: 8, padding: "5px 8px", display: "flex", flex: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogo} alt={brandName || "brand"} style={{ height: 15, maxWidth: 74, objectFit: "contain" }} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="a-d" style={{ fontSize: 22, textTransform: "uppercase" }}>{title}</div>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: "bold", color: "rgba(250,248,245,0.4)", marginTop: 3 }}>
              {brandName}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="a-status">
          <span className={`a-statusdot ${stage.pill.kind}`} />
          <span className="a-statustext">{stage.pill.text}</span>
        </div>

        {/* Progress segments */}
        <div className="a-segbar">
          {SEG_LABELS.map((_, i) => {
            const done = i <= stage.doneThrough;
            const cur = i === stage.currentStep && !done;
            return <span key={i} className={`a-seg${done ? " done" : cur ? " cur" : ""}`} />;
          })}
        </div>
        <div className="a-seglabels">
          {SEG_LABELS.map((label, i) => {
            const done = i <= stage.doneThrough;
            const cur = i === stage.currentStep && !done;
            return <span key={i} className={done ? "done" : cur ? "cur" : ""}>{label}</span>;
          })}
        </div>

        {/* Action needed vs quiet wait line */}
        {actionCopy ? (
          <div className="a-alert">
            <div className="a-alert-eyebrow">Action needed</div>
            <div className="a-alert-msg">{actionCopy}</div>
          </div>
        ) : waitCopy ? (
          <div className="a-stageline">{waitCopy}</div>
        ) : null}
      </div>
    </Link>
  );
}
