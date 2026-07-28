import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SpiritResponseForm } from "./spirit-response-form";

export default async function Coach5sModelSpiritPage({
  params,
}: {
  params: Promise<{ batchId: string; playerId: string }>;
}) {
  const { batchId, playerId } = await params;
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, name")
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

  const [{ data: questions }, { data: responses }] = await Promise.all([
    supabase
      .from("five_s_questions")
      .select("id, section, question")
      .eq("category", "spirit")
      .order("display_order"),
    supabase
      .from("five_s_question_responses")
      .select("question_id, answer")
      .eq("player_id", playerId),
  ]);

  const existingByQuestion = new Map((responses ?? []).map((r) => [r.question_id, r.answer]));

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
          <p className="text-sm text-muted-foreground">{batch.name} · Spirit</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
        <CardContent className="px-6">
          <SpiritResponseForm
            batchId={batchId}
            playerId={playerId}
            questions={questions ?? []}
            existingByQuestion={existingByQuestion}
          />
        </CardContent>
      </Card>
    </div>
  );
}
