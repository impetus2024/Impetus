import "server-only";
import { randomBytes } from "crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAccountInviteEmail } from "@/lib/email/send";
import { absoluteUrl } from "@/lib/url";
import { logError, logWarning } from "@/lib/logger";
import type { UserRole } from "@/lib/auth/roles";

// Thrown for rejections the caller should show back to the user as-is
// (same convention as UploadValidationError in r2.ts), as opposed to a
// generic "something went wrong".
export class ProvisionUserError extends Error {}

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

// Marks an account as holding a temporary credential. verifySession
// (src/lib/auth/dal.ts) then sends the owner to /reset-password until they
// have replaced it, so an emailed temp password can't quietly stay valid for
// the life of the account.
//
// Non-fatal on failure, same reasoning as revoke_user_sessions below: the
// password change/account creation it accompanies has already happened and
// matters more than this hardening step. Written on the service-role client —
// the column is locked against authenticated writes (see its migration).
async function flagPasswordChangeRequired(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);
  if (error) {
    logError(`Failed to flag must_change_password for user ${userId}:`, error);
  }
}

// One-time link the recipient can use to set their own password, as an
// alternative to being sent a generated one. Supabase mints it (single-use,
// short-lived, invalidated once used), so nothing here is a credential this
// app created or has to store.
//
// redirectTo is the same bare /auth/confirm path requestPasswordReset uses —
// Supabase's redirect allowlist matches exact URLs, so both flows must point
// at the same one (see forgot-password/actions.ts).
//
// Returns null rather than throwing: the caller's email still has a usable
// fallback ("Forgot password?"), and a link failure must not undo a change
// that already succeeded.
export async function generatePasswordSetupLink(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: absoluteUrl("/auth/confirm") },
  });

  if (error || !data?.properties?.action_link) {
    logWarning(`Could not generate a password setup link for ${email}:`, error);
    return null;
  }

  return data.properties.action_link;
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
}): Promise<{ user: User; emailSent: boolean }> {
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

  // Confirmed in production (2026-07-31): createUser's error carries this
  // exact code (status 422) when the email is already registered to another
  // account — surfaced as a specific, actionable message rather than the
  // generic fallback below.
  if (error?.code === "email_exists") {
    throw new ProvisionUserError(
      "An account with this email already exists — they may already be registered under a different role or centre."
    );
  }

  if (error || !data.user) {
    throw error ?? new Error("Failed to create user");
  }

  await flagPasswordChangeRequired(data.user.id);

  // The account is already usable at this point (password is set above).
  // Email delivery is a notification, not a precondition — don't undo the
  // account creation just because RESEND_API_KEY isn't configured yet.
  // emailSent is reported back to the caller (see resetUserPassword below)
  // so the UI can tell the operator when nothing actually went out, instead
  // of silently succeeding with no way to reach the new account.
  let emailSent = false;
  try {
    await sendAccountInviteEmail({
      to: email,
      fullName,
      tempPassword,
      loginUrl,
      emailType: "account_invite",
      recipientProfileId: data.user.id,
      centreId: centreId ?? null,
    });
    emailSent = true;
  } catch (err) {
    logWarning(`Invite email not sent for ${email}:`, err);
  }

  return { user: data.user, emailSent };
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
  centreId: string | null;
}): Promise<{ tempPassword: string; emailSent: boolean }> {
  const { userId, email, fullName, loginUrl, centreId } = params;
  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) throw error;

  await flagPasswordChangeRequired(userId);

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
    await sendAccountInviteEmail({
      to: email,
      fullName,
      tempPassword,
      loginUrl,
      emailType: "password_reset",
      recipientProfileId: userId,
      centreId,
    });
    emailSent = true;
  } catch (err) {
    logWarning(`Password reset email not sent for ${email}:`, err);
  }

  return { tempPassword, emailSent };
}
