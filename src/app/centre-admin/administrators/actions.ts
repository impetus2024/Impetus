"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  uploadDocFields,
  deleteReplacedDocs,
  discardUploadedDocs,
  guardDocColumns,
  DOCUMENT_CHANGED_MESSAGE,
  DOCUMENT_UPLOAD_FAILED_MESSAGE,
} from "@/lib/storage/upload-doc-fields";
import {
  provisionUser,
  resetUserPassword,
  changeLoginEmail,
  loginEmailInUse,
  sendLoginEmailChangedNotice,
  revokeUserSessions,
  ProvisionUserError,
} from "@/lib/auth/provision-user";
import { StaffDetailsSchema, readStaffDetails, staffDetailsColumns } from "@/lib/staff/profile";
import { absoluteUrl } from "@/lib/url";
import { logError } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type StaffProfileInsert = Database["public"]["Tables"]["staff_profiles"]["Insert"];

// Staff/Finance are read-only accounts (view the same data centre_admin
// sees, no mutation rights anywhere else in the app) — see the 20260803*
// migrations for the RLS side of that.
const StaffRole = z.enum(["centre_admin", "coach", "medical", "staff", "finance"]);

const AdministratorSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }),
  email: z.email({ error: "Enter a valid email." }),
  contactNumber: z.string().min(1, { error: "Contact number is required." }),
  role: StaffRole,
  dateOfBirth: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  dateOfJoining: z.string().optional(),
});

export type AdministratorFormState = { error?: string } | undefined;

function emptyToUndefined(v: FormDataEntryValue | null) {
  return v && v.toString().trim() !== "" ? v.toString() : undefined;
}

