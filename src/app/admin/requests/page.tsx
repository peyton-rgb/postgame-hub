// ============================================================
// /admin/requests — Requests (prototype S.requests and
// S["requests-reports"]). Two bookmarkable tabs:
//   ?tab=changes (default) — athlete change requests (tickets)
//   ?tab=reports           — reports about profiles (reports)
// Both tables arrive with migration 083. Until then each tab says
// so honestly. Read-only: approve/deny is not wired yet.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { Avatar, CardFoot, TablePending, timeAgo } from "@/components/admin/ops-bits";
import { Pill } from "@/components/admin/campaign/bits";
import { Dim, SimpleTable, TabbedCard } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

interface TicketRow {
  ticket_id: number;
  person_id: string | null;
  email: string | null;
  instagram_username: string | null;
  instagram_username_change: string | null;
  college_id_change: string | null;
  email_change: string | null;
  mobile_phone_change: string | null;
  sport_id_change: string | null;
  tik_tok_username_change: string | null;
  twitter_username_change: string | null;
  message: string | null;
  is_approved: boolean | null;
  is_denied: boolean | null;
  date_stamp: string | null;
  created_at: string | null;
}

interface ReportRow {
  report_id: number;
  report_type: string | null;
  description: string | null;
  person_id: string | null;
  athlete_profile_id: number | null;
  date_stamp: string | null;
  created_at: string | null;
}

const CHANGE_FIELDS: [keyof TicketRow, string][] = [
  ["instagram_username_change", "Instagram handle"],
  ["college_id_change", "College"],
  ["mobile_phone_change", "Phone"],
  ["sport_id_change", "Sport"],
  ["email_change", "Email"],
  ["tik_tok_username_change", "TikTok handle"],
  ["twitter_username_change", "X handle"],
];

function changesOf(t: TicketRow): { what: string; to: string } {
  const hits = CHANGE_FIELDS.filter(([k]) => t[k] != null && String(t[k]).trim() !== "");
  if (hits.length === 0) return { what: t.message ? "Message" : "—", to: t.message ?? "—" };
  const [k, label] = hits[0];
  let to = String(t[k]);
  // Never show a full phone number in a list.
  if (k === "mobile_phone_change") to = `(•••) •••-${to.replace(/\D/g, "").slice(-4)}`;
  return { what: hits.length > 1 ? `${label} +${hits.length - 1} more` : label, to };
}

export default async function RequestsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const tab = searchParams.tab === "reports" ? "reports" : "changes";

  const [ticketsRes, openCountRes, reportsRes] = await Promise.all([
    tab === "changes"
      ? safeQuery<TicketRow[]>(() =>
          supabase
            .from("tickets")
            .select(
              "ticket_id, person_id, email, instagram_username, instagram_username_change, college_id_change, email_change, mobile_phone_change, sport_id_change, tik_tok_username_change, twitter_username_change, message, is_approved, is_denied, date_stamp, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(100)
        )
      : Promise.resolve(null),
    safeQuery<{ ticket_id: number }[]>(() =>
      supabase.from("tickets").select("ticket_id").not("is_approved", "is", true).not("is_denied", "is", true).limit(1000)
    ),
    tab === "reports"
      ? safeQuery<ReportRow[]>(() =>
          supabase
            .from("reports")
            .select("report_id, report_type, description, person_id, athlete_profile_id, date_stamp, created_at")
            .order("created_at", { ascending: false })
            .limit(100)
        )
      : Promise.resolve(null),
  ]);

  // Names for the people on this page (people table is live).
  const personIds = Array.from(
    new Set([...(ticketsRes?.data ?? []), ...(reportsRes?.data ?? [])].map((r) => r.person_id).filter(Boolean) as string[])
  );
  const names = new Map<string, string>();
  if (personIds.length) {
    const { data } = await supabase.from("people").select("id, first_name, last_name").in("id", personIds);
    for (const p of (data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
      names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "—");
    }
  }

  const openCount = openCountRes.pending ? null : (openCountRes.data ?? []).length;

  return (
    <div>
      <PageHeader title="Requests" subtitle="Things athletes and brands have asked us to change or look at." />
      <TabbedCard
        tabs={[
          { href: "/admin/requests", label: "Athlete change requests", count: openCount, active: tab === "changes" },
          { href: "/admin/requests?tab=reports", label: "Reports", active: tab === "reports" },
        ]}
      >
        {tab === "changes" && ticketsRes && (
          ticketsRes.pending ? (
            <TablePending table="tickets" feature="Athlete change requests from the app" />
          ) : ticketsRes.error ? (
            <div className="p-4"><ErrorNote message={ticketsRes.error} /></div>
          ) : (
            <>
              <SimpleTable
                rows={ticketsRes.data ?? []}
                rowKey={(t) => String(t.ticket_id)}
                empty="No change requests yet."
                cols={[
                  {
                    h: "Athlete",
                    r: (t) => {
                      const n = (t.person_id && names.get(t.person_id)) || (t.instagram_username ? `@${t.instagram_username}` : t.email) || "—";
                      return (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={n} />
                          <span className="font-medium text-stone-900">{n}</span>
                        </div>
                      );
                    },
                  },
                  { h: "Wants to change", r: (t) => changesOf(t).what },
                  { h: "To", r: (t) => <span className="text-stone-600">{changesOf(t).to}</span> },
                  { h: "Sent", r: (t) => timeAgo(t.date_stamp ?? t.created_at) },
                  {
                    h: "Status",
                    r: (t) => (t.is_approved ? <Pill tone="ok">Approved</Pill> : t.is_denied ? <Pill>Denied</Pill> : <Pill tone="warn">Open</Pill>),
                  },
                ]}
              />
              <CardFoot>
                <span>Approve and deny are not wired up yet; this list is read-only.</span>
              </CardFoot>
            </>
          )
        )}

        {tab === "reports" && reportsRes && (
          reportsRes.pending ? (
            <TablePending table="reports" feature="Reports athletes and brands submit about profiles or content" />
          ) : reportsRes.error ? (
            <div className="p-4"><ErrorNote message={reportsRes.error} /></div>
          ) : (
            <SimpleTable
              rows={reportsRes.data ?? []}
              rowKey={(r) => String(r.report_id)}
              empty="No reports yet."
              cols={[
                { h: "Type", r: (r) => <Pill>{r.report_type ?? "Other"}</Pill> },
                { h: "Reported by", r: (r) => (r.person_id && names.get(r.person_id)) || <Dim>—</Dim> },
                { h: "About", r: (r) => (r.athlete_profile_id ? `Profile #${r.athlete_profile_id}` : <Dim>—</Dim>) },
                { h: "Details", r: (r) => <span className="text-stone-600">{r.description ?? "—"}</span> },
                { h: "Date", r: (r) => timeAgo(r.date_stamp ?? r.created_at) },
              ]}
            />
          )
        )}
      </TabbedCard>
    </div>
  );
}
