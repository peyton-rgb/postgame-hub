"use client";

import Image from "next/image";
import type { RunOfShow, RosShoot, RosShotSection, RosTimelineItem, RosContact } from "@/lib/types";
import { UploadBox, parseCrew } from "@/components/run-of-show/UploadBox";
import { FrameioUploadCard, LucidLinkUploadCard } from "@/components/run-of-show/DesktopUploadCard";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const capitalize3 = (word: string) =>
  word[0].toUpperCase() + word.slice(1, 3).toLowerCase();

// `date` is free text. "Friday, October 9, 2026" → ["Fri", "Oct 9"];
// anything else comes back null and the card shows the raw text.
function splitDate(raw: string): [string, string] | null {
  const m = raw.trim().match(/^([A-Za-z]{3,9})\.?,?\s+([A-Za-z]{3,9})\.?\s+(\d{1,2})\b/);
  if (!m) return null;
  const weekday = WEEKDAYS.find((d) => d.startsWith(m[1].toLowerCase()));
  const month = MONTHS.find((d) => d.startsWith(m[2].toLowerCase()));
  if (!weekday || !month) return null;
  return [capitalize3(weekday), `${capitalize3(month)} ${Number(m[3])}`];
}

// "4:00 pm ET" → ["4:00", "PM ET"]; "10:30 AM" → ["10:30", "AM"].
function splitTime(raw: string): [string, string] | null {
  const m = raw.trim().match(/^(\d{1,2}:\d{2})\s*([ap])\.?m\.?(?:\s+([A-Za-z]{1,5}))?$/i);
  if (!m) return null;
  return [m[1], `${m[2].toUpperCase()}M${m[3] ? ` ${m[3].toUpperCase()}` : ""}`];
}

