"use client";

import { useState } from "react";
import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup, FieldDescription, FieldSeparator } from "@/components/ui/field";
import { selectLabel } from "@/lib/utils";
import type { BatchFormState } from "./actions";

type Option = { id: string; name: string };

export function BatchFormDialog({
  trigger,
  title,
  action,
  coaches,
  playerTypes,
  ageCategories,
  defaultValues,
}: {
  trigger: React.ReactElement;
  title: string;
  action: (prev: BatchFormState, formData: FormData) => Promise<BatchFormState>;
  coaches: Option[];
  playerTypes: Option[];
  ageCategories: Option[];
  defaultValues?: {
    name: string;
    headCoachId: string | null;
    assistantCoachId: string | null;
    playerTypeId: string | null;
    ageCategoryId: string;
    startTime: string;
    endTime: string;
  };
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<BatchFormState>(action);
  // Add Batch always needs a head coach; Edit Batch may leave the slot empty,
  // which is what removes the current coach.
  const isEdit = Boolean(defaultValues);
  const [headCoachId, setHeadCoachId] = useState<string | null>(defaultValues?.headCoachId ?? null);
  const [assistantCoachId, setAssistantCoachId] = useState<string | null>(defaultValues?.assistantCoachId ?? null);
  const assistantCoachOptions = coaches.filter((c) => c.id !== headCoachId);
  // An empty slot means two different things: on Edit it is a real saved state
  // ("no head coach") that the admin can also choose, on Add it is simply
  // nothing picked yet — so only the edit dialog offers the removal item.
  const headCoachPlaceholder = isEdit ? "No head coach" : "Select coach";
  const assistantCoachPlaceholder = isEdit ? "No assistant coach" : "Select coach";

  // Re-sync from the saved batch on every open. The selects are controlled,
  // so a cancelled edit (or values a previous save left behind) must not leak
  // into the next one — opening and saving without touching a select has to
  // write back exactly what is stored.
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setHeadCoachId(defaultValues?.headCoachId ?? null);
      setAssistantCoachId(defaultValues?.assistantCoachId ?? null);
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Batch Name</FieldLabel>
              <Input
                id="name"
                name="name"
                defaultValue={defaultValues?.name}
                required
              />
            </Field>
            <FieldSeparator>Coaches</FieldSeparator>
            <Field>
              <FieldLabel htmlFor="headCoachId">Head Coach</FieldLabel>
              <Select
                name="headCoachId"
                value={headCoachId}
                onValueChange={(value) => {
                  const next = (value as string | null) ?? null;
                  setHeadCoachId(next);
                  // One person can't hold both slots (the DB CHECK and the
                  // schema's refine both reject it), so promoting the current
                  // assistant to head clears the assistant slot in the same
                  // save instead of failing on submit.
                  if (next === assistantCoachId) setAssistantCoachId(null);
                }}
                required={!isEdit}
              >
                <SelectTrigger id="headCoachId" className="w-full">
                  <SelectValue placeholder={headCoachPlaceholder}>
                    {selectLabel(coaches, headCoachPlaceholder)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {isEdit && <SelectItem value={null}>No head coach</SelectItem>}
                  {coaches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {isEdit
                  ? "Pick \"No head coach\" to remove the current coach — the batch stays with the centre, unassigned, until a new head coach is chosen."
                  : "The coach who runs this batch."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="assistantCoachId">Assistant Coach (optional)</FieldLabel>
              <Select
                name="assistantCoachId"
                value={assistantCoachId}
                onValueChange={(value) =>
                  setAssistantCoachId((value as string | null) ?? null)
                }
              >
                <SelectTrigger id="assistantCoachId" className="w-full">
                  <SelectValue placeholder={assistantCoachPlaceholder}>
                    {selectLabel(assistantCoachOptions, assistantCoachPlaceholder)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No assistant coach</SelectItem>
                  {assistantCoachOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Gets the same access as the head coach for this batch — attendance, roster, 5S, injuries.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="playerTypeId">Program Type</FieldLabel>
              <Select
                name="playerTypeId"
                defaultValue={defaultValues?.playerTypeId ?? undefined}
              >
                <SelectTrigger id="playerTypeId" className="w-full">
                  <SelectValue placeholder="Select program type">
                    {selectLabel(playerTypes, "Select program type")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {playerTypes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ageCategoryId">Age Category</FieldLabel>
              <Select
                name="ageCategoryId"
                defaultValue={defaultValues?.ageCategoryId}
                required
              >
                <SelectTrigger id="ageCategoryId" className="w-full">
                  <SelectValue placeholder="Select age category">
                    {selectLabel(ageCategories, "Select age category")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ageCategories.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="startTime">Start Time</FieldLabel>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={defaultValues?.startTime}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="endTime">End Time</FieldLabel>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue={defaultValues?.endTime}
                required
              />
            </Field>

            {state?.error && (
              <FieldDescription className="text-destructive">
                {state.error}
              </FieldDescription>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
