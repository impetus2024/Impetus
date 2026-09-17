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
