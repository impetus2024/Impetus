"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export type GatePassEntry = { time: string; reason: string; by: string | null };

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
          {entry.by && <p className="mt-1 text-xs text-muted-foreground">Recorded by {entry.by}</p>}
        </>
      ) : (
        <p className="mt-0.5 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

export function GatePassDetailsDialog({
  playerName,
  checkIn,
  checkOut,
}: {
  playerName: string;
  checkIn: GatePassEntry | null;
  checkOut: GatePassEntry | null;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm">Details</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{playerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <EntrySection label="Check In" entry={checkIn} emptyLabel="No check-in recorded" />
          <EntrySection label="Check Out" entry={checkOut} emptyLabel="Still checked in" />
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
