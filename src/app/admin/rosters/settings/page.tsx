// ============================================================
// /admin/rosters/settings — Schedule & rules (the prototype's
// S["rosters-settings"]): how the roster bots run and what they may
// change on their own. One row in roster_settings (migration 091).
// Until 091 is applied the form shows the proposed defaults and says
// that saving turns on with the migration.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { Card } from "@/components/admin/campaign/bits";
import { Crumb } from "@/components/admin/people/bits";
import { saveRosterSettings } from "../actions";

export const dynamic = "force-dynamic";

interface Settings {
  cadence: string;
  run_at: string;
  sweep_months: string[];
  transfer_by_instagram: boolean;
  save_instagram_id: boolean;
  may_add: boolean;
  may_fill_handles: boolean;
  may_update_details: boolean;
  on_missing: string;
  hold_back_below_pct: number;
  slack_summary: boolean;
  workspace_tasks: boolean;
  updated_at: string | null;
}

const DEFAULTS: Settings = {
  cadence: "weekly",
  run_at: "04:00 America/New_York",
  sweep_months: ["august", "october", "january"],
  transfer_by_instagram: true,
  save_instagram_id: true,
  may_add: true,
  may_fill_handles: true,
  may_update_details: true,
  on_missing: "archive",
  hold_back_below_pct: 50,
  slack_summary: true,
  workspace_tasks: true,
  updated_at: null,
};

const RESULT: Record<string, { tone: "ok" | "warn"; text: string }> = {
  saved: { tone: "ok", text: "Saved. The bots use these rules from their next run." },
  pending: { tone: "warn", text: "Saving needs the roster_settings table (migration 091, written, not applied). Nothing was changed." },
  error: { tone: "warn", text: "That didn't save. Nothing was changed." },
};

const sec = "border-b border-stone-200 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500 md:col-span-2";
const lbl = "mb-1.5 block text-[12px] font-medium text-stone-700";
const sub = "mt-1 text-[12px] text-stone-500";

function Seg({ name, value, options }: { name: string; value: string; options: Array<[string, string]> }) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-stone-300 bg-stone-50 p-0.5" role="radiogroup">
      {options.map(([v, l]) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={value === v} className="peer sr-only" />
          <span className="block rounded px-3 py-1 text-[13px] font-medium text-stone-500 peer-checked:bg-white peer-checked:text-stone-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[#D73F09]/40">
            {l}
          </span>
        </label>
      ))}
    </div>
  );
}

function Check({ name, on, children }: { name: string; on: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 py-0.5 text-[13px] text-stone-700">
      <input type="checkbox" name={name} defaultChecked={on} className="mt-0.5 accent-[#D73F09]" />
      <span>{children}</span>
    </label>
  );
}

