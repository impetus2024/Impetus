"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldDescription } from "@/components/ui/field";
import { setFiveSTestingWindow, type TestingWindowFormState } from "./actions";

function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function TestingWindowDialog({
  currentStart,
  currentEnd,
  triggerLabel,
}: {
  currentStart: string | null;
  currentEnd: string | null;
  triggerLabel: string;
}) {
  const [range, setRange] = useState<DateRange | undefined>(
    currentStart && currentEnd
      ? { from: parseISODate(currentStart), to: parseISODate(currentEnd) }
      : undefined
  );
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<TestingWindowFormState>(setFiveSTestingWindow);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">{triggerLabel}</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>5S Testing Window</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <input type="hidden" name="startDate" value={range?.from ? toISODate(range.from) : ""} />
          <input type="hidden" name="endDate" value={range?.to ? toISODate(range.to) : ""} />
          <p className="mb-2 text-sm text-muted-foreground">
            Coaches can only add or edit 5S scores while today falls inside this range.
          </p>
          <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} className="mx-auto" />
          {state?.error && <FieldDescription className="text-destructive">{state.error}</FieldDescription>}
          <DialogFooter>
            <Button type="submit" disabled={pending || !range?.from || !range?.to}>
              {pending ? "Saving..." : "Save Window"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
