import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAccountInviteEmail } from "@/lib/email/send";
import type { UserRole } from "@/lib/auth/roles";

function generateTempPassword(): string {
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

  await sendAccountInviteEmail({
    to: email,
    fullName,
    tempPassword,
    loginUrl,
  });

  return data.user;
}
