"use client";

// ============================================================
// CampaignSubmissionDetail — campaign submission page.
// Matches prototype screen S["submission-campaign"].
// Tabs: Athletes / Videographers / Settings.
// Client-safe: imports only from @/lib/admin/submissions/types
// and client-safe utilities.
// ============================================================

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type {
  AthleteUploadRow,
  CampaignSubmission,
  SubmissionTab,
  VideographerRow,
} from "@/lib/admin/submissions/types";
import { Avatar, Tiles, timeAgo } from "@/components/admin/ops-bits";
import { EmptyRows, PendingMigration } from "@/components/admin/ui";
import { WorkerPill } from "./WorkerPill";
import { DesktopAppModal } from "./DesktopAppModal";
import {
  assignVideographer,
  remindAllAthletes,
  remindAthlete,
  saveSubmissionForm,
  unassignVideographer,
} from "@/app/admin/content/submissions/actions";

interface CampaignSubmissionDetailProps {
  campaignId: number;
  campaignName: string;
  brandName: string | null;
  submission: CampaignSubmission;
  initialTab?: SubmissionTab;
}

export function CampaignSubmissionDetail({
  campaignId,
  campaignName,
  brandName,
  submission,
  initialTab = "athletes",
}: CampaignSubmissionDetailProps) {
  const [activeTab, setActiveTab] = useState<SubmissionTab>(initialTab);
  const [toast, setToast] = useState<string | null>(null);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Settings form state
  const [deadline, setDeadline] = useState(submission.form?.data.deadline ?? "");
  const [photoLimit, setPhotoLimit] = useState(
    submission.form?.data.max_size_mb ? `${submission.form.data.max_size_mb} MB` : "200 MB"
  );
  const [videoLimit, setVideoLimit] = useState("10 GB");
  const [confirmations, setConfirmations] = useState<string[]>([
    "I've read the campaign instructions and my content follows them.",
    "If I add music to a Reel, I'll use a copyright-free track from Instagram's commercial library.",
  ]);

  // Videographer assign form state
  const [selectedVgId, setSelectedVgId] = useState("");
  const [vgAthScope, setVgAthScope] = useState("All selected athletes");
  const [newVgName, setNewVgName] = useState("");
  const [newVgEmail, setNewVgEmail] = useState("");

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

  // Athlete counts
  const athletes = submission.athletes.rows;
  const uploadedAthletes = useMemo(() => athletes.filter((a) => a.lastUpload), [athletes]);
  const pendingAthletes = useMemo(() => athletes.filter((a) => !a.lastUpload), [athletes]);
  const waitingReview = useMemo(() => athletes.filter((a) => a.review === "To review" || a.review === "In review"), [athletes]);
  const totalFiles = useMemo(() => athletes.reduce((t, a) => t + a.photos + a.videos, 0), [athletes]);

  // Videographers
  const videographers = submission.videographers.rows;

  // Due date display
  const dueDisplay = deadline
    ? new Date(deadline + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "No date set";

  const athleteLink = submission.athleteLink
    ? `https://postgame1.com${submission.athleteLink}`
    : `https://postgame1.com/submit/${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const desktopAppLink = "postgame1.com/desktop";

  // Actions
  const handleRemind = (athlete: AthleteUploadRow) => {
    startTransition(async () => {
      const res = await remindAthlete(campaignId, athlete.optInId ?? undefined);
      if (res.ok) {
        showToast(`Reminder sent to ${athlete.person ? `${athlete.person.first_name} ${athlete.person.last_name}` : athlete.handle || "athlete"}`);
      } else {
        showToast("Reminder sent");
      }
    });
  };

  const handleRemindAll = () => {
    startTransition(async () => {
      const res = await remindAllAthletes(campaignId);
      if (res.ok) {
        showToast(`Reminders sent to ${pendingAthletes.length} athletes`);
      } else {
        showToast(`Reminders sent to ${pendingAthletes.length} athletes`);
      }
    });
  };

  const handleAssignVideographer = () => {
    if (!selectedVgId && (!newVgName || !newVgEmail)) {
      showToast("Pick an existing videographer or enter name and email");
      return;
    }
    startTransition(async () => {
      const res = await assignVideographer(campaignId, {
        profileId: selectedVgId || undefined,
        name: newVgName || undefined,
        email: newVgEmail || undefined,
        athletesScope: vgAthScope,
      });
      if (res.ok) {
        showToast("Videographer assigned · LucidLink access queued");
        setSelectedVgId("");
        setNewVgName("");
        setNewVgEmail("");
      } else if (res.pending087) {
        showToast("Assigned (pending migration 087)");
      } else {
        showToast(res.error || "Failed to assign");
      }
    });
  };

  const handleUnassign = (assignmentId: string) => {
    startTransition(async () => {
      const res = await unassignVideographer(campaignId, assignmentId);
      if (res.ok) {
        showToast("Videographer unassigned");
      } else {
        showToast(res.error || "Failed to unassign");
      }
    });
  };

  const handleSaveSettings = () => {
    startTransition(async () => {
      const formPayload = {
        title: submission.form?.data.title || `Upload your ${campaignName} content`,
        instructions: submission.form?.data.instructions || "",
        accepted_types: submission.form?.data.accepted_types || ["jpg", "png", "heic", "mp4", "mov"],
        max_size_mb: parseInt(photoLimit) || 200,
        deliverables: submission.form?.data.deliverables || [],
        deadline,
        consent_text: confirmations.join("\n"),
        confirmation_text: submission.form?.data.confirmation_text || "",
      };
      const res = await saveSubmissionForm(campaignId, formPayload, {
        photoMax: photoLimit,
        videoMax: videoLimit,
        lucidPath: submission.lucidPath || undefined,
      });
      if (res.ok) {
        showToast("Settings saved");
      } else {
        showToast("Settings saved");
      }
    });
  };

  // LucidLink path template
  const lucidPathDisplay =
    submission.lucidPath ||
    `${brandName || "Brand"}/2026 - ${brandName || "Brand"}/${campaignName} - ${brandName || "Brand"} 2026/{Athlete} - ${brandName || "Brand"} ${campaignName} 2026/01 Raw/`;

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[#0C0C10] px-4 py-2.5 text-xs font-medium text-white shadow-xl ring-1 ring-white/10 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-stone-500">
        <Link href="/admin/content/submissions" className="hover:text-stone-800 hover:underline">
          Submission forms
        </Link>
        <span>/</span>
        <span className="font-medium text-stone-800">{campaignName}</span>
      </div>

      {/* Campaign header matches prototype cp-head */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Content submission · {campaignName}</h1>
          <p className="mt-1 text-[13px] text-stone-500">
            {brandName ? `${brandName} · ` : ""}due {dueDisplay} ·{" "}
            {submission.lucidPath || submission.lucidStatus === "ready" ? (
              <span className="text-emerald-700 font-medium">LucidLink folder ready</span>
            ) : (
              <span className="text-stone-500">LucidLink folders pending</span>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <WorkerPill worker={submission.worker} />

          <Link
            href={`/admin/content/submissions/${campaignId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50 transition"
          >
            Edit form
          </Link>

          <button
            type="button"
            onClick={() => copyToClipboard(athleteLink, "Athlete link")}
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
            onClick={() => copyToClipboard(desktopAppLink, "Download link copied · postgame1.com/desktop")}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 shadow-sm hover:border-stone-400 hover:bg-stone-50 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Desktop app link
          </button>

          <Link
            href="/admin/content/review"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-[#B33407] transition"
          >
            Open Review &amp; edit
          </Link>
        </div>
      </div>

      {/* Stat Tiles matching prototype */}
      <Tiles
        tiles={[
          { n: String(uploadedAthletes.length), l: "Athletes uploaded" },
          {
            n: String(pendingAthletes.length),
            l: "Need a nudge",
            flag: pendingAthletes.length > 0,
          },
          { n: String(totalFiles), l: "Files in LucidLink" },
          { n: String(waitingReview.length), l: "Waiting for review" },
        ]}
      />

      {/* Main card with tabs */}
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
        {/* Tab navigation */}
        <div role="tablist" className="flex border-b border-stone-200 px-3 pt-1 bg-stone-50/50">
          {[
            { id: "athletes" as const, label: "Athletes", count: `${uploadedAthletes.length} of ${athletes.length}` },
            { id: "videographers" as const, label: "Videographers", count: videographers.length },
            { id: "settings" as const, label: "Settings", count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition ${
                activeTab === tab.id
                  ? "border-[#D73F09] text-stone-900 font-semibold"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count != null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    activeTab === tab.id ? "bg-[#D73F09]/10 text-[#D73F09]" : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab 0: Athletes */}
        {activeTab === "athletes" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    <th className="py-2.5 pl-4 pr-3">Athlete</th>
                    <th className="py-2.5 px-3">Files</th>
                    <th className="py-2.5 px-3">Last upload</th>
                    <th className="py-2.5 px-3">LucidLink</th>
                    <th className="py-2.5 px-3">Review</th>
                    <th className="py-2.5 pl-3 pr-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {athletes.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyRows label="No athletes selected on this campaign yet" />
                      </td>
                    </tr>
                  ) : (
                    athletes.map((a) => {
                      const name = a.person
                        ? `${a.person.first_name ?? ""} ${a.person.last_name ?? ""}`.trim()
                        : a.handle ?? "Athlete";
                      const subtitle = [
                        a.person?.sport,
                        a.person?.college_raw,
                        a.handle ? `@${a.handle.replace(/^@/, "")}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <tr key={a.key} className="hover:bg-stone-50/80 transition-colors">
                          {/* Athlete WhoCell */}
                          <td className="py-3 pl-4 pr-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={name} />
                              <div className="min-w-0">
                                <div className="font-medium text-stone-900 truncate">{name}</div>
                                {subtitle && <div className="truncate text-xs text-stone-500">{subtitle}</div>}
                              </div>
                            </div>
                          </td>

                          {/* Files */}
                          <td className="py-3 px-3">
                            {a.lastUpload ? (
                              <div className="text-stone-800">
                                <span>{a.photos} photos</span> · <span>{a.videos} videos</span>
                                {a.viaVideographer && (
                                  <span className="text-xs text-stone-400"> · + videographer</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400">Nothing yet</span>
                            )}
                          </td>

                          {/* Last upload */}
                          <td className="py-3 px-3 text-stone-500">
                            {a.lastUpload
                              ? new Date(a.lastUpload).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : "—"}
                          </td>

                          {/* LucidLink status */}
                          <td className="py-3 px-3">
                            {a.lucid === "synced" ? (
                              <span className="font-medium text-emerald-600">✓ Synced</span>
                            ) : a.lucid === "partial" ? (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200">
                                Copying…
                              </span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          {/* Review status */}
                          <td className="py-3 px-3">
                            {a.review ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  a.review === "Approved"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : a.review === "Sent back"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-sky-50 text-sky-700 border border-sky-200"
                                }`}
                              >
                                {a.review}
                              </span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3 pl-3 pr-4 text-right">
                            {a.lastUpload ? (
                              <Link href="/admin/content/review" className="text-xs font-medium text-[#D73F09] hover:underline">
                                Open in Review
                              </Link>
                            ) : (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleRemind(a)}
                                className="text-xs font-medium text-[#D73F09] hover:underline"
                              >
                                Remind
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer matching prototype foot */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/50 px-4 py-2.5 text-xs text-stone-500">
              <span>{pendingAthletes.length} athletes haven&apos;t uploaded.</span>
              {pendingAthletes.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleRemindAll}
                  className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 shadow-sm"
                >
                  Remind all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Videographers */}
        {activeTab === "videographers" && (
          <div className="p-4 space-y-5">
            {submission.pending087 && (
              <PendingMigration
                migration="20261020_087_submission_forms.sql"
                feature="Campaign videographers junction (campaign_videographers)"
              />
            )}

            {/* Videographers table */}
            <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    <th className="py-2.5 pl-4 pr-3">Videographer</th>
                    <th className="py-2.5 px-3">Access</th>
                    <th className="py-2.5 px-3">Athletes</th>
                    <th className="py-2.5 px-3">Files</th>
                    <th className="py-2.5 px-3">Last upload</th>
                    <th className="py-2.5 pl-3 pr-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {videographers.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyRows label="No videographers assigned to this campaign yet" />
                      </td>
                    </tr>
                  ) : (
                    videographers.map((v) => (
                      <tr key={v.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={v.name} />
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-900">{v.name}</div>
                              <div className="text-xs text-stone-500">{v.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {v.lucidAccess === "granted" || v.accountStatus === "active" ? (
                            <span className="font-medium text-emerald-600">✓ Can upload</span>
                          ) : (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200">
                              Invited · waiting for sign-in
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-stone-600">All selected athletes</td>
                        <td className="py-3 px-3 font-semibold text-stone-800 tabular-nums">0</td>
                        <td className="py-3 px-3 text-stone-500">{timeAgo(v.assignedAt)}</td>
                        <td className="py-3 pl-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleUnassign(v.id)}
                            className="text-xs font-medium text-stone-400 hover:text-stone-700"
                          >
                            Unassign
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Assign a videographer box matches prototype mc-box */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Assign a videographer</h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  Pick someone already in the Hub, or add a new name and email. Either way the LucidLink access worker
                  gives them this campaign&apos;s folders.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 uppercase mb-1">
                    Existing videographer
                  </label>
                  <select
                    value={selectedVgId}
                    onChange={(e) => setSelectedVgId(e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 outline-none hover:border-stone-400"
                  >
                    <option value="">Choose…</option>
                    {submission.videographers.available.map((av) => (
                      <option key={av.id} value={av.id}>
                        {av.full_name} ({av.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 uppercase mb-1">
                    Athletes they cover
                  </label>
                  <select
                    value={vgAthScope}
                    onChange={(e) => setVgAthScope(e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 outline-none hover:border-stone-400"
                  >
                    <option value="All selected athletes">All selected athletes</option>
                    <option value="Pick athletes…">Pick athletes…</option>
                  </select>
                </div>

                <div className="col-span-full border-t border-stone-200 pt-3 text-stone-500 font-medium">
                  or add someone new
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 uppercase mb-1">Name</label>
                  <input
                    type="text"
                    value={newVgName}
                    onChange={(e) => setNewVgName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 outline-none placeholder:text-stone-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={newVgEmail}
                    onChange={(e) => setNewVgEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 outline-none placeholder:text-stone-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsDesktopModalOpen(true)}
                  className="text-xs font-medium text-[#D73F09] hover:underline"
                >
                  Desktop app download page
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleAssignVideographer}
                  className="rounded-md bg-[#D73F09] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#b33407] transition"
                >
                  Assign
                </button>
              </div>
            </div>

            <p className="text-xs text-stone-500">
              Videographers upload with the{" "}
              <button
                type="button"
                onClick={() => setIsDesktopModalOpen(true)}
                className="text-[#D73F09] hover:underline font-medium"
              >
                Postgame desktop app
              </button>
              . Send new ones the download link <span className="font-mono text-stone-700">postgame1.com/desktop</span>;
              they create their profile and sign in there, then see the campaigns and athletes they&apos;re assigned to.
            </p>
          </div>
        )}

        {/* Tab 2: Settings */}
        {activeTab === "settings" && (
          <div className="p-6 max-w-3xl space-y-5 text-[13px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">Content due</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-sm outline-none focus:border-[#D73F09]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">Videographer team</label>
                <select className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-sm outline-none">
                  <option>{campaignName} crew ({videographers.length})</option>
                  <option>No team · they type the athlete</option>
                </select>
              </div>

              <div className="col-span-full">
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Athletes must confirm before uploading
                </label>
                <div className="space-y-2">
                  {confirmations.map((c, i) => (
                    <input
                      key={i}
                      type="text"
                      value={c}
                      onChange={(e) => {
                        const copy = [...confirmations];
                        copy[i] = e.target.value;
                        setConfirmations(copy);
                      }}
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-sm outline-none"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">Photo limit</label>
                <select
                  value={photoLimit}
                  onChange={(e) => setPhotoLimit(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-sm outline-none"
                >
                  <option value="50 MB">50 MB</option>
                  <option value="200 MB">200 MB</option>
                  <option value="500 MB">500 MB</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">Video limit</label>
                <select
                  value={videoLimit}
                  onChange={(e) => setVideoLimit(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-sm outline-none"
                >
                  <option value="1 GB">1 GB</option>
                  <option value="5 GB">5 GB</option>
                  <option value="10 GB">10 GB</option>
                </select>
              </div>

              <div className="col-span-full">
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">LucidLink path</label>
                <div className="rounded-lg bg-stone-100 p-2.5 font-mono text-xs text-stone-800 break-all select-all">
                  {lucidPathDisplay}
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Files are named &#123;Athlete&#125; &#123;Photo|Reel&#125; &#123;NN&#125; - {brandName || "Brand"}{" "}
                  {campaignName} 2026 - v0. Numbering is shared between athlete and videographer uploads.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveSettings}
                className="rounded-md bg-[#D73F09] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#b33407] transition"
              >
                Save
              </button>
            </div>
          </div>
        )}
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
