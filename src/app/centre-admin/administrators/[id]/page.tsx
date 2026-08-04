import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { resolveDocumentLinks } from "@/lib/storage/resolve-document-links";
import { AdministratorDetailForm } from "./administrator-detail-form";

const ROLE_LABEL: Record<string, string> = {
  centre_admin: "Centre Admin",
  coach: "Coach",
  medical: "Medical",
  staff: "Staff",
  finance: "Finance",
};

export default async function AdministratorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
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

  const documentUrls = await resolveDocumentLinks(docKeys);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {profile.email} · {ROLE_LABEL[profile.role] ?? profile.role}
        </p>
      </div>

      <AdministratorDetailForm
        profileId={profile.id}
        fullName={profile.full_name}
        role={profile.role}
        isActive={profile.is_active}
        isSelf={profile.id === centreAdmin.id}
        canEdit={canEdit}
        staffProfile={staffProfile}
        documentUrls={documentUrls}
      />
    </div>
  );
}
