"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_RANGE_PRESETS, type DateRangePreset } from "@/lib/email-analytics/date-range";

function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Same URL-param-preserving convention as ListSearch/ListFilter — writes
// `range` (and `from`/`to` for a custom range), keeps every other param
// (search text, pagination, sort) already on the URL.
export function DateRangeFilter({
  preset,
  from,
  to,
}: {
  preset: DateRangePreset;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(
    preset === "custom" ? { from: parseISODate(from), to: parseISODate(to) } : undefined
  );

  function applyPreset(id: DateRangePreset) {
    const params = new URLSearchParams(searchParams);
    params.set("range", id);
    params.delete("from");
    params.delete("to");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function applyCustom(next: DateRange | undefined) {
    setCustomRange(next);
    if (!next?.from || !next?.to) return;

    const params = new URLSearchParams(searchParams);
    params.set("range", "custom");
    params.set("from", toISODate(next.from));
    params.set("to", toISODate(next.to));
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_RANGE_PRESETS.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant={preset === p.id ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => applyPreset(p.id)}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button type="button" variant={preset === "custom" ? "default" : "outline"} size="sm" className="rounded-full">
              <CalendarIcon className="size-3.5" />
              {preset === "custom" ? `${from} – ${to}` : "Custom Range"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="range" selected={customRange} onSelect={applyCustom} numberOfMonths={2} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
