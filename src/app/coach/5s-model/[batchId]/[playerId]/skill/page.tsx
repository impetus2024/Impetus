import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TestingWindowBanner } from "@/components/five-s/testing-window-banner";
import { getFiveSWindowStatus } from "@/lib/five-s/testing-window";
import { getFiveSTests } from "@/lib/five-s/catalog";
import { SkillScoreForm } from "./skill-score-form";

export default async function Coach5sModelSkillPage({
  params,
}: {
  params: Promise<{ batchId: string; playerId: string }>;
}) {
  const { batchId, playerId } = await params;
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, name, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) notFound();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, player_batches!inner(batch_id)")
    .eq("id", playerId)
    .eq("player_batches.batch_id", batchId)
    .maybeSingle();

  if (!player) notFound();

  const { data: centre } = await supabase
    .from("centres")
    .select("five_s_window_start, five_s_window_end")
    .eq("id", batch.centre_id)
    .single();
  const windowStatus = getFiveSWindowStatus(centre?.five_s_window_start ?? null, centre?.five_s_window_end ?? null);

  const [allTests, { data: results }, { data: groupNotes }, { data: overallNote }] = await Promise.all([
    getFiveSTests(),
    supabase
      .from("five_s_results")
      .select("test_id, score, recorded_by")
      .eq("player_id", playerId),
    supabase
      .from("five_s_group_notes")
      .select("group_name, remarks")
      .eq("player_id", playerId)
      .eq("category", "skill"),
    supabase
      .from("five_s_category_notes")
      .select("remarks, rating")
      .eq("player_id", playerId)
      .eq("category", "skill")
      .maybeSingle(),
  ]);
  const tests = allTests.filter((t) => t.category === "skill");

  const existingScores = new Map(
    (results ?? []).flatMap((r) => (r.score != null ? [[r.test_id, r.score] as const] : []))
  );
  const existingGroupRemarks = new Map((groupNotes ?? []).map((n) => [n.group_name, n.remarks]));
  const lockedTestIds = new Set(
    (results ?? []).filter((r) => r.recorded_by !== coach.id).map((r) => r.test_id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          render={
            <Link href={`/coach/5s-model/${batchId}/${playerId}`} aria-label="Back to 5S Model">
              <ArrowLeft />
            </Link>
          }
        />
        <div>
          <h1 className="text-2xl font-semibold">{player.name}</h1>
          <p className="text-sm text-muted-foreground">{batch.name} · Skill</p>
        </div>
      </div>

      {windowStatus.status === "open" ? (
        <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
          <CardContent className="px-6">
            <SkillScoreForm
              batchId={batchId}
              playerId={playerId}
              tests={tests}
              existingScores={existingScores}
              existingGroupRemarks={existingGroupRemarks}
              overallRemarks={overallNote?.remarks ?? ""}
              overallRating={overallNote?.rating ?? null}
              lockedTestIds={lockedTestIds}
            />
          </CardContent>
        </Card>
      ) : (
        <TestingWindowBanner status={windowStatus} />
      )}
    </div>
  );
}
