import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getFiveSQuestions } from "@/lib/five-s/catalog";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function SuperAdminSpiritBenchmarksPage() {
  await requireRole("super_admin");
  const questions = (await getFiveSQuestions()).filter((q) => q.category === "spirit");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Spirit Benchmarks</h1>
        <p className="text-sm text-muted-foreground">
          Spirit is a questionnaire (rarely / sometimes / frequently / always), not a measured
          test — how benchmarks apply here is still to be decided. This is the current question
          catalog.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead>Question</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="whitespace-nowrap">{q.section}</TableCell>
              <TableCell>{q.question}</TableCell>
            </TableRow>
          ))}
          {questions.length === 0 && (
            <TableRow>
              <TableCell colSpan={2}>
                <EmptyState icon={Sparkles} title="No questions in this category yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
