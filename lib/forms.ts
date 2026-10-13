// Fillable Forms — field definitions, validation, invoice totals.
//
// Field types cover the full business set: text, textarea, number, date,
// checkbox, select (dropdown), signature, and line_items (invoice rows).
// A form template stores fields[] in form_templates.fields; a submission
// stores values { [fieldId]: value } in form_submissions.values.

export const FORM_CATEGORIES = ["contract", "document", "invoice"] as const;
export type FormCategory = (typeof FORM_CATEGORIES)[number];

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "checkbox",
  "select",
  "signature",
  "line_items",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export function isFormCategory(value: unknown): value is FormCategory {
  return value === "contract" || value === "document" || value === "invoice";
}

export function isFieldType(value: unknown): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(String(value));
}

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  help?: string;
};

export type LineItem = {
  description: string;
  qty: number;
  price_cents: number;
};

export function categoryLabel(category: string): string {
  if (category === "contract") return "Contract";
  if (category === "document") return "Document";
  if (category === "invoice") return "Invoice";
  return category;
}

export function fieldTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: "Short text",
    textarea: "Long text",
    number: "Number",
    date: "Date",
    checkbox: "Checkbox",
    select: "Dropdown",
    signature: "Signature",
    line_items: "Line items (invoice)",
  };
  return labels[type] ?? type;
}

/** Parse a fields JSONB value into validated FormField[]. Never throws. */
export function parseFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const out: FormField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    if (typeof f.id !== "string" || !f.id) continue;
    if (typeof f.label !== "string" || !f.label.trim()) continue;
    if (!isFieldType(f.type)) continue;
    const options = Array.isArray(f.options)
      ? f.options.filter((o): o is string => typeof o === "string" && o.trim() !== "")
      : undefined;
    out.push({
      id: f.id,
      label: f.label.trim(),
      type: f.type,
      required: f.required === true,
      options,
      help: typeof f.help === "string" ? f.help : undefined,
    });
  }
  return out;
}

/** Parse submission values. Never throws. */
export function parseValues(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function parseLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LineItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const li = item as Record<string, unknown>;
    const qty = Number(li.qty);
    const price = Number(li.price_cents);
    out.push({
      description: typeof li.description === "string" ? li.description : "",
      qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
      price_cents: Number.isFinite(price) && price >= 0 ? Math.round(price) : 0,
    });
  }
  return out;
}

/** Total in cents for a line_items value. */
export function lineItemsTotal(items: LineItem[]): number {
  return items.reduce((sum, li) => sum + li.qty * li.price_cents, 0);
}

/** Sum of all line_items fields in a submission. */
export function submissionTotal(fields: FormField[], values: Record<string, unknown>): number {
  let total = 0;
  for (const f of fields) {
    if (f.type === "line_items") total += lineItemsTotal(parseLineItems(values[f.id]));
  }
  return total;
}

/** Missing-required-field check. Returns the labels of fields that are empty. */
export function missingRequired(fields: FormField[], values: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    const v = values[f.id];
    if (f.type === "checkbox") {
      if (v !== true && v !== "on" && v !== "true") missing.push(f.label);
    } else if (f.type === "line_items") {
      if (parseLineItems(v).length === 0) missing.push(f.label);
    } else if (f.type === "signature") {
      // Signature is captured at the submission level (name/email), not per-field.
      continue;
    } else if (v === undefined || v === null || String(v).trim() === "") {
      missing.push(f.label);
    }
  }
  return missing;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
