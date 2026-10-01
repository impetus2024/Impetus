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
import {
  SPEED_BENCHMARK_CEILINGS,
  type SpeedBenchmark,
  type SpeedBenchmarkCeiling,
} from "@/lib/five-s/speed-benchmarks";
import { saveSpeedBenchmarks, type BenchmarkFormState } from "./actions";

const CEILING_LABEL: Record<SpeedBenchmarkCeiling, string> = {
  score_5_ceiling: "Score 5 (≤)",
  score_4_ceiling: "Score 4 (≤)",
  score_3_ceiling: "Score 3 (≤)",
  score_2_ceiling: "Score 2 (≤)",
};

type AgeBand = { id: string; label: string };

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
  existingBenchmarks: Map<string, SpeedBenchmark>;
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
                {SPEED_BENCHMARK_CEILINGS.map((ceiling) => (
                  <TableHead key={ceiling}>
                    {CEILING_LABEL[ceiling]} ({unit})
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ageBands.map((band) => {
                const existing = existingBenchmarks.get(band.id);
                return (
                  <TableRow key={band.id}>
                    <TableCell className="font-medium whitespace-nowrap">{band.label}</TableCell>
                    {SPEED_BENCHMARK_CEILINGS.map((ceiling) => (
                      <TableCell key={ceiling}>
                        <Input
                          name={`${band.id}_${ceiling}`}
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={existing?.[ceiling] ?? ""}
                          required
                          className="w-24"
                        />
                      </TableCell>
                    ))}
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
