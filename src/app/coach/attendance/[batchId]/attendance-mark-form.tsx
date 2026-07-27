"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldDescription } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AttendanceFormState } from "../actions";

type Player = { id: string; name: string };
type Status = "present" | "absent";

export function AttendanceMarkForm({
  players,
  date,
  defaultStatuses,
  action,
}: {
  players: Player[];
  date: string;
  defaultStatuses: Record<string, Status>;
  action: (prev: AttendanceFormState, formData: FormData) => Promise<AttendanceFormState>;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(defaultStatuses);
  const [state, formAction, pending] = useActionState(action, undefined);

  function markAll(status: Status) {
    setStatuses(Object.fromEntries(players.map((p) => [p.id, status])));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="date" value={date} />
      {players.map((p) => (
        <input key={p.id} type="hidden" name={`status_${p.id}`} value={statuses[p.id] ?? ""} />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Date
          <Input
            type="date"
            defaultValue={date}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("date", e.target.value);
              window.location.href = url.toString();
            }}
            className="w-auto"
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => markAll("present")}>
          Mark all Present
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => markAll("absent")}>
          Mark all Absent
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={statuses[p.id] === "present" ? "default" : "outline"}
                  onClick={() => setStatuses((s) => ({ ...s, [p.id]: "present" }))}
                >
                  Present
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={statuses[p.id] === "absent" ? "destructive" : "outline"}
                  onClick={() => setStatuses((s) => ({ ...s, [p.id]: "absent" }))}
                >
                  Absent
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {state?.error && <FieldDescription className="text-destructive">{state.error}</FieldDescription>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Attendance"}
      </Button>
    </form>
  );
}
