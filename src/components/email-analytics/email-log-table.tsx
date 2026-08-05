import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "./sortable-table-head";
import { EmailStatusBadge } from "./email-status-badge";
import type { EmailLogListItem, EmailLogSortColumn } from "@/lib/email-analytics/queries";

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const COLUMNS: { key: EmailLogSortColumn; label: string }[] = [
  { key: "recipient_email", label: "Recipient" },
  { key: "status", label: "Status" },
  { key: "sent_at", label: "Sent" },
  { key: "delivered_at", label: "Delivered" },
  { key: "opened_at", label: "Opened" },
  { key: "open_count", label: "Open Count" },
  { key: "clicked_at", label: "Clicked" },
  { key: "click_count", label: "Click Count" },
];

export function EmailLogTable({
  logs,
  sort,
  dir,
  centreId,
  detailBasePath,
  hasFilters,
}: {
  logs: EmailLogListItem[];
  sort: string;
  dir: "asc" | "desc";
  // Carried on the detail link's query string so the super-admin detail
  // page (which has no session-derived centre) can re-resolve which centre
  // to scope its lookup to. The centre-admin detail page ignores it — its
  // centreId always comes from the caller's own session, never the URL.
  centreId: string;
  detailBasePath: string;
  hasFilters: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((col) => (
            <SortableTableHead key={col.key} column={col.key} currentSort={sort} currentDir={dir}>
              {col.label}
            </SortableTableHead>
          ))}
          {/* Subject isn't sortable — free text, not a meaningful ordering. */}
          <TableHead>Subject</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="font-medium">{log.recipient_email}</TableCell>
            <TableCell>
              <EmailStatusBadge status={log.status} />
            </TableCell>
            <TableCell>{formatTimestamp(log.sent_at)}</TableCell>
            <TableCell>{formatTimestamp(log.delivered_at)}</TableCell>
            <TableCell>{formatTimestamp(log.opened_at)}</TableCell>
            <TableCell>{log.open_count}</TableCell>
            <TableCell>{formatTimestamp(log.clicked_at)}</TableCell>
            <TableCell>{log.click_count}</TableCell>
            <TableCell className="max-w-64 truncate text-muted-foreground">{log.subject ?? "—"}</TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`${detailBasePath}/${log.id}?centreId=${centreId}`}>View</Link>}
              />
            </TableCell>
          </TableRow>
        ))}
        {logs.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMNS.length + 2}>
              {hasFilters ? (
                <EmptyState icon={Mail} title="No emails match your search" message="Try a different recipient or date range." />
              ) : (
                <EmptyState icon={Mail} title="No emails sent in this range" />
              )}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
