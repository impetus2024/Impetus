import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Badge } from "@/components/ui/badge";
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

export default async function CoachAttendancePage() {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const supabase = await createClient();

  const [{ data: coaches }, { data: batches }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("batches")
      .select("id, name, head_coach_id, assistant_coach_id")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .order("name"),
  ]);

  const batchesByCoach = new Map<string, { id: string; name: string }[]>();
  for (const coach of coaches ?? []) {
    const assigned = (batches ?? []).filter(
      (b) => b.head_coach_id === coach.id || b.assistant_coach_id === coach.id
    );
    batchesByCoach.set(coach.id, assigned);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Coach Attendance</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Coach</TableHead>
            <TableHead>Assigned Batches</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coaches?.map((coach) => {
            const assigned = batchesByCoach.get(coach.id) ?? [];
            return (
              <TableRow key={coach.id}>
                <TableCell>{coach.full_name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {assigned.length > 0 ? (
                      assigned.map((b) => (
                        <Badge key={b.id} variant="outline">
                          {b.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No batches assigned</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/centre-admin/coach-attendance/${coach.id}`}>View Attendance</Link>}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {coaches?.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>
                <EmptyState icon={Users} title="No coaches yet" message="Add a coach to see their attendance here." />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
