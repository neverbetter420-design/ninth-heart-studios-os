"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isTemplateCategory } from "@/lib/templates";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function revalidateTemplates(id?: string) {
  revalidatePath("/templates");
  if (id) revalidatePath(`/templates/${id}`);
  revalidatePath("/contracts");
}

export async function createTemplate(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const name = clean(formData.get("name"));
  const category = formData.get("category");
  const body = String(formData.get("body") ?? "");
  if (!name || !isTemplateCategory(category)) {
    redirect("/templates?error=Name+and+a+valid+category+are+required.");
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({ name, category, content: { body }, active: true, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) redirect("/templates?error=Could+not+create+the+template.");
  redirect(`/templates/${data.id}`);
}

export async function updateTemplate(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  const name = clean(formData.get("name"));
  const category = formData.get("category");
  const body = String(formData.get("body") ?? "");
  if (!id || !name || !isTemplateCategory(category)) return;

  await supabase
    .from("templates")
    .update({ name, category, content: { body }, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateTemplates(id);
}

export async function setTemplateActive(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  if (!id) return;
  const active = formData.get("active") === "true";

  await supabase
    .from("templates")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateTemplates(id);
}

export async function deleteTemplate(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = clean(formData.get("template_id"));
  if (!id) return;
  await supabase.from("templates").delete().eq("id", id);
  redirect("/templates");
}
