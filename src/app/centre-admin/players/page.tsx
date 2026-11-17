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
import { PlayerRatingBadge } from "@/components/five-s/player-rating-badge";
import { getOverallPlayerRatings } from "@/lib/five-s/scores";
import { FIVE_S_RADAR_AXES } from "@/components/profile/five-s-radar-section";
import { PlayerRowActions } from "./row-actions";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; batchId?: string; coachId?: string; playerTypeId?: string; status?: string; page?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
  const { q, batchId, coachId, playerTypeId, status, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let query = supabase
    .from("players")
    .select("id, name, date_of_birth, is_active, batches!players_batch_id_fkey(name), player_types(name)", {
      count: "exact",
    })
    .eq("centre_id", centreAdmin.centre_id!);

  if (q) query = query.ilike("name", `%${q}%`);
  if (batchId) query = query.eq("batch_id", batchId);
  const validCoachId = coachId && /^[0-9a-f-]{36}$/i.test(coachId) ? coachId : undefined;
  if (validCoachId) {
    // Players of any batch where this coach is head or assistant.
    const { data: coachBatches } = await supabase
      .from("batches")
      .select("id")
      .eq("centre_id", centreAdmin.centre_id!)
      .or(`head_coach_id.eq.${validCoachId},assistant_coach_id.eq.${validCoachId}`);
    query = query.in("batch_id", (coachBatches ?? []).map((b) => b.id));
  }
  if (playerTypeId) query = query.eq("player_type_id", playerTypeId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  const [{ data: players, count }, { data: batches }, { data: playerTypes }, { data: coachProfiles }] = await Promise.all([
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
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const coaches = (coachProfiles ?? []).map((c) => ({ id: c.id, name: c.full_name }));
  const hasFilters = Boolean(q || batchId || coachId || playerTypeId || status);

  // Overall 5S rating badge — same publish gate as everywhere else
  // centre-admin sees a coach's 5S data (FiveSResultsView's
  // gateUntilPublished): only shown once the coach has published the
  // player's report, never their in-progress scores.
  const playerIds = (players ?? []).map((p) => p.id);
  const [{ data: publishedReports }, ratingByPlayer] =
    playerIds.length > 0
      ? await Promise.all([
          supabase.from("five_s_reports").select("player_id").in("player_id", playerIds),
          getOverallPlayerRatings(playerIds, FIVE_S_RADAR_AXES.map((a) => a.key)),
        ])
      : [{ data: [] }, new Map()];
  const publishedPlayerIds = new Set((publishedReports ?? []).map((r) => r.player_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Player Management</h1>
        {canEdit && <Button render={<Link href="/centre-admin/players/new">Add Player</Link>} />}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search players..." />
        <ListFilter paramKey="batchId" label="All batches" options={batches ?? []} />
        <ListFilter paramKey="coachId" label="All coaches" options={coaches} />
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
              <TableCell>
                <div className="flex items-center gap-2">
                  {player.name}
                  {publishedPlayerIds.has(player.id) && (
                    <PlayerRatingBadge rating={ratingByPlayer.get(player.id) ?? null} />
                  )}
                </div>
              </TableCell>
              <TableCell>{calculateAge(player.date_of_birth)}</TableCell>
              <TableCell>{player.batches?.name ?? "—"}</TableCell>
              <TableCell>{player.player_types?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={player.is_active ? "default" : "secondary"}>
                  {player.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <PlayerRowActions playerId={player.id} isActive={player.is_active} canEdit={canEdit} />
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
