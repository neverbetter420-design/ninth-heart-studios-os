"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isFormCategory, parseFields, type FormField } from "@/lib/forms";
import { importPdfFields } from "@/lib/pdf-import";
import { sanitizeFilename } from "@/lib/files";

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

/** Admin sends a form to a project — creates a pending submission for the client. */export async function sendFormToProject(formData: FormData) {
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

/**
 * Import a PDF as a form template.
 *
 * Parses AcroForm fields (exact) or falls back to text heuristics
 * (best-effort). The template is created INACTIVE — the admin reviews
 * the imported fields in the builder and clicks Restore to activate.
 * The source PDF is stored in the form-sources bucket as the branded
 * reference and linked from the template.
 */
export async function importPdfForm(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const name = clean(formData.get("name"));
  const category = formData.get("category");
  const file = formData.get("pdf");
  if (!name || !isFormCategory(category)) {
    redirect("/forms?error=Name+and+a+valid+category+are+required.");
  }
  if (!(file instanceof File) || file.size === 0) {
    redirect("/forms?error=Choose+a+PDF+to+import.");
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    redirect("/forms?error=Only+PDF+files+can+be+imported.");
  }
  if (file.size > 25 * 1024 * 1024) {
    redirect("/forms?error=PDF+must+be+under+25MB.");
  }

  const buffer = await file.arrayBuffer();
  const parsed = await importPdfFields(buffer);

  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      name,
      category,
      description: parsed.title
        ? `Imported from ${sanitizeFilename(file.name)} — “${parsed.title}”. Review fields before activating.`
        : `Imported from ${sanitizeFilename(file.name)}. Review fields before activating.`,
      fields: parsed.fields,
      active: false,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/forms?error=Could+not+import+the+PDF.");

  // Store the source PDF as the branded reference (best-effort — the
  // imported fields stand on their own if storage fails).
  const objectPath = `templates/${data.id}/${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("form-sources")
    .upload(objectPath, file, { contentType: "application/pdf", upsert: false });
  if (!uploadError) {
    await supabase
      .from("form_templates")
      .update({ source_file_path: objectPath, source_file_name: sanitizeFilename(file.name) })
      .eq("id", data.id);
  }

  redirect(`/forms/${data.id}`);
}
