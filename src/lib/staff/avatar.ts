import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/storage/r2";
import { logError } from "@/lib/logger";

// Resolves the signed URL for a staff member's own uploaded profile picture
// (staff_profiles.profile_picture_path, set via the Administrator form) —
// used to show their real photo in the topbar instead of just initials.
// Only centre_admin/coach/medical/staff/finance ever have a staff_profiles
// row (see 20260727125052_core_schema.sql); super_admin/parent never do, so
// callers for those roles skip this entirely rather than querying for
// nothing. A longer expiry than resolveDocumentLinks's default (300s) since
// this is shown continuously in the UI chrome, not clicked through once.
export async function getOwnAvatarUrl(profileId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select("profile_picture_path")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!data?.profile_picture_path) return undefined;

  try {
    return await getSignedFileUrl(data.profile_picture_path, 3600);
  } catch (err) {
    logError(`Failed to sign avatar URL for profile ${profileId}:`, err);
    return undefined;
  }
}
