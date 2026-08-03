import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/dal";
import { getParentChildren } from "@/lib/parent/children";
import { resolveDocumentLinks } from "@/lib/storage/resolve-document-links";
import { Card, CardContent } from "@/components/ui/card";
import { InjuryReportsTable } from "@/components/injuries/injury-reports-table";
import { ProfileCard } from "@/components/profile/profile-card";
import { ProfileMenu, type ProfileSection } from "@/components/profile/profile-menu";
import { AttendanceCalendar } from "@/components/profile/attendance-calendar";
import { FiveSResultsView } from "@/components/profile/five-s-results-view";
import { PlayerProfileView } from "@/components/profile/player-profile-view";
import { ParentProfileView } from "@/components/profile/parent-profile-view";
import { PackageDetailsSection } from "@/components/profile/package-details-section";
import { DocumentsSection } from "@/components/profile/documents-section";
import { ChildSelect } from "../child-select";

type Option = { id: string; name: string };
type LookupTable = "age_categories" | "player_types" | "packages" | "batches";

export default async function ParentPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string; section?: string; month?: string }>;
}) {
  const parent = await requireRole("parent");
  const { playerId, section: sectionParam, month } = await searchParams;

  const children = await getParentChildren(parent.id);
  const selectedId = playerId || children[0]?.id;

  const validSections: ProfileSection[] = [
    "profile",
    "parent",
    "packageDetails",
    "documents",
    "attendance",
    "injuries",
    "5s",
  ];
  const section: ProfileSection = validSections.includes(sectionParam as ProfileSection)
    ? (sectionParam as ProfileSection)
    : "profile";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Player</h1>
        <ChildSelect options={children} selectedId={selectedId} basePath="/parent/player" />
      </div>

      {selectedId ? (
        <PlayerProfileSections playerId={selectedId} section={section} month={month} />
      ) : (
        <p className="text-muted-foreground">No children linked to your account yet.</p>
      )}
    </div>
  );
}

// Lookup tables (age_categories/player_types/packages/batches) have no RLS
// policy for the parent role — only staff roles can read them — so an
// embedded join in the player query above resolves to null for a parent,
// same root cause documented on the centre-admin batch-name lookup. A
// parent has already been proven (via the RLS-scoped players query itself)
// to be linked to this specific player, so a narrow admin-client lookup of
// just the one relevant row's name is safe here.
async function resolveOne(
  admin: ReturnType<typeof createAdminClient>,
  table: LookupTable,
  id: string | null
): Promise<Option[]> {
  if (!id) return [];
  const { data } = await admin.from(table).select("id, name").eq("id", id).maybeSingle();
  return data ? [data] : [];
}

async function PlayerProfileSections({
  playerId,
  section,
  month,
}: {
  playerId: string;
  section: ProfileSection;
  month?: string;
}) {
  const supabase = await createClient();

  // RLS-scoped: only resolves if this player is actually linked to the
  // signed-in parent (see the "parents view own children" policy).
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();

  if (!player) return null;

  const admin = createAdminClient();
  const [ageCategories, playerTypes, packages, batches] = await Promise.all([
    resolveOne(admin, "age_categories", player.age_category_id),
    resolveOne(admin, "player_types", player.player_type_id),
    resolveOne(admin, "packages", player.package_id),
    resolveOne(admin, "batches", player.batch_id),
  ]);

  // Same no-RLS-for-parent reasoning as resolveOne above, but the "Package
  // Details" view needs price/discount/custom fields too, not just id/name.
  const { data: packageDetails } = player.package_id
    ? await admin
        .from("packages")
        .select("name, price, is_custom, custom_amount, discount")
        .eq("id", player.package_id)
        .maybeSingle()
    : { data: null };

  const documentLinks = await resolveDocumentLinks({
    profilePicture: player.profile_picture_path,
    aadhaar: player.aadhaar_doc_path,
    medicalRecords: player.medical_records_path,
  });

  const basePath = `/parent/player?playerId=${playerId}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <ProfileCard
          name={player.name}
          dateOfBirth={player.date_of_birth}
          batchName={batches[0]?.name ?? null}
          playerTypeName={playerTypes[0]?.name ?? null}
          isActive={player.is_active}
          profilePictureUrl={documentLinks.profilePicture}
        />
        <Card className="rounded-2xl border-border/50 py-3 shadow-soft">
          <CardContent className="px-3">
            <ProfileMenu
              basePath={basePath}
              active={section}
              sections={["profile", "parent", "packageDetails", "documents", "attendance", "injuries", "5s"]}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
        <CardContent className="px-6">
          {section === "profile" && (
            <PlayerProfileView
              values={{
                name: player.name,
                dateOfBirth: player.date_of_birth,
                ageCategoryId: player.age_category_id,
                email: player.email,
                contactNumber: player.contact_number,
                playerTypeId: player.player_type_id,
                packageId: player.package_id,
                batchId: player.batch_id,
                gender: player.gender,
                bloodGroup: player.blood_group,
                heightCm: player.height_cm,
                weightKg: player.weight_kg,
                birthMark: player.birth_mark,
                medicalCondition: player.medical_condition,
                foodAllergy: player.food_allergy,
                aiffNumber: player.aiff_number,
              }}
              ageCategories={ageCategories}
              playerTypes={playerTypes}
              packages={packages}
              batches={batches}
              documentLinks={documentLinks}
            />
          )}

          {section === "parent" && (
            <ParentProfileView
              values={{
                fatherName: player.father_name,
                motherName: player.mother_name,
                parentEmail: player.parent_email,
                parentContactNumber: player.parent_contact_number,
                addressLine1: player.address_line1,
                addressLine2: player.address_line2,
                country: player.country,
                state: player.state,
                city: player.city,
                pincode: player.pincode,
              }}
            />
          )}

          {section === "packageDetails" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Package Details</h2>
                <p className="text-sm text-muted-foreground">Package and payment terms for this player</p>
              </div>
              <PackageDetailsSection
                packageName={packageDetails?.name ?? null}
                price={packageDetails?.price ?? null}
                isCustom={packageDetails?.is_custom ?? false}
                customAmount={packageDetails?.is_custom ? packageDetails.custom_amount : null}
                discount={packageDetails?.is_custom ? packageDetails.discount : null}
                assignedAt={player.created_at}
              />
            </div>
          )}

          {section === "documents" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Documents</h2>
                <p className="text-sm text-muted-foreground">Uploaded for this player</p>
              </div>
              <DocumentsSection documentLinks={documentLinks} />
            </div>
          )}

          {section === "attendance" && (
            <AttendanceCalendar playerId={playerId} month={month} basePath={`${basePath}&section=attendance`} />
          )}

          {section === "injuries" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Injuries</h2>
                <p className="text-sm text-muted-foreground">Reported by coach or medical staff</p>
              </div>
              <InjuryReportsTable playerId={playerId} />
            </div>
          )}

          {section === "5s" && (
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Link
                  href={`/parent/5s-model?playerId=${playerId}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open full results page
                </Link>
              </div>
              <FiveSResultsView playerId={playerId} gateUntilPublished />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
