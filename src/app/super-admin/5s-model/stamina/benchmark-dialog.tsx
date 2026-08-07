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
  STAMINA_BENCHMARK_TIERS,
  type StaminaBenchmarkTier,
  type TestBenchmark,
} from "@/lib/five-s/stamina-benchmarks";
import { saveStaminaBenchmarks, type BenchmarkFormState } from "./actions";

const TIER_LABEL: Record<StaminaBenchmarkTier, string> = {
  poor_ceiling: "Poor (below)",
  average_low: "Average – low",
  average_high: "Average – high",
  elite_floor: "Elite (above)",
};

type AgeBand = { id: string; label: string };

export function StaminaBenchmarkDialog({
  testId,
  testName,
  isBeepTest,
  unit,
  ageBands,
  existingBenchmarks,
}: {
  testId: string;
  testName: string;
  isBeepTest: boolean;
  unit: string;
  ageBands: AgeBand[];
  existingBenchmarks: Map<string, TestBenchmark>;
}) {
  const action = saveStaminaBenchmarks.bind(
    null,
    testId,
    isBeepTest,
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
                  {STAMINA_BENCHMARK_TIERS.map((tier) => (
                    <TableHead key={tier}>
                      {TIER_LABEL[tier]}
                      {!isBeepTest ? ` (${unit})` : ""}
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
                      {STAMINA_BENCHMARK_TIERS.map((tier) => {
                        const point = existing?.[tier];
                        return (
                          <TableCell key={tier}>
                            {isBeepTest ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  name={`${band.id}_${tier}_level`}
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder="L"
                                  defaultValue={point?.level ?? ""}
                                  required
                                  className="w-16"
                                />
                                <span className="text-muted-foreground">/</span>
                                <Input
                                  name={`${band.id}_${tier}_shuttle`}
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder="S"
                                  defaultValue={point?.shuttle ?? ""}
                                  required
                                  className="w-16"
                                />
                              </div>
                            ) : (
                              <Input
                                name={`${band.id}_${tier}_value`}
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={point?.value ?? ""}
                                required
                                className="w-24"
                              />
                            )}
                          </TableCell>
                        );
                      })}
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
