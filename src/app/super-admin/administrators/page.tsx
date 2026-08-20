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
import { AddSuperAdminDialog } from "./add-super-admin-dialog";
import { SuperAdminRowActions } from "./row-actions";

export default async function SuperAdminsPage() {
  const me = await requireRole("super_admin");
  const supabase = await createClient();

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "super_admin")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Super Admins</h1>
        <AddSuperAdminDialog />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {superAdmins?.map((admin) => (
            <TableRow key={admin.id}>
              <TableCell>{admin.full_name}</TableCell>
              <TableCell>{admin.email}</TableCell>
              <TableCell>
                <SuperAdminRowActions profileId={admin.id} isSelf={admin.id === me.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
