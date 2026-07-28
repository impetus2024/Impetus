"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { ParentProfileView, type ParentProfileViewValues } from "@/components/profile/parent-profile-view";
import type { PlayerFormState } from "../actions";

const FILLED_INPUT = "border-transparent bg-muted/60 focus-visible:bg-background";

export type ParentProfileDefaultValues = ParentProfileViewValues;

export function ParentProfileForm({
  action,
  defaultValues,
}: {
  action: (prev: PlayerFormState, formData: FormData) => Promise<PlayerFormState>;
  defaultValues: ParentProfileDefaultValues;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [isEditing, setIsEditing] = useState(false);

  // Return to view mode once a save completes successfully. Adjusted during
  // render (not an effect, and not a ref — both reading a ref during render
  // and calling setState in an effect are disallowed here) per
  // https://react.dev/learn/you-might-not-need-an-effect
  const [prevPending, setPrevPending] = useState(pending);
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (prevPending && !pending && !state?.error) {
      setIsEditing(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
        <ParentProfileView values={defaultValues} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>

      <FieldGroup className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="fatherName">Father Name / Guardian Name</FieldLabel>
          <Input id="fatherName" name="fatherName" defaultValue={defaultValues.fatherName ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="motherName">Mother Name</FieldLabel>
          <Input id="motherName" name="motherName" defaultValue={defaultValues.motherName ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="parentEmail">Parent / Guardian Email ID</FieldLabel>
          <Input id="parentEmail" defaultValue={defaultValues.parentEmail} readOnly className={FILLED_INPUT} />
          <FieldDescription>
            This is the parent&apos;s login — create a new player record to change it.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="parentContactNumber">Parent / Guardian Contact Number</FieldLabel>
          <Input id="parentContactNumber" name="parentContactNumber" defaultValue={defaultValues.parentContactNumber ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="addressLine1">Address Line 1</FieldLabel>
          <Input id="addressLine1" name="addressLine1" defaultValue={defaultValues.addressLine1 ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel>
          <Input id="addressLine2" name="addressLine2" defaultValue={defaultValues.addressLine2 ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="country">Country</FieldLabel>
          <Input id="country" name="country" defaultValue={defaultValues.country ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="state">State</FieldLabel>
          <Input id="state" name="state" defaultValue={defaultValues.state ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="city">City</FieldLabel>
          <Input id="city" name="city" defaultValue={defaultValues.city ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
          <Input id="pincode" name="pincode" defaultValue={defaultValues.pincode ?? ""} className={FILLED_INPUT} />
        </Field>
      </FieldGroup>

      {state?.error && (
        <FieldDescription className="text-destructive">{state.error}</FieldDescription>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
