import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Test = { id: string; name: string; unit: string; group_name: string | null };

// Scaffold for the 4 categories (Speed, Stamina, Strength, Skill) whose
// catalog is a flat/grouped list of named tests with a measurement unit —
// shared here since only the catalog differs per category, not the shape.
// Spirit is a questionnaire (five_s_questions), not a test catalog, so it
// gets its own page rather than reusing this.
export function BenchmarkTestScaffold({
  categoryLabel,
  tests,
}: {
  categoryLabel: string;
  tests: Test[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{categoryLabel} Benchmarks</h1>
        <p className="text-sm text-muted-foreground">
          Set the score each age needs to hit on every {categoryLabel.toLowerCase()} test.
          Benchmark entry is coming next — this is the current test catalog.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead>Test</TableHead>
            <TableHead>Unit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tests.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.group_name ?? "—"}</TableCell>
              <TableCell>{t.name}</TableCell>
              <TableCell>{t.unit || "—"}</TableCell>
            </TableRow>
          ))}
          {tests.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>
                <EmptyState icon={Sparkles} title="No tests in this category yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
