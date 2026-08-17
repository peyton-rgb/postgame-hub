// ============================================================
// /admin/access — Access management.
//
// The cross-brand contact view: ONE ROW PER HUMAN, with every brand
// attachment under them carrying its own role and status. Answers
// "what can this person see?" in one glance, and "revoke everywhere"
// for a departing agency contact in one screen instead of a
// brand-by-brand hunt.
//
// Absorbs the CF Admins view. Staff accounts are NOT managed here —
// the Staff tab routes to /admin/users, no duplicate user management.
//
// SCHEMA: everything 028 delivers (brand_contacts, plus
// postgame_contacts.contact_type / .agency_name) is checked by a LIVE
// PROBE at request time — never a hardcoded flag. getAccessSchemaState()
// is the one source of truth shared with every write guard in
// ./actions.ts, so the banner and the actions cannot disagree: if the
// screen says "not applied", the writes really do refuse, and the moment
// 028 is reachable both flip together with no redeploy.
//
// While it is missing, the real contacts still render as identities with
// zero attachments. No invented attachments, no placeholder brands.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote, PendingMigration, EmptyRows } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import FilterPopover from "@/components/admin/FilterPopover";
import { getAccessSchemaState } from "@/lib/admin/access-schema";
import AccessAttachmentMenu from "@/components/admin/AccessAttachmentMenu";
import AccessInviteForm from "@/components/admin/AccessInviteForm";
import {
  DEFAULT_SEATS_PER_BRAND,
  ROLE_LABEL,
  STATUS_META,
  displayEmail,
  groupByIdentity,
  holdsSeat,
  isAttachmentRole,
  isAttachmentStatus,
  otherBrandCount,
  seatLine,
  type AttachmentRow,
  type ContactRow,
  type IdentityRow,
} from "@/lib/admin/access";

export const dynamic = "force-dynamic";

const MIGRATION = "20260817_028_brand_contacts_junction.sql";

type Search = Record<string, string | undefined>;

