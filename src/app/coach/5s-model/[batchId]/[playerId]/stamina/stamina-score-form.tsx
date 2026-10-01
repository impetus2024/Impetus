"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { submitStaminaScores, type StaminaScoresFormState } from "../../../actions";
import { AutoSaveStatus, useAutoSaveScore } from "../../../auto-save-score";

type Test = { id: string; name: string; unit: string };
type ExistingResult = {
  score: number | null;
  remarks: string | null;
};

export function StaminaScoreForm({
  batchId,
  playerId,
  tests,
  existingByTest,
  overallRemarks,
  lockedTestIds,
  guidance,
}: {
  batchId: string;
  playerId: string;
  tests: Test[];
  existingByTest: Map<string, ExistingResult>;
  overallRemarks: string;
  lockedTestIds: Set<string>;
  guidance: Map<string, string>;
}) {
  const action = submitStaminaScores.bind(
    null,
    batchId,
    playerId,
    tests.map((t) => ({ id: t.id, unit: t.unit }))
  );
  const [state, formAction, pending] = useActionState<StaminaScoresFormState, FormData>(action, undefined);
  const { entries, save } = useAutoSaveScore(batchId, playerId);

  return (
    <form action={formAction} className="space-y-8">
      {tests.map((test) => {
        const existing = existingByTest.get(test.id);
        const locked = lockedTestIds.has(test.id);
        const guide = guidance.get(test.id);
        return (
          <div key={test.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{test.name}</h2>
              {locked ? (
                <span className="text-sm text-muted-foreground">
                  Already recorded by another coach — locked
                </span>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Info className="size-4" /> Kickstart Performance Bands
                      </span>
                    }
                  />
                  <TooltipContent>Compared against Kickstart performance bands for this age group.</TooltipContent>
                </Tooltip>
              )}
            </div>

            {guide && <FieldDescription>{guide}</FieldDescription>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`score_${test.id}`}>
                  {!locked && <span className="text-destructive">*</span>} Score:
                </FieldLabel>
                <Input
                  id={`score_${test.id}`}
                  name={`score_${test.id}`}
                  type="number"
                  step={test.unit === "level" ? "0.1" : "0.01"}
                  min="0"
                  placeholder={test.unit === "level" ? "Completed level" : "Mean time (s)"}
                  defaultValue={existing?.score != null ? String(existing.score) : ""}
                  required={!locked}
                  disabled={locked}
                  onBlur={(event) => save(test.id, event.currentTarget.value)}
                />
                <AutoSaveStatus entry={entries[test.id]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor={`remarks_${test.id}`}>
                {!locked && <span className="text-destructive">*</span>} Remarks:
              </FieldLabel>
              <Textarea
                id={`remarks_${test.id}`}
                name={`remarks_${test.id}`}
                placeholder="Remarks"
                defaultValue={existing?.remarks ?? ""}
                required={!locked}
                disabled={locked}
              />
            </Field>
          </div>
        );
      })}

      <div className="space-y-4 border-t border-border/50 pt-6">
        <h2 className="text-lg font-semibold">Over All Remarks</h2>
        <Field>
          <FieldLabel htmlFor="overall_remarks">
            <span className="text-destructive">*</span> Remarks:
          </FieldLabel>
          <Textarea
            id="overall_remarks"
            name="overall_remarks"
            placeholder="Remarks"
            defaultValue={overallRemarks}
            required
          />
        </Field>
      </div>

      {state?.error && (
        <FieldDescription className="text-destructive">{state.error}</FieldDescription>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" render={<Link href={`/coach/5s-model/${batchId}/${playerId}`}>Back</Link>} />
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </form>
  );
}
