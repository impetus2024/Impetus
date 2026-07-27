"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number };

export function SimpleBarChart({
  data,
  highlightLabel,
  decimals = 0,
}: {
  data: BarDatum[];
  /** Which bar to render at full emphasis (e.g. the current period). Defaults to the last bar. */
  highlightLabel?: string;
  /** Decimal places shown in the hover tooltip. A plain number, not a
   * formatter function — functions aren't serializable across the Server ->
   * Client boundary, and this component is rendered from Server Components. */
  decimals?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const formatValue = (v: number) => v.toFixed(decimals);
  const max = Math.max(1, ...data.map((d) => d.value));
  const emphasized = highlightLabel ?? data[data.length - 1]?.label;

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data yet.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* recessive gridlines for scale reference */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-48 flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-t border-border/60" />
        ))}
      </div>

      <div className="relative flex h-48 items-end gap-2 sm:gap-3">
        {data.map((d) => {
          const isEmphasized = d.label === emphasized;
          const isHovered = d.label === hovered;
          return (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2"
              onMouseEnter={() => setHovered(d.label)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (
                <div className="pointer-events-none absolute -top-9 z-10 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background tabular-nums shadow-elevated">
                  {formatValue(d.value)}
                </div>
              )}
              <div
                className={cn(
                  "w-full rounded-t-md transition-all duration-200",
                  isEmphasized ? "bg-chart-1" : "bg-chart-1/25",
                  isHovered && !isEmphasized && "bg-chart-1/40"
                )}
                style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
              />
              <span className="text-xs text-muted-foreground">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
