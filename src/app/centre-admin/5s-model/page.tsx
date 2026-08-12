import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { parsePageParam, pageRange, totalPages as computeTotalPages } from "@/lib/pagination";
import { TestingWindowBanner } from "@/components/five-s/testing-window-banner";
import { getFiveSWindowStatus } from "@/lib/five-s/testing-window";
import { PlayerRatingBadge } from "@/components/five-s/player-rating-badge";
import { getOverallPlayerRatings } from "@/lib/five-s/scores";
import { FIVE_S_RADAR_AXES } from "@/components/profile/five-s-radar-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TestingWindowDialog } from "./testing-window-dialog";

export default async function CentreAdmin5sModelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; batchId?: string; page?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
  const { q, batchId, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let query = supabase
    .from("players")
    .select("id, name, batches!players_batch_id_fkey(name)", { count: "exact" })
    .eq("centre_id", centreAdmin.centre_id!)
    .eq("is_active", true);

  if (q) query = query.ilike("name", `%${q}%`);
  if (batchId) query = query.eq("batch_id", batchId);

  const [{ data: players, count }, { data: batches }, { data: centre }, { data: reports }] = await Promise.all([
    query.order("name").range(from, to),
    supabase
      .from("batches")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("name"),
    supabase
      .from("centres")
      .select("five_s_window_start, five_s_window_end")
      .eq("id", centreAdmin.centre_id!)
      .single(),
    // One row per player (five_s_reports.player_id is unique — publishing
    // again updates this same row), so published_at is always that
    // player's most recent publish.
    supabase.from("five_s_reports").select("player_id, published_at").eq("centre_id", centreAdmin.centre_id!),
  ]);

  const windowStatus = getFiveSWindowStatus(centre?.five_s_window_start ?? null, centre?.five_s_window_end ?? null);
  const hasFilters = Boolean(q || batchId);
  const publishedAtByPlayer = new Map((reports ?? []).map((r) => [r.player_id, r.published_at]));

  // Overall 5S rating badge — same publish gate as publishedAt/"View
  // Results" above (FiveSResultsView's gateUntilPublished rule): never show
  // a coach's in-progress rating to centre-admin before they publish.
  const playerIds = (players ?? []).map((p) => p.id);
  const ratingByPlayer =
    playerIds.length > 0
      ? await getOverallPlayerRatings(playerIds, FIVE_S_RADAR_AXES.map((a) => a.key))
      : new Map();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">5S Model</h1>
        <p className="text-sm text-muted-foreground">
          View-only — Speed, Stamina, Strength, Spirit, and Skill test results are entered by each player&apos;s coach.
        </p>
      </div>

      <TestingWindowBanner
        status={windowStatus}
        action={
          canEdit ? (
            <TestingWindowDialog
              currentStart={centre?.five_s_window_start ?? null}
              currentEnd={centre?.five_s_window_end ?? null}
              triggerLabel={windowStatus.status === "none" ? "Set Testing Window" : "Edit Testing Window"}
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search players..." />
        <ListFilter paramKey="batchId" label="All batches" options={batches ?? []} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>5S Result Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((p) => {
            const publishedAt = publishedAtByPlayer.get(p.id);
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {p.name}
                    {publishedAt && <PlayerRatingBadge rating={ratingByPlayer.get(p.id) ?? null} />}
                  </div>
                </TableCell>
                <TableCell>{p.batches?.name ?? "—"}</TableCell>
                <TableCell>{publishedAt ? new Date(publishedAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  {publishedAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/centre-admin/5s-model/${p.id}`}>View Results</Link>}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                {hasFilters ? (
                  <EmptyState icon={Sparkles} title="No players match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={Sparkles} title="No players yet" />
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
