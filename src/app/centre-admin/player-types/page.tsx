import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LookupManager } from "@/components/lookup-manager";
import {
  createPlayerType,
  renamePlayerType,
  setPlayerTypeActive,
  createAgeCategory,
  renameAgeCategory,
  setAgeCategoryActive,
} from "./actions";

export default async function PlayerTypesPage() {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
  const supabase = await createClient();

  const [{ data: playerTypes }, { data: ageCategories }] = await Promise.all([
    supabase
      .from("player_types")
      .select("id, name, is_active")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("name"),
    supabase
      .from("age_categories")
      .select("id, name, is_active")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Program Type</h1>

      <Tabs defaultValue="player-types">
        <TabsList>
          <TabsTrigger value="player-types">Program Type</TabsTrigger>
          <TabsTrigger value="age-categories">Age Category</TabsTrigger>
        </TabsList>
        <TabsContent value="player-types">
          <LookupManager
            items={playerTypes ?? []}
            itemLabel="Program Type"
            createAction={createPlayerType}
            renameAction={renamePlayerType}
            toggleAction={setPlayerTypeActive}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="age-categories">
          <LookupManager
            items={ageCategories ?? []}
            itemLabel="Age Category"
            createAction={createAgeCategory}
            renameAction={renameAgeCategory}
            toggleAction={setAgeCategoryActive}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
