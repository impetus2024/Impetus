import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TestingWindowBanner } from "@/components/five-s/testing-window-banner";
import { getFiveSWindowStatus } from "@/lib/five-s/testing-window";
import { getFiveSTests } from "@/lib/five-s/catalog";
import { StaminaScoreForm } from "./stamina-score-form";

export default async function Coach5sModelStaminaPage({
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
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) notFound();

  const { data: player } = await supabase
    .from("players")
    .select("id, name")
    .eq("id", playerId)
    .eq("batch_id", batchId)
    .maybeSingle();

  if (!player) notFound();

  const { data: centre } = await supabase
    .from("centres")
    .select("five_s_window_start, five_s_window_end")
    .eq("id", batch.centre_id)
    .single();
  const windowStatus = getFiveSWindowStatus(centre?.five_s_window_start ?? null, centre?.five_s_window_end ?? null);

  const [allTests, { data: results }, { data: note }] = await Promise.all([
    getFiveSTests(),
    supabase
      .from("five_s_results")
      .select("test_id, score, level, shuttle, vo2_max, remarks")
      .eq("player_id", playerId),
    supabase
      .from("five_s_category_notes")
      .select("remarks")
      .eq("player_id", playerId)
      .eq("category", "stamina")
      .maybeSingle(),
  ]);
  const tests = allTests.filter((t) => t.category === "stamina");

  const existingByTest = new Map((results ?? []).map((r) => [r.test_id, r]));

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
          <p className="text-sm text-muted-foreground">{batch.name} · Stamina</p>
        </div>
      </div>

      {windowStatus.status === "open" ? (
        <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
          <CardContent className="px-6">
            <StaminaScoreForm
              batchId={batchId}
              playerId={playerId}
              tests={tests}
              existingByTest={existingByTest}
              overallRemarks={note?.remarks ?? ""}
            />
          </CardContent>
        </Card>
      ) : (
        <TestingWindowBanner status={windowStatus} />
      )}
    </div>
  );
}
