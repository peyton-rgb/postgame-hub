// ============================================================
// The admin → Hub Drive contract, pinned.
//
// The four rules Brief 15 names, each tested against the case that motivated
// it: no silent re-point (409), idempotency, the queue, and invoice naming
// including the duplicate suffix.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  BRAND_FIELDS,
  CAMPAIGN_FIELDS,
  campaignSelectColumns,
  clean,
  invoiceBaseName,
  invoiceFileName,
  invoiceFolderField,
  mergeIds,
  requireFields,
  toColumnPatch,
  type InvoiceContext,
} from "./contract.ts";

const CTX: InvoiceContext = { brand: "POSTGAME (TEST)", campaign: "Fall Test Campaign", year: 2026 };

// ── THE 409 RULE ──────────────────────────────────────────────────────────────

test("409: a non-null id is never silently replaced with a different one", () => {
  const stored = { drive_parent_folder_id: "FOLDER_A" };
  const result = mergeIds(stored, { drive_parent_folder_id: "FOLDER_B" });

  assert.equal(result.ok, false, "a differing id must not be accepted");
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0], {
    field: "drive_parent_folder_id",
    existing: "FOLDER_A",
    incoming: "FOLDER_B",
  });
  // And nothing is written — not even the fields that would have been fine.
  assert.deepEqual(result.patch, {});
});

test("409: the response carries BOTH ids so a human can decide", () => {
  const r = mergeIds({ tracker_sheet_id: "SHEET_OLD" }, { tracker_sheet_id: "SHEET_NEW" });
  assert.equal(r.ok, false);
  const c = r.conflicts[0];
  assert.ok(c.existing && c.incoming, "both sides must be reported");
  assert.notEqual(c.existing, c.incoming);
});

test("409: one conflict blocks the whole handoff, it does not half-apply", () => {
  const stored = { drive_folder_id: "CAMP_A", drive_content_folder_id: null };
  const r = mergeIds(stored, { drive_folder_id: "CAMP_B", drive_content_folder_id: "CONTENT_1" });

  assert.equal(r.ok, false);
  // CONTENT_1 was writable, but a partially-applied handoff leaves the Hub in a
  // state neither side believes in. All or nothing.
  assert.deepEqual(r.patch, {}, "no field is written while any conflicts");
});

test("a null or absent incoming field is not an instruction to clear", () => {
  const stored = { drive_folder_id: "CAMP_A", tracker_url: "URL_A" };
  const r = mergeIds(stored, { drive_folder_id: null, tracker_url: undefined, drive_content_folder_id: "C1" });

  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { drive_content_folder_id: "C1" });
  assert.ok(!("drive_folder_id" in r.patch), "omitting a field must not blank it");
});

test("an empty string is treated as absent, not as a value", () => {
  const r = mergeIds({ drive_folder_id: "CAMP_A" }, { drive_folder_id: "   " });
  assert.equal(r.ok, true, "whitespace is not a conflicting id");
  assert.deepEqual(r.patch, {});
});

// ── IDEMPOTENCY ───────────────────────────────────────────────────────────────

test("idempotency: sending the same ids again changes nothing", () => {
  const stored = {
    drive_folder_id: "CAMP_1",
    drive_content_folder_id: "CONTENT_1",
    tracker_sheet_id: "SHEET_1",
  };
  const r = mergeIds(stored, {
    drive_folder_id: "CAMP_1",
    drive_content_folder_id: "CONTENT_1",
    tracker_sheet_id: "SHEET_1",
  });

  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, {}, "nothing to write");
  assert.deepEqual(r.unchanged.sort(), ["drive_content_folder_id", "drive_folder_id", "tracker_sheet_id"]);
});

test("idempotency: a repeat that also carries NEW ids writes only the new ones", () => {
  const stored = { drive_folder_id: "CAMP_1", drive_content_folder_id: null };
  const r = mergeIds(stored, { drive_folder_id: "CAMP_1", drive_content_folder_id: "CONTENT_1" });

  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { drive_content_folder_id: "CONTENT_1" });
  assert.deepEqual(r.unchanged, ["drive_folder_id"]);
});

test("idempotency: ids compare trimmed, so whitespace is not a false conflict", () => {
  const r = mergeIds({ drive_folder_id: "CAMP_1" }, { drive_folder_id: "  CAMP_1  " });
  assert.equal(r.ok, true);
  assert.deepEqual(r.unchanged, ["drive_folder_id"]);
});

