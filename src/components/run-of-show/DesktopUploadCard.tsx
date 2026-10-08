"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// The desktop-app upload cards on the public shoot page: crew install a
// vendor's app and drag their cards in. run_of_shows.upload_method picks which
// service a campaign uses.

// Each vendor's own download page.
const LUCIDLINK_DOWNLOAD_URL = "https://www.lucidlink.com/download";
const FRAMEIO_DRIVE_URL = "https://frame.io/drive";
// Frame.io in the browser, for crew who can't install the app.
const FRAMEIO_WEB_URL = "https://next.frame.io";

// LucidLink's own logo file, as lucidlink.com serves it (the site's
// Organization logo): https://dhgs2q3hgrx0j.cloudfront.net/lucidlink_logo_846354e8f3.png
const LUCIDLINK_LOGO_SRC = "/logos/lucidlink.png";

// Frame.io's own icon: the 48×48 frame of https://frame.io/favicon.ico, as PNG.
const FRAMEIO_ICON_SRC = "/logos/frameio-icon.png";

// Crew walkthrough of the LucidLink setup and its poster frame — the same
// video for every campaign.
const LUCIDLINK_MEDIA_BASE =
  "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/bts/_run-of-show";
const LUCIDLINK_SETUP_VIDEO_URL = `${LUCIDLINK_MEDIA_BASE}/postgame-lucidlink-setup.mp4`;
const LUCIDLINK_SETUP_POSTER_URL = `${LUCIDLINK_MEDIA_BASE}/postgame-lucidlink-setup-poster.jpg`;

function UploadStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-[15px] py-3 text-sm leading-[1.4] text-gray-700">
      <span className="flex-none w-[22px] h-[22px] rounded-full bg-[#D73F09] text-white text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function UploadStepHint({ children }: { children: React.ReactNode }) {
  return <span className="block text-[12.5px] text-gray-500 mt-[3px]">{children}</span>;
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-4 h-4 flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v12M6 11l6 6 6-6M5 20h14" />
    </svg>
  );
}

function AllUploaded() {
  return (
    <div className="flex items-start gap-2.5 mt-3.5 text-[13.5px] leading-[1.45] text-gray-700">
      <span className="flex-none w-[18px] h-[18px] mt-px rounded-full bg-[#16a34a] flex items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="w-3 h-3"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <div>
        <strong className="text-gray-900">All uploaded?</strong> Text your Postgame producer
        &quot;Uploaded&quot;.
      </div>
    </div>
  );
}

