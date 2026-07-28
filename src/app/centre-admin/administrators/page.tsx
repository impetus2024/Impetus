import { UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
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
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin");
  const { q, role, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("centre_id", centreAdmin.centre_id!)
    .in("role", ["centre_admin", "coach", "medical"]);

  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (role) query = query.eq("role", role as "centre_admin" | "coach" | "medical");
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  const { data: administrators } = await query.order("full_name");
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
    </div>
  );
}
