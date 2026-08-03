"use client";

import { useState } from "react";
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
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { deleteCentre, type CentreFormState } from "./actions";

export function DeleteCentreDialog({
  centre,
}: {
  centre: { id: string; name: string };
}) {
  const boundAction = deleteCentre.bind(null, centre.id);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<CentreFormState>(boundAction);
  const [confirmName, setConfirmName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmName("");
      }}
    >
      <DialogTrigger render={<Button variant="destructive" size="sm">Delete</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete Centre — {centre.name}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <FieldDescription className="text-destructive">
              This permanently deletes {centre.name} and every batch, player, payment,
              attendance record, and staff account under it. This cannot be undone.
            </FieldDescription>
            <Field>
              <FieldLabel htmlFor={`confirm-${centre.id}`}>
                Type <span className="font-semibold">{centre.name}</span> to confirm
              </FieldLabel>
              <Input
                id={`confirm-${centre.id}`}
                name="confirmName"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
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
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || confirmName !== centre.name}
            >
              {pending ? "Deleting..." : "Delete Centre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
