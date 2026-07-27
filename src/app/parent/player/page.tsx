import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { getParentChildren } from "@/lib/parent/children";
import { calculateAge } from "@/lib/age";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChildSelect } from "../child-select";

export default async function ParentPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string }>;
}) {
  const parent = await requireRole("parent");
  const { playerId } = await searchParams;

  const children = await getParentChildren(parent.id);
  const selectedId = playerId || children[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Player</h1>
        <ChildSelect options={children} selectedId={selectedId} basePath="/parent/player" />
      </div>

      {selectedId ? (
        <PlayerDetails playerId={selectedId} />
      ) : (
        <p className="text-muted-foreground">No children linked to your account yet.</p>
      )}
    </div>
  );
}

async function PlayerDetails({ playerId }: { playerId: string }) {
  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("name, date_of_birth, gender, batches(name), player_types(name)")
    .eq("id", playerId)
    .maybeSingle();

  if (!player) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{player.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Age: {calculateAge(player.date_of_birth)}</p>
          <p>Gender: {player.gender ?? "—"}</p>
          <p>Batch: {player.batches?.name ?? "—"}</p>
          <p>Player Type: {player.player_types?.name ?? "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5S Model</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          5S scoring is not built yet — this section is intentionally deferred.
        </CardContent>
      </Card>
    </div>
  );
}
