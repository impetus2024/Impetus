import Link from "next/link";
import { HeartPulse } from "lucide-react";
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

export default async function CoachInjuriesPage() {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("batches")
    .select("id, name")
    .or(coachBatchFilter(coach.id))
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Injuries</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches?.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>{batch.name}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/coach/injuries/${batch.id}`}>View Players</Link>}
                />
              </TableCell>
            </TableRow>
          ))}
          {batches?.length === 0 && (
            <TableRow>
              <TableCell colSpan={2}>
                <EmptyState icon={HeartPulse} title="No batches assigned yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
