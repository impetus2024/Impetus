import "server-only";
import { randomBytes } from "crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAccountInviteEmail, sendEmailChangedEmail } from "@/lib/email/send";
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
// Deliberately built from `hashed_token` rather than returned as Supabase's
// own `action_link`. action_link points at GoTrue's /auth/v1/verify, and
// because this runs on the service-role client there is no PKCE code verifier
// for it to pair with — so GoTrue resolves it through the *implicit* grant and
// redirects to /auth/confirm with #access_token=... in the URL *fragment*.
// Fragments are never sent to the server, so /auth/confirm (a Route Handler)
// saw neither `code` nor `token_hash` and bounced every one of these links to
// /login?error=invalid-reset-link. requestPasswordReset never hit this because
// it runs on the @supabase/ssr client, which is PKCE and does get `?code=`.
//
// hashed_token is the same token in the form verifyOtp() consumes, so pointing
// straight at /auth/confirm keeps the whole exchange server-side: no fragment,
// and the link therefore also survives being opened in a new tab or a
// different browser from the one that triggered the change. No redirect
// allowlist entry is needed either, since Supabase is no longer doing the
// redirecting.
//
// Returns null rather than throwing: the caller's email still has a usable
// fallback ("Forgot password?"), and a link failure must not undo a change
// that already succeeded.
export async function generatePasswordSetupLink(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    logWarning(`Could not generate a password setup link for ${email}:`, error);
    return null;
  }

  const url = new URL(absoluteUrl("/auth/confirm"));
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "recovery");
  return url.toString();
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
  await revokeUserSessions(userId, "an admin password reset");

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

// Ends every session the user holds. Shared by each flow that changes a
// credential or login identity (admin reset, email change, self-service and
// recovery password changes). See the revoke_user_sessions migration for the
// caveat: an already-issued access token only dies at its natural expiry.
//
// Logged, not thrown: the change it accompanies has already succeeded and
// matters more than this hardening step.
export async function revokeUserSessions(userId: string, reason: string): Promise<void> {
  const { error } = await createAdminClient().rpc("revoke_user_sessions", {
    target_user_id: userId,
  });
  if (error) {
    logError(`Failed to revoke existing sessions for user ${userId} after ${reason}:`, error);
  }
}

export type ChangeLoginEmailResult = "ok" | "email_in_use" | "failed";

// Moves an account's login email in auth.users (the source of truth);
// handle_auth_user_sync then mirrors it into profiles.email. Shared by the
// parent (updateParentProfile) and coach (updateAdministrator) email-change
// flows so duplicate detection and session revocation can't drift apart.
//
// handle_auth_user_sync rewrites role/centre_id/full_name from the auth
// metadata on every email update, and that metadata can lag behind profiles
// (updateAdministrator edits profiles.full_name/role directly). The current
// profile values are therefore written back in the same call, so the email
// change leaves role, centre and name exactly as they were.
export async function changeLoginEmail(
  userId: string,
  newEmail: string
): Promise<ChangeLoginEmailResult> {
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, centre_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    logError(`Failed to load profile ${userId} before changing its login email:`, profileError);
    return "failed";
  }

  const { error: emailError } = await admin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
    app_metadata: { role: profile.role, centre_id: profile.centre_id },
    user_metadata: { full_name: profile.full_name },
  });

  if (emailError) {
    // GoTrue's admin UPDATE endpoint has no duplicate-email pre-check the
    // way createUser does: an address that's already taken reaches
    // auth.users' users_email_partial_key unique index and comes back as
    // HTTP 500 carrying a Postgres 23505 body. supabase-js folds every 5xx
    // into an AuthRetryableFetchError *without* parsing that body, so
    // emailError.code is undefined and message is "{}" -- meaning the
    // email_exists test alone can never match here. Ask profiles which case
    // this was: it mirrors auth.users.email via the on_auth_user_updated
    // trigger, and stores it lowercased the way GoTrue does.
    logError(`Failed to update the login email for user ${userId} (-> ${newEmail}):`, emailError);

    const { data: conflictingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", newEmail.toLowerCase())
      .neq("id", userId)
      .maybeSingle();

    return conflictingProfile || emailError.code === "email_exists" ? "email_in_use" : "failed";
  }

  // The login identity just changed under whoever is holding a session on
  // this account.
  await revokeUserSessions(userId, "an email change");
  return "ok";
}

// Sent to the NEW address once every write for an email change has
// succeeded: Supabase's single-use recovery link (generatePasswordSetupLink)
// inside the existing email-changed template. Throws when the send fails so
// the caller can tell the operator; the change itself stands either way.
export async function sendLoginEmailChangedNotice(params: {
  userId: string;
  newEmail: string;
  previousEmail: string;
  fullName: string;
  centreId: string | null;
}): Promise<void> {
  const { userId, newEmail, previousEmail, fullName, centreId } = params;
  const passwordSetupUrl = await generatePasswordSetupLink(newEmail);
  await sendEmailChangedEmail({
    to: newEmail,
    fullName,
    passwordSetupUrl,
    loginUrl: absoluteUrl("/login"),
    recipientProfileId: userId,
    centreId,
    // Stable across retries of the same change, distinct per change, and
    // enforced by a unique index on email_logs — so a double-submit or a
    // re-run after a partial failure sends one email, not two. The one case
    // it also suppresses is changing an address away and back to a previous
    // value, which would reuse the same key; that recipient has already had
    // this exact notice.
    idempotencyKey: `email_changed:${userId}:${previousEmail.toLowerCase()}->${newEmail.toLowerCase()}`,
  });
}
