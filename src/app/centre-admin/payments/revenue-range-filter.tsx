"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectLabel } from "@/lib/utils";
import { REVENUE_RANGE_OPTIONS, DEFAULT_REVENUE_RANGE } from "./revenue-range";

// Same URL-param-driven pattern as ListFilter, but always has an explicit
// current value (defaults to 6 months) instead of an "All ___" removable
// state -- there's no "unfiltered" reading for a trend chart's time window.
export function RevenueRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") ?? DEFAULT_REVENUE_RANGE;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === DEFAULT_REVENUE_RANGE) {
      params.delete("range");
    } else {
      params.set("range", value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={current} onValueChange={(v) => v && handleChange(v)}>
      <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full text-xs">
        <SelectValue>
          {selectLabel([...REVENUE_RANGE_OPTIONS], REVENUE_RANGE_OPTIONS[0].name)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {REVENUE_RANGE_OPTIONS.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
