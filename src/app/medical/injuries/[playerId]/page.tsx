import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { InjuryReportsTable } from "@/components/injuries/injury-reports-table";
import { AddInjuryDialog } from "@/components/injuries/add-injury-dialog";

export default async function MedicalPlayerInjuriesPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const medical = await requireRole("medical");
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("id, name")
    .eq("id", playerId)
    .eq("centre_id", medical.centre_id!)
    .maybeSingle();

  if (!player) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{player.name} — Injury Reports</h1>
        <AddInjuryDialog
          playerId={player.id}
          playerName={player.name}
          revalidatePathTarget={`/medical/injuries/${playerId}`}
        />
      </div>
      <InjuryReportsTable playerId={player.id} />
    </div>
  );
}
