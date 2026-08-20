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
import { FIVE_S_CATEGORY_META, FIVE_S_CATEGORY_ORDER, type FiveSCategory } from "@/lib/five-s/categories";
import { getFiveSTests, getFiveSQuestions } from "@/lib/five-s/catalog";
import { PublishReportButton } from "./publish-report-button";

type Category = FiveSCategory;
const CATEGORY_META = FIVE_S_CATEGORY_META;
const CATEGORY_ORDER = FIVE_S_CATEGORY_ORDER;

export default async function Coach5sModelPlayerHubPage({
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
    .select("id, name, age_categories(name), player_batches!inner(batch_id)")
    .eq("id", playerId)
    .eq("player_batches.batch_id", batchId)
    .maybeSingle();

  if (!player) notFound();

  const [
    testRows,
    questionRows,
    { count: resultCount },
    { count: responseCount },
    { data: report },
    { data: centre },
  ] = await Promise.all([
    getFiveSTests(),
    getFiveSQuestions(),
    supabase.from("five_s_results").select("id", { count: "exact", head: true }).eq("player_id", playerId),
    supabase
      .from("five_s_question_responses")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId),
    supabase.from("five_s_reports").select("id").eq("player_id", playerId).maybeSingle(),
    supabase
      .from("centres")
      .select("five_s_window_start, five_s_window_end")
      .eq("id", batch.centre_id)
      .single(),
  ]);
  const availableCategories = new Set([
    ...testRows.map((t) => t.category as Category),
    ...questionRows.map((q) => q.category as Category),
  ]);
  const hasScores = (resultCount ?? 0) > 0 || (responseCount ?? 0) > 0;
  const isComplete =
    (resultCount ?? 0) >= testRows.length && (responseCount ?? 0) >= questionRows.length;
  const isPublished = report !== null;
  const windowStatus = getFiveSWindowStatus(centre?.five_s_window_start ?? null, centre?.five_s_window_end ?? null);
  const isWindowOpen = windowStatus.status === "open";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            render={
              <Link href={`/coach/5s-model/${batchId}`} aria-label="Back to player list">
                <ArrowLeft />
              </Link>
            }
          />
          <div>
            <h1 className="text-2xl font-semibold">
              {player.name}{" "}
              {player.age_categories?.name && (
                <span className="text-muted-foreground">({player.age_categories.name})</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">{batch.name} · 5S Model</p>
          </div>
        </div>
        {hasScores && (
          <Button
            variant="outline"
            render={<Link href={`/coach/5s-model/${batchId}/${playerId}/results`}>View Results</Link>}
          />
        )}
      </div>

      <TestingWindowBanner status={windowStatus} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          const isAvailable = availableCategories.has(category);

          return (
            <Card key={category} className="flex flex-col rounded-2xl border-border/50 py-6 shadow-soft">
              <CardContent className="flex flex-1 flex-col gap-4 px-6">
                <span className="flex size-11 items-center justify-center rounded-full border border-primary/30 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="space-y-1.5">
                  <h2 className="font-semibold">{meta.label}</h2>
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                </div>
                <div className="mt-auto border-t border-border/50 pt-4">
                  {isAvailable && isWindowOpen ? (
                    <Button
                      className="w-full"
                      render={<Link href={`/coach/5s-model/${batchId}/${playerId}/${category}`}>Update Score</Link>}
                    />
                  ) : (
                    <Button className="w-full" disabled variant="outline">
                      {isAvailable ? "Testing Window Closed" : "Coming Soon"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" render={<Link href={`/coach/5s-model/${batchId}`}>Back</Link>} />
        <PublishReportButton
          batchId={batchId}
          playerId={playerId}
          isComplete={isComplete}
          isPublished={isPublished}
        />
      </div>
    </div>
  );
}
