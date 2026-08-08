"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { vo2MaxFromBeepTest, vo2MaxFromCooperTest } from "@/lib/five-s/vo2-max";
import { submitStaminaScores, type StaminaScoresFormState } from "../../../actions";

type Test = { id: string; name: string; unit: string };
type ExistingResult = {
  score: number | null;
  level: number | null;
  shuttle: number | null;
  vo2_max: number | null;
  remarks: string | null;
};

// Beep Test's raw score is a Level/Shuttle pair; every other Stamina test
// (Cooper Test) is a single number. VO2 Max is never typed by the coach —
// it's a live preview computed from whichever raw fields are filled in, and
// has no `name` attribute so it's never submitted: the server recomputes it
// authoritatively from the same raw score in submitStaminaScores.
function StaminaTestFields({
  test,
  existing,
  locked,
}: {
  test: Test;
  existing?: ExistingResult;
  locked: boolean;
}) {
  const isBeepTest = test.unit === "level";

  const [level, setLevel] = useState(existing?.level != null ? String(existing.level) : "");
  const [shuttle, setShuttle] = useState(existing?.shuttle != null ? String(existing.shuttle) : "");
  const [score, setScore] = useState(existing?.score != null ? String(existing.score) : "");

  const levelNum = Number(level);
  const shuttleNum = Number(shuttle);
  const scoreNum = Number(score);

  const vo2Max = isBeepTest
    ? level !== "" && shuttle !== "" && Number.isFinite(levelNum) && Number.isFinite(shuttleNum)
      ? vo2MaxFromBeepTest(levelNum, shuttleNum)
      : null
    : score !== "" && Number.isFinite(scoreNum)
      ? vo2MaxFromCooperTest(scoreNum)
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {isBeepTest ? (
        <>
          <Field>
            <FieldLabel htmlFor={`level_${test.id}`}>
              {!locked && <span className="text-destructive">*</span>} Level:
            </FieldLabel>
            <Input
              id={`level_${test.id}`}
              name={`level_${test.id}`}
              type="number"
              step="1"
              min="0"
              placeholder="Level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              required={!locked}
              disabled={locked}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`shuttle_${test.id}`}>
              {!locked && <span className="text-destructive">*</span>} Shuttle:
            </FieldLabel>
            <Input
              id={`shuttle_${test.id}`}
              name={`shuttle_${test.id}`}
              type="number"
              step="1"
              min="0"
              placeholder="Shuttle"
              value={shuttle}
              onChange={(e) => setShuttle(e.target.value)}
              required={!locked}
              disabled={locked}
            />
          </Field>
        </>
      ) : (
        <Field>
          <FieldLabel htmlFor={`score_${test.id}`}>
            {!locked && <span className="text-destructive">*</span>} Score:
          </FieldLabel>
          <Input
            id={`score_${test.id}`}
            name={`score_${test.id}`}
            type="number"
            step="0.01"
            min="0"
            placeholder="Score"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            required={!locked}
            disabled={locked}
          />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor={`vo2max_${test.id}`}>VO2 Max:</FieldLabel>
        <Input
          id={`vo2max_${test.id}`}
          type="text"
          value={vo2Max != null ? vo2Max.toFixed(2) : ""}
          placeholder="Auto-calculated"
          disabled
          className="bg-muted text-muted-foreground"
        />
      </Field>
    </div>
  );
}

export function StaminaScoreForm({
  batchId,
  playerId,
  tests,
  existingByTest,
  overallRemarks,
  lockedTestIds,
}: {
  batchId: string;
  playerId: string;
  tests: Test[];
  existingByTest: Map<string, ExistingResult>;
  overallRemarks: string;
  lockedTestIds: Set<string>;
}) {
  const action = submitStaminaScores.bind(
    null,
    batchId,
    playerId,
    tests.map((t) => ({ id: t.id, unit: t.unit }))
  );
  const [state, formAction, pending] = useActionState<StaminaScoresFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-8">
      {tests.map((test) => {
        const existing = existingByTest.get(test.id);
        const locked = lockedTestIds.has(test.id);
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
                        <Info className="size-4" /> European Standard Scores
                      </span>
                    }
                  />
                  <TooltipContent>Compared against European standard benchmarks for this age group.</TooltipContent>
                </Tooltip>
              )}
            </div>

            <StaminaTestFields test={test} existing={existing} locked={locked} />

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
