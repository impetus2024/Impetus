import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { getSignedFileUrl } from "@/lib/storage/r2";
import { AdministratorDetailForm } from "./administrator-detail-form";

const ROLE_LABEL: Record<string, string> = {
  centre_admin: "Centre Admin",
  coach: "Coach",
  medical: "Medical",
};

export default async function AdministratorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!profile) notFound();

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("*")
    .eq("profile_id", id)
    .maybeSingle();

  const docKeys = {
    aadhaar: staffProfile?.aadhaar_doc_path,
    birthCertificate: staffProfile?.birth_certificate_path,
    profilePicture: staffProfile?.profile_picture_path,
    otherDocuments: staffProfile?.other_documents_path,
  };

  const documentUrls: Record<string, string> = {};
  for (const [label, key] of Object.entries(docKeys)) {
    if (key) {
      try {
        documentUrls[label] = await getSignedFileUrl(key);
      } catch {
        // storage not configured — link simply won't be shown
      }
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {profile.email} · {ROLE_LABEL[profile.role] ?? profile.role}
        </p>
      </div>

      <AdministratorDetailForm
        profileId={profile.id}
        fullName={profile.full_name}
        isActive={profile.is_active}
        staffProfile={staffProfile}
        documentUrls={documentUrls}
      />
    </div>
  );
}
