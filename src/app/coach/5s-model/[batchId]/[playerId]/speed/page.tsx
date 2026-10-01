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
import { calculateAge } from "@/lib/age";
import { getFiveSTests } from "@/lib/five-s/catalog";
import { findSpeedAgeBand } from "@/lib/five-s/speed-benchmarks";
import { speedTestDistanceGuidance } from "@/lib/five-s/speed-test-guidance";
import { SpeedScoreForm } from "./speed-score-form";

export default async function Coach5sModelSpeedPage({
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
    .select("id, name, date_of_birth, gender, player_batches!inner(batch_id)")
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

  const [allTests, { data: results }, { data: speedAgeBands }] = await Promise.all([
    getFiveSTests(),
    supabase
      .from("five_s_results")
      .select("test_id, score, recorded_by")
      .eq("player_id", playerId),
    supabase
      .from("five_s_age_bands")
      .select("id, label, min_age, max_age, gender")
      .eq("category", "speed")
      .order("display_order"),
  ]);
  const tests = allTests.filter((t) => t.category === "speed");

  // Two Speed tests are run over a different course length depending on the
  // age group, so the coach has to see which distance applies to this player
  // before recording a time. The band comes from the same gender-aware
  // lookup scoring uses (findSpeedAgeBand) rather than a second age rule
  // here; speedTestDistanceGuidance then returns null for the tests that
  // don't vary by age, so those fields render exactly as before.
  const speedBand = findSpeedAgeBand(
    calculateAge(player.date_of_birth),
    player.gender,
    speedAgeBands ?? []
  );
  const distanceGuidance = new Map(
    tests.flatMap((t) => {
      const guidance = speedTestDistanceGuidance(t.name, speedBand?.label ?? null);
      return guidance ? [[t.id, guidance] as const] : [];
    })
  );

  const existingScores = new Map(
    (results ?? []).flatMap((r) => (r.score != null ? [[r.test_id, r.score] as const] : []))
  );
  // A test already recorded by a coach from the player's other batch is
  // frozen — see the RLS split in the player_batches migration. Only the
  // coach who first recorded it may still edit.
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
          <p className="text-sm text-muted-foreground">{batch.name} · Speed</p>
        </div>
      </div>

      {windowStatus.status === "open" ? (
        <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
          <CardContent className="px-6">
            <SpeedScoreForm
              batchId={batchId}
              playerId={playerId}
              tests={tests}
              existingScores={existingScores}
              lockedTestIds={lockedTestIds}
              distanceGuidance={distanceGuidance}
            />
          </CardContent>
        </Card>
      ) : (
        <TestingWindowBanner status={windowStatus} />
      )}
    </div>
  );
}
