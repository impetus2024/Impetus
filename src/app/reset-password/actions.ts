"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleHome, type UserRole } from "@/lib/auth/dal";
import { logError, logWarning } from "@/lib/logger";

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
    .select("id, role")
    .single();

  // Only a *successful* password change clears must_change_password — this is
  // the single place the forced-change loop in verifySession can be exited.
  // On the service-role client because the column is locked against
  // authenticated writes (see its migration), and blocking on failure because
  // redirecting to a dashboard the DAL would immediately bounce back here
  // would look like the form silently doing nothing.
  if (profile) {
    const { error: flagError } = await createAdminClient()
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id);
    if (flagError) {
      logError(`Failed to clear must_change_password for ${profile.id}:`, flagError);
      return { error: "Your password was updated, but we couldn't finish signing you in. Try again." };
    }
  }

  redirect(profile ? roleHome(profile.role as UserRole) : "/login");
}
