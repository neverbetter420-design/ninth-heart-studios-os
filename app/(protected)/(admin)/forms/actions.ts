"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isFormCategory, parseFields, type FormField } from "@/lib/forms";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function revalidateForms(id?: string) {
  revalidatePath("/forms");
  if (id) revalidatePath(`/forms/${id}`);
  revalidatePath("/portal");
}

function newFieldId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function createFormTemplate(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const name = clean(formData.get("name"));
  const category = formData.get("category");
  const description = clean(formData.get("description")) ?? "";
  if (!name || !isFormCategory(category)) {
    redirect("/forms?error=Name+and+a+valid+category+are+required.");
  }

  const { data, error } = await supabase
    .from("form_templates")
    .insert({ name, category, description, fields: [], active: true, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) redirect("/forms?error=Could+not+create+the+form.");
  redirect(`/forms/${data.id}`);
}

export async function updateFormTemplate(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  const name = clean(formData.get("name"));
  const category = formData.get("category");
  const description = clean(formData.get("description")) ?? "";
  if (!id || !name || !isFormCategory(category)) return;

  await supabase
    .from("form_templates")
    .update({ name, category, description, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateForms(id);
}

export async function addFormField(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  const label = clean(formData.get("label"));
  const type = formData.get("type");
  if (!id || !label) return;
  if (!["text", "textarea", "number", "date", "checkbox", "select", "signature", "line_items"].includes(String(type))) {
    return;
  }

  const { data: template } = await supabase
    .from("form_templates")
    .select("fields")
    .eq("id", id)
    .maybeSingle();
  if (!template) return;

  const fields = parseFields(template.fields);
  const options = String(formData.get("options") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const field: FormField = {
    id: newFieldId(),
    label,
    type: type as FormField["type"],
    required: formData.get("required") === "on",
    options: type === "select" && options.length > 0 ? options : undefined,
    help: clean(formData.get("help")) ?? undefined,
  };
  fields.push(field);

  await supabase
    .from("form_templates")
    .update({ fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateForms(id);
}

export async function deleteFormField(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  const fieldId = clean(formData.get("field_id"));
  if (!id || !fieldId) return;

  const { data: template } = await supabase
    .from("form_templates")
    .select("fields")
    .eq("id", id)
    .maybeSingle();
  if (!template) return;

  const fields = parseFields(template.fields).filter((f) => f.id !== fieldId);
  await supabase
    .from("form_templates")
    .update({ fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateForms(id);
}

export async function setFormTemplateActive(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  if (!id) return;
  const active = formData.get("active") === "true";

  await supabase
    .from("form_templates")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateForms(id);
}

export async function deleteFormTemplate(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  if (!id) return;
  await supabase.from("form_templates").delete().eq("id", id);
  redirect("/forms");
}

/** Admin sends a form to a project — creates a pending submission for the client. */
export async function sendFormToProject(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const templateId = clean(formData.get("template_id"));
  const projectId = clean(formData.get("project_id"));
  if (!templateId || !projectId) return;

  const { data: template } = await supabase
    .from("form_templates")
    .select("id")
    .eq("id", templateId)
    .eq("active", true)
    .maybeSingle();
  if (!template) return;

  await supabase.from("form_submissions").insert({
    template_id: templateId,
    project_id: projectId,
    status: "pending",
    values: {},
    created_by: user.id,
  });
  revalidateForms(templateId);
  revalidatePath(`/projects/${projectId}`);
}
