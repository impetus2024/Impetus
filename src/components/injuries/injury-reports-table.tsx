import { HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/storage/r2";
import { logError } from "@/lib/logger";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function safeSignedUrl(key: string | null) {
  if (!key) return null;
  try {
    return await getSignedFileUrl(key);
  } catch (err) {
    logError(`Failed to sign injury report URL (${key}):`, err);
    return null;
  }
}

export async function InjuryReportsTable({ playerId }: { playerId: string }) {
  const supabase = await createClient();
  const { data: injuries } = await supabase
    .from("injuries")
    .select(
      "id, date_of_injury, nature, body_region, cause, treating_person, description, report_doc_path"
    )
    .eq("player_id", playerId)
    .order("date_of_injury", { ascending: false });

  const rows = await Promise.all(
    (injuries ?? []).map(async (i) => ({
      ...i,
      reportUrl: await safeSignedUrl(i.report_doc_path),
    }))
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Nature</TableHead>
          <TableHead>Body Region</TableHead>
          <TableHead>Cause</TableHead>
          <TableHead>Treating Person</TableHead>
          <TableHead>Report</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((i) => (
          <TableRow key={i.id}>
            <TableCell>{i.date_of_injury}</TableCell>
            <TableCell>{i.nature ?? "—"}</TableCell>
            <TableCell>{i.body_region ?? "—"}</TableCell>
            <TableCell>{i.cause ?? "—"}</TableCell>
            <TableCell>{i.treating_person ?? "—"}</TableCell>
            <TableCell>
              {i.reportUrl ? (
                <a href={i.reportUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  View
                </a>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6}>
              <EmptyState icon={HeartPulse} title="No injury reports yet" />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
