import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAccountInviteEmail } from "@/lib/email/send";
import { logError, logWarning } from "@/lib/logger";
import type { UserRole } from "@/lib/auth/roles";

function generateTempPassword(): string {
  // DEV_DEFAULT_PASSWORD lets every provisioned account share one known
  // password during local testing, when there's no email service to
  // deliver a random one. Never set this in a deployed environment.
  if (process.env.DEV_DEFAULT_PASSWORD) {
    return process.env.DEV_DEFAULT_PASSWORD;
  }
  // 24 chars of base64url — well above Supabase's default minimum, no
  // ambiguous characters to transcribe since it's only ever emailed, not
  // typed from a printout.
  return randomBytes(18).toString("base64url");
}

// Shared by every "create an account for someone else" flow (Super Admin
// creating a centre's first Centre Admin, Centre Admin creating Coach/
// Medical/Administrator accounts, and the Player form auto-inviting a
// parent). Creates the auth user with role/centre_id in app_metadata (the
// on_auth_user_created / on_auth_user_updated triggers sync this into
// public.profiles), then emails the temp password.
export async function provisionUser(params: {
  email: string;
  fullName: string;
  role: UserRole;
  centreId?: string;
  loginUrl: string;
}) {
  const { email, fullName, role, centreId, loginUrl } = params;
  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role, centre_id: centreId ?? null },
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    throw error ?? new Error("Failed to create user");
  }

  // The account is already usable at this point (password is set above).
  // Email delivery is a notification, not a precondition — don't undo the
  // account creation just because RESEND_API_KEY isn't configured yet.
  try {
    await sendAccountInviteEmail({ to: email, fullName, tempPassword, loginUrl });
  } catch (err) {
    logWarning(`Invite email not sent for ${email}:`, err);
  }

  return data.user;
}

// Recovery path for accounts that can't use self-service "forgot password"
// (no working inbox, invite email never arrived because Resend isn't
// configured). Always returns the new password to the caller — shown
// once in the admin UI — precisely because email delivery can't be
// trusted to have worked; a centre admin can then relay it out of band.
export async function resetUserPassword(params: {
  userId: string;
  email: string;
  fullName: string;
  loginUrl: string;
}): Promise<{ tempPassword: string; emailSent: boolean }> {
  const { userId, email, fullName, loginUrl } = params;
  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) throw error;

  // Penetration test finding: changing the password alone left any
  // already-issued session usable — confirmed live, an old access token
  // kept working after this exact call. supabase-js's admin API has no
  // "revoke every session for user X" method (signOut() needs that
  // session's own JWT, which we don't have here), so this goes through a
  // security-definer function instead (see its migration for the full
  // caveat: this stops the session being refreshed, but per JWT
  // statelessness an already-issued access token is only fully dead once
  // it naturally expires). Logged, not thrown — the password change
  // already succeeded and matters more than this secondary hardening step.
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", {
    target_user_id: userId,
  });
  if (revokeError) {
    logError(`Failed to revoke existing sessions for ${email} after password reset:`, revokeError);
  }

  let emailSent = false;
  try {
    await sendAccountInviteEmail({ to: email, fullName, tempPassword, loginUrl });
    emailSent = true;
  } catch (err) {
    logWarning(`Password reset email not sent for ${email}:`, err);
  }

  return { tempPassword, emailSent };
}
