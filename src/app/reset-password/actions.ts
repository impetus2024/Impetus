"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome, type UserRole } from "@/lib/auth/dal";
import { logWarning } from "@/lib/logger";

const ResetPasswordSchema = z.object({
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});

export type ResetPasswordState = { error?: string } | undefined;

export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid password." };
  }

  const supabase = await createClient();

  // Requires the recovery session established by /auth/confirm — if it's
  // missing or expired, updateUser fails and the user needs a fresh link.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logWarning("Password update rejected (recovery session missing/expired):", error);
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .single();

  redirect(profile ? roleHome(profile.role as UserRole) : "/login");
}