export default async function RosterSettingsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const db = createServiceSupabase() as any; // roster_settings (091) is not in the generated types yet
  const res = await safeQuery<Settings>(() => db.from("roster_settings").select("*").eq("id", 1).maybeSingle());
  const s: Settings = { ...DEFAULTS, ...(res.data ?? {}) };
  const result = searchParams.result ? RESULT[searchParams.result] : null;

  return (
    <form action={saveRosterSettings}>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
        <div>
          <Crumb items={[{ label: "Rosters", href: "/admin/rosters" }, { label: "Schedule & rules" }]} />
          <h1 className="text-xl font-semibold text-stone-900">Schedule &amp; rules</h1>
          <p className="mt-1 text-[13px] text-stone-500">How the roster bots run and what they&apos;re allowed to change on their own.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/admin/rosters" className="rounded-md px-3 py-1.5 text-[13px] font-medium text-stone-600 hover:bg-stone-100">
            Cancel
          </a>
          <button type="submit" className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]">
            Save
          </button>
        </div>
      </div>

      {result && (
        <div
          className={
            "mb-4 rounded-lg border px-4 py-3 text-[13px] " +
            (result.tone === "ok" ? "border-stone-200 bg-white text-status-ok" : "border-status-warn bg-amber-50 text-status-warn")
          }
        >
          {result.text}
        </div>
      )}

      <Card>
        <div className="grid gap-4 py-1 md:grid-cols-2">
          <div>
            <span className={lbl}>Check every school</span>
            <Seg name="cadence" value={s.cadence} options={[["weekly", "Every week"], ["biweekly", "Every 2 weeks"], ["monthly", "Every month"]]} />
          </div>
          <div>
            <label htmlFor="rs-run" className={lbl}>
              Run at
            </label>
            <select id="rs-run" name="run_at" defaultValue={s.run_at} className="h-[36px] w-full rounded-md border border-stone-300 bg-white px-2 text-[13px]">
              <option value="04:00 America/New_York">4:00 AM Eastern</option>
              <option value="00:00 America/New_York">Midnight Eastern</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <span className={lbl}>Extra full sweeps when new rosters go up</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Check name="sweep_months" on={s.sweep_months.includes("august")}>
                August · fall sports
              </Check>
              <Check name="sweep_months" on={s.sweep_months.includes("october")}>
                October · winter sports
              </Check>
              <Check name="sweep_months" on={s.sweep_months.includes("january")}>
                January · spring sports
              </Check>
            </div>
          </div>

          <div className={sec}>Matching</div>
          <div className="md:col-span-2">
            <span className={lbl}>Identify athletes by</span>
            <div className="mb-1.5 text-[12px] text-stone-500">
              1. Instagram account → 2. name + sport + school, only when there&apos;s no Instagram
            </div>
            <Check name="transfer_by_instagram" on={s.transfer_by_instagram}>
              Treat the same Instagram at a new school as a transfer (move them, don&apos;t add a new athlete)
            </Check>
            <Check name="save_instagram_id" on={s.save_instagram_id}>
              Save Instagram&apos;s permanent account number too, so a renamed handle still matches
            </Check>
          </div>

          <div className={sec}>What the bots can do on their own</div>
          <div className="md:col-span-2">
            <Check name="may_add" on={s.may_add}>
              Add new athletes
            </Check>
            <Check name="may_fill_handles" on={s.may_fill_handles}>
              Fill in missing Instagram, TikTok and X handles
            </Check>
            <Check name="may_update_details" on={s.may_update_details}>
              Update school, sport and class year
            </Check>
          </div>
          <div className="md:col-span-2">
            <span className={lbl}>When an athlete is no longer on the roster</span>
            <Seg name="on_missing" value={s.on_missing} options={[["archive", "Archive automatically"], ["flag", "Flag for review"]]} />
            <div className={sub}>
              Archived athletes stay in the database and come back if they show up on a roster again. App users are never archived;
              they&apos;re flagged instead.
            </div>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="rs-hold" className={lbl}>
              Hold back a school&apos;s update if it finds fewer than
            </label>
            <select
              id="rs-hold"
              name="hold_back_below_pct"
              defaultValue={String(s.hold_back_below_pct)}
              className="h-[36px] w-full max-w-[260px] rounded-md border border-stone-300 bg-white px-2 text-[13px]"
            >
              <option value="50">50% of last season&apos;s athletes</option>
              <option value="70">70% of last season&apos;s athletes</option>
              <option value="0">Don&apos;t hold back</option>
            </select>
            <div className={sub}>Protects against a broken scrape archiving a whole school.</div>
          </div>

          <div className={sec}>Tell the team</div>
          <div className="md:col-span-2">
            <Check name="slack_summary" on={s.slack_summary}>
              Post a summary in Slack after each run
            </Check>
            <Check name="workspace_tasks" on={s.workspace_tasks}>
              Add schools that need a look to the Workspace
            </Check>
          </div>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-stone-500">
        {res.pending
          ? "Proposed settings. Saving turns on with migration 091 (written, not applied); the schedule isn't decided yet."
          : s.updated_at
            ? `Last changed ${new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
            : "Proposed settings; the schedule isn't decided yet."}
      </p>
    </form>
  );
}
