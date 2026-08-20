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
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
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
    headCoachId: string;
    assistantCoachId: string | null;
    playerTypeId: string | null;
    ageCategoryId: string;
    startTime: string;
    endTime: string;
  };
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<BatchFormState>(action);
  const [headCoachId, setHeadCoachId] = useState(defaultValues?.headCoachId ?? null);
  const [assistantCoachId, setAssistantCoachId] = useState(defaultValues?.assistantCoachId ?? null);
  const assistantCoachOptions = coaches.filter((c) => c.id !== headCoachId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Field>
              <FieldLabel htmlFor="headCoachId">Head Coach</FieldLabel>
              <Select
                name="headCoachId"
                defaultValue={defaultValues?.headCoachId}
                onValueChange={(value) => {
                  setHeadCoachId(value as string | null);
                  if (value === assistantCoachId) setAssistantCoachId(null);
                }}
                required
              >
                <SelectTrigger id="headCoachId" className="w-full">
                  <SelectValue placeholder="Select coach">
                    {selectLabel(coaches, "Select coach")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="assistantCoachId">Assistant Coach (optional)</FieldLabel>
              <Select
                name="assistantCoachId"
                value={assistantCoachId}
                onValueChange={(value) => setAssistantCoachId(value as string | null)}
              >
                <SelectTrigger id="assistantCoachId" className="w-full">
                  <SelectValue placeholder="Select coach">
                    {selectLabel(assistantCoachOptions, "Select coach")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
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
