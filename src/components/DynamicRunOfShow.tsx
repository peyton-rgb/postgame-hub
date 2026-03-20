"use client";

import Image from "next/image";
import type { RunOfShow, RosShoot, RosShotSection, RosTimelineItem, RosContact } from "@/lib/types";

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

export function DynamicRunOfShowDetail({
  ros,
  shoot,
}: {
  ros: RunOfShow;
  shoot: RosShoot;
}) {
  const contacts: RosContact[] = ros.contacts || [];
  const shotList: RosShotSection[] = shoot.shot_list || [];
  const timeline: RosTimelineItem[] = shoot.timeline || [];

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
            {shoot.event_name}
          </h1>
          <p className="text-lg text-gray-500">
            {shoot.city}, {shoot.state}
          </p>
        </div>

        {/* Camera Settings */}
        {ros.camera_settings && (
          <div className="border-2 border-[#D73F09] bg-[#D73F09]/10 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="text-[#D73F09] text-xl flex-shrink-0">&#9888;</div>
            <div className="text-[#D73F09] text-sm md:text-base font-black uppercase tracking-wide">
              {ros.camera_settings}
            </div>
          </div>
        )}

        {/* Content Upload Folder */}
        {shoot.content_folder_url && (
          <div className="bg-gray-900 rounded-xl p-5 mb-10">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-white/70 mb-3">
              Content Upload Folder
            </div>
            <a
              href={shoot.content_folder_url}
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
        )}

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
              Event Start Time
            </div>
            <div className="text-lg font-bold text-gray-900">
              {shoot.event_start_time}
            </div>
          </div>
          <div className="bg-white border-2 border-[#D73F09] rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-[#D73F09] mb-2">
              Videographer Arrival Time
            </div>
            <div className="text-2xl font-black text-gray-900">
              {shoot.arrival_time}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Before event start
            </div>
          </div>
          {shoot.starting_address && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-2">
                Starting Location
              </div>
              <div className="text-sm font-medium leading-relaxed text-gray-900">
                {shoot.starting_address}
              </div>
            </div>
          )}
        </div>

        {/* Videographer Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
            Assigned Videographer
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
              {shoot.videographer === "TBD" ? "?" : shoot.videographer[0]}
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900">
                {shoot.videographer}
              </div>
              {shoot.videographer_phone && (
                <div className="text-gray-500 text-sm">
                  {shoot.videographer_phone}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Postgame Points of Contact */}
        {contacts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
              Postgame Points of Contact
            </div>
            <div className="space-y-3">
              {contacts.map((contact, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
                    {contact.initials ||
                      contact.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">
                      {contact.name}
                    </div>
                    {contact.phone && (
                      <div className="text-gray-500 text-sm">
                        {contact.phone}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client Point of Contact */}
        {shoot.client_contact_name && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
              {ros.client_name} Point of Contact
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FBBF24] flex items-center justify-center text-sm font-black text-gray-900">
                {shoot.client_contact_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <div className="font-bold text-gray-900">
                  {shoot.client_contact_name}
                </div>
                {shoot.client_contact_phone && (
                  <div className="text-gray-500 text-sm">
                    {shoot.client_contact_phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-gray-900">
              <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
              Timeline
            </h2>
            <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
              {timeline.map((item, idx) => (
                <TimelineItem
                  key={idx}
                  time={item.time}
                  title={item.title}
                  description={item.description}
                  highlight={item.highlight}
                />
              ))}
            </div>
          </div>
        )}

        {/* Shot List */}
        {shotList.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-gray-900">
              <span className="w-2 h-2 rounded-full bg-[#D73F09] inline-block" />
              Shot List
            </h2>
            <div className="space-y-6">
              {shotList.map((section, idx) => (
                <div
                  key={idx}
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
        )}

        {/* Event Info Link */}
        {shoot.website && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-2">
              Official Event Info
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
        )}

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
            {ros.client_name} — {ros.event_name || ros.name}
          </div>
        </div>
      </div>
    </div>
  );
}
