import { test } from "node:test";
import assert from "node:assert/strict";
import { isApproved } from "./frameio-clips.ts";

const f = (value: unknown, by: "id" | "name" = "id") => ({
  id: "x", name: "clip.mp4", type: "file" as const,
  metadata: [by === "id"
    ? { field_definition_id: "04884c84-8309-4ac9-beb1-8334a4610db7", value }
    : { field_definition_name: "Status", value }],
});

test("approved as option object by id", () => {
  assert.equal(isApproved(f([{ id: "b1caf85a-6387-4e93-b254-b72008058593", display_name: "Approved" }])), true);
});
test("approved as plain label string, matched by field name", () => {
  assert.equal(isApproved(f(["Approved"], "name")), true);
});
test("other status is not approved", () => {
  assert.equal(isApproved(f([{ id: "nope", display_name: "Needs Review" }])), false);
});
test("no status field is not approved", () => {
  assert.equal(isApproved({ id: "x", name: "a", type: "file", metadata: [] }), false);
});
