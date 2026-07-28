import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap, Activity, Dumbbell, Flame, Target, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Category = "speed" | "stamina" | "strength" | "spirit" | "skill";

const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; description: string }> = {
  speed: {
    label: "Speed",
    icon: Zap,
    description:
      "A quick, focused test to measure a player's acceleration and top-end speed across short sprint distances.",
  },
  stamina: {
    label: "Stamina",
    icon: Activity,
    description:
      "Assesses a player's cardiovascular endurance and ability to sustain effort over an extended period of play.",
  },
  strength: {
    label: "Strength",
    icon: Dumbbell,
    description:
      "Measures a player's physical power, useful in duels, shielding the ball, and other physical contests on the pitch.",
  },
  spirit: {
    label: "Spirit",
    icon: Flame,
    description:
      "Evaluates a player's mentality, determination, and competitive drive during training and matches.",
  },
  skill: {
    label: "Skill",
    icon: Target,
    description:
      "Tests a player's technical ability on the ball — control, passing, and finishing under pressure.",
  },
};

const CATEGORY_ORDER: Category[] = ["speed", "stamina", "strength", "spirit", "skill"];

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
    .select("id, name")
    .eq("id", batchId)
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) notFound();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, age_categories(name)")
    .eq("id", playerId)
    .eq("batch_id", batchId)
    .maybeSingle();

  if (!player) notFound();

  const [{ data: testRows }, { data: questionRows }] = await Promise.all([
    supabase.from("five_s_tests").select("category"),
    supabase.from("five_s_questions").select("category"),
  ]);
  const availableCategories = new Set([
    ...(testRows ?? []).map((t) => t.category as Category),
    ...(questionRows ?? []).map((q) => q.category as Category),
  ]);

  return (
    <div className="space-y-6">
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
                  {isAvailable ? (
                    <Button
                      className="w-full"
                      render={<Link href={`/coach/5s-model/${batchId}/${playerId}/${category}`}>Update Score</Link>}
                    />
                  ) : (
                    <Button className="w-full" disabled variant="outline">
                      Coming Soon
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" render={<Link href={`/coach/5s-model/${batchId}`}>Back</Link>} />
      </div>
    </div>
  );
}
