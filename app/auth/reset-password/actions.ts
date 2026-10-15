"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 12) {
    redirect("/auth/reset-password?error=Password%20must%20be%20at%20least%2012%20characters.");
  }
  if (password !== confirm) {
    redirect("/auth/reset-password?error=Passwords%20do%20not%20match.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=Reset%20link%20is%20invalid%20or%20expired.%20Request%20a%20new%20one.");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/?password=reset");
}