function TimeCard({
  label,
  raw,
  parts,
  accent,
}: {
  label: string;
  raw: string;
  parts: [string, string] | null;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-2 py-3 sm:p-5 text-center min-w-0 ${
        accent
          ? "border-[1.5px] border-[#D73F09] bg-[#D73F09]/5"
          : "bg-white border border-gray-200"
      }`}
    >
      <div
        className={`text-[10px] sm:text-xs font-bold uppercase tracking-[1.5px] mb-2 ${
          accent ? "text-[#D73F09]" : "text-gray-400"
        }`}
      >
        {label}
      </div>
      {parts ? (
        <>
          <div
            className={`text-2xl sm:text-3xl font-black leading-none ${
              accent ? "text-[#D73F09]" : "text-gray-900"
            }`}
          >
            {parts[0]}
          </div>
          <div
            className={`text-xs sm:text-sm font-bold mt-1.5 ${
              accent ? "text-[#D73F09]" : "text-gray-500"
            }`}
          >
            {parts[1]}
          </div>
        </>
      ) : (
        <div
          className={`text-sm font-bold break-words ${
            accent ? "text-[#D73F09]" : "text-gray-900"
          }`}
        >
          {raw}
        </div>
      )}
    </div>
  );
}

// Tap-to-call. US numbers (10 digits, or 11 with a leading 1) are shown as
// (XXX) XXX-XXXX; anything else is shown as stored.
function PhoneLink({ raw }: { raw: string }) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  const us = digits.length === 10;
  if (!us && !digits) return <div className="text-gray-500 text-sm">{raw}</div>;
  return (
    <div className="text-sm">
      <a
        href={us ? `tel:+1${digits}` : `tel:${digits}`}
        className="text-[#D73F09] font-medium hover:underline"
      >
        {us ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : raw}
      </a>
    </div>
  );
}

// Free text that may contain a US phone number (shot-list headings):
// the number becomes the same tap-to-call link, the rest stays as typed.
function TextWithPhones({ text }: { text: string }) {
  const parts = text.split(/((?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d))/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const digits = part.replace(/\D/g, "").slice(-10);
        return (
          <a
            key={i}
            href={`tel:+1${digits}`}
            className="text-[#D73F09] whitespace-nowrap hover:underline"
          >
            ({digits.slice(0, 3)}) {digits.slice(3, 6)}-{digits.slice(6)}
          </a>
        );
      })}
    </>
  );
}

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
        {/* Ranges ("12:30 – 1:00 PM CT") may only wrap at the dash; no line at all without a time */}
        {time?.trim() && (
          <div className="text-sm font-black uppercase tracking-[0.5px] leading-snug mb-1 text-[#D73F09]">
            {time.split(/\s+[–—-]\s+/).map((part, i, parts) => (
              <span key={i} className="inline-block whitespace-nowrap">
                {part}
                {i < parts.length - 1 ? "\u00a0–\u00a0" : ""}
              </span>
            ))}
          </div>
        )}
        <div className="font-bold text-sm text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-1">{description}</div>
      </div>
    </div>
  );
}

export function DynamicRunOfShowDetail({
  ros,
  shoot,
  postgameLogoUrl,
  clientLogoUrl,
  lucidStopPath = null,
}: {
  ros: RunOfShow;
  shoot: RosShoot;
  postgameLogoUrl: string | null;
  clientLogoUrl: string | null;
  // This stop's folder in LucidLink, outermost folder first; null when the
  // campaign has no LucidLink folder.
  lucidStopPath?: string[] | null;
}) {
  const contacts: RosContact[] = ros.contacts || [];
  const shotList: RosShotSection[] = shoot.shot_list || [];
  const timeline: RosTimelineItem[] = shoot.timeline || [];

  // "Venue | street address" — the venue is optional.
  const address = shoot.starting_address?.trim() || "";
  const pipe = address.indexOf("|");
  const venue = pipe > -1 ? address.slice(0, pipe).trim() : "";
  const street = pipe > -1 ? address.slice(pipe + 1).trim() : address;
  const mapQuery = encodeURIComponent([venue, street].filter(Boolean).join(", "));

  const uploadUrl = shoot.frameio_upload_url || shoot.content_folder_url;

  // Desktop-app upload cards. run_of_shows.upload_method picks one, and each
  // only shows once it has what it needs to name the crew's folders.
  const frameioProject = ros.frameio_project_name?.trim() || "";
  const frameioFolder = shoot.frameio_folder?.trim() || "";
  const showLucidLink = ros.upload_method === "lucidlink" && Boolean(lucidStopPath);
  const showFrameio =
    ros.upload_method === "frameio" && Boolean(frameioProject && frameioFolder);
  // "baton-rouge" → "Baton Rouge", for the "<Stop> done" text.
  const stopName = shoot.slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-gray-900">
      {/* Header — logo lockup. Logos are always the brands-table files. */}
      <div className="border-b border-[#222] bg-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-center gap-5">
          {postgameLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={postgameLogoUrl} alt="Postgame" className="h-[22px] w-auto" />
          ) : (
            <Image
              src="/postgame-logo.png"
              alt="Postgame"
              width={106}
              height={22}
              priority
            />
          )}
          {clientLogoUrl && (
            <>
              <span className="w-px h-7 bg-white/35" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clientLogoUrl}
                alt={ros.client_name}
                className="h-10 w-auto max-w-[45%] object-contain"
              />
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Title Block */}
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-[2px] text-[#D73F09] mb-3">
            Run of Show
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 text-gray-900">
            {shoot.athlete || shoot.event_name}
          </h1>
          <p className="text-lg text-gray-500">
            {shoot.city}, {shoot.state}{shoot.athlete ? ` — ${shoot.event_name}` : ""}
          </p>
        </div>

        {/* Date / Crew Call / Start — three across at every width */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <TimeCard label="Date" raw={shoot.date} parts={splitDate(shoot.date)} />
          <TimeCard
            label="Crew Call"
            raw={shoot.arrival_time}
            parts={splitTime(shoot.arrival_time)}
            accent
          />
          <TimeCard
            label="Start"
            raw={shoot.event_start_time}
            parts={splitTime(shoot.event_start_time)}
          />
        </div>

        {/* Starting Location */}
        {address && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-2">
              Starting Location
            </div>
            <div className="text-sm leading-relaxed text-gray-900 select-text mb-4">
              {venue && <div className="font-bold">{venue}</div>}
              <div className={venue ? "" : "font-medium"}>{street}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-gray-900 text-white text-sm font-bold flex items-center justify-center gap-2 py-3"
              >
                <img src="/map-icons/google-maps.svg" alt="" className="w-[18px] h-[18px]" />
                Google Maps
              </a>
              <a
                href={`https://maps.apple.com/?daddr=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white border border-gray-300 text-gray-900 text-sm font-bold flex items-center justify-center gap-2 py-3"
              >
                <img src="/map-icons/apple.svg" alt="" className="w-[18px] h-[18px]" />
                Apple Maps
              </a>
            </div>
            {/* The site map below replaces the Google embed when a shoot has one */}
            {!shoot.site_map_url && (
              <iframe
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                title="Map of the starting location"
                loading="lazy"
                className="w-full aspect-[4/3] sm:aspect-auto sm:h-80 rounded-[10px] border border-gray-200 mt-4"
              />
            )}
          </div>
        )}

        {/* Event Site Map — opens the full image in a new tab to pinch-zoom */}
        {shoot.site_map_url && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
              Event Site Map
            </div>
            <a
              href={shoot.site_map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shoot.site_map_url}
                alt="Event site map"
                className="w-full rounded-[10px] border border-gray-200"
              />
              <span className="absolute bottom-2 right-2 rounded-full bg-gray-900/85 text-white text-xs font-bold px-3 py-1">
                Tap to zoom
              </span>
            </a>
          </div>
        )}

        <div className="h-6" />

        {/* Athlete */}
        {shoot.athlete && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
            <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
              Athlete
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1a1a2e] flex items-center justify-center text-sm font-black text-white">
                {shoot.athlete.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="font-bold text-lg text-gray-900">
                {shoot.athlete}
              </div>
            </div>
          </div>
        )}

        {/* Videographer Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-gray-400 mb-3">
            {shoot.videographer_2 || shoot.videographer_3
              ? "Assigned Videographers"
              : "Assigned Videographer"}
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
                <PhoneLink raw={shoot.videographer_phone} />
              )}
            </div>
          </div>
          {shoot.videographer_2 && (
            <div className="flex items-center gap-4 mt-3">
              <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
                {shoot.videographer_2[0]}
              </div>
              <div>
                <div className="font-bold text-lg text-gray-900">
                  {shoot.videographer_2}
                </div>
                {shoot.videographer_2_phone && (
                  <PhoneLink raw={shoot.videographer_2_phone} />
                )}
              </div>
            </div>
          )}
          {shoot.videographer_3 && (
            <div className="flex items-center gap-4 mt-3">
              <div className="w-10 h-10 rounded-full bg-[#D73F09] flex items-center justify-center text-sm font-black text-white">
                {shoot.videographer_3[0]}
              </div>
              <div>
                <div className="font-bold text-lg text-gray-900">
                  {shoot.videographer_3}
                </div>
                {shoot.videographer_3_phone && (
                  <PhoneLink raw={shoot.videographer_3_phone} />
                )}
              </div>
            </div>
          )}
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
                      <PhoneLink raw={contact.phone} />
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
                  <PhoneLink raw={shoot.client_contact_phone} />
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
                      <TextWithPhones text={section.category} />
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

        {/* Upload — last thing on the page, for the end of the shoot. A
            campaign set to LucidLink or Frame.io gets that app's steps;
            otherwise the upload box replaces the link-out button once uploads
            are switched on. */}
        {showLucidLink && lucidStopPath ? (
          <LucidLinkUploadCard
            basePath={[...lucidStopPath, "01 Raw"]}
            stopName={stopName}
            crew={[shoot.videographer, shoot.videographer_2, shoot.videographer_3]}
            browserUploadUrl={shoot.content_folder_url}
          />
        ) : showFrameio ? (
          <FrameioUploadCard
            projectName={frameioProject}
            folder={frameioFolder}
            stopName={stopName}
            crew={[shoot.videographer, shoot.videographer_2, shoot.videographer_3]}
            browserUploadUrl={shoot.content_folder_url}
          />
        ) : ros.uploads_enabled ? (
          <UploadBox
            shootId={shoot.id}
            crew={parseCrew([shoot.videographer, shoot.videographer_2, shoot.videographer_3])}
          />
        ) : uploadUrl && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
            <div className="text-xl font-black text-gray-900">
              Upload Your Footage
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Upload before you leave.
            </p>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Big video dumps? Install{" "}
              <a
                href="https://www.google.com/drive/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-700"
              >
                Google Drive for desktop
              </a>{" "}
              (free) and drag your card folders in from Finder — it resumes if
              wifi drops and is more reliable than the browser.
            </p>
            <a
              href={uploadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-[#D73F09] text-white text-base font-bold text-center py-4"
            >
              Upload Footage →
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
