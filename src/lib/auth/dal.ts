import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome, type UserRole } from "@/lib/auth/roles";

export { roleHome, type UserRole };

// Verifies the JWT (local signature check, no DB round trip — see
// GoTrueClient.getClaims) and loads the caller's profile row, which is the
// source of truth for role/centre_id. Memoized per request via React cache.
export const verifySession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const userId = data.claims.sub;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, centre_id, full_name, email, is_active, must_change_password")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  if (!profile.is_active) {
    redirect("/login?disabled=1");
  }

  // The account is holding a temporary password that was emailed to it (see
  // provisionUser/resetUserPassword) — it stays usable for exactly one thing,
  // replacing that password, until the flag is cleared by updatePassword.
  //
  // No redirect loop: /reset-password reads the session directly rather than
  // through verifySession, precisely so it stays reachable here, and its
  // action clears the flag before redirecting on to the role's home.
  if (profile.must_change_password) {
    redirect("/reset-password?required=1");
  }

  return profile;
});

// Authentication methods GoTrue records in the JWT's `amr` claim for a session
// opened from an emailed link: "recovery" when /auth/confirm exchanges a PKCE
// code (forgot-password), "otp" when it verifies a token_hash (the admin
// password-setup link). Both confirmed against this project's GoTrue. An
// ordinary sign-in records "password" instead.
const EMAIL_LINK_AMR_METHODS = new Set(["recovery", "otp", "magiclink"]);

export type PasswordResetMode = "recovery" | "required";

// Who may use /reset-password, and in which mode. It sets a password without
// asking for the current one, so it is only for:
// - "recovery": a session opened from an emailed recovery link, or
// - "required": an account still holding a temporary password
//   (must_change_password), which verifySession sends here.
// Any other signed-in session gets mode null and must use the change-password
// dialog, which does require the current password.
//
// Reads the session directly rather than through verifySession, since that
// redirects must_change_password accounts to this very page.
export async function getPasswordResetContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email, is_active, must_change_password")
    .eq("id", claims.sub)
    .maybeSingle();

  const fromEmailLink = (claims.amr ?? []).some(
    (entry) => typeof entry !== "string" && EMAIL_LINK_AMR_METHODS.has(entry.method)
  );
  const mode: PasswordResetMode | null = fromEmailLink
    ? "recovery"
    : profile?.must_change_password
      ? "required"
      : null;

  return { profile: profile ?? null, mode };
}

// Use in Server Components/Actions/Route Handlers that are only valid for
// specific roles. Redirects rather than throwing so a stale link just lands
// the user back on their own dashboard instead of an error page.
export async function requireRole(...allowed: UserRole[]) {
  const profile = await verifySession();

  if (!allowed.includes(profile.role)) {
    redirect(roleHome(profile.role));
  }

  return profile;
}
