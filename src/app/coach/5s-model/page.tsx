import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { TestingWindowBanner } from "@/components/five-s/testing-window-banner";
import { getFiveSWindowStatus } from "@/lib/five-s/testing-window";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function Coach5sModelPage() {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const [{ data: batches }, { data: centre }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, name")
      .eq("head_coach_id", coach.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("centres")
      .select("five_s_window_start, five_s_window_end")
      .eq("id", coach.centre_id!)
      .single(),
  ]);

  const windowStatus = getFiveSWindowStatus(centre?.five_s_window_start ?? null, centre?.five_s_window_end ?? null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">5S Model</h1>

      <TestingWindowBanner status={windowStatus} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches?.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>{batch.name}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  render={<Link href={`/coach/5s-model/${batch.id}`}>View Players</Link>}
                />
              </TableCell>
            </TableRow>
          ))}
          {batches?.length === 0 && (
            <TableRow>
              <TableCell colSpan={2}>
                <EmptyState icon={Sparkles} title="No batches assigned yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
