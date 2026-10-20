"use client";

// ============================================================
// SubmissionFormEditor — content submission form editor.
// Matches prototype screen S["submission-edit"].
// Features split layout with live App / Mobile web / Desktop web preview.
// Client-safe: imports only from @/lib/admin/submissions/types
// and client-safe form helpers.
// ============================================================

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type {
  Deliverable,
  FormRow,
  SubmissionFormData,
  SubmissionPreviewView,
} from "@/lib/admin/submissions/types";
import {
  acceptedTypesLabel,
  consentLines,
  EMPTY_FORM,
  parseAcceptedTypes,
  sizeLabel,
} from "@/lib/admin/submissions/form";
import { PendingMigration } from "@/components/admin/ui";
import { SubmissionPreview } from "./SubmissionPreview";
import { DesktopAppModal } from "./DesktopAppModal";
import { saveSubmissionForm } from "@/app/admin/content/submissions/actions";

interface SubmissionFormEditorProps {
  campaignId: number;
  campaignName: string;
  brandName: string | null;
  form: FormRow | null;
  pending087: boolean;
  athleteLink: string | null;
  lucidPath: string | null;
}

export function SubmissionFormEditor({
  campaignId,
  campaignName,
  brandName,
  form,
  pending087,
  athleteLink,
  lucidPath,
}: SubmissionFormEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<SubmissionPreviewView>("phone");
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);

  // Form Fields
  const [headline, setHeadline] = useState(
    form?.data.title || `Upload your ${campaignName} content`
  );
  const [intro, setIntro] = useState(
    form?.data.instructions ||
      `Send us everything you shot for ${campaignName}. We review within 3 days and tell you what's approved before you post.`
  );
  const [items, setItems] = useState<Deliverable[]>(
    form?.data.deliverables && form.data.deliverables.length > 0
      ? form.data.deliverables
      : [
          { kind: "video", count: 1, note: "Reel, 15–30s, vertical" },
          { kind: "photo", count: 3, note: "Feed photos, product visible" },
        ]
  );
  const [confirmations, setConfirmations] = useState<string[]>(
    consentLines(form?.data || EMPTY_FORM)
  );
  const [due, setDue] = useState(form?.data.deadline || "");
  const [photoLimit, setPhotoLimit] = useState(
    sizeLabel(form?.data.max_size_mb ?? null) || "200 MB"
  );
  const [videoLimit, setVideoLimit] = useState("10 GB");
  const [types, setTypes] = useState(
    acceptedTypesLabel(form?.data.accepted_types || []) || "JPG, PNG, HEIC · MP4, MOV"
  );
  const [done, setDone] = useState(
    form?.data.confirmation_text ||
      "Got it. We'll review your content within 3 days and message you in the app when it's approved."
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast(`Copied: ${text}`);
    }
  };

  const athleteFullUrl = athleteLink
    ? `https://postgame1.com${athleteLink}`
    : `https://postgame1.com/submit/${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  // Add deliverable item
  const addItem = () => {
    setItems([...items, { kind: "photo", count: 1, note: "" }]);
  };

  // Update deliverable item
  const updateItem = (index: number, key: keyof Deliverable, val: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: val };
    setItems(updated);
  };

  // Remove deliverable item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Add confirmation line
  const addConfirmation = () => {
    setConfirmations([...confirmations, ""]);
  };

  // Update confirmation line
  const updateConfirmation = (index: number, val: string) => {
    const updated = [...confirmations];
    updated[index] = val;
    setConfirmations(updated);
  };

  // Remove confirmation line
  const removeConfirmation = (index: number) => {
    setConfirmations(confirmations.filter((_, i) => i !== index));
  };

  // Save handler
  const handleSave = () => {
    startTransition(async () => {
      const payload: SubmissionFormData = {
        title: headline,
        instructions: intro,
        accepted_types: parseAcceptedTypes(types),
        max_size_mb: parseInt(photoLimit) || 200,
        deliverables: items,
        deadline: due,
        consent_text: confirmations.filter((c) => c.trim().length > 0).join("\n"),
        confirmation_text: done,
      };

      const res = await saveSubmissionForm(campaignId, payload, {
        photoMax: photoLimit,
        videoMax: videoLimit,
        lucidPath: lucidPath || undefined,
      });

      if (res.ok) {
        showToast("Submission form saved · app and web");
      } else if (res.pending087) {
        showToast("Saved base form (087 columns pending)");
      } else {
        showToast(res.error || "Failed to save");
      }
    });
  };

  const lucidPathDisplay =
    lucidPath ||
    `${brandName || "Brand"}/2026 - ${brandName || "Brand"}/${campaignName} - ${brandName || "Brand"} 2026/{Athlete} - ${brandName || "Brand"} ${campaignName} 2026/01 Raw/Photos|Videos/`;

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[#0C0C10] px-4 py-2.5 text-xs font-medium text-white shadow-xl ring-1 ring-white/10 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Breadcrumb matches prototype */}
      <div className="flex items-center gap-1.5 text-xs text-stone-500">
        <Link href="/admin/content/submissions" className="hover:text-stone-800 hover:underline">
          Submission forms
        </Link>
        <span>/</span>
        <Link href={`/admin/content/submissions/${campaignId}`} className="hover:text-stone-800 hover:underline">
          {campaignName}
        </Link>
        <span>/</span>
        <span className="font-medium text-stone-800">Edit form</span>
      </div>

      {/* Header matching prototype cp-head */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900">Content submission form</h1>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              Live
            </span>
          </div>
          <p className="mt-1 text-[13px] text-stone-500">
            {campaignName} {brandName ? `· ${brandName}` : ""}. One form: the athlete link opens it as a web page, and app
            users see it in the app.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/content/submissions/${campaignId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50 transition"
          >
            ← Back
          </Link>

          <button
            type="button"
            onClick={() => copyToClipboard(athleteFullUrl, "Athlete link")}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Athlete link
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#D73F09] px-4 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-[#B33407] transition"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {pending087 && (
        <PendingMigration
          migration="20261020_087_submission_forms.sql"
          feature="Form field additions (title, instructions, deliverables, deadline, consent, limits)"
        />
      )}

      {/* Split layout: Editor on Left, Live Preview on Right */}
      <div className={`grid grid-cols-1 gap-6 items-start ${view === "desktop" ? "xl:grid-cols-12" : "lg:grid-cols-12"}`}>
        {/* Left Column: Form Editor */}
        <div className={`space-y-4 ${view === "desktop" ? "xl:col-span-6" : "lg:col-span-7"}`}>
          {/* Section 1: Content submission · athlete form */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm space-y-4 text-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#D73F09]">
              Content submission · athlete form
            </div>

            {/* 1. Headline */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 shadow-sm outline-none focus:border-[#D73F09]"
              />
            </div>

            {/* 2. Intro */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Intro</label>
              <textarea
                rows={2}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 shadow-sm outline-none focus:border-[#D73F09]"
              />
              <p className="mt-1 text-[11px] text-stone-400">
                One or two lines. The required posts from the opt-in page fill in the list below.
              </p>
            </div>

            {/* 3. What to upload */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">What to upload</label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={it.kind}
                      onChange={(e) => updateItem(i, "kind", e.target.value)}
                      className="w-24 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 shadow-sm outline-none"
                    >
                      <option value="video">Video</option>
                      <option value="photo">Photo</option>
                    </select>

                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={it.count}
                      onChange={(e) => updateItem(i, "count", parseInt(e.target.value) || 1)}
                      className="w-16 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 shadow-sm outline-none text-center"
                      placeholder="Qty"
                    />

                    <input
                      type="text"
                      value={it.note}
                      onChange={(e) => updateItem(i, "note", e.target.value)}
                      placeholder="What it should be (e.g. Reel, 15–30s, vertical)"
                      className="flex-1 min-w-0 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 shadow-sm outline-none placeholder:text-stone-400"
                    />

                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="flex h-7 w-7 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 text-sm"
                      title="Remove deliverable"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addItem}
                className="mt-2 text-xs font-semibold text-[#D73F09] hover:underline"
              >
                + Add item
              </button>
              <p className="mt-1 text-[11px] text-stone-400">
                Pulled from Required posts on the opt-in page. Edit if the upload ask differs from the posting ask.
              </p>
            </div>

            {/* 4. Athletes must confirm */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Athletes must confirm</label>
              <div className="space-y-2">
                {confirmations.map((ack, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-stone-400 font-mono text-[11px]">{i + 1}.</span>
                    <input
                      type="text"
                      value={ack}
                      onChange={(e) => updateConfirmation(i, e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 shadow-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeConfirmation(i)}
                      className="flex h-7 w-7 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 text-sm"
                      title="Remove confirmation"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addConfirmation}
                className="mt-2 text-xs font-semibold text-[#D73F09] hover:underline"
              >
                + Add a confirmation
              </button>
              <p className="mt-1 text-[11px] text-stone-400">
                Each one is a checkbox they tick before the Upload button turns on.
              </p>
            </div>

            {/* 5. Due */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Due</label>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-56 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-800 shadow-sm outline-none"
              />
              <p className="mt-1 text-[11px] text-stone-400">They can keep adding files until this date.</p>
            </div>

            {/* 6. Limits & file types */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Limits &amp; file types</label>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <span className="block text-[11px] text-stone-500 mb-0.5">Photo limit</span>
                  <select
                    value={photoLimit}
                    onChange={(e) => setPhotoLimit(e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 shadow-sm outline-none"
                  >
                    <option value="50 MB">50 MB</option>
                    <option value="200 MB">200 MB</option>
                    <option value="500 MB">500 MB</option>
                  </select>
                </div>

                <div>
                  <span className="block text-[11px] text-stone-500 mb-0.5">Video limit</span>
                  <select
                    value={videoLimit}
                    onChange={(e) => setVideoLimit(e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 shadow-sm outline-none"
                  >
                    <option value="1 GB">1 GB</option>
                    <option value="5 GB">5 GB</option>
                    <option value="10 GB">10 GB</option>
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-[11px] text-stone-500 mb-0.5">Accepted types</span>
                <input
                  type="text"
                  value={types}
                  onChange={(e) => setTypes(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 shadow-sm outline-none"
                />
              </div>
            </div>

            {/* 7. After they upload */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">After they upload</label>
              <textarea
                rows={2}
                value={done}
                onChange={(e) => setDone(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 shadow-sm outline-none"
              />
              <p className="mt-1 text-[11px] text-stone-400">
                Shown once the last file is in. Also sent as an app notification.
              </p>
            </div>

            {/* 8. Where files go */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Where files go</label>
              <div className="rounded-lg bg-stone-100 p-2.5 font-mono text-xs text-stone-800 break-all select-all">
                {lucidPathDisplay}
              </div>
              <p className="mt-1 text-[11px] text-stone-400">
                Set by the campaign. Files are renamed &#123;Athlete&#125; &#123;Photo|Reel&#125; &#123;NN&#125; - {brandName || "Brand"}{" "}
                {campaignName} 2026 - v0 on the way in.
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSave}
                className="rounded-md bg-[#D73F09] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#b33407] transition"
              >
                {isPending ? "Saving…" : "Save form"}
              </button>
            </div>
          </div>

          {/* Section 2: Videographers Card */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm space-y-3 text-xs">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Videographers</h2>
              <p className="mt-0.5 text-stone-500">
                No form. Videographers upload through the Postgame desktop app, where they create their profile, sign
                in, and see the campaigns and athletes they&apos;re assigned to.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <div>
                <span className="font-semibold text-stone-800">Download link</span>
                <div className="font-mono text-stone-600">postgame1.com/desktop</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard("postgame1.com/desktop", "Download link")}
                  className="text-xs font-medium text-[#D73F09] hover:underline"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => setIsDesktopModalOpen(true)}
                  className="text-xs font-medium text-[#D73F09] hover:underline"
                >
                  See the app
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className={`space-y-3 sticky top-4 ${view === "desktop" ? "xl:col-span-6" : "lg:col-span-5"}`}>
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <span className="font-bold text-stone-900 text-xs">Preview</span>

              {/* Segmented control */}
              <div className="flex rounded-md bg-stone-100 p-0.5 text-xs">
                {(["phone", "mweb", "desktop"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`rounded px-3 py-1 font-medium transition ${
                      view === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
                    }`}
                  >
                    {v === "phone" ? "App" : v === "mweb" ? "Mobile web" : "Desktop web"}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-2 text-[11px] text-stone-500">
              The athlete link opens the web page. Athletes with the app see the App version.
            </p>

            {/* Live frame container */}
            <div className="mt-4 flex justify-center bg-stone-100/70 rounded-xl overflow-hidden py-4">
              <SubmissionPreview
                view={view}
                headline={headline}
                intro={intro}
                items={items}
                confirmations={confirmations.filter((c) => c.trim().length > 0)}
                dueDate={due}
                photoLimit={photoLimit}
                videoLimit={videoLimit}
                acceptedTypes={types}
                brandName={brandName}
                campaignName={campaignName}
                publicUrl={athleteFullUrl}
              />
            </div>
          </div>
        </div>
      </div>

      <DesktopAppModal
        isOpen={isDesktopModalOpen}
        onClose={() => setIsDesktopModalOpen(false)}
        campaignName={campaignName}
        brandName={brandName ?? undefined}
      />
    </div>
  );
}
