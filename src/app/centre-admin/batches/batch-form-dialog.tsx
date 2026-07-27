"use client";

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
    playerTypeId: string | null;
    ageCategoryId: string;
    startTime: string;
    endTime: string;
  };
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<BatchFormState>(action);

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
                required
              >
                <SelectTrigger id="headCoachId" className="w-full">
                  <SelectValue placeholder="Select coach" />
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
              <FieldLabel htmlFor="playerTypeId">Player Type</FieldLabel>
              <Select
                name="playerTypeId"
                defaultValue={defaultValues?.playerTypeId ?? undefined}
              >
                <SelectTrigger id="playerTypeId" className="w-full">
                  <SelectValue placeholder="Select player type" />
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
                  <SelectValue placeholder="Select age category" />
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
