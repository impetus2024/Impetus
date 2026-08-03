import { ShieldCheck, Award } from "lucide-react";
import { FIVE_S_CATEGORY_META, type FiveSCategory } from "@/lib/five-s/categories";
import { cn } from "@/lib/utils";

const AXES: { key: FiveSCategory; label: string; color: string }[] = [
  { key: "speed", label: "Speed", color: "var(--color-status-good)" },
  { key: "stamina", label: "Stamina", color: "var(--color-chart-4)" },
  { key: "strength", label: "Strength", color: "#8b5cf6" },
  { key: "skill", label: "Skill", color: "var(--color-chart-1)" },
  { key: "spirit", label: "Spirit", color: "var(--color-status-critical)" },
];

const DATA_COLOR = "var(--color-chart-3)";
const MAX = 5;
const SIZE = 340;
const CENTER = SIZE / 2;
const RADIUS = 92;
const BADGE_RADIUS = RADIUS + 56;
const GRID_LEVELS = [1, 2, 3, 4, 5];

function axisPoint(index: number, count: number, radius: number) {
  const angle = ((360 / count) * index - 90) * (Math.PI / 180);
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

function tier(score: number): { label: string; className: string } {
  if (score < 2) return { label: "Needs Improvement", className: "text-status-critical" };
  if (score < 3.5) return { label: "Good", className: "text-status-warning" };
  return { label: "Excellent", className: "text-status-good" };
}

function overallMessage(score: number): string {
  if (score < 2) return "Keep practicing! You can do better.";
  if (score < 3.5) return "Good progress! Keep pushing.";
  return "Excellent! Keep up the great work.";
}

// Bespoke, colorful presentation of the 5S radar built specifically for this
// card — deliberately separate from the generic single-color <RadarChart>
// (still used as-is in five-s-radar-section.tsx's Current/Previous overview
// cards), since giving that shared component a rainbow-per-axis boundary
// plus icon badges would be a much bigger, more disruptive change than this
// one dashboard widget calls for.
export function FiveSPerformanceOverview({ scores }: { scores: Record<string, number> }) {
  const values = AXES.map((a) => Math.max(0, Math.min(MAX, scores[a.key] ?? 0)));
  const overall = values.reduce((sum, v) => sum + v, 0) / values.length;
  const radiusForValue = (v: number) => (v / MAX) * RADIUS;

  const dataPoints = AXES.map((a, i) => {
    const { x, y } = axisPoint(i, AXES.length, radiusForValue(scores[a.key] ?? 0));
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">5S Model</h3>
            <p className="text-sm text-muted-foreground">Your Performance Overview</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Award className="size-4.5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Overall Performance</p>
            <p className="text-lg leading-tight font-semibold text-primary">
              {overall.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">/ 5</span>
            </p>
            <p className="text-xs text-muted-foreground">{overallMessage(overall)}</p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[440px]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label="5S performance radar">
          {GRID_LEVELS.map((level) => {
            const isOuter = level === GRID_LEVELS.length;
            const points = AXES.map((_, i) => {
              const { x, y } = axisPoint(i, AXES.length, (level / MAX) * RADIUS);
              return { x, y };
            });
            if (!isOuter) {
              return (
                <polygon
                  key={level}
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              );
            }
            // Outermost ring only: each edge gets its own gradient between
            // the two axis colors it connects, so the frame reads as one
            // continuous rainbow rather than a flat single color.
            return points.map((p, i) => {
              const next = points[(i + 1) % points.length];
              const gradId = `five-s-edge-${i}`;
              return (
                <g key={i}>
                  <defs>
                    <linearGradient id={gradId} x1={p.x} y1={p.y} x2={next.x} y2={next.y} gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor={AXES[i].color} />
                      <stop offset="100%" stopColor={AXES[(i + 1) % AXES.length].color} />
                    </linearGradient>
                  </defs>
                  <line x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke={`url(#${gradId})`} strokeWidth={2} />
                </g>
              );
            });
          })}

          {AXES.map((axis, i) => {
            const { x, y } = axisPoint(i, AXES.length, RADIUS);
            return <line key={axis.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
          })}

          {GRID_LEVELS.map((level) => {
            const { x, y } = axisPoint(0, AXES.length, (level / MAX) * RADIUS);
            return (
              <text key={level} x={x + 4} y={y} fontSize={9} fill="var(--color-muted-foreground)" textAnchor="end">
                {level}
              </text>
            );
          })}

          <polygon points={dataPoints} fill={DATA_COLOR} fillOpacity={0.22} stroke={DATA_COLOR} strokeWidth={2} />
          {AXES.map((axis, i) => {
            const { x, y } = axisPoint(i, AXES.length, radiusForValue(scores[axis.key] ?? 0));
            return <circle key={axis.key} cx={x} cy={y} r={3.5} fill={DATA_COLOR} />;
          })}
        </svg>

        {AXES.map((axis, i) => {
          const { x, y } = axisPoint(i, AXES.length, BADGE_RADIUS);
          const Icon = FIVE_S_CATEGORY_META[axis.key].icon;
          return (
            <div
              key={axis.key}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
              style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }}
            >
              <div
                className="flex size-9 items-center justify-center rounded-full border-2 bg-card"
                style={{ borderColor: axis.color, color: axis.color }}
              >
                <Icon className="size-4" />
              </div>
              <span className="text-xs font-semibold whitespace-nowrap text-foreground">{axis.label}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex h-0.5 w-5 rounded-full" style={{ backgroundColor: DATA_COLOR }} />
        Current 5S Test Data
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {AXES.map((axis) => {
          const score = Math.max(0, Math.min(MAX, scores[axis.key] ?? 0));
          const { label: tierLabel, className: tierClass } = tier(score);
          const Icon = FIVE_S_CATEGORY_META[axis.key].icon;
          return (
            <div key={axis.key} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${axis.color} 15%, transparent)`, color: axis.color }}
                >
                  <Icon className="size-3.5" />
                </div>
                <span className="text-sm font-medium text-foreground">{axis.label}</span>
              </div>
              <p className="mt-2 text-lg font-semibold" style={{ color: axis.color }}>
                {score.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">/ 5</span>
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(score / MAX) * 100}%`, backgroundColor: axis.color }}
                />
              </div>
              <p className={cn("mt-1.5 text-xs font-medium", tierClass)}>{tierLabel}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
