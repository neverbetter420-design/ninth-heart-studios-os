// Master Templates — the reusable library for contracts + docs.
//
// A template is { body } stored in the templates.content jsonb column.
// Contract templates prefill contract bodies; document templates prefill
// document notes. Categories are exactly "contract" | "document" — anything
// else is rejected at the action layer.

export const TEMPLATE_CATEGORIES = ["contract", "document"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export function isTemplateCategory(value: unknown): value is TemplateCategory {
  return value === "contract" || value === "document";
}

export function templateBody(content: unknown): string {
  if (content && typeof content === "object" && "body" in content) {
    const body = (content as { body?: unknown }).body;
    return typeof body === "string" ? body : "";
  }
  return "";
}

export function categoryLabel(category: string): string {
  if (category === "contract") return "Contract";
  if (category === "document") return "Document";
  return category;
}
