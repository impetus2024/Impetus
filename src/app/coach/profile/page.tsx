import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveDocumentLinks } from "@/lib/storage/resolve-document-links";
import { CoachProfileForm } from "./coach-profile-form";

export default async function CoachProfilePage() {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("*")
    .eq("profile_id", coach.id)
    .maybeSingle();

  const documentUrls = await resolveDocumentLinks({
    profilePicture: staffProfile?.profile_picture_path,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground">{coach.email}</p>
      </div>

      <CoachProfileForm
        fullName={coach.full_name}
        staffProfile={staffProfile}
        documentUrls={documentUrls}
      />
    </div>
  );
}
