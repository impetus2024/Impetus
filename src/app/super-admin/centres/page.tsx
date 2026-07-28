import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicFileUrl } from "@/lib/storage/r2";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddCentreDialog } from "./add-centre-dialog";
import { InviteAdminDialog } from "./invite-admin-dialog";

export default async function CentresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let centresQuery = supabase
    .from("centres")
    .select("id, name, contact_number, email, country, logo_path, is_active");

  if (q) centresQuery = centresQuery.ilike("name", `%${q}%`);
  if (status === "active") centresQuery = centresQuery.eq("is_active", true);
  if (status === "inactive") centresQuery = centresQuery.eq("is_active", false);

  const [{ data: centres }, { data: admins }] = await Promise.all([
    centresQuery.order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("centre_id")
      .eq("role", "centre_admin")
      .eq("is_active", true),
  ]);

  const centresWithAdmin = new Set((admins ?? []).map((a) => a.centre_id));
  const canShowLogos = Boolean(process.env.R2_PUBLIC_URL);
  const hasFilters = Boolean(q || status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Centre Management</h1>
        <AddCentreDialog />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search centres..." />
        <ListFilter
          paramKey="status"
          label="All statuses"
          options={[
            { id: "active", name: "Active" },
            { id: "inactive", name: "Inactive" },
          ]}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Centre</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {centres?.map((centre) => (
            <TableRow key={centre.id}>
              <TableCell className="flex items-center gap-3">
                <Avatar>
                  {canShowLogos && centre.logo_path && (
                    <AvatarImage src={getPublicFileUrl(centre.logo_path)} />
                  )}
                  <AvatarFallback>
                    {centre.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {centre.name}
              </TableCell>
              <TableCell>{centre.contact_number}</TableCell>
              <TableCell>{centre.email}</TableCell>
              <TableCell>{centre.country}</TableCell>
              <TableCell>
                <Badge variant={centre.is_active ? "default" : "secondary"}>
                  {centre.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={centresWithAdmin.has(centre.id) ? "default" : "destructive"}>
                  {centresWithAdmin.has(centre.id) ? "Assigned" : "None"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <InviteAdminDialog centreId={centre.id} centreName={centre.name} />
              </TableCell>
            </TableRow>
          ))}
          {centres?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                {hasFilters ? (
                  <EmptyState icon={Building2} title="No centres match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={Building2} title="No centres yet" message="Add your first centre to get started." />
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
