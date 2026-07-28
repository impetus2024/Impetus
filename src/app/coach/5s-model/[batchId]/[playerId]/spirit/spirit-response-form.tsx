"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldDescription } from "@/components/ui/field";
import { submitSpiritResponses, type SpiritResponsesFormState } from "../../../actions";

type Question = { id: string; section: string; question: string };

const ANSWERS = [
  { value: "rarely", label: "Rarely" },
  { value: "sometimes", label: "Sometimes" },
  { value: "frequently", label: "Frequently" },
  { value: "always", label: "Always" },
] as const;

const GRID_COLS = "grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem]";

export function SpiritResponseForm({
  batchId,
  playerId,
  questions,
  existingByQuestion,
}: {
  batchId: string;
  playerId: string;
  questions: Question[];
  existingByQuestion: Map<string, string>;
}) {
  const action = submitSpiritResponses.bind(
    null,
    batchId,
    playerId,
    questions.map((q) => q.id)
  );
  const [state, formAction, pending] = useActionState<SpiritResponsesFormState, FormData>(action, undefined);

  const sections: { label: string; questions: Question[] }[] = [];
  for (const question of questions) {
    const current = sections[sections.length - 1];
    if (current && current.label === question.section) {
      current.questions.push(question);
    } else {
      sections.push({ label: question.section, questions: [question] });
    }
  }

  let slNo = 0;

  return (
    <form action={formAction} className="space-y-8">
      {sections.map((section) => (
        <div key={section.label} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.label}</h2>

          <div className="overflow-x-auto rounded-lg border border-border/50">
            <div className={`grid ${GRID_COLS} gap-x-4 border-b border-border/50 bg-muted/40 px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase`}>
              <span>Sl. No</span>
              <span>Question</span>
              {ANSWERS.map((a) => (
                <span key={a.value} className="text-center">
                  {a.label}
                </span>
              ))}
            </div>

            {section.questions.map((question) => {
              slNo += 1;
              return (
                <RadioGroup
                  key={question.id}
                  name={`answer_${question.id}`}
                  defaultValue={existingByQuestion.get(question.id)}
                  required
                  className={`grid ${GRID_COLS} items-center gap-x-4 border-b border-border/50 px-4 py-3 last:border-b-0`}
                >
                  <span className="text-sm text-muted-foreground">{slNo}</span>
                  <span className="text-sm text-foreground">{question.question}</span>
                  {ANSWERS.map((a) => (
                    <div key={a.value} className="flex justify-center">
                      <RadioGroupItem value={a.value} />
                    </div>
                  ))}
                </RadioGroup>
              );
            })}
          </div>
        </div>
      ))}

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
