"use client";

import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileInput } from "@/components/ui/file-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { updateCentre, type CentreFormState } from "./actions";

export function EditCentreDialog({
  centre,
}: {
  centre: {
    id: string;
    name: string;
    contact_number: string;
    email: string;
    country: string;
  };
}) {
  const boundAction = updateCentre.bind(null, centre.id);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<CentreFormState>(boundAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Centre — {centre.name}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`name-${centre.id}`}>Centre Name</FieldLabel>
              <Input id={`name-${centre.id}`} name="name" defaultValue={centre.name} required />
            </Field>
            <Field>
              <FieldLabel htmlFor={`contactNumber-${centre.id}`}>
                Centre Contact Number
              </FieldLabel>
              <Input
                id={`contactNumber-${centre.id}`}
                name="contactNumber"
                defaultValue={centre.contact_number}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`email-${centre.id}`}>Centre Email ID</FieldLabel>
              <Input
                id={`email-${centre.id}`}
                name="email"
                type="email"
                defaultValue={centre.email}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`country-${centre.id}`}>Centre Country</FieldLabel>
              <Input
                id={`country-${centre.id}`}
                name="country"
                defaultValue={centre.country}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`logo-${centre.id}`}>Centre Logo</FieldLabel>
              <FileInput id={`logo-${centre.id}`} name="logo" accept="image/*" />
              <FieldDescription>Leave blank to keep the current logo.</FieldDescription>
            </Field>
            {state?.error && (
              <FieldDescription className="text-destructive">
                {state.error}
              </FieldDescription>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
