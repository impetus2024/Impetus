"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5];

// A 1-5 rating input in half-star increments — click the left half of a
// star for X.5, the right half for X.0. Submits as a plain hidden input
// (participates in FormData like every other field in these forms), so
// validation (required, in range) stays server-side, matching how the rest
// of this app's forms work — a hidden input can't carry native `required`
// semantics anyway (the HTML spec excludes hidden inputs from constraint
// validation).
export function StarRatingInput({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: number | null;
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className="flex items-center gap-3">
      <div className="flex" onMouseLeave={() => setHover(null)}>
        {STARS.map((star) => {
          const fillFraction = shown == null ? 0 : Math.max(0, Math.min(1, shown - (star - 1)));
          return (
            <div key={star} className="relative size-7">
              <Star className="size-7 text-muted-foreground" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillFraction * 100}%` }}>
                <Star className="size-7 fill-amber-400 text-amber-400" />
              </div>
              <button
                type="button"
                aria-label={`Rate ${star - 0.5} out of 5`}
                className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(star - 0.5)}
                onClick={() => setValue(star - 0.5)}
              />
              <button
                type="button"
                aria-label={`Rate ${star} out of 5`}
                className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(star)}
                onClick={() => setValue(star)}
              />
            </div>
          );
        })}
      </div>
      <span className={cn("text-sm tabular-nums", value != null ? "text-foreground" : "text-muted-foreground")}>
        {value != null ? `${value} / 5` : "Not rated"}
      </span>
      <input type="hidden" name={name} value={value ?? ""} />
    </div>
  );
}
