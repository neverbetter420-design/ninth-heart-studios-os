// Fillable Forms verification: field parsing, totals, required checks.
// No database, no network.
import assert from "node:assert/strict";
import {
  categoryLabel,
  fieldTypeLabel,
  formatCents,
  lineItemsTotal,
  missingRequired,
  parseFields,
  parseLineItems,
  submissionTotal,
} from "../lib/forms.ts";

// 1. parseFields keeps valid fields, drops junk
const fields = parseFields([
  { id: "a", label: "Name", type: "text", required: true },
  { id: "b", label: "Items", type: "line_items", required: false },
  { id: "", label: "No id", type: "text" },
  { id: "c", label: "Bad type", type: "teleport" },
  { id: "d", label: "Options", type: "select", options: ["A", "B", ""] },
  null,
  "junk",
]);
assert.equal(fields.length, 3, "only 3 valid fields survive");
assert.deepEqual(fields[2].options, ["A", "B"], "empty options filtered");

// 2. Line item totals
assert.equal(lineItemsTotal([{ description: "Site", qty: 1, price_cents: 90000 }]), 90000);
assert.equal(
  lineItemsTotal([
    { description: "A", qty: 2, price_cents: 5000 },
    { description: "B", qty: 1, price_cents: 250 },
  ]),
  10250,
);
assert.equal(lineItemsTotal(parseLineItems([{ description: "X", qty: -1, price_cents: -5 }])), 0, "negatives clamp to 0");

// 3. submissionTotal sums only line_items fields
const total = submissionTotal(fields, { b: [{ description: "Site", qty: 1, price_cents: 90000 }] });
assert.equal(total, 90000, "invoice total computed");

// 4. missingRequired catches empty required fields, ignores signature
const req = parseFields([
  { id: "n", label: "Name", type: "text", required: true },
  { id: "c", label: "Agree", type: "checkbox", required: true },
  { id: "s", label: "Sign", type: "signature", required: true },
]);
assert.deepEqual(missingRequired(req, {}), ["Name", "Agree"], "signature not a value field");
assert.deepEqual(missingRequired(req, { n: "Hailey", c: true }), [], "filled form passes");

// 5. Labels + money format
assert.equal(categoryLabel("invoice"), "Invoice");
assert.equal(fieldTypeLabel("line_items"), "Line items (invoice)");
assert.equal(formatCents(90000), "$900.00");

console.log("verify:forms — all checks passed.");
