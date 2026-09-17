"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleHome, type UserRole } from "@/lib/auth/dal";
import { logError, logWarning } from "@/lib/logger";

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, { error: "Password must be at least 8 characters." }),
    confirmPassword: z.string().min(1, { error: "Confirm your new password." }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    error: "Password and confirmation don't match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordState = { error?: string } | undefined;

export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
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

  // A recovery link establishes a session for the sole purpose of setting a
  // password. Leaving it live would mean anyone who opened that one-time
  // emailed link is now signed into the account, so end it and make them prove
  // they know the password they just chose.
  //
  // The forced-change path (?required=1) is deliberately not signed out: that
  // user reached this page from an ordinary session they authenticated for, so
  // bouncing them to /login would make them type a password they set seconds
  // ago. They continue to their dashboard as before.
  const required = formData.get("required") === "1";

  if (!required || !profile) {
    await supabase.auth.signOut();
    redirect("/login?reset=success");
  }

  redirect(roleHome(profile.role as UserRole));
}
