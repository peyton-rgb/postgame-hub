// ============================================================
// Invite form — Name · Email · Contact type (segmented) · Agency name
// (conditional) · Brand · Role for this brand.
//
// The dedupe rule is stated in the form itself, not just enforced in
// the action: inviting an email we already know ATTACHES that person
// to the brand. One login, no twins. Operators need to see that before
// they type, or they will make a second "Jane Doe".
// ============================================================

"use client";

import { useState } from "react";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { inviteContact } from "@/app/admin/access/actions";
import { DEFAULT_SEATS_PER_BRAND } from "@/lib/admin/access";

export default function AccessInviteForm({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"brand" | "agency">("brand");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [brandId, setBrandId] = useState("");

  const brandName = brands.find((b) => b.id === brandId)?.name ?? "the selected brand";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]"
      >
        Invite contact
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-stone-900">Invite a contact</h2>
          <p className="mt-0.5 text-[12px] text-stone-500">
            Inviting an email we already have <b>attaches that person to this brand</b> — it never
            creates a second copy of them. One human, one login, many brands.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-1 text-[13px] text-stone-500 hover:bg-stone-100"
        >
          Cancel
        </button>
      </div>

      <form action={inviteContact} className="grid gap-3 md:grid-cols-2">
        <label className="block text-[12px] font-medium text-stone-600">
          Name
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900"
          />
        </label>

        <label className="block text-[12px] font-medium text-stone-600">
          Email
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900"
          />
        </label>

        <div className="text-[12px] font-medium text-stone-600">
          Contact type
          <input type="hidden" name="contact_type" value={type} />
          <div className="mt-1 inline-flex rounded-md border border-stone-300 p-0.5">
            {(["brand", "agency"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  "rounded px-3 py-1 text-[13px] font-medium capitalize " +
                  (type === t ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-50")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {type === "agency" ? (
          <label className="block text-[12px] font-medium text-stone-600">
            Agency name
            <input
              name="agency_name"
              required
              placeholder="Sample Agency Group"
              className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900"
            />
          </label>
        ) : (
          <div aria-hidden className="hidden md:block" />
        )}

        <label className="block text-[12px] font-medium text-stone-600">
          Brand
          <select
            name="brand_id"
            required
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-[13px] text-stone-900"
          >
            <option value="">Select a brand…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[12px] font-medium text-stone-600">
          Role — for this brand
          <select
            name="role"
            defaultValue="viewer"
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-[13px] text-stone-900"
          >
            <option value="viewer">Viewer</option>
            <option value="approver">Approver</option>
          </select>
          <span className="mt-1 block text-[11px] font-normal text-stone-400">
            Roles are per brand — the same person can be Approver here and Viewer elsewhere.
          </span>
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <p className="text-[11px] text-stone-400">
            An invite holds one of {brandName}&apos;s {DEFAULT_SEATS_PER_BRAND} seats as soon as it
            is sent.
          </p>
          <ConfirmSubmit
            confirmLabel="Send invite"
            disabled={!name || !email || !brandId}
            summary={
              `Invite ${name || "this contact"} (${email || "no email"}) to ${brandName} as ` +
              `${type === "agency" ? "an agency" : "a brand"} contact? ` +
              `If we already know this email, they will be attached to ${brandName} rather than duplicated.`
            }
          >
            Send invite
          </ConfirmSubmit>
        </div>
      </form>
    </div>
  );
}
