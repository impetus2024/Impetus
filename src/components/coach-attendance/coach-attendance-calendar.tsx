import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  WEEKDAYS,
  MONTH_NAMES,
  toDateKey,
  monthParam,
  parseMonthParam,
  buildCalendarGrid,
} from "@/lib/calendar-grid";

// Same glossy-dot treatment as the player attendance calendar
// (src/components/profile/attendance-calendar.tsx), just two states
// instead of three — a coach's day is binary (attended/not), it doesn't
// have the player-level "not marked yet" state.
const DOT_STYLE = {
  attended:
    "bg-status-good shadow-[0_2px_6px_-1px_rgba(12,163,12,0.55),inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1.5px_rgba(0,0,0,0.12)]",
  notAttended:
    "bg-status-critical shadow-[0_2px_6px_-1px_rgba(208,59,59,0.55),inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1.5px_rgba(0,0,0,0.12)]",
} as const;

export async function CoachAttendanceCalendar({
  batches,
  batchId,
  month,
  selectedDate,
  basePath,
}: {
  batches: { id: string; name: string }[];
  /** "all" or one of `batches[].id`, already validated by the caller. */
  batchId: string;
  month?: string;
  selectedDate?: string;
  /** Must already include `?batchId=...` — month/date get appended with `&`. */
  basePath: string;
}) {
  const { year, month: monthIdx } = parseMonthParam(month);
  const cells = buildCalendarGrid(year, monthIdx);
  const rangeStart = toDateKey(cells[0]);
  const rangeEnd = toDateKey(cells[cells.length - 1]);

  const batchIds = batches.map((b) => b.id);

  const supabase = await createClient();
  // Only the columns needed to know *whether* attendance exists per
  // batch/date — same minimal-select shape as the coach's own attendance
  // page (src/app/coach/attendance/[batchId]/page.tsx), no player-level
  // status needed here.
  const { data: records } = batchIds.length
    ? await supabase
        .from("attendance")
        .select("batch_id, attendance_date")
        .in("batch_id", batchIds)
        .gte("attendance_date", rangeStart)
        .lte("attendance_date", rangeEnd)
    : { data: [] as { batch_id: string; attendance_date: string }[] };

  const enteredByDate = new Map<string, Set<string>>();
  for (const r of records ?? []) {
    if (!enteredByDate.has(r.attendance_date)) enteredByDate.set(r.attendance_date, new Set());
    enteredByDate.get(r.attendance_date)!.add(r.batch_id);
  }

  function isAttended(dateKey: string) {
    const entered = enteredByDate.get(dateKey);
    if (!entered || entered.size === 0) return false;
    return batchId === "all" ? true : entered.has(batchId);
  }

  const todayKey = toDateKey(new Date());
  const prevHref = `${basePath}&month=${monthParam(year, monthIdx - 1)}`;
  const nextHref = `${basePath}&month=${monthParam(year, monthIdx + 1)}`;

  // The day-detail breakdown always covers every assigned batch, regardless
  // of the All Batches / single-batch filter above — the admin is looking
  // at *why* the coach's overall status landed where it did.
  const dayDetail =
    selectedDate && selectedDate >= rangeStart && selectedDate <= rangeEnd
      ? batches.map((b) => ({
          id: b.id,
          name: b.name,
          entered: enteredByDate.get(selectedDate)?.has(b.id) ?? false,
        }))
      : null;
  const dayDetailAttended = dayDetail?.some((b) => b.entered) ?? false;

  return (
    <div className="space-y-6">
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
              const isSelected = key === selectedDate;

              let dotClass: string | null = null;
              if (key <= todayKey) dotClass = isAttended(key) ? DOT_STYLE.attended : DOT_STYLE.notAttended;

              return (
                <Link
                  key={key}
                  href={`${basePath}&month=${monthParam(year, monthIdx)}&date=${key}`}
                  className={cn(
                    "flex h-20 flex-col items-center gap-2 border-r border-b border-border/60 pt-2.5 last:border-r-0 [&:nth-child(7n)]:border-r-0 hover:bg-muted/60",
                    isToday && "bg-primary/10",
                    isSelected && "ring-2 ring-inset ring-primary"
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
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", DOT_STYLE.attended)} /> Attended
          </span>
          <span className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", DOT_STYLE.notAttended)} /> Not attended
          </span>
        </div>
      </div>

      {dayDetail && (
        <div className="space-y-3 rounded-2xl border border-border/60 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{selectedDate}</h4>
            <Badge variant={dayDetailAttended ? "default" : "secondary"}>
              {dayDetailAttended ? "Attended" : "Not Attended"}
            </Badge>
          </div>
          <ul className="space-y-1.5 text-sm">
            {dayDetail.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4">
                <span>{b.name}</span>
                <span className={b.entered ? "text-status-good" : "text-muted-foreground"}>
                  {b.entered ? "Attendance entered" : "No attendance"}
                </span>
              </li>
            ))}
            {dayDetail.length === 0 && <li className="text-muted-foreground">No batches assigned.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
