// Master Templates verification: content extraction + category guard.
// No database, no network.
import assert from "node:assert/strict";
import { categoryLabel, isTemplateCategory, templateBody } from "../lib/templates.ts";

// 1. templateBody extracts body from content jsonb
assert.equal(templateBody({ body: "Hello" }), "Hello", "body extracted");
assert.equal(templateBody({}), "", "missing body → empty");
assert.equal(templateBody(null), "", "null content → empty");
assert.equal(templateBody({ body: 42 }), "", "non-string body → empty");
assert.equal(templateBody("nope"), "", "non-object content → empty");

// 2. Category guard admits exactly contract + document
assert.ok(isTemplateCategory("contract"), "contract is a valid category");
assert.ok(isTemplateCategory("document"), "document is a valid category");
assert.ok(!isTemplateCategory("proposal"), "proposal is not a template category");
assert.ok(!isTemplateCategory(""), "empty is not a template category");
assert.ok(!isTemplateCategory(undefined), "undefined is not a template category");

// 3. Labels
assert.equal(categoryLabel("contract"), "Contract");
assert.equal(categoryLabel("document"), "Document");

console.log("verify:templates — all checks passed.");
