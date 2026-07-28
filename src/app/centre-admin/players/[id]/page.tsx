import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { getSignedFileUrl } from "@/lib/storage/r2";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InjuryReportsTable } from "@/components/injuries/injury-reports-table";
import { ProfileMenu, type ProfileSection } from "@/components/profile/profile-menu";
import { ProfileCard } from "@/components/profile/profile-card";
import { AttendanceCalendar } from "@/components/profile/attendance-calendar";
import { FiveSResultsView } from "@/components/profile/five-s-results-view";
import { updatePlayerProfile, updateParentProfile, setPlayerActive } from "../actions";
import { DeactivatePlayerButton } from "./deactivate-button";
import { PlayerProfileForm } from "./player-profile-form";
import { ParentProfileForm } from "./parent-profile-form";

type Option = { id: string; name: string };
type LookupTable = "age_categories" | "player_types" | "packages" | "batches";

// The dropdowns only offer active lookups (you shouldn't newly assign a
// player to a deactivated batch/package/etc.), but a player already
// assigned to one that's since been deactivated still needs their current
// value to actually show as selected, not silently fall back to the
// placeholder — so make sure it's present in the option list either way.
async function ensureOptionIncluded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: LookupTable,
  options: Option[],
  currentId: string | null
): Promise<Option[]> {
  if (!currentId || options.some((o) => o.id === currentId)) return options;
  const { data } = await supabase.from(table).select("id, name").eq("id", currentId).maybeSingle();
  return data ? [...options, data] : options;
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; month?: string }>;
}) {
  const { id } = await params;
  const { section: sectionParam, month } = await searchParams;
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const validSections: ProfileSection[] = ["profile", "parent", "attendance", "injuries", "5s"];
  const section: ProfileSection = validSections.includes(sectionParam as ProfileSection)
    ? (sectionParam as ProfileSection)
    : "profile";

  const { data: player } = await supabase
    .from("players")
    .select("*, batches(name), player_types(name)")
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!player) notFound();

  const [{ data: ageCategories }, { data: playerTypes }, { data: packages }, { data: batches }] =
    await Promise.all([
      supabase
        .from("age_categories")
        .select("id, name")
        .eq("centre_id", centreAdmin.centre_id!)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("player_types")
        .select("id, name")
        .eq("centre_id", centreAdmin.centre_id!)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("packages")
        .select("id, name")
        .eq("centre_id", centreAdmin.centre_id!)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("batches")
        .select("id, name")
        .eq("centre_id", centreAdmin.centre_id!)
        .eq("is_active", true)
        .order("name"),
    ]);

  const [ageCategoryOptions, playerTypeOptions, packageOptions, batchOptions] = await Promise.all([
    ensureOptionIncluded(supabase, "age_categories", ageCategories ?? [], player.age_category_id),
    ensureOptionIncluded(supabase, "player_types", playerTypes ?? [], player.player_type_id),
    ensureOptionIncluded(supabase, "packages", packages ?? [], player.package_id),
    ensureOptionIncluded(supabase, "batches", batches ?? [], player.batch_id),
  ]);

  const docKeys = {
    aadhaar: player.aadhaar_doc_path,
    medicalRecords: player.medical_records_path,
    profilePicture: player.profile_picture_path,
  };
  const documentLinks: Record<string, string> = {};
  for (const [label, key] of Object.entries(docKeys)) {
    if (key) {
      try {
        documentLinks[label] = await getSignedFileUrl(key);
      } catch {
        // storage not configured — link omitted
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{player.name}</h1>
          <p className="text-sm text-muted-foreground">Player Profile</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={player.is_active ? "default" : "secondary"}>
            {player.is_active ? "Active" : "Inactive"}
          </Badge>
          <DeactivatePlayerButton
            playerId={player.id}
            isActive={player.is_active}
            action={setPlayerActive}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <ProfileCard
            name={player.name}
            dateOfBirth={player.date_of_birth}
            batchName={player.batches?.name ?? null}
            playerTypeName={player.player_types?.name ?? null}
            isActive={player.is_active}
            profilePictureUrl={documentLinks.profilePicture}
          />
          <Card className="rounded-2xl border-border/50 py-3 shadow-soft">
            <CardContent className="px-3">
              <ProfileMenu basePath={`/centre-admin/players/${id}`} active={section} />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
          <CardContent className="px-6">
            {section === "profile" && (
              <PlayerProfileForm
                action={updatePlayerProfile.bind(null, id)}
                ageCategories={ageCategoryOptions}
                playerTypes={playerTypeOptions}
                packages={packageOptions}
                batches={batchOptions}
                documentLinks={documentLinks}
                defaultValues={{
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
              />
            )}

            {section === "parent" && (
              <ParentProfileForm
                action={updateParentProfile.bind(null, id)}
                defaultValues={{
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

            {section === "attendance" && (
              <AttendanceCalendar
                playerId={id}
                month={month}
                basePath={`/centre-admin/players/${id}?section=attendance`}
              />
            )}

            {section === "injuries" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Injuries</h2>
                  <p className="text-sm text-muted-foreground">Reported by coach or medical staff</p>
                </div>
                <InjuryReportsTable playerId={id} />
              </div>
            )}

            {section === "5s" && <FiveSResultsView playerId={id} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
