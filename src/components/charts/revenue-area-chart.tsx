"use client";

import { useId, useState } from "react";

export type RevenuePoint = { label: string; value: number };

// Plot-only viewBox -- axis text lives in HTML below/beside the SVG (see
// render), never as SVG <text>, so it stays a fixed CSS font size instead
// of scaling with the chart's fluid width (that scaling was the bug: at
// full container width a "10px" SVG font rendered 3x too large). Dots are
// HTML too, for the same reason: a non-uniformly stretched SVG circle
// (fluid width, fixed height) renders as a visible ellipse.
const WIDTH = 600;
const HEIGHT = 140;
const PAD_X = 8;
const PAD_Y = 8;
const TICKS = 4;

function formatINR(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

// Rounds a max value up to a "clean" step (1/2/5 × a power of ten) so
// gridlines read as round numbers instead of arbitrary fractions of the
// data's actual peak.
function niceMax(max: number) {
  if (max <= 0) return TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// Catmull-Rom -> cubic Bezier, so the line reads as a smooth trend rather
// than sharp month-to-month angles, while still passing exactly through
// every real data point (no invented values).
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function RevenueAreaChart({ data }: { data: RevenuePoint[] }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data yet.
      </div>
    );
  }

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * i).reverse();

  const innerWidth = WIDTH - PAD_X * 2;
  const innerHeight = HEIGHT - PAD_Y * 2;
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PAD_X + stepX * i,
    y: PAD_Y + innerHeight * (1 - d.value / max),
  }));

  const linePath = smoothPath(points);
  const areaPath =
    `${linePath} L ${points[points.length - 1].x},${PAD_Y + innerHeight} ` +
    `L ${points[0].x},${PAD_Y + innerHeight} Z`;

  const active = hoverIndex ?? points.length - 1;
  const activePoint = points[active];
  const activeDatum = data[active];

  function nearestIndexFromClientX(clientX: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const raw = Math.round(fraction * (data.length - 1));
    return Math.min(data.length - 1, Math.max(0, raw));
  }

  return (
    <div className="flex gap-3">
      {/* y-axis: fixed CSS font size, evenly spaced to match the SVG gridlines below */}
      <div className="flex h-48 w-16 shrink-0 flex-col justify-between py-1 text-right">
        {ticks.map((t, i) => (
          <span key={i} className="text-xs text-muted-foreground tabular-nums">
            {formatINR(t)}
          </span>
        ))}
      </div>

      <div className="flex-1 space-y-1.5">
        <div
          className="relative h-48"
          onPointerMove={(e) => setHoverIndex(nearestIndexFromClientX(e.clientX, e.currentTarget))}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="h-full w-full touch-none"
            role="img"
            aria-label={`Revenue by month, ${activeDatum.label}: ${formatINR(activeDatum.value)}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* recessive gridlines, spaced to match the y-axis labels' justify-between */}
            {ticks.map((_, i) => {
              const y = PAD_Y + (innerHeight / TICKS) * i;
              return <line key={i} x1={0} y1={y} x2={WIDTH} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
            })}

            <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {hoverIndex !== null && (
              <line
                x1={activePoint.x}
                y1={0}
                x2={activePoint.x}
                y2={HEIGHT}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
            )}
          </svg>

          {/* dots as HTML, not SVG -- a fluid-width/fixed-height SVG stretches
              circles into ellipses; a CSS-sized div stays round. */}
          <div
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
            style={{ left: `${(points[points.length - 1].x / WIDTH) * 100}%`, top: `${(points[points.length - 1].y / HEIGHT) * 100}%` }}
          />
          {hoverIndex !== null && (
            <div
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
              style={{ left: `${(activePoint.x / WIDTH) * 100}%`, top: `${(activePoint.y / HEIGHT) * 100}%` }}
            />
          )}

          {hoverIndex !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-elevated"
              style={{ left: `${(activePoint.x / WIDTH) * 100}%`, top: `${(activePoint.y / HEIGHT) * 100}%` }}
            >
              <p className="font-semibold text-foreground tabular-nums">{formatINR(activeDatum.value)}</p>
              <p className="text-muted-foreground">{activeDatum.label}</p>
            </div>
          )}
        </div>

        {/* x-axis: same fixed CSS font size, evenly spaced to match the points above */}
        <div className="flex justify-between">
          {data.map((d, i) => (
            <span key={d.label + i} className="text-xs text-muted-foreground">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
