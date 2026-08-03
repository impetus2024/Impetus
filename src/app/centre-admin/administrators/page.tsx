import { UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { parsePageParam, pageRange, totalPages as computeTotalPages } from "@/lib/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddAdministratorDialog } from "./add-administrator-dialog";
import { AdministratorRowActions } from "./row-actions";

// PostgREST parses .or()'s argument as filter *grammar*, not a plain
// value — unlike .eq()/.ilike(), which safely parameterize their value —
// so unescaped user input reaches the filter parser directly. Confirmed
// during a penetration test: a comma in the search box reaches PostgREST's
// logic-tree parser and can corrupt/extend the intended filter (bounded
// here by the centre_id/role filters and RLS, but still a real injection
// point, and it silently breaks legitimate searches containing a comma,
// e.g. "Smith, John"). PostgREST's reserved filter-value characters are
// `,` `.` `:` `(` `)` — escape them with a backslash before interpolating.
function escapeOrFilterValue(value: string): string {
  return value.replace(/[,.:()]/g, (c) => `\\${c}`);
}

const ROLE_LABEL: Record<string, string> = {
  centre_admin: "Centre Admin",
  coach: "Coach",
  medical: "Medical",
};

const ROLE_OPTIONS = [
  { id: "centre_admin", name: "Centre Admin" },
  { id: "coach", name: "Coach" },
  { id: "medical", name: "Medical" },
];

export default async function AdministratorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin");
  const { q, role, status, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active", { count: "exact" })
    .eq("centre_id", centreAdmin.centre_id!)
    .in("role", ["centre_admin", "coach", "medical"]);

  if (q) {
    const safeQ = escapeOrFilterValue(q);
    query = query.or(`full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
  }
  if (role) query = query.eq("role", role as "centre_admin" | "coach" | "medical");
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  const { data: administrators, count } = await query.order("full_name").range(from, to);
  const hasFilters = Boolean(q || role || status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administrator Management</h1>
        <AddAdministratorDialog />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search by name or email..." />
        <ListFilter paramKey="role" label="All roles" options={ROLE_OPTIONS} />
        <ListFilter
          paramKey="status"
          label="All statuses"
          options={[
            { id: "active", name: "Enabled" },
            { id: "inactive", name: "Disabled" },
          ]}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {administrators?.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.full_name}</TableCell>
              <TableCell>{a.email}</TableCell>
              <TableCell>{ROLE_LABEL[a.role] ?? a.role}</TableCell>
              <TableCell>
                <Badge variant={a.is_active ? "default" : "secondary"}>
                  {a.is_active ? "Enabled" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell>
                <AdministratorRowActions
                  profileId={a.id}
                  isActive={a.is_active}
                  isSelf={a.id === centreAdmin.id}
                />
              </TableCell>
            </TableRow>
          ))}
          {administrators?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                {hasFilters ? (
                  <EmptyState icon={UserCog} title="No administrators match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={UserCog} title="No administrators yet" message="Add a coach, medical staff, or admin to get started." />
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
