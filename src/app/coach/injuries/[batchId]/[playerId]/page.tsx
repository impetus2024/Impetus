import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import { InjuryReportsTable } from "@/components/injuries/injury-reports-table";
import { AddInjuryDialog } from "@/components/injuries/add-injury-dialog";

export default async function CoachPlayerInjuriesPage({
  params,
}: {
  params: Promise<{ batchId: string; playerId: string }>;
}) {
  const { batchId, playerId } = await params;
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) notFound();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, player_batches!inner(batch_id)")
    .eq("id", playerId)
    .eq("player_batches.batch_id", batchId)
    .maybeSingle();

  if (!player) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{player.name} — Injury Reports</h1>
        <AddInjuryDialog
          playerId={player.id}
          playerName={player.name}
          revalidatePathTarget={`/coach/injuries/${batchId}/${playerId}`}
        />
      </div>
      <InjuryReportsTable playerId={player.id} />
    </div>
  );
}
