"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { submitSpeedScores, type SpeedScoresFormState } from "../../../actions";

type Test = { id: string; name: string; unit: string };

export function SpeedScoreForm({
  batchId,
  playerId,
  tests,
  existingScores,
}: {
  batchId: string;
  playerId: string;
  tests: Test[];
  existingScores: Map<string, number>;
}) {
  const action = submitSpeedScores.bind(null, batchId, playerId);
  const [state, formAction, pending] = useActionState<SpeedScoresFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <FieldGroup>
        {tests.map((test) => (
          <Field key={test.id}>
            <FieldLabel htmlFor={`score_${test.id}`}>
              <span className="text-destructive">*</span> {test.name}
            </FieldLabel>
            <div className="flex items-center gap-3">
              <Input
                id={`score_${test.id}`}
                name={`score_${test.id}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Score ( in Sec )"
                defaultValue={existingScores.get(test.id) ?? ""}
                required
                className="max-w-md"
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                      <Info className="size-3.5" />
                    </span>
                  }
                />
                <TooltipContent>Compared against European standard benchmarks for this age group.</TooltipContent>
              </Tooltip>
              <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">
                European Standard Scores
              </span>
            </div>
          </Field>
        ))}
      </FieldGroup>

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
