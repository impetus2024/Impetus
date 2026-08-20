"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { provisionUser, resetUserPassword, ProvisionUserError } from "@/lib/auth/provision-user";
import { absoluteUrl } from "@/lib/url";
import { logError } from "@/lib/logger";

const SuperAdminSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }),
  email: z.email({ error: "Enter a valid email." }),
});

export type SuperAdminFormState = { error?: string } | undefined;

// super_admin has no centre_id (see the centre_required_for_staff check on
// profiles), so this is just provisionUser with no centreId — same account
// flow every other "create someone else's account" action uses.
export async function createSuperAdmin(
  _prev: SuperAdminFormState,
  formData: FormData
): Promise<SuperAdminFormState> {
  await requireRole("super_admin");

  const parsed = SuperAdminSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let emailSent: boolean;
  try {
    const result = await provisionUser({
      email: parsed.data.email,
      fullName: parsed.data.name,
      role: "super_admin",
      loginUrl: absoluteUrl("/login"),
    });
    emailSent = result.emailSent;
  } catch (err) {
    logError(`Failed to provision super admin for ${parsed.data.email}:`, err);
    return {
      error:
        err instanceof ProvisionUserError
          ? err.message
          : "Failed to create the account — please try again.",
    };
  }

  revalidatePath("/super-admin/administrators");

  if (!emailSent) {
    return {
      error:
        "Account created, but the invite email couldn't be sent — use \"Reset Password\" from this row to generate a temporary password you can share directly.",
    };
  }
  return undefined;
}

export type ResetPasswordActionState =
  | { error: string }
  | { tempPassword: string; emailSent: boolean };

export async function resetSuperAdminPassword(
  profileId: string
): Promise<ResetPasswordActionState> {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", profileId)
    .eq("role", "super_admin")
    .maybeSingle();

  if (!target) {
    return { error: "Super admin not found." };
  }

  try {
    const result = await resetUserPassword({
      userId: target.id,
      email: target.email,
      fullName: target.full_name,
      loginUrl: absoluteUrl("/login"),
      centreId: null,
    });
    return result;
  } catch (err) {
    logError(`Failed to reset password for ${target.email}:`, err);
    return { error: "Failed to reset password." };
  }
}
