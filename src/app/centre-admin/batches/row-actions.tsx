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
    head_coach_id: string;
    assistant_coach_id: string | null;
    player_type_id: string | null;
    age_category_id: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
  };
  coaches: Option[];
  playerTypes: Option[];
  ageCategories: Option[];
}) {
  const [pending, startTransition] = useTransition();

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
        coaches={coaches}
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
