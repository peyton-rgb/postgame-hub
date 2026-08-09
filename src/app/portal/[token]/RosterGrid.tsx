"use client";

import { useState } from "react";
import { brandSafe } from "@/lib/brand-safe";
import { CARD_B, RADIUS, BEBAS, ANTON, MONO } from "@/lib/portal";

export type RosterPerson = {
  key: string;
  name: string;
  school: string | null;
  sport: string | null;
  followers: number;
  image: string | null;
  // false when ig_followers was never collected (stored as 0). Such a person
  // has no rank and no follower figure — only a labelled placeholder.
  ranked: boolean;
};

// Notable roster. Desktop renders the top 8 in a 4-up grid — unchanged by the
// mobile reflow. At <=750px the grid holds 2-up and collapses to the top 4,
// with a "Full roster" control that expands the remainder in place. Nothing is
// orphaned: every ranked person is reachable without leaving the page.
//
// The ranking is real. ig_followers is populated for everyone shown, which is
// why this ranks where the Assets tab's "Top performing" sort stays disabled.

const DESKTOP_VISIBLE = 8;

const fmtFollowers = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

function Tile({ person, rank }: { person: RosterPerson; rank: number | null }) {
  const sub = [person.school, person.sport].filter(Boolean).map((s) => brandSafe(String(s))).join(" · ");
  return (
    <div
      className="pv2-roster-tile relative overflow-hidden block"
      style={{ border: `1px solid ${CARD_B}`, borderRadius: RADIUS, aspectRatio: "3 / 4", background: "#101014" }}
    >
      {person.image ? (
        <img
          src={person.image}
          alt={person.name}
          loading="lazy"
          className="w-full h-full object-cover block"
          style={{ objectPosition: "50% 30%" }}
        />
      ) : null}
      {/* edge blend — hard rule 4 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(0deg,rgba(7,7,10,.95) 0%,rgba(7,7,10,.42) 30%,rgba(7,7,10,0) 62%),linear-gradient(90deg,rgba(7,7,10,.34) 0%,rgba(7,7,10,0) 22%,rgba(7,7,10,0) 78%,rgba(7,7,10,.34) 100%)",
        }}
      />
      {/* No rank number without a measurement — numbering the unranked would
          present an alphabetical order as a performance ranking. */}
      {rank !== null ? (
        <div
          className="pv2-rank absolute top-3 left-3.5 z-[2]"
          style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: "rgba(250,248,245,.60)" }}
        >
          {String(rank).padStart(2, "0")}
        </div>
      ) : null}

      <div className="absolute top-2.5 right-3 z-[2] text-right">
        {person.ranked ? (
          <>
            <b className="pv2-fol-n block" style={{ ...ANTON, fontSize: 20, lineHeight: 1, fontWeight: 400 }}>
              {fmtFollowers(person.followers)}
            </b>
            <span
              className="pv2-fol-l block mt-[3px]"
              style={{ ...MONO, fontSize: 10, letterSpacing: ".14em", color: "rgba(250,248,245,.55)" }}
            >
              Followers
            </span>
          </>
        ) : (
          <>
            {/* ig_followers = 0 is uncollected, not a reading of zero. */}
            <b
              className="pv2-fol-n block"
              style={{ ...ANTON, fontSize: 20, lineHeight: 1, fontWeight: 400, color: "rgba(250,248,245,.30)" }}
            >
              &mdash;
            </b>
            <span
              className="pv2-fol-chip inline-block mt-[4px] rounded-[3px] px-[5px] py-[3px] whitespace-nowrap"
              style={{
                ...MONO,
                fontSize: 8,
                letterSpacing: ".08em",
                background: "rgba(250,248,245,.07)",
                border: `1px solid ${CARD_B}`,
                color: "rgba(250,248,245,.60)",
              }}
            >
              Awaiting verified data
            </span>
          </>
        )}
      </div>
      <div className="absolute left-4 right-4 bottom-3.5 z-[2]">
        <div className="pv2-ath-name uppercase" style={{ ...BEBAS, fontSize: 24, lineHeight: 1.02, letterSpacing: ".012em" }}>
          {brandSafe(person.name)}
        </div>
        <div
          className="pv2-ath-sub mt-1.5"
          style={{ ...MONO, fontSize: 10, letterSpacing: ".13em", color: "rgba(250,248,245,.68)" }}
        >
          {sub || "School · Sport"}
        </div>
      </div>
    </div>
  );
}

export default function RosterGrid({
  people,
  rankedCount,
}: {
  people: RosterPerson[];
  rankedCount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const top = people.slice(0, DESKTOP_VISIBLE);
  const rest = people.slice(DESKTOP_VISIBLE);
  const flag = expanded ? "true" : "false";

  // Ranked people sort ahead of unranked, so an item's array index is its rank
  // — but only while it is ranked.
  const rankAt = (index: number, person: RosterPerson) => (person.ranked ? index + 1 : null);

  return (
    <div>
      <div
        className="pv2-roster-grid grid gap-4 grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4"
        data-expanded={flag}
      >
        {top.map((p, i) => (
          <Tile key={p.key} person={p} rank={rankAt(i, p)} />
        ))}
      </div>

      {/* Remainder — revealed in place at <=750px. Hidden at desktop, which
          shows the top 8 as approved. */}
      {rest.length ? (
        <div className="pv2-roster-more" data-expanded={flag}>
          {rest.map((p, i) => (
            <Tile key={p.key} person={p} rank={rankAt(i + DESKTOP_VISIBLE, p)} />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="pv2-seeall"
        style={{ ...MONO, color: "#FAF8F5" }}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* "Ranking", not "roster": people with no follower data are excluded
            from the ranking, so this count is smaller than the roster total in
            the section header. Calling it the full roster would overstate it. */}
        {expanded ? "Show fewer" : `Full ranking (${rankedCount}) →`}
      </button>
    </div>
  );
}
