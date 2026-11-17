"use client";
import { ActionForm } from "@/components/ui/action-form";

import { useState } from "react";
import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { createGatePassEntry, type GatePassFormState } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export type GatePassEntry = { time: string; reason: string; by: string | null; byRole: string | null };

const ROLE_LABELS: Record<string, string> = { centre_admin: "Admin", coach: "Coach" };

function EntrySection({
  label,
  entry,
  emptyLabel,
}: {
  label: string;
  entry: GatePassEntry | null;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {entry ? (
        <>
          <p className="mt-0.5 text-sm text-muted-foreground">{new Date(entry.time).toLocaleString()}</p>
          <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">{entry.reason}</p>
          {(entry.by || entry.byRole) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Issued by {entry.by ?? "Unknown"}
              {entry.byRole && ` (${ROLE_LABELS[entry.byRole] ?? entry.byRole})`}
            </p>
          )}
        </>
      ) : (
        <p className="mt-0.5 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

export function GatePassDetailsDialog({
  playerId,
  playerName,
  checkIn,
  checkOut,
  canCheckOut,
}: {
  playerId: string;
  playerName: string;
  checkIn: GatePassEntry | null;
  checkOut: GatePassEntry | null;
  canCheckOut: boolean;
}) {
  const [checkingOut, setCheckingOut] = useState(false);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<GatePassFormState>(createGatePassEntry, () => setCheckingOut(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCheckingOut(false);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm">Details</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{playerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <EntrySection label="Check In" entry={checkIn} emptyLabel="No check-in recorded" />
          <EntrySection label="Check Out" entry={checkOut} emptyLabel="Still checked in" />
        </div>
        {canCheckOut && checkingOut && (
          <ActionForm action={submit}>
            <input type="hidden" name="playerId" value={playerId} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="checkout-reason">Check Out Reason</FieldLabel>
                <Textarea id="checkout-reason" name="reason" required autoFocus />
              </Field>
              {state?.error && (
                <FieldDescription className="text-destructive">{state.error}</FieldDescription>
              )}
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCheckingOut(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Confirm Check Out"}
              </Button>
            </DialogFooter>
          </ActionForm>
        )}
        {!(canCheckOut && checkingOut) && (
          <DialogFooter showCloseButton>
            {canCheckOut && <Button onClick={() => setCheckingOut(true)}>Check Out</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
