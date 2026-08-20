import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import { calculateAge } from "@/lib/age";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CoachBatchPlayersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, name")
    .eq("id", id)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) notFound();

  const { data: players } = await supabase
    .from("players")
    .select("id, name, date_of_birth, gender, parent_contact_number, player_batches!inner(batch_id)")
    .eq("player_batches.batch_id", id)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{batch.name} — Players</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Parent Contact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell>{calculateAge(p.date_of_birth)}</TableCell>
              <TableCell>{p.gender ?? "—"}</TableCell>
              <TableCell>{p.parent_contact_number ?? "—"}</TableCell>
            </TableRow>
          ))}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState icon={Users} title="No players in this batch yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
