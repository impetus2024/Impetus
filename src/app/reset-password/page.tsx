import { redirect } from "next/navigation";
import { getPasswordResetContext, roleHome } from "@/lib/auth/dal";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const context = await getPasswordResetContext();

  // Reachable two ways: with the session /auth/confirm establishes from a
  // valid emailed link, or with an ordinary signed-in session that
  // verifySession bounced here because the account still holds a temporary
  // password. No session at all means an expired/reused/missing token.
  if (!context) {
    redirect("/login?error=invalid-reset-link");
  }

  // Any other signed-in session would be able to set a new password without
  // knowing the current one — send it home, where the change-password dialog
  // (which does ask for it) lives. The mode is decided server-side from the
  // session and profile, never from the URL.
  if (context.profile && !context.mode) {
    redirect(roleHome(context.profile.role));
  }

  return <ResetPasswordForm required={context.mode === "required"} />;
}
