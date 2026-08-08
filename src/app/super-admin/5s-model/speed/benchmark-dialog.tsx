"use client";

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
import { FieldDescription } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveSpeedBenchmarks, type BenchmarkFormState } from "./actions";

type AgeBand = { id: string; label: string };
type BenchmarkValues = { min: number; max: number; avg: number };

export function SpeedBenchmarkDialog({
  testId,
  testName,
  unit,
  ageBands,
  existingBenchmarks,
}: {
  testId: string;
  testName: string;
  unit: string;
  ageBands: AgeBand[];
  existingBenchmarks: Map<string, BenchmarkValues>;
}) {
  const action = saveSpeedBenchmarks.bind(
    null,
    testId,
    ageBands.map((b) => b.id)
  );
  const { open, setOpen, pending, state, submit } = useDialogFormAction<BenchmarkFormState>(action);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Set Benchmarks</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{testName} — Benchmarks by Age</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Age</TableHead>
                <TableHead>Min ({unit})</TableHead>
                <TableHead>Max ({unit})</TableHead>
                <TableHead>Avg ({unit})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ageBands.map((band) => {
                const existing = existingBenchmarks.get(band.id);
                return (
                  <TableRow key={band.id}>
                    <TableCell className="font-medium">{band.label}</TableCell>
                    <TableCell>
                      <Input
                        name={`min_${band.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={existing?.min ?? ""}
                        required
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        name={`max_${band.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={existing?.max ?? ""}
                        required
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        name={`avg_${band.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={existing?.avg ?? ""}
                        required
                        className="w-24"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {state?.error && (
            <FieldDescription className="text-destructive">{state.error}</FieldDescription>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
