"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome, type UserRole } from "@/lib/auth/dal";

const LoginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z.string().min(1, { error: "Password is required." }),
});

export type LoginState = { error?: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account is disabled. Contact your centre admin." };
  }

  redirect(roleHome(profile.role as UserRole));
}
