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
import type { PackageFormState } from "./actions";

type Option = { id: string; name: string };

export function PackageFormDialog({
  trigger,
  title,
  action,
  playerTypes,
  defaultValues,
}: {
  trigger: React.ReactElement;
  title: string;
  action: (prev: PackageFormState, formData: FormData) => Promise<PackageFormState>;
  playerTypes: Option[];
  defaultValues?: {
    name: string;
    playerTypeId: string | null;
    price: number;
    duration: string;
  };
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<PackageFormState>(action);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Package Name</FieldLabel>
              <Input id="name" name="name" defaultValue={defaultValues?.name} required />
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
              <FieldLabel htmlFor="price">Package Price</FieldLabel>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={defaultValues?.price}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="duration">Package Duration</FieldLabel>
              <Input
                id="duration"
                name="duration"
                placeholder="e.g. 3 Months"
                defaultValue={defaultValues?.duration}
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
