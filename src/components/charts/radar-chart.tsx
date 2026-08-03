export type RadarDatum = { label: string; value: number };

// SIZE has to leave enough horizontal margin past LABEL_RADIUS for the
// longest axis label ("Stamina"/"Strength") not to clip against the
// viewBox edge — SVG clips overflowing text by default.
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 92;
const LABEL_RADIUS = RADIUS + 22;
const GRID_LEVELS = [1, 2, 3, 4, 5];

function axisPoint(index: number, count: number, radius: number) {
  const angle = ((360 / count) * index - 90) * (Math.PI / 180);
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

function polygon(data: RadarDatum[], max: number, radiusForValue: (v: number) => number) {
  return data
    .map((d, i) => {
      const { x, y } = axisPoint(i, data.length, radiusForValue(Math.min(d.value, max)));
      return `${x},${y}`;
    })
    .join(" ");
}

// Plain SVG, no charting dependency — same approach as SimpleBarChart. No
// interactivity needed here, so this stays a Server Component.
export function RadarChart({
  data,
  max = 5,
  color = "var(--color-chart-3)",
  className = "mx-auto w-full max-w-[300px]",
}: {
  data: RadarDatum[];
  max?: number;
  color?: string;
  className?: string;
}) {
  if (data.length < 3) return null;
  const radiusForValue = (v: number) => (Math.max(0, v) / max) * RADIUS;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={className} role="img" aria-label="Radar chart">
      {GRID_LEVELS.map((level) => (
        <polygon
          key={level}
          points={data.map((_, i) => {
            const { x, y } = axisPoint(i, data.length, (level / max) * RADIUS);
            return `${x},${y}`;
          }).join(" ")}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      ))}

      {data.map((d, i) => {
        const { x, y } = axisPoint(i, data.length, RADIUS);
        return <line key={d.label} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
      })}

      {GRID_LEVELS.map((level) => {
        const { x, y } = axisPoint(0, data.length, (level / max) * RADIUS);
        return (
          <text key={level} x={x + 4} y={y} fontSize={9} fill="var(--color-muted-foreground)" textAnchor="end">
            {level}
          </text>
        );
      })}

      <polygon points={polygon(data, max, radiusForValue)} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} />

      {data.map((d, i) => {
        const { x, y } = axisPoint(i, data.length, radiusForValue(Math.min(d.value, max)));
        return <circle key={d.label} cx={x} cy={y} r={3} fill={color} />;
      })}

      {data.map((d, i) => {
        const { x, y } = axisPoint(i, data.length, LABEL_RADIUS);
        const textAnchor = Math.abs(x - CENTER) < 4 ? "middle" : x > CENTER ? "start" : "end";
        return (
          <text key={d.label} x={x} y={y} fontSize={11} fill="var(--color-muted-foreground)" textAnchor={textAnchor} dominantBaseline="middle">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
