"use client";

import { useMemo, useState } from "react";
import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { createGatePassEntry, type GatePassFormState } from "./actions";

type Player = { id: string; name: string; is_checked_in: boolean };

export function AddGatePassDialog({ players }: { players: Player[] }) {
  const [playerId, setPlayerId] = useState<string | undefined>();
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<GatePassFormState>(createGatePassEntry, () =>
      setPlayerId(undefined)
    );

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === playerId),
    [players, playerId]
  );
  const actionLabel = selectedPlayer?.is_checked_in ? "Check In" : "Check Out";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Movement Pass</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Movement Pass</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="playerId">Select Player</FieldLabel>
              <Select
                name="playerId"
                value={playerId}
                onValueChange={(v) => setPlayerId(v ?? undefined)}
                required
              >
                <SelectTrigger id="playerId" className="w-full">
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.is_checked_in ? "(checked in)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Textarea id="reason" name="reason" required />
            </Field>
            {state?.error && (
              <FieldDescription className="text-destructive">
                {state.error}
              </FieldDescription>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || !playerId}>
              {pending ? "Saving..." : actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
