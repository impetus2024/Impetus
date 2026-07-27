import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { PlayerForm } from "../player-form";
import { createPlayer } from "../actions";

export default async function NewPlayerPage() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add Player</h1>
      <PlayerForm
        action={createPlayer}
        ageCategories={ageCategories ?? []}
        playerTypes={playerTypes ?? []}
        packages={packages ?? []}
        batches={batches ?? []}
        submitLabel="Submit"
      />
    </div>
  );
}
