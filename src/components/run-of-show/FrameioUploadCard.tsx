"use client";

import { useState } from "react";

// Frame.io's own page for its desktop app (Frame.io Drive) — Mac and Windows.
const FRAMEIO_DESKTOP_APP_URL = "https://frame.io/drive";

interface FrameioCrewMember {
  name: string;
  role: string;
  // Their folder inside the stop's folder: "Dave Jordan - Video".
  folder: string;
}

// "Dave Jordan (Video)" → { name: "Dave Jordan", role: "Video" }. The role keeps
// its casing because it is part of the folder name. Empty and "TBD" slots are dropped.
function parseFrameioCrew(raw: Array<string | null | undefined>): FrameioCrewMember[] {
  const crew: FrameioCrewMember[] = [];
  for (const entry of raw) {
    const text = (entry || "").trim();
    if (!text || text.toUpperCase() === "TBD") continue;
    const m = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    const name = (m ? m[1] : text).trim();
    if (!name) continue;
    const role = (m ? m[2] : "").trim();
    crew.push({ name, role, folder: role ? `${name} - ${role}` : name });
  }
  return crew;
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold text-gray-900 mt-[18px] mb-2.5">
      <span className="w-[22px] h-[22px] rounded-full bg-gray-900 text-white text-xs flex items-center justify-center">
        {n}
      </span>
      {children}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-snug py-[7px] border-t border-[#eee] first:border-t-0">
      <span className="flex-none w-5 h-5 mt-px rounded-full bg-[#f1f0ff] text-[#5b53ff] text-[11px] font-bold flex items-center justify-center">
        {n}
      </span>
      <div>{children}</div>
    </li>
  );
}

export function FrameioUploadCard({
  projectName,
  folder,
  stopName,
  crew: rawCrew,
  browserUploadUrl,
}: {
  projectName: string;
  folder: string;
  stopName: string;
  crew: Array<string | null | undefined>;
  browserUploadUrl: string | null;
}) {
  const crew = parseFrameioCrew(rawCrew);
  const [selected, setSelected] = useState<number | null>(null);
  const me = selected === null ? null : crew[selected];
  const myPath = me ? `${folder} › ${me.folder}` : null;

  return (
    <section
      aria-labelledby="ros-frameio-title"
      className="bg-white border border-gray-200 rounded-xl p-5 mb-10"
    >
      <h2 id="ros-frameio-title" className="text-xl font-black text-gray-900">
        Upload Your Footage
      </h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Everything goes to our Frame.io project. Upload before you leave.
      </p>

      <div className="rounded-[10px] border border-[#f3e1a8] bg-[#fff8e6] px-3.5 py-3 text-sm">
        📧 <b>Before the shoot:</b> accept the Frame.io invite we emailed you for{" "}
        <b>{projectName}</b>. Use that same email to sign in below.
      </div>

      {crew.length > 0 && (
        <>
          <StepTitle n={1}>Who are you?</StepTitle>
          <div role="radiogroup" aria-label="Select your name" className="flex flex-col gap-2">
            {crew.map((c, i) => (
              <button
                key={`${c.folder}-${i}`}
                type="button"
                role="radio"
                aria-checked={selected === i}
                onClick={() => setSelected(i)}
                className={`flex items-center justify-between gap-3 text-left rounded-[10px] border-[1.5px] px-3.5 py-3 text-[15px] font-bold text-gray-900 ${
                  selected === i
                    ? "border-[#D73F09] bg-[#fdf1ec]"
                    : "border-gray-200 bg-white"
                }`}
              >
                {c.name}
                {c.role && (
                  <span className="text-[11px] tracking-[0.1em] uppercase text-gray-500">
                    {c.role}
                  </span>
                )}
              </button>
            ))}
          </div>
          {myPath && (
            <div
              aria-live="polite"
              className="mt-2.5 rounded-[10px] border border-[#dcd9ff] bg-[#f1f0ff] px-3.5 py-3 text-[13px]"
            >
              Your Frame.io folder
              <b className="block text-[15px] mt-1 break-words">
                {projectName} › {myPath}
              </b>
            </div>
          )}
        </>
      )}

      <div className="mt-[18px] rounded-xl border-[1.5px] border-gray-200 bg-white p-4">
        <h3 className="text-[17px] font-bold text-gray-900">Frame.io drive in Finder</h3>
        <p className="text-[13px] text-gray-500 mt-0.5 mb-2.5">
          Mount the project like an external drive and drag files straight in.
        </p>
        <ol className="mb-3">
          <Step n={1}>
            Install the <b>Frame.io desktop app</b> and sign in
          </Step>
          <Step n={2}>
            Mount project <b>{projectName}</b>
            <span className="block text-xs text-gray-500 mt-0.5">
              It shows up in Finder under Locations
            </span>
          </Step>
          <Step n={3}>
            Open <b className="break-words">{myPath || "your folder"}</b>
          </Step>
          <Step n={4}>Drag your SD card folders in</Step>
          <Step n={5}>Leave the app running until uploads finish</Step>
        </ol>
        <a
          href={FRAMEIO_DESKTOP_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-[10px] border-[1.5px] border-gray-900 px-3 py-[11px] text-center text-sm font-bold text-gray-900"
        >
          Download Frame.io desktop app
        </a>
      </div>

      <div className="mt-4 rounded-[10px] border border-[#cdebd6] bg-[#f0faf3] px-3.5 py-3 text-sm">
        ✅ <b className="text-[#166534]">When it&apos;s all uploaded,</b> text Peyton
        &quot;{stopName} done&quot; with how many cards you uploaded.
      </div>

      {browserUploadUrl && (
        <p className="mt-3 text-[13px] text-gray-500 text-center">
          Can&apos;t use Frame.io?{" "}
          <a
            href={browserUploadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-gray-900 underline"
          >
            Upload in the browser instead →
          </a>
        </p>
      )}
    </section>
  );
}
