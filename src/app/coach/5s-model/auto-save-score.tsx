"use client";

import { useCallback, useRef, useState } from "react";
import { autoSaveTestScore } from "./actions";

export type AutoSaveEntry = { status: "saving" | "saved" | "error"; error?: string };

// Per-field auto-save for the coach score-entry forms — see
// autoSaveTestScore's comment in ./actions.ts for why this exists. Status is
// tracked per test id rather than as one global flag, so "Saved" appears
// beside the field the coach just filled in instead of somewhere they'd have
// to scroll to.
export function useAutoSaveScore(batchId: string, playerId: string) {
  const [entries, setEntries] = useState<Record<string, AutoSaveEntry>>({});
  // Last value successfully written — blurring a field the coach didn't
  // change (tabbing through, clicking Back and returning) must not re-save.
  const savedValues = useRef(new Map<string, string>());

  const save = useCallback(
    async (testId: string, value: string) => {
      const trimmed = value.trim();
      if (trimmed === "" || savedValues.current.get(testId) === trimmed) return;

      const setEntry = (entry: AutoSaveEntry | null) =>
        setEntries((prev) => {
          const next = { ...prev };
          if (entry) next[testId] = entry;
          else delete next[testId];
          return next;
        });

      setEntry({ status: "saving" });
      const result = await autoSaveTestScore(batchId, playerId, testId, trimmed);

      if (result.error) {
        setEntry({ status: "error", error: result.error });
        return;
      }
      if (!result.saved) {
        // Nothing worth saving (empty/partial input) — clear the indicator
        // rather than leaving a stale "Saving…" behind.
        setEntry(null);
        return;
      }

      savedValues.current.set(testId, trimmed);
      setEntry({ status: "saved" });
    },
    [batchId, playerId]
  );

  return { entries, save };
}

export function AutoSaveStatus({ entry }: { entry: AutoSaveEntry | undefined }) {
  if (!entry) return null;

  if (entry.status === "error") {
    return <p className="mt-1.5 text-xs text-destructive">{entry.error}</p>;
  }

  return (
    <p className="mt-1.5 text-xs text-muted-foreground">
      {entry.status === "saving" ? "Saving…" : "Saved"}
    </p>
  );
}
