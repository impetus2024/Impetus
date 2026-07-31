import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
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

export default async function Coach5sModelBatchPage({
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
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) notFound();

  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .eq("batch_id", batchId)
    .eq("is_active", true)
    .order("name");

  const playerIds = (players ?? []).map((p) => p.id);
  // "View Scores" only makes sense once there's something to view — a
  // player shows up here as soon as any test score or spirit-question
  // response has been recorded for them, across either table since a
  // category might only have one or the other (spirit is questions-only).
  const [{ data: resultRows }, { data: responseRows }] =
    playerIds.length > 0
      ? await Promise.all([
          supabase.from("five_s_results").select("player_id").in("player_id", playerIds),
          supabase.from("five_s_question_responses").select("player_id").in("player_id", playerIds),
        ])
      : [{ data: [] }, { data: [] }];
  const playersWithScores = new Set([
    ...(resultRows ?? []).map((r) => r.player_id),
    ...(responseRows ?? []).map((r) => r.player_id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{batch.name} — 5S Model</h1>

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
              <TableCell className="text-right space-x-2">
                {playersWithScores.has(p.id) && (
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/coach/5s-model/${batchId}/${p.id}/results`}>View Scores</Link>}
                  />
                )}
                <Button
                  size="sm"
                  render={<Link href={`/coach/5s-model/${batchId}/${p.id}`}>5S Model Scores</Link>}
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