export default async function AccessPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin("admin");

  const tab = searchParams.tab === "staff" ? "staff" : "contacts";
  if (tab === "staff") return <StaffTab />;

  const supabase = createServiceSupabase();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const brandFilter = sanitizeFilterValue(searchParams.brand ?? "");
  const statusFilter = isAttachmentStatus(searchParams.status) ? searchParams.status : "";
  const showRevoked = searchParams.revoked === "1";
  const result = searchParams.result ?? "";

  // ---------- brands (for the filter + invite form) ----------
  const brandsRes = await safeQuery<{ id: string; name: string | null }[]>(() =>
    supabase.from("brands").select("id, name").order("name", { ascending: true }).limit(500)
  );
  const brands = (brandsRes.data ?? [])
    .filter((b): b is { id: string; name: string } => Boolean(b.name))
    .map((b) => ({ id: b.id, name: b.name }));

  // ---------- live schema probe ----------
  // The single source of truth for "is 028 there?" — shared with every
  // write guard, so the banner and the actions can never disagree.
  const schema = await getAccessSchemaState();
  const schemaPending = !schema.attachments;

  // ---------- attachments ----------
  // Pulled first: brand/status filters narrow the set of HUMANS we page over.
  const attachRes = await safeQuery<AttachmentRaw[]>(() =>
    supabase
      .from("brand_contacts")
      .select(
        "id, contact_id, brand_id, role, status, invited_email, signup_email, invited_at, activated_at, revoked_at, brands(name)" +
        (schema.invites ? ", invite_send_error, invite_expires_at" : "")
      )
      .limit(5000)
  );
  const allAttachments: AttachmentRow[] = (attachRes.data ?? []).map(normalizeAttachment);

  // If the probe says the table is reachable but this query still failed,
  // that is a REAL error (a column we asked for is missing), not a pending
  // migration. Surfacing it beats silently rendering everyone as unattached
  // — which is exactly how a schema mismatch hid here once already.
  const attachmentReadBroken = !schemaPending && (attachRes.pending || Boolean(attachRes.error));

  // Which humans survive the attachment-level filters?
  let contactIdFilter: string[] | null = null;
  if (!schemaPending && (brandFilter || statusFilter)) {
    const matching = allAttachments.filter(
      (a) =>
        (!brandFilter || a.brand_id === brandFilter) &&
        (!statusFilter || a.status === statusFilter)
    );
    contactIdFilter = Array.from(new Set(matching.map((a) => a.contact_id)));
  }

  // ---------- identities ----------
  function applyContactFilter(query: any) {
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
    if (contactIdFilter) {
      // Empty array would be invalid PostgREST; use an impossible id instead.
      query = query.in("id", contactIdFilter.length ? contactIdFilter : [ZERO_UUID]);
    }
    return query;
  }

  const { from, to } = pageRange(page);
  const fullSelect = "id, name, email, phone, is_active, created_at, contact_type, agency_name";
  const baseSelect = "id, name, email, phone, is_active, created_at";

  // The probe decides which shape to ask for; no speculative failing query.
  const identityPending = !schema.identityFields;
  const contactsRes = await safeQuery<ContactRaw[]>(() =>
    applyContactFilter(
      supabase.from("postgame_contacts").select(identityPending ? baseSelect : fullSelect)
    )
      .order("name", { ascending: true })
      .range(from, to)
  );

  if (contactsRes.error) {
    return (
      <div>
        <PageHeader title="Access management" />
        <ErrorNote message={contactsRes.error} />
      </div>
    );
  }

  const countRes = await safeQuery<null>(() =>
    applyContactFilter(
      supabase.from("postgame_contacts").select("id", { count: "exact", head: true })
    ) as any
  );
  const total = (countRes as unknown as { count?: number }).count ?? (contactsRes.data ?? []).length;

  const contacts: ContactRow[] = (contactsRes.data ?? []).map(normalizeContact);
  const pageIds = new Set(contacts.map((c) => c.id));

  // Revoked attachments are hidden unless explicitly asked for.
  const visibleAttachments = allAttachments.filter(
    (a) => pageIds.has(a.contact_id) && (showRevoked || a.status !== "revoked")
  );
  const identities = groupByIdentity(contacts, visibleAttachments);

  // How many revoked attachments the filter is currently hiding, per human —
  // so an empty cell can say which kind of empty it is.
  const hiddenRevoked = new Map<string, number>();
  if (!showRevoked) {
    for (const a of allAttachments) {
      if (a.status !== "revoked" || !pageIds.has(a.contact_id)) continue;
      hiddenRevoked.set(a.contact_id, (hiddenRevoked.get(a.contact_id) ?? 0) + 1);
    }
  }

  // ---------- seat line (only meaningful for one brand at a time) ----------
  const seatBrand = brandFilter ? brands.find((b) => b.id === brandFilter) ?? null : null;
  const seatUsage = seatBrand
    ? (() => {
        const rows = allAttachments.filter((a) => a.brand_id === seatBrand.id);
        return {
          used: rows.filter((a) => holdsSeat(a.status)).length,
          total: DEFAULT_SEATS_PER_BRAND,
          onFile: rows.filter((a) => a.status === "on_file").length,
        };
      })()
    : null;

  return (
    <div>
      <PageHeader
        title="Access management"
        subtitle="Everyone with a door into the Hub · staff accounts live in Users — this view is external access: portal contacts & agencies"
        actions={<AccessInviteForm brands={brands} />}
      />

      <Tabs active="contacts" contactCount={total} />

      {result && <ResultNote result={result} />}

      {/* Driven entirely by the live probe: once 028 is reachable this
          disappears on its own, and the write guards flip in the same breath. */}
      {!schema.ready && (
        <div className="mb-4">
          <PendingMigration migration={MIGRATION} feature={capitalise(schema.missing.join(" and "))} />
        </div>
      )}

      {attachmentReadBroken && (
        <div className="mb-4">
          <ErrorNote
            message={
              "brand_contacts exists but could not be read with the columns this screen asks for — " +
              "every contact below will look unattached, which may not be true. This is a schema " +
              "mismatch, not a pending migration. " +
              (attachRes.error ?? "")
            }
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <form action="/admin/access" method="GET" className="flex items-center gap-2">
          {brandFilter && <input type="hidden" name="brand" value={brandFilter} />}
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {showRevoked && <input type="hidden" name="revoked" value="1" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search contacts by name or email"
            className="w-full max-w-xs rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
          />
        </form>
        <FilterPopover
          fields={[
            {
              key: "brand",
              label: "Brand",
              type: "select",
              options: brands.map((b) => ({ value: b.id, label: b.name })),
            },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: (["active", "invited", "bounced", "on_file", "revoked"] as const).map((s) => ({
                value: s,
                label: STATUS_META[s].label,
              })),
            },
            { key: "revoked", label: "Show revoked attachments", type: "checkbox" },
          ]}
        />
      </div>

      {seatBrand && seatUsage && (
        <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-[12.5px] text-stone-600">
          <b className="text-stone-900">{seatBrand.name}</b> · {seatLine(seatUsage)}
          {seatUsage.onFile > 0 && (
            <span className="text-stone-400">
              {" "}
              ({seatUsage.onFile} on file, not counted)
            </span>
          )}
        </div>
      )}

      <AdminTable<IdentityRow>
        rows={identities}
        rowKey={(r) => r.contact.id}
        emptyLabel={
          q || brandFilter || statusFilter
            ? "No contacts match these filters."
            : "No contacts yet."
        }
        columns={[
          {
            key: "who",
            header: "Contact",
            render: (r) => <Who identity={r} />,
          },
          {
            key: "type",
            header: "Type",
            render: (r) => <TypeChip identity={r} pending={identityPending} />,
          },
          {
            key: "attachments",
            header: "Brand attachments — role & status per brand",
            render: (r) => (
              <Attachments identity={r} pending={schemaPending} hiddenRevoked={hiddenRevoked.get(r.contact.id) ?? 0} />
            ),
          },
          {
            key: "last",
            header: "Activated",
            align: "right",
            secondary: true,
            render: (r) => <Activated identity={r} />,
          },
        ]}
        mobile={{
          title: (r) => r.contact.name,
          subtitle: (r) => displayEmail(r)?.value ?? "no email on file",
          strip: (r) => <Attachments identity={r} pending={schemaPending} hiddenRevoked={hiddenRevoked.get(r.contact.id) ?? 0} />,
        }}
      />

      <Paginator
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        basePath="/admin/access"
        params={{
          q: q || undefined,
          brand: brandFilter || undefined,
          status: statusFilter || undefined,
          revoked: showRevoked ? "1" : undefined,
        }}
      />

      <PortalScopeNote />
    </div>
  );
}

// ============================================================
// Pieces
// ============================================================

function Tabs({ active, contactCount }: { active: "contacts" | "staff"; contactCount?: number }) {
  const item = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={
        "border-b-2 px-0.5 py-2 text-[13.5px] " +
        (on
          ? "border-[#D73F09] font-semibold text-stone-900"
          : "border-transparent text-stone-500 hover:text-stone-800")
      }
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-4 flex items-center gap-5 border-b border-stone-200">
      {item("/admin/access", `Portal contacts${contactCount != null ? ` · ${contactCount}` : ""}`, active === "contacts")}
      {item("/admin/access?tab=staff", "Staff (→ Users)", active === "staff")}
      <span className="ml-auto hidden pb-2 text-[11.5px] text-stone-400 sm:inline">
        every grant, revoke, and role change is logged
      </span>
    </div>
  );
}

