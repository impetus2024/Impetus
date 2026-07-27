import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { getSignedFileUrl } from "@/lib/storage/r2";
import { calculateAge } from "@/lib/age";
import { Badge } from "@/components/ui/badge";
import { PlayerForm } from "../player-form";
import { updatePlayer, setPlayerActive } from "../actions";
import { DeactivatePlayerButton } from "./deactivate-button";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("*")
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
          <p className="text-sm text-muted-foreground">
            Age {calculateAge(player.date_of_birth)}
          </p>
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

      <PlayerForm
        action={updatePlayer.bind(null, id)}
        ageCategories={ageCategories ?? []}
        playerTypes={playerTypes ?? []}
        packages={packages ?? []}
        batches={batches ?? []}
        parentEmailEditable={false}
        documentLinks={documentLinks}
        submitLabel="Save Changes"
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
    </div>
  );
}
