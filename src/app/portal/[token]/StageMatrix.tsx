"use client";

import { useState } from "react";
import { ORANGE, OFFWHITE, CARD, CARD_B, HAIR, RADIUS, BLUR, BEBAS, MONO, INK_LABEL } from "@/lib/portal";

export type MatrixCampaign = { id: string; name: string; opened: string };

// In-flight stage matrix. Stage tracking is NOT wired to anything yet, so every
// live campaign renders all six nodes in the `untracked` state behind the
// "Stage tracking not yet connected" chip. Nothing here is inferred from data
// we do not have.
//
// The Example view shows how a tracked campaign WILL render. Its rows are
// explicitly prefixed "Example —" so they can never be mistaken for this
// brand's real campaigns.

const STAGES = ["Brief", "Roster", "Shoot", "Review", "Live", "Recap"] as const;

type NodeState = "untracked" | "pending" | "now" | "done";

const EXAMPLES: { name: string; note: string; hot?: boolean; states: NodeState[] }[] = [
  { name: "Example — just opened", note: "Brief with Postgame", states: ["now", "pending", "pending", "pending", "pending", "pending"] },
  { name: "Example — shoot week", note: "12 athletes confirmed", states: ["done", "done", "now", "pending", "pending", "pending"] },
  { name: "Example — awaiting your review", note: "3 assets need your approval", hot: true, states: ["done", "done", "done", "now", "pending", "pending"] },
  { name: "Example — live", note: "Recap in build", states: ["done", "done", "done", "done", "done", "now"] },
];

function Dot({ state }: { state: NodeState }) {
  const base: React.CSSProperties = {
    width: 11,
    height: 11,
    borderRadius: "50%",
    background: "#07070A",
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "rgba(250,248,245,.28)",
    position: "relative",
    zIndex: 2,
    flex: "0 0 11px",
  };
  if (state === "done") return <i style={{ ...base, background: ORANGE, borderColor: ORANGE }} />;
  if (state === "now") return <i style={{ ...base, borderColor: ORANGE, boxShadow: "0 0 0 4px rgba(215,63,9,.20)" }} />;
  if (state === "untracked")
    return <i style={{ ...base, borderStyle: "dashed", borderColor: "rgba(250,248,245,.24)", background: "transparent" }} />;
  return <i style={base} />;
}

function Row({ name, note, hot, states }: { name: string; note: string; hot?: boolean; states: NodeState[] }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[minmax(210px,1.4fr)_repeat(6,1fr)] items-center pb-3 md:pb-0"
      style={{ borderBottom: `1px solid ${HAIR}` }}
    >
      <div className="px-5 pt-[18px] pb-1 md:py-[18px]">
        <div className="uppercase" style={{ ...BEBAS, fontSize: 21, letterSpacing: ".012em", lineHeight: 1.1 }}>{name}</div>
        <div className="mt-[5px]" style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: hot ? ORANGE : "rgba(250,248,245,.44)" }}>
          {note}
        </div>
      </div>
      {STAGES.map((stage, i) => (
        <div
          key={stage}
          className="relative flex items-center justify-start md:justify-center px-5 py-1.5 md:px-0 md:py-0 md:h-16"
        >
          {/* connector rule, desktop only */}
          <span
            aria-hidden
            className="hidden md:block absolute top-1/2 h-px"
            style={{
              left: i === 0 ? "50%" : 0,
              right: i === STAGES.length - 1 ? "50%" : 0,
              background:
                states[i] === "untracked"
                  ? "repeating-linear-gradient(90deg,rgba(250,248,245,.16) 0 3px,transparent 3px 7px)"
                  : "rgba(250,248,245,.13)",
            }}
          />
          <Dot state={states[i]} />
          <span className="md:hidden ml-3" style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: INK_LABEL }}>
            {stage}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StageMatrix({ campaigns }: { campaigns: MatrixCampaign[] }) {
  const [mode, setMode] = useState<"live" | "demo">("live");

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div className="inline-flex p-[3px] rounded-[5px]" style={{ background: "rgba(250,248,245,.05)", border: `1px solid ${CARD_B}` }}>
          {(["live", "demo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className="rounded-[3px] px-3.5 inline-flex items-center justify-center"
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: ".14em",
                border: 0,
                cursor: "pointer",
                minHeight: 34,
                background: mode === m ? "rgba(250,248,245,.11)" : "transparent",
                color: mode === m ? OFFWHITE : INK_LABEL,
              }}
            >
              {m === "live" ? "Live" : "Example"}
            </button>
          ))}
        </div>
      </div>

      <div
        className="overflow-hidden"
        style={{ border: `1px solid ${CARD_B}`, borderRadius: RADIUS, background: CARD, backdropFilter: BLUR, WebkitBackdropFilter: BLUR }}
      >
        {/* header row, desktop only */}
        <div
          className="hidden md:grid grid-cols-[minmax(210px,1.4fr)_repeat(6,1fr)]"
          style={{ borderBottom: `1px solid ${CARD_B}`, background: "rgba(250,248,245,.03)" }}
        >
          <div className="text-left pl-5 py-3" style={{ ...MONO, fontSize: 10, letterSpacing: ".15em", color: "rgba(250,248,245,.44)" }}>
            Campaign
          </div>
          {STAGES.map((s) => (
            <div key={s} className="text-center py-3" style={{ ...MONO, fontSize: 10, letterSpacing: ".15em", color: "rgba(250,248,245,.44)" }}>
              {s}
            </div>
          ))}
        </div>

        {mode === "live" ? (
          campaigns.length ? (
            campaigns.map((c) => (
              <Row key={c.id} name={c.name} note={c.opened} states={STAGES.map(() => "untracked") as NodeState[]} />
            ))
          ) : (
            <div className="px-5 py-8" style={{ fontSize: 16, color: "rgba(250,248,245,.68)" }}>
              No campaigns in flight.
            </div>
          )
        ) : (
          EXAMPLES.map((e) => <Row key={e.name} name={e.name} note={e.note} hot={e.hot} states={e.states} />)
        )}

        <div
          className="flex items-center justify-between gap-4 px-5 py-3.5 flex-wrap"
          style={{ borderTop: `1px solid ${CARD_B}`, background: "rgba(250,248,245,.02)" }}
        >
          <div className="flex gap-[18px] flex-wrap">
            {([
              ["done", "Complete"],
              ["now", "In progress"],
              ["pending", "Pending"],
              ["untracked", "Not tracked"],
            ] as const).map(([s, label]) => (
              <span key={s} className="flex items-center gap-[7px]" style={{ ...MONO, fontSize: 10, letterSpacing: ".13em", color: INK_LABEL }}>
                <Dot state={s as NodeState} />
                {label}
              </span>
            ))}
          </div>
          <span
            className="inline-block rounded-[3px] px-2 py-[5px]"
            style={{ ...MONO, fontSize: 10, background: "rgba(250,248,245,.07)", border: `1px solid ${CARD_B}`, color: "rgba(250,248,245,.60)" }}
          >
            Stage tracking not yet connected
          </span>
        </div>
      </div>
    </div>
  );
}
