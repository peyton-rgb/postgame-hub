"use client";

import { useState } from "react";
import BrandCampaignPicker from "./BrandCampaignPicker";

type Brand = { id: string; name: string };
type Campaign = { id: string; name: string; brand_id: string };
type Step = "landing" | "form" | "uploading" | "success";
type BrandCampaign = { brandId: string | null; campaignId: string | null };

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB — mirrors the API route.

/** Simple MB formatter for file-size display. */
function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Upload a File to a signed Supabase storage URL with progress events.
 * fetch() doesn't expose upload progress events; XMLHttpRequest does.
 * The Supabase signed upload URL accepts a PUT with the upload token in
 * the Authorization header and the file bytes as the request body.
 */
function xhrUploadWithProgress(
  signedUrl: string,
  token: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}

/**
 * BTS Submission page — public mobile-first four-step flow:
 *   1. Landing — Postgame logo + "New Submission" button.
 *   2. Form    — file picker, athlete name, brand/campaign, hold toggle, submitter name.
 *   3. Uploading — progress bar while the file PUTs to Supabase.
 *   4. Success — confirmation, submission summary, "Submit Another" button.
 *
 * Errors at any step roll the user back to the form state with their data
 * preserved and a red banner explaining what went wrong.
 */
export default function BtsSubmissionClient({
  brands,
  campaigns,
}: {
  brands: Brand[];
  campaigns: Campaign[];
}) {
  // ── State ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("landing");
  const [file, setFile] = useState<File | null>(null);
  const [athleteName, setAthleteName] = useState("");
  const [brandCampaign, setBrandCampaign] = useState<BrandCampaign>({
    brandId: null,
    campaignId: null,
  });
  const [holdPosting, setHoldPosting] = useState<boolean | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    athleteName: string;
    brandName: string;
    campaignName: string;
    filename: string;
  } | null>(null);

  // All fields present → submit enabled.
  const canSubmit =
    !!file &&
    !!athleteName.trim() &&
    !!brandCampaign.brandId &&
    !!brandCampaign.campaignId &&
    holdPosting !== null;

  // Reset wipes every field and returns to landing.
  const reset = () => {
    setFile(null);
    setAthleteName("");
    setBrandCampaign({ brandId: null, campaignId: null });
    setHoldPosting(null);
    setSubmitterName("");
    setUploadPct(0);
    setErrorMsg(null);
    setResult(null);
    setStep("landing");
  };

  // File-pick gate: reject non-videos and anything over the size cap.
  const onFilePick = (f: File | null) => {
    setErrorMsg(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setErrorMsg("Please choose a video file.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setErrorMsg(`That file is ${formatMB(f.size)} — the limit is 500 MB.`);
      return;
    }
    setFile(f);
  };

  // The full submission flow. Any failure rolls back to "form" with the
  // errorMsg set and the user's form data intact.
  const handleSubmit = async () => {
    if (
      !canSubmit ||
      !file ||
      holdPosting === null ||
      !brandCampaign.brandId ||
      !brandCampaign.campaignId
    ) {
      return;
    }
    setErrorMsg(null);
    setUploadPct(0);
    setStep("uploading");
    try {
      // 1. prepare-upload: server returns a signed upload URL + path.
      const prepRes = await fetch("/api/bts/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          brandId: brandCampaign.brandId,
          campaignId: brandCampaign.campaignId,
          athleteName: athleteName.trim(),
          holdPosting,
          submitterName: submitterName.trim() || null,
        }),
      });
      if (!prepRes.ok) {
        const err = await prepRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not prepare upload.");
      }
      const { uploadUrl, storagePath, token } = await prepRes.json();

      // 2. PUT the file bytes directly to Supabase with progress events.
      await xhrUploadWithProgress(uploadUrl, token, file, setUploadPct);

      // 3. submit: server writes bts_submissions + mirrors to the sheet.
      const subRes = await fetch("/api/bts/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          brandId: brandCampaign.brandId,
          campaignId: brandCampaign.campaignId,
          athleteName: athleteName.trim(),
          holdPosting,
          submitterName: submitterName.trim() || null,
          fileSize: file.size,
          mimeType: file.type,
          originalFilename: file.name,
        }),
      });
      if (!subRes.ok) {
        const err = await subRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Could not save submission.");
      }

      // 4. Success — compose the summary and swap to the success view.
      const brandName = brands.find((b) => b.id === brandCampaign.brandId)?.name ?? "";
      const campaignName = campaigns.find((c) => c.id === brandCampaign.campaignId)?.name ?? "";
      setResult({
        athleteName: athleteName.trim(),
        brandName,
        campaignName,
        filename: file.name,
      });
      setStep("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStep("form");
    }
  };

  // Shared input classes mirror the BrandList form convention.
  const inputCls =
    "w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:border-[#D73F09] outline-none";
  const labelCls =
    "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2";

  // ── Views ──────────────────────────────────────────────────────────

  // Landing view — logo, tagline, call to action.
  if (step === "landing") {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center text-center">
          <img
            src="/postgame-logo-white.png"
            alt="Postgame"
            className="h-10 object-contain mb-10"
          />
          <h1 className="d text-5xl md:text-6xl mb-3 leading-none">
            BTS Video
            <br />
            Submission
          </h1>
          <p className="text-sm text-gray-400 mb-10">
            Upload behind-the-scenes content for your campaign.
          </p>
          <button
            onClick={() => setStep("form")}
            className="w-full px-4 py-4 bg-[#D73F09] rounded-lg text-white font-bold text-sm uppercase tracking-wider hover:bg-[#B33407] min-h-[56px]"
          >
            New Submission
          </button>
        </div>
      </main>
    );
  }

  // Form view — file picker + athlete / brand / campaign / toggle / submitter.
  if (step === "form") {
    return (
      <main className="flex-1 px-6 py-10">
        <div className="w-full max-w-md mx-auto">
          <h1 className="d text-3xl mb-8 leading-none">New BTS Submission</h1>

          {errorMsg && (
            <div className="mb-5 px-4 py-3 border border-red-500/40 bg-red-500/10 rounded-lg text-sm text-red-300">
              {errorMsg}
            </div>
          )}

          {/* File picker — big tappable label wraps a hidden input. */}
          <div className="mb-6">
            <label className={labelCls}>Video File</label>
            {!file ? (
              <label
                htmlFor="video-input"
                className="block w-full border-2 border-dashed border-gray-700 hover:border-[#D73F09] rounded-xl px-6 py-8 text-center cursor-pointer transition-colors"
              >
                <div className="text-sm font-bold text-white mb-1">Choose Video</div>
                <div className="text-xs text-gray-500">
                  Tap to pick from phone · 500 MB max
                </div>
              </label>
            ) : (
              <div className="border border-gray-700 bg-[#111] rounded-xl px-4 py-4">
                <div className="text-sm font-bold text-white truncate mb-1">
                  {file.name}
                </div>
                <div className="text-xs text-gray-400 mb-3">{formatMB(file.size)}</div>
                <label
                  htmlFor="video-input"
                  className="text-xs text-[#D73F09] font-bold uppercase tracking-wider cursor-pointer hover:underline"
                >
                  Choose different video
                </label>
              </div>
            )}
            <input
              id="video-input"
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFilePick(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Remaining fields only appear once a file is chosen — keeps the
              first tap obvious and doesn't overwhelm on mobile. */}
          {file && (
            <>
              <div className="mb-4">
                <label className={labelCls}>Athlete Name</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Jordan Chiles"
                  value={athleteName}
                  onChange={(e) => setAthleteName(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <BrandCampaignPicker
                  brands={brands}
                  campaigns={campaigns}
                  value={brandCampaign}
                  onChange={setBrandCampaign}
                />
              </div>

              <div className="mb-4">
                <label className={labelCls}>Hold Posting?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "YES", val: true },
                    { label: "NO", val: false },
                  ].map(({ label, val }) => {
                    const active = holdPosting === val;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setHoldPosting(val)}
                        className={
                          active
                            ? "px-4 py-3 rounded-lg border-2 border-[#D73F09] bg-[#D73F09]/15 text-[#D73F09] font-bold text-sm min-h-[48px]"
                            : "px-4 py-3 rounded-lg border border-gray-700 bg-black text-gray-300 font-bold text-sm min-h-[48px] hover:border-gray-500"
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <label className={labelCls}>
                  Submitter Name <span className="text-gray-600 normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Your name"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full px-4 py-4 bg-[#D73F09] rounded-lg text-white font-bold text-sm uppercase tracking-wider hover:bg-[#B33407] disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px]"
              >
                Submit
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  // Uploading view — progress bar + blocking message.
  if (step === "uploading") {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <h2 className="d text-4xl mb-6 leading-none">Uploading…</h2>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-[#D73F09] transition-all duration-150"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          <div className="text-sm text-gray-400 font-mono">{uploadPct}%</div>
          <p className="mt-6 text-xs text-gray-500 uppercase tracking-wider">
            Hold tight — don&apos;t close this tab.
          </p>
        </div>
      </main>
    );
  }

  // Success view — confirmation + summary + submit-another.
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 w-20 h-20 rounded-full bg-[#D73F09]/15 border-2 border-[#D73F09] flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D73F09" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="d text-5xl mb-3 leading-none">Submitted!</h2>
        <p className="text-sm text-gray-400 mb-8">
          Your video is in. The Postgame team will take it from here.
        </p>

        {result && (
          <dl className="text-left bg-[#111] border border-gray-700 rounded-xl px-5 py-4 mb-8 text-sm space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Athlete</dt>
              <dd className="text-white font-bold truncate">{result.athleteName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Brand</dt>
              <dd className="text-white font-bold truncate">{result.brandName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Campaign</dt>
              <dd className="text-white font-bold truncate">{result.campaignName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">File</dt>
              <dd className="text-white font-bold truncate">{result.filename}</dd>
            </div>
          </dl>
        )}

        <button
          onClick={reset}
          className="w-full px-4 py-4 bg-[#D73F09] rounded-lg text-white font-bold text-sm uppercase tracking-wider hover:bg-[#B33407] min-h-[56px]"
        >
          Submit Another
        </button>
      </div>
    </main>
  );
}
