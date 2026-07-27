import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
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

export default async function AdministratorsPage() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { data: administrators } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("centre_id", centreAdmin.centre_id!)
    .in("role", ["centre_admin", "coach", "medical"])
    .order("full_name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administrator Management</h1>
        <AddAdministratorDialog />
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
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No administrators yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
