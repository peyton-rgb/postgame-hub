// ============================================================
// /admin/settings — Settings (prototype S.settings): your profile
// and the connected services. Every connection status is checked
// live (env var present, or a row in the connection table); a
// connection whose table is not in the database yet says so.
// The Team tab links to /admin/team (one list, not two).
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader } from "@/components/admin/ui";
import { timeAgo } from "@/components/admin/ops-bits";
import { Pill, type Tone } from "@/components/admin/campaign/bits";
import { TabbedCard } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

interface Conn {
  name: string;
  status: string;
  tone: Tone;
  note?: string;
}

export default async function SettingsPage() {
  const me = await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const [profileRes, igRes, frameRes, hookRes] = await Promise.all([
    supabase.from("profiles").select("full_name, display_name, email, access_level").eq("id", me.id).maybeSingle(),
    safeQuery<{ ig_username: string | null; last_import_at: string | null }[]>(() =>
      supabase.from("instagram_connections").select("ig_username, last_import_at").limit(5)
    ),
    safeQuery<{ id: string }[]>(() => supabase.from("frameio_connection").select("*").limit(1)),
    safeQuery<{ received_at: string }[]>(() =>
      supabase.from("instagram_webhook_events").select("received_at").order("received_at", { ascending: false }).limit(1)
    ),
  ]);

  const profile = profileRes.data as { full_name: string | null; display_name: string | null; email: string | null; access_level: string | null } | null;
  const name = profile?.full_name || profile?.display_name || "";
  const email = profile?.email ?? me.email ?? "";

  const pendingConn = (table: string): Conn => ({ name: "", status: "Not set up", tone: "muted", note: `${table} table not in the database yet (migration 083)` });

  const ig = igRes.data ?? [];
  const conns: Conn[] = [
    igRes.pending
      ? { ...pendingConn("instagram_connections"), name: "Instagram" }
      : ig.length
        ? {
            name: "Instagram",
            status: `Connected · ${ig.map((c) => (c.ig_username ? `@${c.ig_username}` : "account")).join(", ")}`,
            tone: "ok",
            note: ig[0]?.last_import_at ? `Last import ${timeAgo(ig[0].last_import_at)}` : undefined,
          }
        : { name: "Instagram", status: "Not connected", tone: "warn" },
    frameRes.pending
      ? { ...pendingConn("frameio_connection"), name: "Frame.io" }
      : (frameRes.data ?? []).length
        ? { name: "Frame.io", status: "Connected", tone: "ok" }
        : { name: "Frame.io", status: "Not connected", tone: "warn" },
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_REFRESH_TOKEN
      ? { name: "Google Drive", status: "Connected", tone: "ok" }
      : { name: "Google Drive", status: "Not configured", tone: "warn" },
    hookRes.pending
      ? { ...pendingConn("instagram_webhook_events"), name: "Mentions webhook" }
      : (hookRes.data ?? []).length
        ? { name: "Mentions webhook", status: "Receiving", tone: "ok", note: `Last event ${timeAgo(hookRes.data![0].received_at)}` }
        : { name: "Mentions webhook", status: "Nothing received yet", tone: "muted" },
  ];

  const levelLabel = profile?.access_level ? profile.access_level.charAt(0).toUpperCase() + profile.access_level.slice(1) : null;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, your team and connected services." />
      <TabbedCard
        tabs={[
          { href: "/admin/settings", label: "Profile & connections", active: true },
          { href: "/admin/team", label: "Team", active: false },
        ]}
      >
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2 md:px-5">
          <label className="grid gap-1.5 text-[13px]">
            <span className="font-medium text-stone-700">Name</span>
            <input
              className="rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-stone-900"
              value={name || "—"}
              readOnly
              aria-readonly
            />
          </label>
          <label className="grid gap-1.5 text-[13px]">
            <span className="font-medium text-stone-700">Email</span>
            <input className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-stone-500" value={email} disabled />
          </label>
          <p className="text-[12px] text-stone-500 md:col-span-2">
            {levelLabel ? `Hub access: ${levelLabel}. ` : ""}Name changes are not editable here yet. Access levels are changed on{" "}
            <Link href="/admin/access" className="text-[#D73F09] hover:underline">
              Access
            </Link>
            .
          </p>

          <div className="md:col-span-2">
            <h2 className="mb-1 mt-2 text-[14px] font-semibold text-stone-900">Connections</h2>
            {conns.map((c) => (
              <div key={c.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stone-100 py-2.5 last:border-0">
                <span className="min-w-[140px] flex-1 text-[13px] font-medium text-stone-900">
                  {c.name}
                  {c.note && <span className="block text-[12px] font-normal text-stone-500">{c.note}</span>}
                </span>
                <Pill tone={c.tone}>{c.status}</Pill>
              </div>
            ))}
          </div>
        </div>
      </TabbedCard>
    </div>
  );
}