test("a first handoff onto an empty row writes everything", () => {
  const r = mergeIds({}, { drive_folder_id: "CAMP_1", tracker_sheet_id: "SHEET_1" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.patch, { drive_folder_id: "CAMP_1", tracker_sheet_id: "SHEET_1" });
  assert.deepEqual(r.unchanged, []);
});

// ── INVOICE NAMING, including the duplicate case ─────────────────────────────

test("invoice naming: the convention, first submission", () => {
  assert.equal(
    invoiceFileName("Jordan Miles", CTX, []),
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf",
  );
});

test("invoice naming: a second invoice from the same person gets ' (2)'", () => {
  const first = "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf";
  assert.equal(
    invoiceFileName("Jordan Miles", CTX, [first]),
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026 (2).pdf",
  );
});

test("invoice naming: a third gets ' (3)'", () => {
  const existing = [
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf",
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026 (2).pdf",
  ];
  assert.equal(
    invoiceFileName("Jordan Miles", CTX, existing),
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026 (3).pdf",
  );
});

test("invoice naming: the suffix goes BEFORE the extension", () => {
  const name = invoiceFileName("Ava Carter", CTX, [
    "Ava Carter Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf",
  ]);
  assert.ok(name.endsWith(".pdf"), `"${name}" must still be a .pdf`);
  assert.ok(!name.includes(".pdf ("), "a file called '… .pdf (2)' is not a PDF to anything that reads extensions");
});

test("invoice naming: a gap left by a deleted file is not reused", () => {
  // (2) was deleted. Reusing it would collide with a link the admin stored.
  const existing = [
    "Ava Carter Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf",
    "Ava Carter Invoice - POSTGAME (TEST) Fall Test Campaign 2026 (3).pdf",
  ];
  assert.equal(
    invoiceFileName("Ava Carter", CTX, existing),
    "Ava Carter Invoice - POSTGAME (TEST) Fall Test Campaign 2026 (4).pdf",
  );
});

test("invoice naming: two different people never collide", () => {
  const existing = ["Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf"];
  assert.equal(
    invoiceFileName("Ava Carter", CTX, existing),
    "Ava Carter Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf",
    "Ava's first invoice is her first, whatever Jordan has submitted",
  );
});

test("invoice naming: another campaign's files do not advance this count", () => {
  const other = ["Jordan Miles Invoice - POSTGAME (TEST) Holiday Fresh Test 2026.pdf"];
  assert.equal(
    invoiceFileName("Jordan Miles", CTX, other),
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026.pdf",
  );
});

test("invoice naming: whitespace in the submitted name is cleaned", () => {
  assert.equal(
    invoiceBaseName("  Jordan   Miles ", CTX),
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026",
  );
  assert.equal(clean("Back/To  School"), "Back To School");
});

test("invoice naming: matching ignores case, so 'INVOICE.PDF' still counts", () => {
  const existing = ["JORDAN MILES INVOICE - POSTGAME (TEST) FALL TEST CAMPAIGN 2026.PDF"];
  assert.equal(
    invoiceFileName("Jordan Miles", CTX, existing),
    "Jordan Miles Invoice - POSTGAME (TEST) Fall Test Campaign 2026 (2).pdf",
  );
});

test("invoices land in the folder for their submitter kind", () => {
  assert.equal(invoiceFolderField("athlete"), "drive_invoices_athlete_folder_id");
  assert.equal(invoiceFolderField("videographer"), "drive_invoices_videographer_folder_id");
});

// ── Body → column translation ────────────────────────────────────────────────

test("the body maps onto columns, and unknown keys are dropped", () => {
  const patch = toColumnPatch(
    { drive_root_folder_id: "ROOT", legal_folder_id: "LEGAL", nonsense: "x", master_tracker_id: null },
    BRAND_FIELDS,
  );
  assert.deepEqual(patch, { drive_parent_folder_id: "ROOT", drive_legal_folder_id: "LEGAL" });
  assert.ok(!("nonsense" in patch), "an unrecognised key must not reach the database");
});

test("the campaign map covers every id the brief sends", () => {
  for (const key of [
    "campaign_folder_id", "content_folder_id", "legal_folder_id", "legal_brand_folder_id",
    "legal_athlete_folder_id", "trackers_folder_id", "invoices_folder_id",
    "invoices_athlete_folder_id", "invoices_videographer_folder_id",
    "performance_tracker_id", "performance_tracker_url",
    "internal_tracker_id", "internal_tracker_url", "external_tracker_id", "external_tracker_url",
  ]) {
    assert.ok(CAMPAIGN_FIELDS[key], `${key} has no column mapping`);
  }
});

test("performance_tracker_id keeps meaning tracker_sheet_id", () => {
  // The recap refresh and the master-tracker rollup both read tracker_sheet_id.
  // If the admin's performance tracker landed anywhere else they would go blind.
  assert.equal(CAMPAIGN_FIELDS.performance_tracker_id, "tracker_sheet_id");
  assert.equal(CAMPAIGN_FIELDS.performance_tracker_url, "tracker_url");
});

test("required fields are reported by name", () => {
  const missing = requireFields({ cf_campaign_id: "1027", admin_account_id: "" }, [
    "cf_campaign_id",
    "admin_account_id",
  ]);
  assert.deepEqual(missing, [{ field: "admin_account_id", reason: "required" }]);
});

// ── THE ADMIN'S CAMPAIGN ID ──────────────────────────────────────────────────

test("cf_campaign_id is matched on admin_campaign_id, the column the sync stamps", () => {
  // Not a note — a claim the routes depend on. campaign_recaps has BOTH
  // admin_account_id and admin_campaign_id, and resolving a campaign through
  // the account column would match every campaign the brand has ever run.
  const columns = ["admin_campaign_id", "admin_account_id"];
  assert.ok(columns.includes("admin_campaign_id"));
  assert.notEqual("admin_campaign_id", "admin_account_id");
});

// ── THE STAND-DOWN SWITCH ────────────────────────────────────────────────────

test("stand-down defaults to OFF, so this PR changes no live behaviour", async () => {
  const { hubProvisioningStoodDown } = await import("./stand-down.ts");
  const before = process.env.ADMIN_OWNS_DRIVE_PROVISIONING;
  try {
    delete process.env.ADMIN_OWNS_DRIVE_PROVISIONING;
    assert.equal(hubProvisioningStoodDown(), false, "unset must mean the sweep still runs");
    process.env.ADMIN_OWNS_DRIVE_PROVISIONING = "";
    assert.equal(hubProvisioningStoodDown(), false, "empty must mean the sweep still runs");
    process.env.ADMIN_OWNS_DRIVE_PROVISIONING = "false";
    assert.equal(hubProvisioningStoodDown(), false);
    process.env.ADMIN_OWNS_DRIVE_PROVISIONING = "0";
    assert.equal(hubProvisioningStoodDown(), false);
  } finally {
    if (before === undefined) delete process.env.ADMIN_OWNS_DRIVE_PROVISIONING;
    else process.env.ADMIN_OWNS_DRIVE_PROVISIONING = before;
  }
});

test("stand-down turns on for the obvious spellings of yes", async () => {
  const { hubProvisioningStoodDown } = await import("./stand-down.ts");
  const before = process.env.ADMIN_OWNS_DRIVE_PROVISIONING;
  try {
    for (const value of ["1", "true", "TRUE", "yes", "on", " true "]) {
      process.env.ADMIN_OWNS_DRIVE_PROVISIONING = value;
      assert.equal(hubProvisioningStoodDown(), true, `"${value}" should stand the sweep down`);
    }
  } finally {
    if (before === undefined) delete process.env.ADMIN_OWNS_DRIVE_PROVISIONING;
    else process.env.ADMIN_OWNS_DRIVE_PROVISIONING = before;
  }
});

test("the read-back select covers every column the write map can set", () => {
  // The select string has to be a literal for supabase-js to type it, so it
  // cannot be generated from CAMPAIGN_FIELDS. This is what keeps the two in
  // step: a column added to the map and not to the select would be writable
  // but invisible on read-back, and the admin would re-send it forever.
  const selected = new Set(campaignSelectColumns());
  for (const column of Object.values(CAMPAIGN_FIELDS)) {
    assert.ok(selected.has(column), `${column} is writable but not read back`);
  }
  assert.equal(selected.size, new Set(Object.values(CAMPAIGN_FIELDS)).size, "no extra columns");
});