export function LucidLinkUploadCard({
  browserUploadUrl,
}: {
  browserUploadUrl: string | null;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function closeVideo() {
    videoRef.current?.pause();
    setVideoOpen(false);
  }

  // While the overlay is up: start playing, close on Escape, hold the page still.
  useEffect(() => {
    if (!videoOpen) return;
    videoRef.current?.play().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeVideo();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [videoOpen]);

  return (
    <section
      aria-labelledby="ros-lucidlink-upload-title"
      className="bg-white border border-gray-200 rounded-xl px-[17px] py-[18px] mb-10"
    >
      <h2 id="ros-lucidlink-upload-title" className="text-xl font-bold text-gray-900">
        Upload Your Footage
      </h2>
      <p className="text-sm text-gray-500 mt-[5px]">
        Upload before you leave. Everything goes to Postgame&apos;s LucidLink drive.
      </p>

      <button
        type="button"
        onClick={() => setVideoOpen(true)}
        className="flex w-full items-center gap-3.5 mt-4 p-2.5 text-left rounded-xl border border-gray-200 bg-[#fafaf9] hover:border-[#D73F09]"
      >
        <span className="relative flex-none w-[54px] h-24 rounded-lg overflow-hidden bg-[#07070a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LUCIDLINK_SETUP_POSTER_URL}
            alt=""
            className="block w-full h-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-7 h-7 rounded-full bg-[#D73F09] flex items-center justify-center">
              <span className="ml-[3px] border-y-[6px] border-y-transparent border-l-[9px] border-l-white" />
            </span>
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-gray-900">New to LucidLink?</span>
          <span className="block text-[13px] text-gray-500 mt-[3px]">
            Watch the 45-second setup video
          </span>
        </span>
        <span className="ml-auto pr-1.5 text-[13px] font-bold text-[#D73F09] whitespace-nowrap">
          Watch ›
        </span>
      </button>

      <div className="mt-3 rounded-[10px] border border-[#f3cdbd] bg-[#fbeee8] px-[13px] py-[11px] text-[13.5px] leading-[1.45]">
        <b className="text-[#D73F09]">Before the shoot:</b> accept the LucidLink invite link
        sent to your email, using that same email to create your account.
      </div>

      <a
        href={LUCIDLINK_DOWNLOAD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 mt-3.5 p-[13px] rounded-[9px] bg-gray-900 text-white text-sm font-bold"
      >
        <Image
          src={LUCIDLINK_LOGO_SRC}
          alt=""
          width={22}
          height={22}
          className="flex-none rounded-[5px]"
        />
        Download LucidLink Desktop App
        <DownloadIcon />
      </a>
      <div className="text-center text-xs text-gray-500 mt-1.5">Mac or Windows</div>

      {/* Same header bar and rows as the shot list cards. */}
      <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-[15px] py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-sm uppercase tracking-[1.5px] text-gray-900">
            How to upload
          </h3>
        </div>
        <ol className="divide-y divide-gray-100">
          <UploadStep n={1}>Open LucidLink and sign in with your invite email</UploadStep>
          <UploadStep n={2}>
            Click <strong className="text-gray-900">postgameproductions</strong>, then{" "}
            <strong className="text-gray-900">Connect</strong>
          </UploadStep>
          <UploadStep n={3}>
            Click <strong className="text-gray-900">Browse files</strong>
            <UploadStepHint>
              Finder opens. You&apos;ll only see one folder, and it&apos;s yours.
            </UploadStepHint>
          </UploadStep>
          <UploadStep n={4}>
            Drag each SD card onto your folder
            <UploadStepHint>One folder per card: Card 1, Card 2, Card 3…</UploadStepHint>
          </UploadStep>
          <UploadStep n={5}>
            Keep LucidLink open until it says{" "}
            <strong className="text-gray-900">&quot;Your files are up to date&quot;</strong>
            <UploadStepHint>Finder finishing the copy is NOT the end.</UploadStepHint>
          </UploadStep>
        </ol>
      </div>

      <AllUploaded />

      {browserUploadUrl && (
        <a
          href={browserUploadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-3.5 p-[11px] text-center rounded-[9px] border border-gray-200 text-[13px] font-bold text-gray-900"
        >
          Can&apos;t use LucidLink? Upload in the browser instead →
        </a>
      )}

      {/* Setup video overlay. It stays mounted so closing only pauses it. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="LucidLink setup video"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeVideo();
        }}
        className={`fixed inset-0 z-50 items-center justify-center p-5 bg-[rgba(7,7,10,0.86)] ${
          videoOpen ? "flex" : "hidden"
        }`}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={closeVideo}
          className="absolute top-3.5 right-4 w-10 h-10 rounded-full bg-white text-gray-900 text-xl font-bold leading-none"
        >
          ×
        </button>
        <video
          ref={videoRef}
          controls
          playsInline
          preload="none"
          poster={LUCIDLINK_SETUP_POSTER_URL}
          className="max-h-[88vh] max-w-full rounded-[14px] bg-black"
        >
          <source src={LUCIDLINK_SETUP_VIDEO_URL} type="video/mp4" />
        </video>
      </div>
    </section>
  );
}

export function FrameioUploadCard({
  projectName,
  locationFolder,
}: {
  // Empty values fall back to generic wording in the steps.
  projectName: string;
  locationFolder: string;
}) {
  return (
    <section
      aria-labelledby="ros-frameio-upload-title"
      className="bg-white border border-gray-200 rounded-xl px-[17px] py-[18px] mb-10"
    >
      <h2 id="ros-frameio-upload-title" className="text-xl font-bold text-gray-900">
        Upload Your Footage
      </h2>
      <p className="text-sm text-gray-500 mt-[5px]">
        Upload before you leave. Everything goes to Postgame&apos;s Frame.io project.
      </p>

      <div className="mt-4 rounded-[10px] border border-[#f3cdbd] bg-[#fbeee8] px-[13px] py-[11px] text-[13.5px] leading-[1.45]">
        <b className="text-[#D73F09]">Before the shoot:</b> accept the Frame.io invite sent to
        your email, and sign in with that same email.
      </div>

      <a
        href={FRAMEIO_DRIVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 mt-3.5 p-[13px] rounded-[9px] bg-gray-900 text-white text-sm font-bold"
      >
        <Image
          src={FRAMEIO_ICON_SRC}
          alt=""
          width={22}
          height={22}
          className="flex-none rounded-[5px]"
        />
        Download Frame.io Drive Desktop App
        <DownloadIcon />
      </a>
      <div className="text-center text-xs text-gray-500 mt-1.5">
        Mac or Windows. Faster than uploading in the browser.
      </div>

      {/* Same header bar and rows as the shot list cards. */}
      <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-[15px] py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-sm uppercase tracking-[1.5px] text-gray-900">
            How to upload
          </h3>
        </div>
        <ol className="divide-y divide-gray-100">
          <UploadStep n={1}>
            Open Frame.io Drive and click <strong className="text-gray-900">Sign In</strong>
            <UploadStepHint>Use the email your invite was sent to.</UploadStepHint>
          </UploadStep>
          <UploadStep n={2}>
            Under <strong className="text-gray-900">Workspaces</strong>, click{" "}
            {projectName ? (
              <strong className="text-gray-900 break-words">{projectName}</strong>
            ) : (
              "the project"
            )}
          </UploadStep>
          <UploadStep n={3}>
            {locationFolder ? (
              <>
                Open <strong className="text-gray-900 break-words">{locationFolder}</strong>,
                then your own folder
              </>
            ) : (
              "Open your location folder, then your own folder"
            )}
            <UploadStepHint>Your folder has your name on it.</UploadStepHint>
          </UploadStep>
          <UploadStep n={4}>
            Click <strong className="text-gray-900">Upload</strong> (bottom right) and pick your
            SD card folders
            <UploadStepHint>One folder per card: Card 1, Card 2, Card 3…</UploadStepHint>
          </UploadStep>
          <UploadStep n={5}>
            Keep Frame.io Drive open until <strong className="text-gray-900">Transfers</strong>{" "}
            shows the upload complete
            <UploadStepHint>Closing the app early stops the upload.</UploadStepHint>
          </UploadStep>
        </ol>
      </div>

      <AllUploaded />

      <a
        href={FRAMEIO_WEB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-3.5 p-[11px] text-center rounded-[9px] border border-gray-200 text-[13px] font-bold text-gray-900"
      >
        Can&apos;t install the app? Upload in the browser at frame.io →
      </a>
    </section>
  );
}
