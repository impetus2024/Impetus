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

type Test = { id: string; name: string; unit: string };
type ExistingResult = { score: number; vo2_max: number | null; remarks: string | null };

export function StaminaScoreForm({
  batchId,
  playerId,
  tests,
  existingByTest,
  overallRemarks,
}: {
  batchId: string;
  playerId: string;
  tests: Test[];
  existingByTest: Map<string, ExistingResult>;
  overallRemarks: string;
}) {
  const action = submitStaminaScores.bind(
    null,
    batchId,
    playerId,
    tests.map((t) => t.id)
  );
  const [state, formAction, pending] = useActionState<StaminaScoresFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-8">
      {tests.map((test) => {
        const existing = existingByTest.get(test.id);
        return (
          <div key={test.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{test.name}</h2>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Info className="size-4" /> European Standard Scores
                    </span>
                  }
                />
                <TooltipContent>Compared against European standard benchmarks for this age group.</TooltipContent>
              </Tooltip>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`score_${test.id}`}>
                  <span className="text-destructive">*</span> Score:
                </FieldLabel>
                <Input
                  id={`score_${test.id}`}
                  name={`score_${test.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Score"
                  defaultValue={existing?.score ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`vo2max_${test.id}`}>
                  <span className="text-destructive">*</span> VO2 Max:
                </FieldLabel>
                <Input
                  id={`vo2max_${test.id}`}
                  name={`vo2max_${test.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="VO2 Max"
                  defaultValue={existing?.vo2_max ?? ""}
                  required
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor={`remarks_${test.id}`}>
                <span className="text-destructive">*</span> Remarks:
              </FieldLabel>
              <Textarea
                id={`remarks_${test.id}`}
                name={`remarks_${test.id}`}
                placeholder="Remarks"
                defaultValue={existing?.remarks ?? ""}
                required
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
