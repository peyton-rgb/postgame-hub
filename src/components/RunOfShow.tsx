"use client";

import Link from "next/link";
import Image from "next/image";
import type { Shoot } from "@/lib/run-of-show-data";

const paradeShotList = [
  {
    category: "Parade & Restaurant Shots (Top Priority)",
    shots: [
      "Hero shot: Cane's float passing in front of a Raising Cane's restaurant (if applicable)",
      "Float in front of local landmarks / points of interest",
      "Any Cane's branded signage/moments along parade route",
      "Wide shot of float moving with crowd showing Cane's branding",
    ],
  },
  {
    category: "Crew & Cane's Gear",
    shots: [
      "Crew members wearing Cane's gear participating in parade",
      "Crew on foot interacting with crowd — throwing/handing out items",
      "Crew on float — waving, One Love, throwing items",
      "Close-ups of Cane's branded swag being distributed",
      "Crew on/in front of float with parade energy",
      "Crew holding parade sponsor banner in front of float",
    ],
  },
  {
    category: "Float Coverage",
    shots: [
      "All four sides of float — wide, panning to show entire side",
      "All four sides of float — close, panning to show detail of design/branding",
      "Start wide at front of float, move closer until front focal point fills frame with solid black (transition shot)",
      "Reverse: start with black and move back until entire float is in frame (transition shot)",
      "Close-ups of Cane's branded swag",
    ],
  },
  {
    category: "Crowd & Atmosphere",
    shots: [
      "Cheering attendees — close-ups showing excitement",
      "Cheering attendees — wide shots to show size of crowds",
    ],
  },
];

const riverDyeingShotList = [
  {
    category: "River Dyeing Coverage (Top Priority — Reel Opener)",
    shots: [
      "Tight shots of boats dyeing the river",
      "Wider shots of river turning green",
      "Time progression shots showing color change",
    ],
  },
  {
    category: "Atmosphere & Branding",
    shots: [
      "Crowd reactions along the riverbank",
      "Any Cane's branded signage/moments in the area",
      "Close-ups of Cane's branded swag",
      "Cheering attendees — close-ups showing excitement",
      "Cheering attendees — wide shots to show size of crowds",
    ],
  },
];

function TimelineItem({
  time,
  title,
  description,
  highlight,
}: {
  time: string;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={`absolute -left-[calc(1.5rem+5px)] w-3 h-3 rounded-full border-2 ${
          highlight
            ? "bg-[#D73F09] border-[#D73F09]"
            : "bg-white border-gray-300"
        }`}
      />
      <div
        className={`${
          highlight
            ? "bg-[#D73F09]/10 border border-[#D73F09]/30"
            : "bg-white border border-gray-200"
        } rounded-lg p-4`}
      >
        <div
          className={`text-xs font-bold uppercase tracking-[1.5px] mb-1 ${
            highlight ? "text-[#D73F09]" : "text-gray-400"
          }`}
        >
          {time}
        </div>
        <div className="font-bold text-sm text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-1">{description}</div>
      </div>
    </div>
  );
}

