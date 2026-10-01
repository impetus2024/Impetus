import { HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveDocumentLink } from "@/lib/storage/resolve-document-links";
import { DocumentLinkView } from "@/components/profile/documents-section";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      report: await resolveDocumentLink(`injury report ${i.id}`, i.report_doc_path),
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
              {i.report ? (
                <DocumentLinkView link={i.report} label="View" className="text-primary underline" />
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
