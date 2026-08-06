"use client";

import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { updateMonthlyHighlight, type MonthlyHighlightFormState } from "@/lib/monthly-highlights/actions";

export function EditMonthlyHighlightDialog({
  highlight,
}: {
  highlight: { id: string; title: string; description: string | null };
}) {
  const boundAction = updateMonthlyHighlight.bind(null, highlight.id);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<MonthlyHighlightFormState>(boundAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Highlight — {highlight.title}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`title-${highlight.id}`}>Title</FieldLabel>
              <Input
                id={`title-${highlight.id}`}
                name="title"
                defaultValue={highlight.title}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`description-${highlight.id}`}>Description</FieldLabel>
              <Textarea
                id={`description-${highlight.id}`}
                name="description"
                defaultValue={highlight.description ?? ""}
                rows={3}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`image-${highlight.id}`}>Image</FieldLabel>
              <FileInput id={`image-${highlight.id}`} name="image" accept="image/*" />
              <FieldDescription>Leave blank to keep the current image.</FieldDescription>
            </Field>
            {state?.error && (
              <FieldDescription className="text-destructive">{state.error}</FieldDescription>
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
