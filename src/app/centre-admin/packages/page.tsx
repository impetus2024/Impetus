import { Package2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageFormDialog } from "./package-form-dialog";
import { PackageRowActions } from "./row-actions";
import { createPackage } from "./actions";

export default async function PackagesPage() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const [{ data: packages }, { data: playerTypes }] = await Promise.all([
    supabase
      .from("packages")
      .select("id, name, player_type_id, price, duration, is_active, player_types(name)")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("name"),
    supabase
      .from("player_types")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Package Management</h1>
        <PackageFormDialog
          trigger={<Button>Add New Package</Button>}
          title="Add Package"
          action={createPackage}
          playerTypes={playerTypes ?? []}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Package</TableHead>
            <TableHead>Player Type</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packages?.map((pkg) => (
            <TableRow key={pkg.id}>
              <TableCell>{pkg.name}</TableCell>
              <TableCell>{pkg.player_types?.name ?? "—"}</TableCell>
              <TableCell>{pkg.price}</TableCell>
              <TableCell>{pkg.duration}</TableCell>
              <TableCell>
                <Badge variant={pkg.is_active ? "default" : "secondary"}>
                  {pkg.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <PackageRowActions pkg={pkg} playerTypes={playerTypes ?? []} />
              </TableCell>
            </TableRow>
          ))}
          {packages?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState icon={Package2} title="No packages yet" message="Add a package to start enrolling players." />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
