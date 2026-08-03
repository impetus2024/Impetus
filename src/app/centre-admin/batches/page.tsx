import { CalendarCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { parsePageParam, pageRange, totalPages as computeTotalPages } from "@/lib/pagination";
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

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    headCoachId?: string;
    playerTypeId?: string;
    ageCategoryId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
  const { q, headCoachId, playerTypeId, ageCategoryId, status, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let query = supabase
    .from("batches")
    .select(
      "id, name, head_coach_id, player_type_id, age_category_id, start_time, end_time, is_active, profiles!batches_head_coach_id_fkey(full_name), player_types(name), age_categories(name)",
      { count: "exact" }
    )
    .eq("centre_id", centreAdmin.centre_id!);

  if (q) query = query.ilike("name", `%${q}%`);
  if (headCoachId) query = query.eq("head_coach_id", headCoachId);
  if (playerTypeId) query = query.eq("player_type_id", playerTypeId);
  if (ageCategoryId) query = query.eq("age_category_id", ageCategoryId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  const [{ data: batches, count }, { data: coachProfiles }, { data: playerTypes }, { data: ageCategories }] =
    await Promise.all([
      query.order("name").range(from, to),
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

  const hasFilters = Boolean(q || headCoachId || playerTypeId || ageCategoryId || status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Batch Management</h1>
        {canEdit && (
          <BatchFormDialog
            trigger={<Button>Add Batch</Button>}
            title="Add Batch"
            action={createBatch}
            coaches={coaches}
            playerTypes={playerTypes ?? []}
            ageCategories={ageCategories ?? []}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search batches..." />
        <ListFilter paramKey="headCoachId" label="All coaches" options={coaches} />
        <ListFilter paramKey="playerTypeId" label="All program types" options={playerTypes ?? []} />
        <ListFilter paramKey="ageCategoryId" label="All age categories" options={ageCategories ?? []} />
        <ListFilter
          paramKey="status"
          label="All statuses"
          options={[
            { id: "active", name: "Active" },
            { id: "inactive", name: "Inactive" },
          ]}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>Head Coach</TableHead>
            <TableHead>Program Type</TableHead>
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
                {canEdit ? (
                  <BatchRowActions
                    batch={batch}
                    coaches={coaches}
                    playerTypes={playerTypes ?? []}
                    ageCategories={ageCategories ?? []}
                  />
                ) : (
                  <span className="block text-right text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {batches?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                {hasFilters ? (
                  <EmptyState icon={CalendarCheck} title="No batches match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={CalendarCheck} title="No batches yet" message="Create your first training batch." />
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
