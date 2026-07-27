import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
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

  return (
    <Card className="gap-0 rounded-2xl border-border/70 py-5 shadow-card transition-shadow duration-200 hover:shadow-elevated">
      <CardContent className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
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
        </div>
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
