// ============================================================
// Folder-name matching for the nightly Drive sweep. Uses the real names from
// the Raising Cane's 2026 duplicates found on Nov 16 2026: the admin built
// "Holiday Bikes - Raising Cane's 2026" and "Heisman 2026 - Raising Cane's
// 2026", the sweep didn't recognise them, and built "Holiday Bikes" and
// "Heisman 2026" alongside.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { adminCampaignFolderName, matchesSubfolder, normalizeName } from "./drive-folder-names.ts";

const f = (name: string) => ({ id: name, name });

test("builds the admin's campaign folder name", () => {
  assert.equal(adminCampaignFolderName("Holiday Bikes", "Raising Cane's", 2026), "Holiday Bikes - Raising Cane's 2026");
  assert.equal(adminCampaignFolderName("Heisman 2026", "Raising Cane's", 2026), "Heisman 2026 - Raising Cane's 2026");
});

test("curly and straight apostrophes count as the same name", () => {
  assert.equal(normalizeName("Holiday Bikes - Raising Cane’s 2026"), normalizeName("holiday bikes - raising cane's 2026 "));
});

test("subfolders match the plain name or the admin's suffixed name", () => {
  const kids = [
    f("Content - Raising Cane's Holiday Bikes 2026"),
    f("Legal - Raising Cane's Holiday Bikes 2026"),
    f("Trackers - Raising Cane's Holiday Bikes 2026"),
  ];
  assert.deepEqual(matchesSubfolder(kids, "Content").map((k) => k.name), ["Content - Raising Cane's Holiday Bikes 2026"]);
  assert.equal(matchesSubfolder(kids, "Travel").length, 0);
  assert.equal(matchesSubfolder([f("Content")], "Content").length, 1);
});

test("a subfolder name that only starts the same way is not a match", () => {
  assert.equal(matchesSubfolder([f("Contents Archive")], "Content").length, 0);
  assert.equal(matchesSubfolder([f("Legal Hold")], "Legal").length, 0);
});
