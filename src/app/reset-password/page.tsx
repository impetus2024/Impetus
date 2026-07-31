import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Only reachable with the session /auth/confirm establishes from a valid
  // emailed link — no session here means an expired/reused/missing token.
  if (!data?.claims) {
    redirect("/login?error=invalid-reset-link");
  }

  return <ResetPasswordForm />;
}
