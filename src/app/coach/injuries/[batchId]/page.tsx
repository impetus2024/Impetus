import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddInjuryDialog } from "@/components/injuries/add-injury-dialog";

export default async function CoachBatchInjuriesPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, name")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) notFound();

  const { data: players } = await supabase
    .from("players")
    .select("id, name, player_batches!inner(batch_id)")
    .eq("player_batches.batch_id", batchId)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{batch.name} — Injuries</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link href={`/coach/injuries/${batchId}/${p.id}`}>
                      Injury Reports
                    </Link>
                  }
                />
                <AddInjuryDialog
                  playerId={p.id}
                  playerName={p.name}
                  revalidatePathTarget={`/coach/injuries/${batchId}/${p.id}`}
                />
              </TableCell>
            </TableRow>
          ))}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={2}>
                <EmptyState icon={Users} title="No players in this batch yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
