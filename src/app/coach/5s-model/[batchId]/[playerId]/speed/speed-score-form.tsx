"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { submitSpeedScores, type SpeedScoresFormState } from "../../../actions";
import { AutoSaveStatus, useAutoSaveScore } from "../../../auto-save-score";

type Test = { id: string; name: string; unit: string };

export function SpeedScoreForm({
  batchId,
  playerId,
  tests,
  existingScores,
  lockedTestIds,
  distanceGuidance,
}: {
  batchId: string;
  playerId: string;
  tests: Test[];
  existingScores: Map<string, number>;
  lockedTestIds: Set<string>;
  distanceGuidance: Map<string, string>;
}) {
  const action = submitSpeedScores.bind(null, batchId, playerId);
  const [state, formAction, pending] = useActionState<SpeedScoresFormState, FormData>(action, undefined);
  const { entries, save } = useAutoSaveScore(batchId, playerId);
  const allLocked = tests.length > 0 && tests.every((t) => lockedTestIds.has(t.id));

  return (
    <form action={formAction} className="space-y-6">
      <FieldGroup>
        {tests.map((test) => {
          const locked = lockedTestIds.has(test.id);
          // Resolved on the server from the player's age band — null for the
          // tests that run one distance for everyone.
          const distance = distanceGuidance.get(test.id);
          return (
            <Field key={test.id}>
              <FieldLabel htmlFor={`score_${test.id}`}>
                {!locked && <span className="text-destructive">*</span>} {test.name}
              </FieldLabel>
              {distance && <FieldDescription>{distance}</FieldDescription>}
              <div className="flex items-center gap-3">
                <Input
                  id={`score_${test.id}`}
                  name={`score_${test.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Score ( in Sec )"
                  defaultValue={existingScores.get(test.id) ?? ""}
                  required={!locked}
                  disabled={locked}
                  onBlur={(event) => save(test.id, event.currentTarget.value)}
                  className="max-w-md"
                />
                {locked ? (
                  <span className="text-sm text-muted-foreground">
                    Already recorded by another coach — locked
                  </span>
                ) : (
                  <>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                            <Info className="size-3.5" />
                          </span>
                        }
                      />
                      <TooltipContent>Compared against Kickstart performance bands for this age group.</TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">
                      Kickstart Performance Bands
                    </span>
                  </>
                )}
              </div>
              <AutoSaveStatus entry={entries[test.id]} />
            </Field>
          );
        })}
      </FieldGroup>

      {state?.error && (
        <FieldDescription className="text-destructive">{state.error}</FieldDescription>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" render={<Link href={`/coach/5s-model/${batchId}/${playerId}`}>Back</Link>} />
        <Button type="submit" disabled={pending || allLocked}>
          {pending ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </form>
  );
}
