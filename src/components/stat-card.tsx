import type { LucideIcon } from "lucide-react";
import { Maximize2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Positive = good (shown in status-good), negative = shown in status-critical. */
  trend?: { value: number; label?: string };
}) {
  const trendGood = trend !== undefined && trend.value >= 0;
  const isLongText = typeof value === "string" && value.length > 8;

  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5 shadow-soft transition-shadow duration-200 hover:shadow-card">
      <CardContent className="px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground/50">
            <Maximize2 className="size-3" />
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {Icon && (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/70">
              <Icon className="size-4" />
            </div>
          )}
          <p
            className={cn(
              "min-w-0 truncate font-semibold tracking-tight tabular-nums",
              isLongText ? "text-lg" : "text-3xl"
            )}
          >
            {value}
          </p>
        </div>

        {trend && (
          <p
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              trendGood ? "text-status-good" : "text-status-critical"
            )}
          >
            {trendGood ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
