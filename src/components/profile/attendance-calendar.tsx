import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEEKDAYS, MONTH_NAMES, toDateKey, monthParam, parseMonthParam, buildCalendarGrid } from "@/lib/calendar-grid";

// Glossy, embossed dot: a colored glow shadow beneath plus a soft inset
// highlight/shade so it reads as a small raised bead, not a flat circle.
const DOT_STYLE = {
  present:
    "bg-status-good shadow-[0_2px_6px_-1px_rgba(12,163,12,0.55),inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1.5px_rgba(0,0,0,0.12)]",
  absent:
    "bg-status-critical shadow-[0_2px_6px_-1px_rgba(208,59,59,0.55),inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1.5px_rgba(0,0,0,0.12)]",
  notMarked:
    "bg-status-warning shadow-[0_2px_6px_-1px_rgba(250,178,25,0.55),inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1.5px_rgba(0,0,0,0.12)]",
} as const;

export async function AttendanceCalendar({
  playerId,
  month,
  basePath,
}: {
  playerId: string;
  month?: string;
  /** Must already include `?section=attendance` (or equivalent) — month gets appended with `&`. */
  basePath: string;
}) {
  const { year, month: monthIdx } = parseMonthParam(month);
  const cells = buildCalendarGrid(year, monthIdx);
  const rangeStart = toDateKey(cells[0]);
  const rangeEnd = toDateKey(cells[cells.length - 1]);

  const supabase = await createClient();
  const { data: records } = await supabase
    .from("attendance")
    .select("attendance_date, status")
    .eq("player_id", playerId)
    .gte("attendance_date", rangeStart)
    .lte("attendance_date", rangeEnd);

  const statusByDate = new Map<string, "present" | "absent">();
  for (const r of records ?? []) statusByDate.set(r.attendance_date, r.status);

  const todayKey = toDateKey(new Date());
  const prevHref = `${basePath}&month=${monthParam(year, monthIdx - 1)}`;
  const nextHref = `${basePath}&month=${monthParam(year, monthIdx + 1)}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-tight">
          {MONTH_NAMES[monthIdx]} {year}
        </h3>
        <div className="flex items-center gap-2">
          <Link href={prevHref} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full bg-card shadow-sm hover:bg-muted")}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Previous month</span>
          </Link>
          <Link href={nextHref} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full bg-card shadow-sm hover:bg-muted")}>
            <ChevronRight className="size-4" />
            <span className="sr-only">Next month</span>
          </Link>
          <Link href={basePath} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
            Today
          </Link>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border/60">
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date) => {
            const key = toDateKey(date);
            const inMonth = date.getMonth() === monthIdx;
            const isToday = key === todayKey;
            const status = statusByDate.get(key);

            let dotClass: string | null = null;
            if (status === "present") dotClass = DOT_STYLE.present;
            else if (status === "absent") dotClass = DOT_STYLE.absent;
            else if (key <= todayKey) dotClass = DOT_STYLE.notMarked;

            return (
              <div
                key={key}
                className={cn(
                  "flex h-20 flex-col items-center gap-2 border-r border-b border-border/60 pt-2.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                  isToday && "bg-primary/10"
                )}
              >
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    inMonth ? "text-foreground" : "text-muted-foreground/40",
                    isToday && "font-semibold text-primary"
                  )}
                >
                  {date.getDate()}
                </span>
                {dotClass && <span className={cn("size-3 rounded-full", dotClass)} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", DOT_STYLE.present)} /> Present
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", DOT_STYLE.absent)} /> Absent
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", DOT_STYLE.notMarked)} /> Not marked
        </span>
      </div>
    </div>
  );
}
