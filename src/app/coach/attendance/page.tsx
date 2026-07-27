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

export default async function CoachAttendancePage() {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("batches")
    .select("id, name")
    .eq("head_coach_id", coach.id)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Attendance</h1>

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
                  size="sm"
                  render={<Link href={`/coach/attendance/${batch.id}`}>Add Attendance</Link>}
                />
              </TableCell>
            </TableRow>
          ))}
          {batches?.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No batches assigned yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
