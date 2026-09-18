"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPasswordResetContext, roleHome } from "@/lib/auth/dal";
import { revokeUserSessions } from "@/lib/auth/provision-user";
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

  // Same gate as the page, re-checked here because a Server Action can be
  // called directly. The mode comes from the session and profile, never from
  // anything the form submits.
  const context = await getPasswordResetContext();
  if (!context) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { profile, mode } = context;
  const supabase = await createClient();

  // Checked before the password is touched: a session with no active account
  // behind it must neither change a password nor be told it succeeded.
  if (!profile || !profile.is_active) {
    logWarning("Password update refused: no active profile for this session.");
    await supabase.auth.signOut({ scope: "local" });
    return { error: "We couldn't find an active account for this link. Contact your centre." };
  }

  if (!mode) {
    return { error: "Use Reset Password in your account menu to change your password." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // Specific messages for the rejections the user can fix, so the forced
    // change can't dead-end on a misleading "link expired".
    if (error.code === "same_password") {
      return { error: "Choose a password different from your current one." };
    }
    if (error.code === "weak_password") {
      return { error: error.message };
    }
    logWarning(`Password update rejected (${mode} session):`, error);
    return {
      error:
        mode === "recovery"
          ? "Your reset link has expired. Request a new one."
          : "Failed to update your password — try again.",
    };
  }

  // Only a *successful* password change clears must_change_password — this is
  // the single place the forced-change loop in verifySession can be exited
  // (besides changeOwnPassword). On the service-role client because the
  // column is locked against authenticated writes (see its migration), and
  // blocking on failure because redirecting to a dashboard the DAL would
  // immediately bounce back here would look like the form silently doing
  // nothing. The password already changed, so a retry needs a different one
  // (GoTrue rejects the same password) — the message says so rather than
  // leaving the user resubmitting into same_password.
  if (profile.must_change_password) {
    const { error: flagError } = await createAdminClient()
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id);
    if (flagError) {
      logError(`Failed to clear must_change_password for ${profile.id}:`, flagError);
      return {
        error: "Your password was updated, but we couldn't finish. Choose another new password and save again.",
      };
    }
  }

  // The password is the credential being replaced, so every session opened
  // with the old one (or from the emailed link) ends here, this one included.
  await revokeUserSessions(profile.id, "a password change via /reset-password");

  // A recovery link establishes a session for the sole purpose of setting a
  // password. Leaving it live would mean anyone who opened that one-time
  // emailed link is now signed into the account, so end it and make them prove
  // they know the password they just chose. Local scope: the session was
  // already revoked server-side above; this just clears the cookies.
  if (mode === "recovery") {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?reset=success");
  }

  // Forced change: the user reached this page from an ordinary session they
  // authenticated for, so bouncing them to /login would make them type a
  // password they set seconds ago. Open a fresh session with it instead (the
  // old one was revoked above) and continue to their dashboard.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.password,
  });
  if (signInError) {
    logWarning(`Could not re-establish a session for ${profile.id} after a forced password change:`, signInError);
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?reset=success");
  }

  redirect(roleHome(profile.role));
}
