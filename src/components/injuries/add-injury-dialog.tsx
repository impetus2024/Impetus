"use client";

import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { createInjury, type InjuryFormState } from "@/lib/injuries/actions";

export function AddInjuryDialog({
  playerId,
  playerName,
  revalidatePathTarget,
}: {
  playerId: string;
  playerName: string;
  revalidatePathTarget: string;
}) {
  const boundAction = createInjury.bind(null, playerId, revalidatePathTarget);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<InjuryFormState>(boundAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Add Injury</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Injury — {playerName}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field orientation="responsive">
              <FieldLabel htmlFor="dateOfInjury">Date of Injury / Disease</FieldLabel>
              <Input id="dateOfInjury" name="dateOfInjury" type="date" required />
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="activityType">Activity Type During Injury / Disease</FieldLabel>
              <Input id="activityType" name="activityType" />
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="bodyRegion">Injured or Affected Body Region</FieldLabel>
              <Input id="bodyRegion" name="bodyRegion" />
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="nature">Nature of Injury / Disease</FieldLabel>
              <Input id="nature" name="nature" />
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="cause">Cause of Injury / Disease</FieldLabel>
              <Input id="cause" name="cause" />
            </Field>
            <Field orientation="responsive">
              <FieldLabel htmlFor="treatingPerson">Treating Person</FieldLabel>
              <Input id="treatingPerson" name="treatingPerson" />
            </Field>
            <Field>
              <FieldLabel htmlFor="initialTreatment">Initial Treatment</FieldLabel>
              <Textarea id="initialTreatment" name="initialTreatment" />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" name="description" />
            </Field>
            <Field>
              <FieldLabel htmlFor="reportDocument">
                Upload Injury / Disease Report Document
              </FieldLabel>
              <Input id="reportDocument" name="reportDocument" type="file" />
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
