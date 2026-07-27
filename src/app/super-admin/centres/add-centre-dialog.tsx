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
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldSeparator,
} from "@/components/ui/field";
import { createCentre, type CentreFormState } from "./actions";

export function AddCentreDialog() {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<CentreFormState>(createCentre);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Centre</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Centre</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-6">
          <FieldSet>
            <FieldLegend variant="label">Centre details</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Centre Name</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="contactNumber">
                  Centre Contact Number
                </FieldLabel>
                <Input id="contactNumber" name="contactNumber" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Centre Email ID</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="logo">Centre Logo</FieldLabel>
                <Input id="logo" name="logo" type="file" accept="image/*" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="country">Centre Country</FieldLabel>
                <Input id="country" name="country" required />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          <FieldSet>
            <FieldLegend variant="label">Initial Centre Admin</FieldLegend>
            <FieldDescription>
              This person will receive login credentials by email and can
              invite coaches, medical staff, and other admins from there.
            </FieldDescription>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="adminName">Name</FieldLabel>
                <Input id="adminName" name="adminName" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="adminEmail">Email</FieldLabel>
                <Input id="adminEmail" name="adminEmail" type="email" required />
              </Field>
            </FieldGroup>
          </FieldSet>

          {state?.error && (
            <FieldDescription className="text-destructive">
              {state.error}
            </FieldDescription>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create Centre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
