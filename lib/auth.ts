import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export const getCurrentAuth = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null as Profile | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, active")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: (profile ?? null) as Profile | null };
});

export async function requireUser() {
  const auth = await getCurrentAuth();

  if (!auth.user) {
    redirect("/auth/sign-in");
  }

  if (!auth.profile || !auth.profile.active) {
    redirect("/auth/unauthorized");
  }

  return { user: auth.user, profile: auth.profile };
}

export async function requireAdmin() {
  const auth = await requireUser();

  if (auth.profile.role !== "admin") {
    redirect("/portal");
  }

  return auth;
}
