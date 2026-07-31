import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { calculateAge } from "@/lib/age";
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
import { PlayerRowActions } from "./row-actions";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; batchId?: string; playerTypeId?: string; status?: string; page?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin");
  const { q, batchId, playerTypeId, status, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let query = supabase
    .from("players")
    .select("id, name, date_of_birth, is_active, batches(name), player_types(name)", { count: "exact" })
    .eq("centre_id", centreAdmin.centre_id!);

  if (q) query = query.ilike("name", `%${q}%`);
  if (batchId) query = query.eq("batch_id", batchId);
  if (playerTypeId) query = query.eq("player_type_id", playerTypeId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  const [{ data: players, count }, { data: batches }, { data: playerTypes }] = await Promise.all([
    query.order("name").range(from, to),
    supabase
      .from("batches")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("name"),
    supabase
      .from("player_types")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("name"),
  ]);

  const hasFilters = Boolean(q || batchId || playerTypeId || status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Player Management</h1>
        <Button render={<Link href="/centre-admin/players/new">Add Player</Link>} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search players..." />
        <ListFilter paramKey="batchId" label="All batches" options={batches ?? []} />
        <ListFilter paramKey="playerTypeId" label="All program types" options={playerTypes ?? []} />
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
            <TableHead>Name</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Program Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((player) => (
            <TableRow key={player.id}>
              <TableCell>{player.name}</TableCell>
              <TableCell>{calculateAge(player.date_of_birth)}</TableCell>
              <TableCell>{player.batches?.name ?? "—"}</TableCell>
              <TableCell>{player.player_types?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={player.is_active ? "default" : "secondary"}>
                  {player.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <PlayerRowActions playerId={player.id} isActive={player.is_active} />
              </TableCell>
            </TableRow>
          ))}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                {hasFilters ? (
                  <EmptyState icon={Users} title="No players match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={Users} title="No players yet" message="Add your first player to get started." />
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
