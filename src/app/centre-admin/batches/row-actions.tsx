"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { BatchFormDialog } from "./batch-form-dialog";
import { updateBatch, setBatchActive } from "./actions";

type Option = { id: string; name: string };

export function BatchRowActions({
  batch,
  coaches,
  playerTypes,
  ageCategories,
}: {
  batch: {
    id: string;
    name: string;
    // Nullable since migration 20261005000000: a batch can outlive its coach
    // (cleared from Edit Batch) and shows as unassigned until one is picked.
    head_coach_id: string | null;
    assistant_coach_id: string | null;
    player_type_id: string | null;
    age_category_id: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
    // The assigned coaches as the list query resolved them, so a coach who is
    // no longer in the active-coach list still shows up by name (see below).
    profiles: { full_name: string } | null;
    assistant_coach: { full_name: string } | null;
  };
  coaches: Option[];
  playerTypes: Option[];
  ageCategories: Option[];
}) {
  const [pending, startTransition] = useTransition();

  // A batch keeps pointing at its coach even after that person is deactivated
  // or changes role, which drops them out of the page's active-coach list. Put
  // them back for this row only: otherwise the dialog would show "No head
  // coach" for a batch that still has one, hiding the name it is assigned to.
  const coachOptions = [...coaches];
  for (const [id, name] of [
    [batch.head_coach_id, batch.profiles?.full_name],
    [batch.assistant_coach_id, batch.assistant_coach?.full_name],
  ] as const) {
    if (id && !coachOptions.some((c) => c.id === id)) {
      coachOptions.push({ id, name: name ?? "Unlisted coach" });
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <BatchFormDialog
        trigger={
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
        title="Edit Batch"
        action={updateBatch.bind(null, batch.id)}
        coaches={coachOptions}
        playerTypes={playerTypes}
        ageCategories={ageCategories}
        defaultValues={{
          name: batch.name,
          headCoachId: batch.head_coach_id,
          assistantCoachId: batch.assistant_coach_id,
          playerTypeId: batch.player_type_id,
          ageCategoryId: batch.age_category_id,
          startTime: batch.start_time,
          endTime: batch.end_time,
        }}
      />
      <Button
        variant={batch.is_active ? "destructive" : "default"}
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => setBatchActive(batch.id, !batch.is_active))
        }
      >
        {batch.is_active ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
