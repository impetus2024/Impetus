"use client";

import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldDescription } from "@/components/ui/field";
import { deleteMonthlyHighlight, type MonthlyHighlightFormState } from "@/lib/monthly-highlights/actions";

export function DeleteMonthlyHighlightDialog({
  highlight,
}: {
  highlight: { id: string };
}) {
  const boundAction = deleteMonthlyHighlight.bind(null, highlight.id);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<MonthlyHighlightFormState>(boundAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Monthly Highlight?</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldDescription>This action will permanently remove:</FieldDescription>
          <ul className="mt-2 ml-4 list-disc text-sm text-muted-foreground">
            <li>The Monthly Highlight</li>
            <li>The uploaded image</li>
            <li>All centre assignments</li>
          </ul>
          <FieldDescription className="mt-2 text-destructive">
            This action cannot be undone.
          </FieldDescription>
          {state?.error && (
            <FieldDescription className="mt-2 text-destructive">{state.error}</FieldDescription>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
