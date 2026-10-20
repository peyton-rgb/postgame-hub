"use client";

// ============================================================
// DesktopAppModal — preview of Postgame Desktop for videographers.
// Matches prototype screen S["desktop-app"] and S["vg-onboarding"].
// ============================================================

import { useState } from "react";

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignName?: string;
  brandName?: string;
}

const DA_SCREENS = ["Sign in", "Campaigns", "Upload", "Queue", "Settings"] as const;

export function DesktopAppModal({ isOpen, onClose, campaignName = "Dropset Pro", brandName = "adidas" }: DesktopAppModalProps) {
  const [screen, setScreen] = useState<(typeof DA_SCREENS)[number]>("Upload");
  const [activeAth, setActiveAth] = useState("Taylor Nguyen");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-stone-800 bg-[#0C0C10] text-[#F8F8F9] shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-stone-800 bg-[#141419] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
              <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-[#D73F09]">POSTGAME</span>
              <span className="text-stone-400">Desktop for videographers</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md bg-[#1B1B21] p-0.5 text-xs">
              {DA_SCREENS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScreen(s)}
                  className={`rounded px-2.5 py-1 font-medium transition ${
                    screen === s ? "bg-[#D73F09] text-white" : "text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {s}
                  {s === "Queue" && <span className="ml-1 rounded-full bg-white/20 px-1 py-0.2 text-[10px]">2</span>}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="ml-2 rounded-md p-1.5 text-stone-400 hover:bg-[#1B1B21] hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* App body */}
        <div className="flex flex-1 overflow-hidden min-h-[500px]">
          {/* Sidebar */}
          {screen !== "Sign in" && (
            <aside className="flex w-52 flex-col justify-between border-r border-stone-800 bg-[#111115] p-3 text-xs">
              <div className="space-y-1">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Navigation
                </div>
                {(["Campaigns", "Upload", "Queue", "Settings"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScreen(s)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-medium transition ${
                      screen === s ? "bg-[#1B1B21] text-white" : "text-stone-400 hover:bg-[#16161c] hover:text-stone-200"
                    }`}
                  >
                    <span>{s}</span>
                    {s === "Queue" && (
                      <span className="rounded-full bg-[#D73F09] px-1.5 py-0.5 text-[10px] text-white">2</span>
                    )}
                  </button>
                ))}
              </div>

              {/* User bottom tile */}
              <div className="flex items-center gap-2.5 rounded-lg border border-stone-800 bg-[#16161c] p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#303036] font-bold text-white text-xs">
                  ML
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">Marcus Lee</div>
                  <div className="text-[11px] text-stone-400">Videographer</div>
                </div>
              </div>
            </aside>
          )}

          {/* Main content pane */}
          <main className="flex-1 overflow-y-auto p-8">
            {screen === "Sign in" && (
              <div className="mx-auto flex max-w-sm flex-col items-center justify-center pt-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D73F09] text-2xl font-black text-white">
                  P
                </div>
                <h2 className="text-xl font-bold">Desktop for Videographers</h2>
                <p className="mt-1 text-xs text-stone-400">Sign in to view your assigned campaigns and upload footage</p>

                <div className="mt-6 w-full space-y-3 text-left">
                  <div>
                    <label className="text-xs text-stone-400">Email</label>
                    <input
                      type="email"
                      readOnly
                      value="marcus@example.com"
                      className="mt-1 w-full rounded-lg border border-stone-700 bg-[#16161c] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-400">Password</label>
                    <input
                      type="password"
                      readOnly
                      value="••••••••••••"
                      className="mt-1 w-full rounded-lg border border-stone-700 bg-[#16161c] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreen("Upload")}
                    className="w-full rounded-lg bg-[#D73F09] py-2.5 text-xs font-bold text-white hover:bg-[#b33407]"
                  >
                    SIGN IN
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen("Upload")}
                    className="w-full rounded-lg border border-stone-700 py-2 text-xs font-semibold text-stone-300 hover:bg-[#1B1B21]"
                  >
                    CREATE ACCOUNT
                  </button>
                </div>
              </div>
            )}

            {screen === "Campaigns" && (
              <div>
                <h2 className="text-xl font-bold">Campaigns you&apos;re on</h2>
                <p className="mt-1 text-xs text-stone-400">
                  Assigned by Postgame. Folders are ready in LucidLink before you see them here.
                </p>

                <div className="mt-6 space-y-3">
                  {[
                    { name: campaignName, brand: brandName, detail: "3 athletes · shoot Nov 14 · due Nov 22", active: true },
                    { name: "Fall Tailgate", brand: "Crocs", detail: "2 athletes · due Nov 1", active: false },
                    { name: "Game Day Menu", brand: "Burger King", detail: "Done · 8 files delivered", active: false },
                  ].map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setScreen("Upload")}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                        c.active
                          ? "border-[#D73F09] bg-[#1B1B21]"
                          : "border-stone-800 bg-[#141419] hover:border-stone-700"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-white">{c.name}</div>
                        <div className="mt-0.5 text-xs text-stone-400">
                          {c.brand} · {c.detail}
                        </div>
                      </div>
                      <span className="text-stone-500">›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {screen === "Upload" && (
              <div>
                <h2 className="text-xl font-bold">Upload · {campaignName}</h2>
                <p className="mt-1 text-xs text-stone-400">
                  Pick the athlete, then drop clips. Each file is named and numbered for you.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {["Jordan Miles", "Taylor Nguyen", "Riley Carter"].map((ath) => (
                    <button
                      key={ath}
                      onClick={() => setActiveAth(ath)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        activeAth === ath
                          ? "border-[#D73F09] bg-[#1B1B21] text-white"
                          : "border-stone-800 bg-[#141419] text-stone-400 hover:border-stone-700"
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#303036] text-[10px]">
                        {ath.slice(0, 2).toUpperCase()}
                      </span>
                      {ath}
                    </button>
                  ))}
                  <button className="rounded-full border border-stone-800 bg-[#141419] px-3 py-1.5 text-xs text-stone-400 hover:text-white">
                    + Not listed
                  </button>
                </div>

                <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-800 bg-[#111115] p-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1B1B21] text-xl text-[#D73F09]">
                    ↑
                  </div>
                  <div className="mt-3 font-semibold text-white">Drop clips or a card folder here</div>
                  <p className="mt-1 text-xs text-stone-400">
                    MOV, MP4, JPG, HEIC · up to 10 GB each · keeps going if you close the window
                  </p>
                  <button
                    type="button"
                    className="mt-4 rounded-lg border border-stone-700 bg-transparent px-5 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                  >
                    Choose files
                  </button>
                </div>

                <div className="mt-4 rounded-lg bg-[#141419] p-3 text-xs text-stone-400">
                  Lands in <span className="font-mono text-stone-200">…/{activeAth} - {brandName} {campaignName} 2026/01 Raw/Videos/</span> · next file is <b className="text-white">Reel 03</b>
                </div>
              </div>
            )}

            {screen === "Queue" && (
              <div>
                <h2 className="text-xl font-bold">Queue</h2>
                <p className="mt-1 text-xs text-stone-400">2 uploading · 1 processing · 2 done today</p>

                <div className="mt-6 divide-y divide-stone-800 rounded-xl border border-stone-800 bg-[#141419]">
                  {[
                    { file: `Jordan Miles Reel 03 - ${brandName} ${campaignName} 2026 - v0.mov`, status: "In LucidLink ✓", tone: "ok", pct: 100 },
                    { file: `Jordan Miles Reel 04 - ${brandName} ${campaignName} 2026 - v0.mov`, status: "Processing", tone: "info", pct: 100 },
                    { file: `Taylor Nguyen Reel 01 - ${brandName} ${campaignName} 2026 - v0.mov`, status: "Uploading · 2.1 of 4.8 GB", tone: "info", pct: 44 },
                    { file: `Taylor Nguyen Reel 02 - ${brandName} ${campaignName} 2026 - v0.mov`, status: "Queued", tone: "wait", pct: 0 },
                    { file: `Riley Carter Photo 01 - ${brandName} ${campaignName} 2026 - v0.jpg`, status: "In LucidLink ✓", tone: "ok", pct: 100 },
                  ].map((item) => (
                    <div key={item.file} className="flex items-center gap-4 p-4 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-white">{item.file}</div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-stone-800 overflow-hidden">
                          <div
                            className="h-full bg-[#D73F09] transition-all"
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          item.tone === "ok"
                            ? "bg-emerald-950 text-emerald-400"
                            : item.tone === "info"
                            ? "bg-sky-950 text-sky-400"
                            : "bg-stone-800 text-stone-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-stone-500">
                  &ldquo;In LucidLink ✓&rdquo; means Postgame has it. You can close the app once everything shows that.
                </p>
              </div>
            )}

            {screen === "Settings" && (
              <div>
                <h2 className="text-xl font-bold">Settings</h2>
                <div className="mt-6 divide-y divide-stone-800 rounded-xl border border-stone-800 bg-[#141419]">
                  {[
                    { label: "Account", val: "marcus@example.com · Videographer" },
                    { label: "LucidLink", val: "Connected · 2 campaign folders · 48 GB synced this month" },
                    { label: "Upload", val: "Pause on cellular hotspots · Keep uploading when the app is closed" },
                    { label: "Watch folders", val: `~/Shoots/${campaignName} → Taylor Nguyen (auto-tag)` },
                    { label: "Version", val: "Postgame Desktop 1.0 · up to date" },
                  ].map((row) => (
                    <div key={row.label} className="p-4 text-xs">
                      <div className="font-semibold text-white">{row.label}</div>
                      <div className="mt-0.5 text-stone-400">{row.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-800 bg-[#141419] px-4 py-2.5 text-xs text-stone-400">
          <span>Files go straight into the LucidLink filespace under the campaign path.</span>
          <button
            onClick={onClose}
            className="rounded bg-stone-800 px-3 py-1 font-medium text-white hover:bg-stone-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