function Who({ identity }: { identity: IdentityRow }) {
  const email = displayEmail(identity);
  return (
    <div className="min-w-[180px]">
      <NameLink href={`/admin/access?q=${encodeURIComponent(identity.contact.name)}`}>
        {identity.contact.name}
      </NameLink>
      <div className="mt-0.5 text-[11.5px] text-stone-400">
        {email ? (
          <>
            {email.value}
            {email.fromInvite && <span className="text-stone-300"> · invited address</span>}
          </>
        ) : (
          "no email on file"
        )}
      </div>
    </div>
  );
}

function TypeChip({ identity, pending }: { identity: IdentityRow; pending: boolean }) {
  if (pending) {
    return <span className="text-[11px] text-stone-300">pending 028</span>;
  }
  const isAgency = identity.contact.contact_type === "agency";
  const others = otherBrandCount(identity);
  return (
    <div className="min-w-[130px]">
      <span
        className={
          "inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide " +
          (isAgency ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-600")
        }
      >
        {isAgency ? "Agency" : "Brand"}
      </span>
      {isAgency && identity.contact.agency_name && (
        <div className="mt-0.5 text-[11.5px] text-stone-500">{identity.contact.agency_name}</div>
      )}
      {others > 1 && (
        <div className="mt-0.5 text-[11px] text-stone-400">
          also attached to {others - 1} other brand{others - 1 === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function Attachments({
  identity,
  pending,
  hiddenRevoked = 0,
}: {
  identity: IdentityRow;
  pending: boolean;
  /** revoked attachments the current filter is hiding for this human */
  hiddenRevoked?: number;
}) {
  if (pending) {
    return (
      <span className="text-[12px] text-stone-400">
        Attachments arrive with migration 028 — none invented here.
      </span>
    );
  }
  if (identity.attachments.length === 0) {
    return (
      <span className="text-[12px] text-stone-400">
        {hiddenRevoked > 0
          ? `No live attachments — ${hiddenRevoked} revoked, hidden by the filter`
          : "On file, not attached to any brand yet"}
      </span>
    );
  }
  return (
    <div className="space-y-1.5">
      {identity.attachments.map((a) => {
        const meta = STATUS_META[a.status];
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[140px] text-[12.5px] font-semibold text-stone-800">
              {a.brand_name ?? "—"}
            </span>
            <span
              className={
                "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                (a.role === "approver" ? "bg-orange-50 text-[#D73F09]" : "bg-stone-100 text-stone-600")
              }
            >
              {ROLE_LABEL[a.role]}
            </span>
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + meta.chip}>
              {meta.label}
            </span>
            <span className="text-[11px] text-stone-400">
              {a.status === "revoked" && a.revoked_at
                ? `Revoked ${formatDate(a.revoked_at)}`
                : a.status === "invited" && a.invited_at
                  ? `Invited ${formatDate(a.invited_at)}`
                  : meta.hint}
            </span>
            {a.invite_send_error && (
              <span
                title={a.invite_send_error}
                className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"
              >
                send failed — resend
              </span>
            )}
            <span className="ml-auto">
              <AccessAttachmentMenu
                attachmentId={a.id}
                contactName={identity.contact.name}
                brandName={a.brand_name ?? "this brand"}
                role={a.role}
                status={a.status}
                invitedEmail={a.invited_email ?? identity.contact.email}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The mockup's column is "Last active", but the applied 028 has no
 * last_active_at to source it from — only activated_at, which is when they
 * first signed in. Labelling that "last active" would be a quiet lie, so
 * the column reports what actually exists: when the person activated.
 * Revisit if a real last-seen signal ever lands.
 */
function Activated({ identity }: { identity: IdentityRow }) {
  const stamps = identity.attachments
    .map((a) => a.activated_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .reverse();
  return (
    <span className="whitespace-nowrap text-[11.5px] text-stone-500">
      {stamps.length ? formatDate(stamps[0]) : "never"}
    </span>
  );
}

function PortalScopeNote() {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-stone-300 px-4 py-3 text-[12px] leading-relaxed text-stone-500">
      <b className="text-stone-700">What Revoke does today.</b> Portal entry is currently a{" "}
      <b>brand-level link</b> (<code className="rounded bg-stone-100 px-1">brands.portal_token</code>
      ), not a per-person credential. Revoking here records the decision in the registry — status,
      timestamp, and who did it — and removes the person from this brand&apos;s seat count. It does{" "}
      <b>not</b> rotate that brand&apos;s portal link, so anyone still holding the link keeps it.
      Portal link rotation ships with per-contact tokens. Roles are per attachment: the same agency
      contact can be Approver on one brand and Viewer on another.
    </div>
  );
}

function StaffTab() {
  return (
    <div>
      <PageHeader
        title="Access management"
        subtitle="Everyone with a door into the Hub · staff accounts live in Users — this view is external access: portal contacts & agencies"
      />
      <Tabs active="staff" />
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="text-[15px] font-semibold text-stone-900">Staff access lives in Users admin</h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-stone-600">
          Internal Postgame accounts — their access level, activation, and role — are managed in one
          place, not duplicated here. This screen covers external access only: brand and agency
          contacts who reach the Hub through a client portal.
        </p>
        <Link
          href="/admin/users"
          className="mt-4 inline-block rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]"
        >
          Go to Users admin →
        </Link>
      </div>
    </div>
  );
}

function ResultNote({ result }: { result: string }) {
  const map: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
    invited: { tone: "ok", text: "Invite sent." },
    "invite-not-emailed": {
      tone: "warn",
      text:
        "Attachment saved, but the invite email did NOT go out — the row shows the reason. " +
        "Nobody has been emailed; use Resend once it is fixed.",
    },
    saved: { tone: "ok", text: "Change saved." },
    revoked: {
      tone: "ok",
      text: "Access revoked for that brand. The brand's portal link was not rotated — see the note below.",
    },
    pending028: {
      tone: "warn",
      text: `Nothing was written: this action needs migration ${MIGRATION}, which has not been applied yet.`,
    },
    "invite-missing-fields": { tone: "bad", text: "Name, email and brand are all required." },
    "invite-needs-agency": { tone: "bad", text: "Agency contacts need an agency name." },
    "resend-no-email": { tone: "bad", text: "No address to send to — add an email first." },
    error: { tone: "bad", text: "That write failed. Nothing was changed." },
  };
  const hit = map[result];
  if (!hit) return null;
  const cls =
    hit.tone === "ok"
      ? "border-green-200 bg-green-50 text-green-900"
      : hit.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-red-900";
  return <div className={`mb-4 rounded-lg border px-4 py-2.5 text-[13px] ${cls}`}>{hit.text}</div>;
}

// ============================================================
// Raw → typed
// ============================================================

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ContactRaw {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at: string | null;
  contact_type?: string | null;
  agency_name?: string | null;
}

interface AttachmentRaw {
  id: string;
  contact_id: string;
  brand_id: string;
  role: string | null;
  status: string | null;
  invited_email: string | null;
  signup_email: string | null;
  invited_at: string | null;
  activated_at: string | null;
  revoked_at: string | null;
  invite_send_error?: string | null;
  brands: { name: string | null } | { name: string | null }[] | null;
}

function normalizeContact(raw: ContactRaw): ContactRow {
  return {
    id: raw.id,
    name: raw.name ?? "—",
    email: raw.email,
    phone: raw.phone,
    contact_type: raw.contact_type === "agency" ? "agency" : "brand",
    agency_name: raw.agency_name ?? null,
    is_active: raw.is_active,
    created_at: raw.created_at,
  };
}

function normalizeAttachment(raw: AttachmentRaw): AttachmentRow {
  const brand = Array.isArray(raw.brands) ? raw.brands[0] : raw.brands;
  return {
    id: raw.id,
    contact_id: raw.contact_id,
    brand_id: raw.brand_id,
    brand_name: brand?.name ?? null,
    role: isAttachmentRole(raw.role) ? raw.role : "viewer",
    status: isAttachmentStatus(raw.status) ? raw.status : "on_file",
    invited_email: raw.invited_email,
    signup_email: raw.signup_email,
    invited_at: raw.invited_at,
    activated_at: raw.activated_at,
    revoked_at: raw.revoked_at,
    invite_send_error: raw.invite_send_error ?? null,
  };
}
