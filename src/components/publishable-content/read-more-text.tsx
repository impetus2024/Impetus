"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Past this length, the text gets clamped with a "Read More" toggle instead
// of always rendering in full — keeps a feed card scannable the way a
// social app truncates long captions. Shared by Monthly Highlights and
// News & Events feed cards.
const LONG_TEXT_THRESHOLD = 180;

export function ReadMoreText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_TEXT_THRESHOLD;

  return (
    <div>
      <p
        className={cn(
          "text-sm whitespace-pre-line text-muted-foreground",
          !expanded && isLong && "line-clamp-3"
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Read Less" : "Read More"}
        </button>
      )}
    </div>
  );
}
