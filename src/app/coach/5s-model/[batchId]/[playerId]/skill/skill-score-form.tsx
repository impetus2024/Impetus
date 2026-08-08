"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { submitSkillScores, type SkillGroup, type SkillScoresFormState } from "../../../actions";

type Test = { id: string; name: string; group_name: string | null; is_required: boolean };

export function SkillScoreForm({
  batchId,
  playerId,
  tests,
  existingScores,
  existingGroupRemarks,
  overallRemarks,
  lockedTestIds,
}: {
  batchId: string;
  playerId: string;
  tests: Test[];
  existingScores: Map<string, number>;
  existingGroupRemarks: Map<string, string>;
  overallRemarks: string;
  lockedTestIds: Set<string>;
}) {
  const groups: { label: string; tests: Test[] }[] = [];
  for (const test of tests) {
    const label = test.group_name ?? "";
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.tests.push(test);
    } else {
      groups.push({ label, tests: [test] });
    }
  }

  const boundGroups: SkillGroup[] = groups.map((g) => ({
    label: g.label,
    testIds: g.tests.map((t) => t.id),
    requiredTestIds: g.tests.filter((t) => t.is_required).map((t) => t.id),
  }));

  const action = submitSkillScores.bind(null, batchId, playerId, boundGroups);
  const [state, formAction, pending] = useActionState<SkillScoresFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-8">
      {groups.map((group, groupIndex) => (
        <div key={group.label} className="space-y-5">
          <h2 className="text-lg font-semibold">{group.label}</h2>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              {group.tests.map((test) => {
                const locked = lockedTestIds.has(test.id);
                return (
                  <Field key={test.id}>
                    <FieldLabel htmlFor={`score_${test.id}`}>
                      {test.is_required && !locked && <span className="text-destructive">*</span>} {test.name}
                    </FieldLabel>
                    <div className="flex items-center gap-3">
                      <Input
                        id={`score_${test.id}`}
                        name={`score_${test.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Rating"
                        defaultValue={existingScores.get(test.id) ?? ""}
                        required={test.is_required && !locked}
                        disabled={locked}
                        className="max-w-md"
                      />
                      {locked && (
                        <span className="text-sm text-muted-foreground">
                          Already recorded by another coach — locked
                        </span>
                      )}
                    </div>
                  </Field>
                );
              })}
            </div>
            <Field>
              <FieldLabel htmlFor={`remarks_group_${groupIndex}`}>
                <span className="text-destructive">*</span> Remarks
              </FieldLabel>
              <Textarea
                id={`remarks_group_${groupIndex}`}
                name={`remarks_group_${groupIndex}`}
                placeholder="Remarks"
                defaultValue={existingGroupRemarks.get(group.label) ?? ""}
                required
                className="min-h-32"
              />
            </Field>
          </div>
        </div>
      ))}

      <div className="space-y-4 border-t border-border/50 pt-6">
        <h2 className="text-lg font-semibold">Over All Remarks</h2>
        <Field>
          <FieldLabel htmlFor="overall_remarks">
            <span className="text-destructive">*</span> Remarks
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

      {state?.error && <FieldDescription className="text-destructive">{state.error}</FieldDescription>}

      <div className="flex justify-end gap-3">
        <Button variant="outline" render={<Link href={`/coach/5s-model/${batchId}/${playerId}`}>Back</Link>} />
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </form>
  );
}