export function RunOfShow({ shoot }: { shoot: Shoot }) {
  const shotList =
    shoot.type === "river-dyeing" ? riverDyeingShotList : paradeShotList;

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-gray-900">
      {/* Header */}
      <div className="border-b border-[#222] bg-black">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-center">
          <Image
            src="/postgame-logo.png"
            alt="Postgame"
            width={150}
            height={31}
            priority
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Title Block */}
        <div className="mb-10">
          <div className="text-xs font-bold uppercase tracking-[2px] text-[#D73F09] mb-3">
            Run of Show
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 text-gray-900">
            {shoot.parade}
          </h1>
          <p className="text-lg text-gray-500">
            {shoot.city}, {shoot.state}
          </p>
        </div>

        {/* Camera Settings */}
        <div className="border-2 border-[#D73F09] bg-[#D73F09]/10 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="text-[#D73F09] text-xl flex-shrink-0">&#9888;</div>
          <div className="text-[#D73F09] text-sm md:text-base font-black uppercase tracking-wide">
            Shoot in S-Log · 60fps · Same-day uploads mandatory
          </div>
        </div>

        {/* Content Upload Folder */}
        <div className="bg-gray-900 rounded-xl p-5 mb-10">
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-white/70 mb-3">
            Content Upload Folder
          </div>
          <a
            href={shoot.contentFolder}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 text-white hover:underline text-sm font-bold"
          >
            <Image
              src="/google-drive-logo.png"
              alt="Google Drive"
              width={28}
              height={28}
              className="flex-shrink-0"
            />
            Upload Content to Google Drive →
          </a>
        </div>

        {/* Key Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-2">
              Date
            </div>
            <div className="text-lg font-bold text-gray-900">{shoot.date}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-2">
              {shoot.type === "river-dyeing"
                ? "River Dyeing Begins"
                : "Parade Start Time"}
            </div>
            <div className="text-lg font-bold text-gray-900">
              {shoot.paradeStartTime}
            </div>
          </div>
          <div className="bg-white border-2 border-[#D73F09] rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-[#D73F09] mb-2">
              Videographer Arrival Time
            </div>
            <div className="text-2xl font-black text-gray-900">
              {shoot.arrivalTime}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              30 minutes before{" "}
              {shoot.type === "river-dyeing" ? "dyeing" : "parade"} start
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-2">
              Starting Location
            </div>
            <div className="text-sm font-medium leading-relaxed text-gray-900">
              {shoot.startingAddress}
            </div>
          </div>
        </div>

        {/* Videographer Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
            Assigned Videographer
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
              {shoot.videographer === "TBD"
                ? "?"
                : shoot.videographer[0]}
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900">
                {shoot.videographer}
              </div>
              {shoot.phone && (
                <div className="text-gray-500 text-sm">{shoot.phone}</div>
              )}
            </div>
          </div>
        </div>

        {/* Postgame Points of Contact */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
            Postgame Points of Contact
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
                AH
              </div>
              <div>
                <div className="font-bold text-gray-900">Aaron H.</div>
                <div className="text-gray-500 text-sm">(941) 786-5956</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
                PJ
              </div>
              <div>
                <div className="font-bold text-gray-900">Peyton J.</div>
                <div className="text-gray-500 text-sm">(941) 567-8565</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
                DM
              </div>
              <div>
                <div className="font-bold text-gray-900">Dom M.</div>
                <div className="text-gray-500 text-sm">(352) 530-7027</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cane's Point of Contact */}
        {shoot.canesContact && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
              Cane&apos;s Point of Contact
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FBBF24] flex items-center justify-center text-sm font-black text-gray-900">
                {shoot.canesContact
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <div className="font-bold text-gray-900">
                  {shoot.canesContact}
                </div>
                {shoot.canesPhone && (
                  <div className="text-gray-500 text-sm">
                    {shoot.canesPhone}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="mb-10">
          <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-gray-900">
            <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
            Timeline
          </h2>
          <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
            <TimelineItem
              time={shoot.arrivalTime}
              title="Arrive On Location"
              description="Set up gear, scout shooting positions, confirm float/crew location"
              highlight
            />
            {shoot.type === "parade" ? (
              <>
                <TimelineItem
                  time={shoot.paradeStartTime}
                  title="Parade Begins"
                  description="Start capturing float coverage and parade atmosphere"
                />
                <TimelineItem
                  time="Ongoing"
                  title="Float & Crew Coverage"
                  description="Capture all four sides of float, crew interactions, branded moments"
                />
                <TimelineItem
                  time="Ongoing"
                  title="Crowd & Atmosphere"
                  description="Wide and close crowd shots, landmark shots, branded signage"
                />
                <TimelineItem
                  time="End of Route"
                  title="Wrap"
                  description="Final float shots, review footage, confirm all shot list items captured"
                />
              </>
            ) : (
              <>
                <TimelineItem
                  time={shoot.paradeStartTime}
                  title="River Dyeing Begins"
                  description="Start capturing boats and river turning green"
                />
                <TimelineItem
                  time="Ongoing"
                  title="Dyeing Coverage"
                  description="Tight shots of boats, wide shots of river changing color, crowd reactions"
                />
                <TimelineItem
                  time="Post-Dyeing"
                  title="Wrap"
                  description="Final atmosphere shots, review footage, confirm all shot list items captured"
                />
              </>
            )}
          </div>
        </div>

        {/* Example Videos */}
        <div className="mb-10">
          <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-gray-900">
            <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
            Example Videos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <video
                controls
                playsInline
                preload="metadata"
                className="w-full aspect-[9/16] object-cover bg-black"
              >
                <source src="/example-1.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <video
                controls
                playsInline
                preload="metadata"
                className="w-full aspect-[9/16] object-cover bg-black"
              >
                <source src="/example-2.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>

        {/* Shot List */}
        <div className="mb-10">
          <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-gray-900">
            <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
            Shot List
          </h2>
          <div className="space-y-6">
            {shotList.map((section) => (
              <div
                key={section.category}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-bold text-sm uppercase tracking-[1.5px] text-gray-900">
                    {section.category}
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {section.shots.map((shot, i) => (
                    <li
                      key={i}
                      className="px-5 py-3 flex items-start gap-3 text-sm"
                    >
                      <span className="w-5 h-5 rounded border border-gray-300 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{shot}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Parade Info Link */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-2">
            Official Parade Info
          </div>
          <a
            href={shoot.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D73F09] hover:underline text-sm font-medium break-all"
          >
            {shoot.website}
          </a>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center pt-6 border-t border-gray-200">
          <Image
            src="/postgame-logo-black.png"
            alt="Postgame"
            width={130}
            height={28}
            className="mb-2"
          />
          <div className="text-xs text-gray-400">
            Raising Cane's — St. Patrick's Day 2026
          </div>
        </div>
      </div>
    </div>
  );
}
