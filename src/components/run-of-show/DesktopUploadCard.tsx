"use client";

import { useState } from "react";

// The desktop-app upload cards on the public shoot page: crew install a
// vendor's app, find their own folder and drag their cards in. One layout, two
// services — run_of_shows.upload_method picks which one a campaign uses.

// Each vendor's own download page.
const LUCIDLINK_DOWNLOAD_URL = "https://www.lucidlink.com/download";
const FRAMEIO_DESKTOP_APP_URL = "https://frame.io/drive";

type CrewSlots = Array<string | null | undefined>;

interface FolderCrewMember {
  name: string;
  role: string;
  // Their own folder: "Dave Jordan - Video".
  folder: string;
}

// "Dave Jordan (Video)" → { name: "Dave Jordan", role: "Video" }. The role keeps
// its casing because it is part of the folder name. Empty and "TBD" slots are dropped.
function parseFolderCrew(raw: CrewSlots): FolderCrewMember[] {
  const crew: FolderCrewMember[] = [];
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
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function StepHint({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs text-gray-500 mt-0.5">{children}</span>;
}

function DesktopUploadCard({
  service,
  intro,
  note,
  crew: rawCrew,
  basePath,
  methodTitle,
  methodWhy,
  steps,
  downloadUrl,
  downloadLabel,
  done,
  browserUploadUrl,
}: {
  service: string;
  intro: string;
  note: React.ReactNode;
  crew: CrewSlots;
  // Folders above each person's own folder, outermost first.
  basePath: string[];
  methodTitle: string;
  methodWhy: string;
  // `myPath` is the picked person's full folder path, null until they pick.
  steps: (myPath: string | null) => React.ReactNode;
  downloadUrl: string;
  downloadLabel: string;
  done: React.ReactNode;
  browserUploadUrl: string | null;
}) {
  const crew = parseFolderCrew(rawCrew);
  const [selected, setSelected] = useState<number | null>(null);
  const me = selected === null ? null : crew[selected];
  const myPath = me ? [...basePath, me.folder].join(" › ") : null;

  return (
    <section
      aria-labelledby="ros-desktop-upload-title"
      className="bg-white border border-gray-200 rounded-xl p-5 mb-10"
    >
      <h2 id="ros-desktop-upload-title" className="text-xl font-black text-gray-900">
        Upload Your Footage
      </h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">{intro}</p>

      <div className="rounded-[10px] border border-[#f3e1a8] bg-[#fff8e6] px-3.5 py-3 text-sm">
        {note}
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
              Your {service} folder
              <b className="block text-[15px] mt-1 break-words">{myPath}</b>
            </div>
          )}
        </>
      )}

      <div className="mt-[18px] rounded-xl border-[1.5px] border-gray-200 bg-white p-4">
        <h3 className="text-[17px] font-bold text-gray-900">{methodTitle}</h3>
        <p className="text-[13px] text-gray-500 mt-0.5 mb-2.5">{methodWhy}</p>
        <ol className="mb-3">{steps(myPath)}</ol>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-[10px] border-[1.5px] border-gray-900 px-3 py-[11px] text-center text-sm font-bold text-gray-900"
        >
          {downloadLabel}
        </a>
      </div>

      <div className="mt-4 rounded-[10px] border border-[#cdebd6] bg-[#f0faf3] px-3.5 py-3 text-sm">
        {done}
      </div>

      {browserUploadUrl && (
        <p className="mt-3 text-[13px] text-gray-500 text-center">
          Can&apos;t use {service}?{" "}
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

export function LucidLinkUploadCard({
  basePath,
  stopName,
  crew,
  browserUploadUrl,
}: {
  // content › <Brand> › <Year> - <Brand> › <campaign folder> › <Stop> › 01 Raw
  basePath: string[];
  stopName: string;
  crew: CrewSlots;
  browserUploadUrl: string | null;
}) {
  return (
    <DesktopUploadCard
      service="LucidLink"
      intro="Everything goes to our LucidLink drive. Upload before you leave."
      note={
        <>
          📧 <b>Before the shoot:</b> accept the LucidLink invite we sent you and create
          your account with that same email.
        </>
      }
      crew={crew}
      basePath={basePath}
      methodTitle="LucidLink in Finder"
      methodWhy="Connect our filespace like an external drive and drag your cards straight in."
      steps={(myPath) => (
        <>
          <Step n={1}>
            Download the <b>LucidLink app</b> and sign in with your invite email
          </Step>
          <Step n={2}>
            Connect the <b>&quot;content&quot;</b> filespace
            <StepHint>It appears in Finder like a drive</StepHint>
          </Step>
          <Step n={3}>
            You&apos;ll only see your own folder — open it
            {myPath ? (
              <b className="block mt-0.5 break-words">{myPath}</b>
            ) : (
              <StepHint>Pick your name above to see where it is</StepHint>
            )}
          </Step>
          <Step n={4}>
            Drag each SD card in as its own folder
            <StepHint>Name them Card 1, Card 2…</StepHint>
          </Step>
          <Step n={5}>
            Keep LucidLink open until it says <b>&quot;Remaining upload: 0 B&quot;</b>
            <StepHint>Finder finishing the copy is NOT the end</StepHint>
          </Step>
        </>
      )}
      downloadUrl={LUCIDLINK_DOWNLOAD_URL}
      downloadLabel="Download LucidLink"
      done={
        <>
          ✅ <b className="text-[#166534]">When Remaining upload hits 0 B,</b> text Peyton
          &quot;{stopName} done&quot; + how many cards.
        </>
      }
      browserUploadUrl={browserUploadUrl}
    />
  );
}

export function FrameioUploadCard({
  projectName,
  folder,
  stopName,
  crew,
  browserUploadUrl,
}: {
  projectName: string;
  folder: string;
  stopName: string;
  crew: CrewSlots;
  browserUploadUrl: string | null;
}) {
  return (
    <DesktopUploadCard
      service="Frame.io"
      intro="Everything goes to our Frame.io project. Upload before you leave."
      note={
        <>
          📧 <b>Before the shoot:</b> accept the Frame.io invite we emailed you for{" "}
          <b>{projectName}</b>. Use that same email to sign in below.
        </>
      }
      crew={crew}
      basePath={[projectName, folder]}
      methodTitle="Frame.io drive in Finder"
      methodWhy="Mount the project like an external drive and drag files straight in."
      steps={(myPath) => (
        <>
          <Step n={1}>
            Install the <b>Frame.io desktop app</b> and sign in
          </Step>
          <Step n={2}>
            Mount project <b>{projectName}</b>
            <StepHint>It shows up in Finder under Locations</StepHint>
          </Step>
          <Step n={3}>
            Open{" "}
            <b className="break-words">
              {/* The project is already open by this step, so the path starts below it. */}
              {myPath ? myPath.slice(projectName.length + 3) : "your folder"}
            </b>
          </Step>
          <Step n={4}>Drag your SD card folders in</Step>
          <Step n={5}>Leave the app running until uploads finish</Step>
        </>
      )}
      downloadUrl={FRAMEIO_DESKTOP_APP_URL}
      downloadLabel="Download Frame.io desktop app"
      done={
        <>
          ✅ <b className="text-[#166534]">When it&apos;s all uploaded,</b> text Peyton
          &quot;{stopName} done&quot; with how many cards you uploaded.
        </>
      }
      browserUploadUrl={browserUploadUrl}
    />
  );
}
