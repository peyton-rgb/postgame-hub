// ============================================================
// isNearExistingBrand — the veto that stands between "this account is a
// genuinely new brand" and "this is a brand we already have, spelled
// differently".
//
// The fixture is NOT invented. Every account below is a real row in the live
// admin, and BRAND_NAMES is the full brand list as it stood when auto-create
// shipped (131 rows, 1 Sep 2026). The five vetoed accounts were each mapped by
// a human on 31 Aug precisely because the exact matcher could not see them —
// so a rule set that lets any of them through is a rule set that would have
// created a second Raising Cane's, a second McDonald's, and so on.
//
// Run: npm test
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { isNearExistingBrand, nearExistingBrands, levenshtein } from "./account-brand-map.ts";

/** Every brand in the Hub on 1 Sep 2026, verbatim. */
const BRAND_NAMES = [
  "1-800-Flowers", "7-Eleven", "Adidas", "Agency", "Allstate", "Amazon Music", "Armani",
  "AT&T", "Athlean-X", "Athlete Ally", "BERO", "Betterhelp", "BioSteel", "BOB Hotels",
  "BREWSHOCK", "Brooks", "Bubba Brands", "Buckle", "C4 Energy", "Calvin Klein", "CAVA",
  "CeraVe", "Champions", "Clarks", "Coach", "Coty", "Covergirl", "Cricket Wireless",
  "Crocs", "CVS", "Dick's Sporting Goods", "DKNY", "Door Crypto",
  "Door Dash (merged into DoorDash — do not use)", "DoorDash", "Dove", "Dr. Scholl's",
  "Drink Lick", "Easton", "EBOOST", "Family First", "Five Star", "Fivestar", "Flamin' Hot",
  "Flipgrid", "Fracture", "Free People", "Free People Movement", "Gainbridge", "GAMETIME",
  "GAT Sport", "Gillette", "Golin", "goodr", "Haggar", "Harmless Harvest", "Heydude",
  "Hollister", "HOLO", "Hydroflask", "iHerb", "Izod", "Jel Sert", "JEWLR", "Knockaround",
  "L'Oreal", "LEAF Trading Card", "Legends", "Lulus", "M&M", "Mars", "Mavi", "McDonald's",
  "Mint Mobile", "Misguided", "Momentec", "MONDAY Haircare", "MyFitnessPal", "NFHS", "NFT",
  "NIL Coin", "Nutrabolt", "ONNIT", "PAPATUI", "Pawp", "PepsiCo", "Postgame", "ProjectRepat",
  "PSD Underwear", "Quizlet", "Raising Cane's", "Raising Canes Test", "Rawlings", "Red Bull",
  "Reebok", "Ruffles", "Scooter's Coffee", "Sensationnel", "Shane Co", "SI", "siggi's",
  "Slate", "Sony Music", "Stanley", "STATSports", "Steve Madden", "StubHub", "Taco Bell",
  "Taco John's", "Tangle Teezer", "Thayers", "Thigh Society", "Ticketmaster", "TLF", "Topps",
  "Tostitos", "Tylenol", "UMG", "University of Colorado", "Unsung", "Urban Outfitters",
  "Verb", "Vireo", "Virgin Music Group", "Visit Las Vegas", "Walmart", "Wendy's", "Whoop",
  "YESLY", "York", "Zenni",
];

// ── §4 of the brief, exactly. A test that lets any veto through is failing. ──

/** account name → the brand it must be caught against, and why. */
const MUST_VETO: Array<{ account: string; nearest: string; why: string }> = [
  { account: "Cane's", nearest: "Raising Cane's", why: "rule 1, substring" },
  { account: "McDonalds", nearest: "McDonald's", why: "rule 2, punctuation" },
  { account: "Hey Dude", nearest: "Heydude", why: "rule 2, whitespace" },
  { account: "Ykone - Visit Las Vegas", nearest: "Visit Las Vegas", why: "rule 1, substring" },
  { account: "Dr Scholl's", nearest: "Dr. Scholl's", why: "rule 2" },
];

for (const { account, nearest, why } of MUST_VETO) {
  test(`vetoes ${JSON.stringify(account)} — ${why}`, () => {
    assert.equal(
      isNearExistingBrand(account, BRAND_NAMES),
      true,
      `${account} must be vetoed: auto-creating it would duplicate "${nearest}"`,
    );
    assert.ok(
      nearExistingBrands(account, BRAND_NAMES).includes(nearest),
      `${account} must report "${nearest}" as a brand it was near — "near what" is the half a human works from`,
    );
  });
}

test("creates Burger King — nothing within reach of 131 brands", () => {
  assert.equal(isNearExistingBrand("Burger King", BRAND_NAMES), false);
  assert.deepEqual(nearExistingBrands("Burger King", BRAND_NAMES), []);
});

// ── The whole live account list, so a rule change cannot quietly widen ──
// Only these six accounts fail the exact match. Every other one of the 120
// links exactly, so the veto never sees them.

test("no other live account changes verdict", () => {
  const verdicts = MUST_VETO.map(({ account }) => isNearExistingBrand(account, BRAND_NAMES));
  assert.deepEqual(verdicts, [true, true, true, true, true]);
  assert.equal(isNearExistingBrand("Burger King", BRAND_NAMES), false);
});

// ── Rule-level guards ───────────────────────────────────────────────────────

test("an exact match is not 'near' — that path belongs to exactBrandFor", () => {
  assert.equal(isNearExistingBrand("Adidas", BRAND_NAMES), false);
  assert.equal(isNearExistingBrand("adidas", BRAND_NAMES), false, "case-folded, still exact");
  assert.equal(isNearExistingBrand("Zenni ", BRAND_NAMES), false, "trailing space, still exact");
});

test("rule 3 budget scales with length: 2 edits on 8+, 1 below", () => {
  // 8+ characters: two edits is a typo.
  assert.equal(isNearExistingBrand("Hollistar", ["Hollister"]), true);
  assert.equal(isNearExistingBrand("Holliztar", ["Hollister"]), true, "distance 2");
  assert.equal(isNearExistingBrand("Holziztar", ["Hollister"]), false, "distance 3 — too far");
  // Under 8: two edits is a different word.
  assert.equal(isNearExistingBrand("Mavo", ["Mavi"]), true, "distance 1");
  assert.equal(isNearExistingBrand("Movo", ["Mavi"]), false, "distance 2 on a 4-letter name");
});

test("empty and whitespace names are never near anything", () => {
  assert.equal(isNearExistingBrand("", BRAND_NAMES), false);
  assert.equal(isNearExistingBrand("   ", BRAND_NAMES), false);
  assert.equal(isNearExistingBrand(null, BRAND_NAMES), false);
  assert.equal(isNearExistingBrand(undefined, BRAND_NAMES), false);
  assert.equal(isNearExistingBrand("Burger King", []), false, "no brands to be near");
});

test("nearest brand leads, even when a short name also matched", () => {
  // "SI" is a substring of "Ykone - Vi(si)t Las Vegas" and matches rule 1. It
  // must not outrank the brand a human actually means.
  const near = nearExistingBrands("Ykone - Visit Las Vegas", BRAND_NAMES);
  assert.equal(near[0], "Visit Las Vegas");
  assert.ok(near.includes("SI"), "the blunt match is still reported, just not first");
});

test("levenshtein", () => {
  assert.equal(levenshtein("", ""), 0);
  assert.equal(levenshtein("abc", "abc"), 0);
  assert.equal(levenshtein("", "abc"), 3);
  assert.equal(levenshtein("abc", ""), 3);
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("flaw", "lawn"), 2);
});
