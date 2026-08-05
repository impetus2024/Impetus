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
import { deleteNewsEvent, type NewsEventFormState } from "@/lib/news-events/actions";

export function DeleteNewsEventDialog({ newsEvent }: { newsEvent: { id: string } }) {
  const boundAction = deleteNewsEvent.bind(null, newsEvent.id);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<NewsEventFormState>(boundAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete News / Event?</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldDescription>This action will permanently remove:</FieldDescription>
          <ul className="mt-2 ml-4 list-disc text-sm text-muted-foreground">
            <li>The News / Event item</li>
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
