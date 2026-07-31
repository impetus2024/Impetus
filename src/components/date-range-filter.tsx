"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function toISODate(date: Date) {
  // Local calendar date, not UTC — toISOString() would shift the date
  // backward for timezones behind UTC.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Date-range filter synced to `from`/`to` URL params, following the same
// pattern as ListFilter — preserves every other param already on the URL.
export function DateRangeFilter({
  fromKey = "from",
  toKey = "to",
}: {
  fromKey?: string;
  toKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlFrom = searchParams.get(fromKey);
  const urlTo = searchParams.get(toKey);

  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    urlFrom
      ? { from: parseISODate(urlFrom), to: urlTo ? parseISODate(urlTo) : undefined }
      : undefined
  );

  function apply() {
    const params = new URLSearchParams(searchParams);
    if (range?.from) params.set(fromKey, toISODate(range.from));
    else params.delete(fromKey);
    if (range?.to) params.set(toKey, toISODate(range.to));
    else params.delete(toKey);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  function clear() {
    setRange(undefined);
    const params = new URLSearchParams(searchParams);
    params.delete(fromKey);
    params.delete(toKey);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  const label =
    urlFrom && urlTo && urlTo !== urlFrom
      ? `${urlFrom} → ${urlTo}`
      : (urlFrom ?? "Filter by date");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-9 justify-start gap-2 rounded-full font-normal sm:w-56">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} />
        <div className="flex items-center justify-end gap-2 border-t border-border/50 p-2">
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
          <Button size="sm" onClick={apply} disabled={!range?.from}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
