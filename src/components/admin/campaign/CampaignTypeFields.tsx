// ============================================================
// Edit campaign: the General card (with the Campaign type switch)
// and the Event details card that follows it when Event is chosen.
//
// One client island so the Event card can show/hide. The inputs are
// ordinary form fields (radio + text/date/time), so AdminForm's dirty
// tracking and the server action see them like any other field.
// ============================================================

"use client";

import { useState } from "react";
import { FieldCard, Field } from "@/components/admin/StickySaveBar";
import type { CampaignExtras, CampaignType } from "@/lib/admin/campaigns/types";

const inputCls =
  "mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900 disabled:bg-stone-50 disabled:text-stone-500";
const labelCls = "block text-[12px] font-medium text-stone-600";

export function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <>
      <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-[#D73F09]/10 text-[11px] font-bold text-[#D73F09]">
        {n}
      </span>
      {children}
    </>
  );
}

export function CampaignTypeSwitch({
  initial,
  onChange,
}: {
  initial: CampaignType;
  onChange?: (t: CampaignType) => void;
}) {
  const [type, setType] = useState<CampaignType>(initial);
  const opts: { value: CampaignType; label: string; hint: string }[] = [
    { value: "social", label: "Social campaign", hint: "Athletes create and post content on their own." },
    { value: "event", label: "Event", hint: "Adds event details (date, venue, call time) and event steps." },
  ];
  return (
    <div className="md:col-span-2">
      <span className={labelCls}>Campaign type</span>
      <div className="mt-1 inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
        {opts.map((o) => (
          <label
            key={o.value}
            className={
              "cursor-pointer rounded-md px-3 py-1 text-[13px] font-medium " +
              (type === o.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")
            }
          >
            <input
              type="radio"
              name="campaign_type"
              value={o.value}
              checked={type === o.value}
              onChange={() => {
                setType(o.value);
                onChange?.(o.value);
              }}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      <div className="mt-1 text-[12px] text-stone-500">{opts.find((o) => o.value === type)?.hint}</div>
    </div>
  );
}

export interface GeneralValues {
  campaign_name: string | null;
  brand_id: string | null;
  manager_person_id: string | null;
  assistant_person_id: string | null;
  expected_pay_date: string | null;
  campaign_note: string | null;
  is_active: boolean;
  brand_approves_in: string | null;
}

export default function GeneralAndEventSections({
  values,
  extras,
  pending,
  brandOptions,
  staffOptions,
}: {
  values: GeneralValues;
  extras: CampaignExtras;
  /** migration 084 not applied: the type/event inputs render but the save skips them */
  pending: boolean;
  brandOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
}) {
  const [type, setType] = useState<CampaignType>(extras.campaign_type);
  return (
    <>
      <div id="general">
        <FieldCard title="1 · General">
          <Field label="Campaign name" name="campaign_name" defaultValue={values.campaign_name} />
          <Field label="Brand" name="brand_id" type="select" defaultValue={values.brand_id} options={[{ value: "", label: "Select account" }, ...brandOptions]} />
          <CampaignTypeSwitch initial={extras.campaign_type} onChange={setType} />
          <Field label="Campaign manager" name="manager_person_id" type="select" defaultValue={values.manager_person_id} options={staffOptions} />
          <Field label="Campaign assistant" name="assistant_person_id" type="select" defaultValue={values.assistant_person_id} options={staffOptions} />
          <Field label="Estimated payout date" name="expected_pay_date" type="date" defaultValue={values.expected_pay_date?.slice(0, 10) ?? ""} />
          <Field
            label="Brand approves content in"
            name="brand_approves_in"
            type="select"
            defaultValue={values.brand_approves_in ?? ""}
            options={[
              { value: "", label: "— Not set —" },
              { value: "portal", label: "Brand portal" },
              { value: "sheet", label: "External sheet" },
              { value: "email", label: "Email" },
            ]}
          />
          <Field label="Campaign notes" name="campaign_note" type="textarea" span2 defaultValue={values.campaign_note} placeholder="Anything the team should know" />
          <label className="flex items-center gap-2 text-[13px] font-medium text-stone-700 md:col-span-2">
            <input type="checkbox" name="is_active" defaultChecked={values.is_active} className="h-4 w-4 accent-[#D73F09]" />
            Active
          </label>
          {pending && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-status-warn md:col-span-2">
              Campaign type, event details and &ldquo;Brand approves content in&rdquo; save once migration 20261020_084 is applied.
              Everything else on this page saves now.
            </p>
          )}
        </FieldCard>
      </div>

      {type === "event" && (
        <section id="event" className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
          <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">Event details</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className={labelCls}>
              Event date
              <input type="date" name="event_date" defaultValue={extras.event_date ?? ""} className={inputCls} />
            </label>
            <label className={labelCls}>
              Start time
              <input type="time" name="event_start_time" defaultValue={extras.event_start_time?.slice(0, 5) ?? ""} className={inputCls} />
            </label>
            <label className={labelCls}>
              Venue
              <input type="text" name="event_venue" defaultValue={extras.event_venue ?? ""} className={inputCls} />
            </label>
            <label className={labelCls}>
              Athlete call time
              <input type="time" name="event_call_time" defaultValue={extras.event_call_time?.slice(0, 5) ?? ""} className={inputCls} />
              <span className="mt-1 block text-[12px] font-normal text-stone-500">When athletes should arrive</span>
            </label>
            <label className={labelCls + " md:col-span-2"}>
              What athletes do there
              <textarea name="event_activities" rows={2} defaultValue={extras.event_activities ?? ""} className={inputCls} />
            </label>
            <label className={labelCls}>
              What to wear
              <input type="text" name="event_wardrobe" defaultValue={extras.event_wardrobe ?? ""} className={inputCls} />
            </label>
            <label className={labelCls}>
              Travel &amp; parking
              <input
                type="text"
                name="event_travel_notes"
                defaultValue={extras.event_travel_notes ?? ""}
                placeholder="Parking, travel reimbursement, who to find on arrival"
                className={inputCls}
              />
            </label>
          </div>
        </section>
      )}
    </>
  );
}
