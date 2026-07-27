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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { createPayment, type PaymentFormState } from "./actions";

type Player = { id: string; name: string };
type Package = { id: string; name: string };

export function AddPaymentDialog({
  players,
  packages,
}: {
  players: Player[];
  packages: Package[];
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<PaymentFormState>(createPayment);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Payment</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="playerId">Player</FieldLabel>
              <Select name="playerId" required>
                <SelectTrigger id="playerId" className="w-full">
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="packageId">Package</FieldLabel>
              <Select name="packageId">
                <SelectTrigger id="packageId" className="w-full">
                  <SelectValue placeholder="Select package (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="paymentDate">Payment Date</FieldLabel>
              <Input id="paymentDate" name="paymentDate" type="date" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" />
            </Field>
            {state?.error && (
              <FieldDescription className="text-destructive">
                {state.error}
              </FieldDescription>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
