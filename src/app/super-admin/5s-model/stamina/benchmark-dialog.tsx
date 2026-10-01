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
  STAMINA_BENCHMARK_BOUNDARIES,
  type StaminaBenchmark,
  type StaminaBenchmarkBoundary,
} from "@/lib/five-s/stamina-benchmarks";
import { saveStaminaBenchmarks, type BenchmarkFormState } from "./actions";

const BOUNDARY_LABEL: Record<StaminaBenchmarkBoundary, string> = {
  score_5_boundary: "Score 5",
  score_4_boundary: "Score 4",
  score_3_boundary: "Score 3",
  score_2_boundary: "Score 2",
};

type AgeBand = { id: string; label: string };

export function StaminaBenchmarkDialog({
  testId,
  testName,
  higherIsBetter,
  unit,
  ageBands,
  existingBenchmarks,
}: {
  testId: string;
  testName: string;
  higherIsBetter: boolean;
  unit: string;
  ageBands: AgeBand[];
  existingBenchmarks: Map<string, StaminaBenchmark>;
}) {
  const action = saveStaminaBenchmarks.bind(
    null,
    testId,
    higherIsBetter,
    ageBands.map((b) => b.id)
  );
  const { open, setOpen, pending, state, submit } = useDialogFormAction<BenchmarkFormState>(action);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Set Benchmarks</Button>} />
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{testName} — Benchmarks by Age</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Age</TableHead>
                  {STAMINA_BENCHMARK_BOUNDARIES.map((boundary) => (
                    <TableHead key={boundary}>
                      {BOUNDARY_LABEL[boundary]} {higherIsBetter ? "(≥)" : "(≤)"} ({unit})
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
                      {STAMINA_BENCHMARK_BOUNDARIES.map((boundary) => (
                        <TableCell key={boundary}>
                          <Input
                            name={`${band.id}_${boundary}`}
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={existing?.[boundary] ?? ""}
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
          </div>
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
