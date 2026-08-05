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
import { Field, FieldLabel, FieldGroup, FieldDescription, FieldSet, FieldLegend } from "@/components/ui/field";
import { CentreCheckboxesFieldset } from "@/components/publishable-content/centre-checkboxes-fieldset";
import { createMonthlyHighlight, type MonthlyHighlightFormState } from "@/lib/monthly-highlights/actions";

export function AddMonthlyHighlightDialog({
  centres,
}: {
  // Present only for super_admin — a centre_admin never gets a centre
  // picker; createMonthlyHighlight resolves their own centre_id from the
  // authenticated session and ignores anything a client sends.
  centres?: { id: string; name: string }[];
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<MonthlyHighlightFormState>(createMonthlyHighlight);
  const noCentres = centres && centres.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Highlight</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Monthly Highlight</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-6">
          <FieldSet>
            <FieldLegend variant="label">Highlight details</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="image">Image</FieldLabel>
                <Input id="image" name="image" type="file" accept="image/*" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" name="title" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" name="description" rows={3} />
              </Field>
            </FieldGroup>
          </FieldSet>

          {centres && <CentreCheckboxesFieldset centres={centres} />}

          {state?.error && (
            <FieldDescription className="text-destructive">{state.error}</FieldDescription>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || noCentres}>
              {pending ? "Publishing..." : "Publish Highlight"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