export async function createAdministrator(
  _prev: AdministratorFormState,
  formData: FormData
): Promise<AdministratorFormState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = AdministratorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    contactNumber: formData.get("contactNumber"),
    role: formData.get("role"),
    dateOfBirth: emptyToUndefined(formData.get("dateOfBirth")),
    addressLine1: emptyToUndefined(formData.get("addressLine1")),
    addressLine2: emptyToUndefined(formData.get("addressLine2")),
    country: emptyToUndefined(formData.get("country")),
    state: emptyToUndefined(formData.get("state")),
    city: emptyToUndefined(formData.get("city")),
    pincode: emptyToUndefined(formData.get("pincode")),
    dateOfJoining: emptyToUndefined(formData.get("dateOfJoining")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let userId: string;
  let emailSent: boolean;
  try {
    const result = await provisionUser({
      email: parsed.data.email,
      fullName: parsed.data.name,
      role: parsed.data.role,
      centreId: centreAdmin.centre_id!,
      loginUrl: absoluteUrl("/login"),
    });
    userId = result.user.id;
    emailSent = result.emailSent;
  } catch (err) {
    // provisionUser already tolerates email-delivery failures internally
    // (see its own catch around sendAccountInviteEmail) — reaching here
    // means the auth account itself failed to create, most commonly a
    // duplicate email (ProvisionUserError carries a specific message for
    // that case).
    logError(`Failed to provision administrator account for ${parsed.data.email}:`, err);
    return {
      error:
        err instanceof ProvisionUserError
          ? err.message
          : "Failed to create the account — please try again.",
    };
  }

  // profiles row for the new user only exists once the auth trigger runs
  // (see on_auth_user_created); staff_profiles/document uploads use the
  // service-role client since the caller isn't that user.
  const admin = createAdminClient();

  const staffProfile: StaffProfileInsert = {
    profile_id: userId,
    contact_number: parsed.data.contactNumber,
    date_of_birth: parsed.data.dateOfBirth ?? null,
    address_line1: parsed.data.addressLine1 ?? null,
    address_line2: parsed.data.addressLine2 ?? null,
    country: parsed.data.country ?? null,
    state: parsed.data.state ?? null,
    city: parsed.data.city ?? null,
    pincode: parsed.data.pincode ?? null,
    date_of_joining: parsed.data.dateOfJoining ?? null,
  };

  const docFields: { formKey: string; column: keyof StaffProfileInsert }[] = [
    { formKey: "aadhaarCard", column: "aadhaar_doc_path" },
    { formKey: "birthCertificate", column: "birth_certificate_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
    { formKey: "otherDocuments", column: "other_documents_path" },
  ];

  // The auth account already exists by this point (provisionUser above),
  // so a rejected/failed document here can't abort the whole action the
  // way it does in createPlayer — the account is still created and usable, and
  // no document is saved (uploadDocFields is all-or-nothing and removes what it
  // did upload). The failure is reported back below so the documents can be
  // attached again from the detail page.
  const uploads = await uploadDocFields(formData, docFields, `staff-documents/${userId}`, centreAdmin.id);
  if (uploads.error) {
    logError(`Documents not saved while creating administrator ${userId}:`, uploads.error);
  }
  Object.assign(staffProfile, uploads.values);

  const { error: staffError } = await admin
    .from("staff_profiles")
    .insert(staffProfile);

  if (staffError) {
    logError(`Failed to save staff_profiles for new administrator ${userId}:`, staffError);
    // The insert was rejected, so this request's uploads are unreferenced.
    if (staffError.code) await discardUploadedDocs(uploads.values);
    return { error: "Account created, but saving staff details failed." };
  }

  revalidatePath("/centre-admin/administrators");

  const notices: string[] = [];
  if (uploads.error) {
    // The generic storage-failure message says "nothing was saved" and "try
    // again", both wrong here: the account exists, and resubmitting this form
    // would only fail on the now-taken email.
    const reason =
      uploads.error === DOCUMENT_UPLOAD_FAILED_MESSAGE ? "storage couldn't be reached." : uploads.error;
    notices.push(
      `The account was created, but its documents were not saved (${reason}) Attach them again from this administrator's page instead of submitting this form again.`
    );
  }
  if (!emailSent) {
    notices.push(
      "Account created, but the invite email couldn't be sent — use \"Reset Password\" from this administrator's row to generate a temporary password you can share directly."
    );
  }
  return notices.length ? { error: notices.join(" ") } : undefined;
}

const UpdateAdministratorSchema = StaffDetailsSchema.extend({
  role: StaffRole,
  email: z.email({ error: "Enter a valid email." }).optional(),
  dateOfJoining: z.iso.date({ error: "Enter a valid date of joining." }).optional(),
  updatedAt: z.string().optional(),
});

// Shown when the form's profiles.updated_at no longer matches the row: someone
// else saved this administrator (or changed their login) since it was loaded.
const STALE_ADMINISTRATOR_MESSAGE =
  "This administrator was changed by someone else. Reload the page and try again.";

// Shown when a login email is already taken by a different account — same
// wording as the parent email change (centre-admin/players/actions.ts).
const EMAIL_IN_USE_MESSAGE =
  "An account with this email already exists — they may already be registered under a different role or centre.";

// A coach's role is locked in this form — both the disabled field in
// AdministratorDetailForm and, authoritatively, the check in
// updateAdministrator below. Role editing stays available for the other
// managed roles (centre_admin/medical/staff/finance).
const COACH_ROLE_LOCKED_MESSAGE = "A coach's role can't be changed here.";

export type UpdateAdministratorState = { error?: string } | undefined;

// Email is editable for coach accounts only, and never by writing
// profiles.email: it moves the auth.users login in place (changeLoginEmail,
// shared with the parent email change), so the profile id and every batch
// and attendance row pointing at it are untouched. centre_id is never
// written here. Role is editable for the managed non-coach roles (relaxed by
// the 20260804000000 migration, which still keeps centre_admin from moving
// anyone to/from super_admin or across centres) but locked out for the
// caller's own row below to avoid a centre_admin locking themselves out, and
// for coach accounts entirely (see COACH_ROLE_LOCKED_MESSAGE).
export async function updateAdministrator(
  profileId: string,
  _prev: UpdateAdministratorState,
  formData: FormData
): Promise<UpdateAdministratorState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = UpdateAdministratorSchema.safeParse({
    ...readStaffDetails(formData),
    role: formData.get("role"),
    email: emptyToUndefined(formData.get("email")),
    dateOfJoining: emptyToUndefined(formData.get("dateOfJoining")),
    updatedAt: emptyToUndefined(formData.get("updatedAt")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Without the version the form was loaded with, the request can't prove it
  // isn't overwriting a newer save (or reverting a newer login email).
  if (!parsed.data.updatedAt) {
    return { error: STALE_ADMINISTRATOR_MESSAGE };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!target) {
    return { error: "Administrator not found." };
  }

  if (profileId === centreAdmin.id && parsed.data.role !== target.role) {
    return { error: "You can't change your own role." };
  }

  // A coach's role is fixed once the account is a coach. Every batch
  // (head_coach_id/assistant_coach_id), attendance row (marked_by) and 5S
  // record hangs off this profile id, so moving it out of the coach role
  // silently changes what the account can see and mark without any of those
  // links being reviewed — and because RLS reads the role from the JWT
  // (private.user_role()), the change wouldn't even take effect for the
  // affected user until their access token refreshes. The select is narrowed
  // in AdministratorDetailForm too; this is the authoritative half.
  if (target.role === "coach" && parsed.data.role !== "coach") {
    return { error: COACH_ROLE_LOCKED_MESSAGE };
  }

  // GoTrue stores auth.users.email lowercased (profiles.email mirrors it), so
  // a case-only difference is not a change and must not revoke sessions or
  // send anything.
  const newEmail = parsed.data.email;
  const emailChanging =
    newEmail !== undefined && newEmail.toLowerCase() !== target.email.toLowerCase();

  if (emailChanging && target.role !== "coach") {
    return { error: "Only a coach's login email can be changed here." };
  }

  type DocColumn =
    | "aadhaar_doc_path"
    | "birth_certificate_path"
    | "profile_picture_path"
    | "other_documents_path";
  const docFields: { formKey: string; column: DocColumn }[] = [
    { formKey: "aadhaarCard", column: "aadhaar_doc_path" },
    { formKey: "birthCertificate", column: "birth_certificate_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
    { formKey: "otherDocuments", column: "other_documents_path" },
  ];

  const { data: existing } = await supabase
    .from("staff_profiles")
    .select("aadhaar_doc_path, birth_certificate_path, profile_picture_path, other_documents_path")
    .eq("profile_id", profileId)
    .maybeSingle();

  // Uploaded before anything is written, so a failed or rejected document
  // stops the whole save (nothing is saved, and uploadDocFields has already
  // removed whatever it did upload). From here on, every early return also
  // discards this request's uploads: they are only kept once the staff_profiles
  // write at the end has pointed at them.
  const uploads = await uploadDocFields(formData, docFields, `staff-documents/${profileId}`, centreAdmin.id);
  if (uploads.error) {
    return { error: uploads.error };
  }
  const failAndDiscard = async (error: string): Promise<UpdateAdministratorState> => {
    await discardUploadedDocs(uploads.values);
    return { error };
  };

  // Read-only duplicate check first, so the ordinary "address already taken"
  // rejection happens before anything is written.
  if (emailChanging && (await loginEmailInUse(newEmail, profileId))) {
    return failAndDiscard(EMAIL_IN_USE_MESSAGE);
  }

  // The name/role write doubles as the stale check, and runs BEFORE the login
  // moves: a compare-and-swap on profiles.updated_at that matches only if
  // nobody has written this profile since the form loaded. A stale form (whose
  // email field still holds the address it was loaded with) matches zero rows
  // and returns here, before any auth.users/profiles.email change or session
  // revocation, so it can never revert a newer login email. Email changes
  // always bump profiles.updated_at (handle_auth_user_sync upserts the row), so
  // the version covers them too. It can't be the guard on a later write: the
  // email move below bumps the version again.
  const { data: saved, error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.name, role: parsed.data.role })
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!)
    .eq("updated_at", parsed.data.updatedAt)
    .select("id")
    .maybeSingle();

  if (profileError) {
    logError(`Failed to save profile for administrator ${profileId}:`, profileError);
    return failAndDiscard("Failed to save changes.");
  }

  if (!saved) {
    return failAndDiscard(STALE_ADMINISTRATOR_MESSAGE);
  }

  // Once the login has moved, the owner is told at the new address straight
  // away — the same password-setup notice a parent gets — since nothing below
  // can undo the auth change.
  let emailChangeNotified = true;
  if (emailChanging) {
    const result = await changeLoginEmail(profileId, newEmail);
    if (result !== "ok") {
      return failAndDiscard(
        `${
          result === "email_in_use" ? EMAIL_IN_USE_MESSAGE : "Failed to update the coach's login email."
        } The name and role were saved.`
      );
    }

    try {
      await sendLoginEmailChangedNotice({
        userId: profileId,
        newEmail,
        previousEmail: target.email,
        fullName: parsed.data.name,
        centreId: centreAdmin.centre_id!,
      });
    } catch (err) {
      emailChangeNotified = false;
      logError(`Email-change notification not sent to ${newEmail} for coach ${profileId}:`, err);
    }
  }

  // A row is created when there is none: an administrator provisioned outside
  // this form's own "create" flow (the centre's first admin, auto-provisioned
  // by super-admin's createCentre; or a directly-seeded test account) never
  // gets a staff_profiles row in the first place, and update() against a
  // profile_id with no matching row silently affects zero rows.
  //
  // Both branches are conflict-safe for documents. staff_profiles has no
  // updated_at, so an existing row is updated with a compare-and-swap on the
  // document columns being replaced (guardDocColumns), and a missing row is
  // inserted, which loses cleanly (23505) to a concurrent insert instead of
  // upserting over it. Either way the losing request's uploads are discarded
  // and the winner's stay referenced.
  const staffValues = {
    ...staffDetailsColumns(parsed.data),
    date_of_joining: parsed.data.dateOfJoining ?? null,
    ...uploads.values,
  };
  let staffSaved = true;
  let staffError: { code?: string } | null = null;
  if (existing) {
    const result = await guardDocColumns(
      supabase.from("staff_profiles").update(staffValues).eq("profile_id", profileId),
      existing,
      uploads.values
    ).select("profile_id");
    staffError = result.error;
    staffSaved = (result.data?.length ?? 0) > 0;
  } else {
    staffError = (
      await supabase.from("staff_profiles").insert({ profile_id: profileId, ...staffValues })
    ).error;
  }

  if (
    staffError?.code === "23505" ||
    (!staffError && !staffSaved && Object.keys(uploads.values).length > 0)
  ) {
    return failAndDiscard(DOCUMENT_CHANGED_MESSAGE);
  }
  if (staffError) {
    logError(`Failed to save staff_profiles for administrator ${profileId}:`, staffError);
    if (staffError.code) await discardUploadedDocs(uploads.values);
    return { error: "Failed to save changes." };
  }

  if (existing) {
    deleteReplacedDocs<DocColumn>(existing, uploads.values, {
      entityType: "staff_profile",
      entityId: profileId,
      centreId: centreAdmin.centre_id,
      actorId: centreAdmin.id,
    });
  }

  revalidatePath(`/centre-admin/administrators/${profileId}`);
  revalidatePath("/centre-admin/administrators");

  if (!emailChangeNotified) {
    return {
      error:
        "Saved, and the coach's login email was changed — but we couldn't email them about it. Let them know their new sign-in address directly.",
    };
  }
  return undefined;
}

export async function setAdministratorActive(profileId: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");

  if (!active && profileId === centreAdmin.id) {
    throw new Error("You can't disable your own account.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to ${active ? "enable" : "disable"} administrator ${profileId}:`, error);
    throw error;
  }

  // Disabling only blocks *new* app requests (see verifySession's is_active
  // check) — an already-issued access token stays locally valid until it
  // expires. Revoking server-side closes the rest of that gap the same way
  // resetUserPassword does: same caveats, see that function's migration.
  if (!active) {
    await revokeUserSessions(profileId, "disabling the account");
  }

  revalidatePath("/centre-admin/administrators");
}

export type ResetPasswordActionState =
  | { error: string }
  | { tempPassword: string; emailSent: boolean };

// Recovery path for staff who can't self-service "forgot password" (no
// working inbox, or the original invite email never arrived because
// Resend isn't configured) — see resetUserPassword's doc comment.
export async function resetAdministratorPassword(
  profileId: string
): Promise<ResetPasswordActionState> {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!)
    .in("role", ["centre_admin", "coach", "medical", "staff", "finance"])
    .maybeSingle();

  if (!staff) {
    return { error: "Administrator not found." };
  }

  try {
    const result = await resetUserPassword({
      userId: staff.id,
      email: staff.email,
      fullName: staff.full_name,
      loginUrl: absoluteUrl("/login"),
      centreId: centreAdmin.centre_id!,
    });
    return result;
  } catch (err) {
    logError(`Failed to reset password for ${staff.email}:`, err);
    return { error: "Failed to reset password." };
  }
}
