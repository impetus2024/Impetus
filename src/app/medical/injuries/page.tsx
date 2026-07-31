import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
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
import { AddInjuryDialog } from "@/components/injuries/add-injury-dialog";

export default async function MedicalInjuriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ageCategoryId?: string; playerTypeId?: string; page?: string }>;
}) {
  const medical = await requireRole("medical");
  const { q, ageCategoryId, playerTypeId, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let query = supabase
    .from("players")
    .select("id, name, age_categories(name), player_types(name)", { count: "exact" })
    .eq("centre_id", medical.centre_id!)
    .eq("is_active", true);

  if (q) query = query.ilike("name", `%${q}%`);
  if (ageCategoryId) query = query.eq("age_category_id", ageCategoryId);
  if (playerTypeId) query = query.eq("player_type_id", playerTypeId);

  const [{ data: players, count }, { data: ageCategories }, { data: playerTypes }] = await Promise.all([
    query.order("name").range(from, to),
    supabase
      .from("age_categories")
      .select("id, name")
      .eq("centre_id", medical.centre_id!)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("player_types")
      .select("id, name")
      .eq("centre_id", medical.centre_id!)
      .eq("is_active", true)
      .order("name"),
  ]);

  const hasFilters = Boolean(q || ageCategoryId || playerTypeId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Injuries</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search players..." />
        <ListFilter paramKey="ageCategoryId" label="All age categories" options={ageCategories ?? []} />
        <ListFilter paramKey="playerTypeId" label="All program types" options={playerTypes ?? []} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Age Category</TableHead>
            <TableHead>Program Type</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}</TableCell>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.age_categories?.name ?? "—"}</TableCell>
              <TableCell>{p.player_types?.name ?? "—"}</TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/medical/injuries/${p.id}`}>View Injuries</Link>}
                />
                <AddInjuryDialog
                  playerId={p.id}
                  playerName={p.name}
                  revalidatePathTarget={`/medical/injuries/${p.id}`}
                />
              </TableCell>
            </TableRow>
          ))}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                {hasFilters ? (
                  <EmptyState icon={Users} title="No players match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={Users} title="No players yet" />
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
