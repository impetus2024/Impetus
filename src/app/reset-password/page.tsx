import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Reachable two ways: with the session /auth/confirm establishes from a
  // valid emailed link, or with an ordinary signed-in session that
  // verifySession bounced here because the account still holds a temporary
  // password (?required=1). No session at all means an expired/reused/missing
  // token.
  //
  // Reads the session directly rather than through verifySession so the
  // forced-change redirect has somewhere to land.
  if (!data?.claims) {
    redirect("/login?error=invalid-reset-link");
  }

  const { required } = await searchParams;

  return <ResetPasswordForm required={required === "1"} />;
}
