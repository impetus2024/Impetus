import { Card, CardContent } from "@/components/ui/card";
import { RadarChart } from "@/components/charts/radar-chart";
import { cn } from "@/lib/utils";

export const FIVE_S_RADAR_AXES: { key: string; label: string }[] = [
  { key: "speed", label: "Speed" },
  { key: "stamina", label: "Stamina" },
  { key: "strength", label: "Strength" },
  { key: "skill", label: "Skill" },
  { key: "spirit", label: "Spirit" },
];

function RadarCard({
  title,
  legendLabel,
  scores,
}: {
  title: string;
  legendLabel: string;
  scores: Record<string, number>;
}) {
  return (
    <Card className="rounded-2xl border-border/50 py-5 shadow-soft">
      <CardContent className="px-5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-5 rounded-sm border border-chart-3 bg-chart-3/15" />
          {legendLabel}
        </div>
        <div className="mt-4">
          <RadarChart data={FIVE_S_RADAR_AXES.map((a) => ({ label: a.label, value: scores[a.key] ?? 0 }))} />
        </div>
      </CardContent>
    </Card>
  );
}

// Completion-based score (0-5 per category, no performance benchmarks) —
// "Previous" only renders once at least one test has actually been
// rescored (five_s_results.previous_score set by the DB trigger), so a
// player with a single assessment just shows "Current".
export function FiveSRadarSection({
  current,
  previous,
  showPrevious,
}: {
  current: Record<string, number>;
  previous: Record<string, number>;
  showPrevious: boolean;
}) {
  return (
    <div className={cn("grid gap-4", showPrevious ? "sm:grid-cols-2" : "max-w-sm")}>
      <RadarCard title="5S Model Current Overview" legendLabel="Current Test Data" scores={current} />
      {showPrevious && (
        <RadarCard title="5S Model Previous Overview" legendLabel="Previous Test Data" scores={previous} />
      )}
    </div>
  );
}
