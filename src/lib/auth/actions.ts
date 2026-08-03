"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { isRateLimited, recordAttempt, clearAttempts } from "@/lib/auth/rate-limit";
import { logError } from "@/lib/logger";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, { error: "Current password is required." }),
    newPassword: z.string().min(8, { error: "New password must be at least 8 characters." }),
    confirmPassword: z.string().min(1, { error: "Confirm your new password." }),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    error: "New password and confirmation don't match.",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.oldPassword, {
    error: "New password must be different from your current password.",
    path: ["newPassword"],
  });

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

// Self-service: the logged-in user changing their own password, from
// their profile menu. Distinct from resetUserPassword (provision-user.ts),
// which is an admin resetting *someone else's* password without knowing
// it — this one requires the current password first. Supabase/GoTrue has
// no separate "verify this password" endpoint, so a fresh
// signInWithPassword is the only way to confirm it's correct; on success
// that just reissues a session for the same user, on failure the existing
// session is untouched.
export async function changeOwnPassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const profile = await verifySession();

  const parsed = ChangePasswordSchema.safeParse({
    oldPassword: formData.get("oldPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const rateLimitKey = `changepw:${profile.id}`;
  const rateLimit = isRateLimited(rateLimitKey);
  if (rateLimit.limited) {
    return {
      error: `Too many attempts. Try again in ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes === 1 ? "" : "s"}.`,
    };
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.oldPassword,
  });

  if (verifyError) {
    recordAttempt(rateLimitKey);
    return { error: "Current password is incorrect." };
  }
  clearAttempts(rateLimitKey);

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    logError(`Failed to change password for ${profile.id}:`, updateError);
    return { error: "Failed to update password — try again." };
  }

  return { success: true };
}
