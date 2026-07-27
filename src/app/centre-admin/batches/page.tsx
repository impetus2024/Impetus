import { CalendarCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BatchFormDialog } from "./batch-form-dialog";
import { BatchRowActions } from "./row-actions";
import { createBatch } from "./actions";

export default async function BatchesPage() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const [
    { data: batches },
    { data: coachProfiles },
    { data: playerTypes },
    { data: ageCategories },
  ] = await Promise.all([
    supabase
      .from("batches")
      .select(
        "id, name, head_coach_id, player_type_id, age_category_id, start_time, end_time, is_active, profiles!batches_head_coach_id_fkey(full_name), player_types(name), age_categories(name)"
      )
      .eq("centre_id", centreAdmin.centre_id!)
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("player_types")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("age_categories")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .order("name"),
  ]);

  const coaches = (coachProfiles ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Batch Management</h1>
        <BatchFormDialog
          trigger={<Button>Add Batch</Button>}
          title="Add Batch"
          action={createBatch}
          coaches={coaches}
          playerTypes={playerTypes ?? []}
          ageCategories={ageCategories ?? []}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>Head Coach</TableHead>
            <TableHead>Player Type</TableHead>
            <TableHead>Age Category</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches?.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>{batch.name}</TableCell>
              <TableCell>{batch.profiles?.full_name}</TableCell>
              <TableCell>{batch.player_types?.name ?? "—"}</TableCell>
              <TableCell>{batch.age_categories?.name}</TableCell>
              <TableCell>
                {batch.start_time} – {batch.end_time}
              </TableCell>
              <TableCell>
                <Badge variant={batch.is_active ? "default" : "secondary"}>
                  {batch.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <BatchRowActions
                  batch={batch}
                  coaches={coaches}
                  playerTypes={playerTypes ?? []}
                  ageCategories={ageCategories ?? []}
                />
              </TableCell>
            </TableRow>
          ))}
          {batches?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState icon={CalendarCheck} title="No batches yet" message="Create your first training batch." />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
