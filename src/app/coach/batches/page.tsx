import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CoachBatchesPage() {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("batches")
    .select("id, name, start_time, end_time, age_categories(name), player_types(name)")
    .eq("head_coach_id", coach.id)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Training Batch</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>Age Category</TableHead>
            <TableHead>Player Type</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches?.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>{batch.name}</TableCell>
              <TableCell>{batch.age_categories?.name}</TableCell>
              <TableCell>{batch.player_types?.name ?? "—"}</TableCell>
              <TableCell>
                {batch.start_time} – {batch.end_time}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/coach/batches/${batch.id}`}>View Players</Link>}
                />
              </TableCell>
            </TableRow>
          ))}
          {batches?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No batches assigned yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
