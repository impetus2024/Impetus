import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicFileUrl } from "@/lib/storage/r2";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddCentreDialog } from "./add-centre-dialog";
import { EditCentreDialog } from "./edit-centre-dialog";
import { InviteAdminDialog } from "./invite-admin-dialog";
import { CentreStatusToggle } from "./centre-status-toggle";
import { DeleteCentreDialog } from "./delete-centre-dialog";
import { CentreAdminsDialog } from "./centre-admins-dialog";

export default async function CentresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let centresQuery = supabase
    .from("centres")
    .select("id, name, contact_number, email, country, logo_path, is_active", { count: "exact" });

  if (q) centresQuery = centresQuery.ilike("name", `%${q}%`);
  if (status === "active") centresQuery = centresQuery.eq("is_active", true);
  if (status === "inactive") centresQuery = centresQuery.eq("is_active", false);

  const [{ data: centres, count }, { data: admins }] = await Promise.all([
    centresQuery.order("created_at", { ascending: false }).range(from, to),
    supabase
      .from("profiles")
      .select("id, full_name, email, centre_id, is_active")
      .eq("role", "centre_admin"),
  ]);

  const adminsByCentre = new Map<string, NonNullable<typeof admins>>();
  for (const admin of admins ?? []) {
    if (!admin.centre_id) continue;
    const list = adminsByCentre.get(admin.centre_id) ?? [];
    list.push(admin);
    adminsByCentre.set(admin.centre_id, list);
  }
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
                <div>
                  <div>{centre.name}</div>
                  <div className="text-xs text-muted-foreground">{centre.id}</div>
                </div>
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
                <CentreAdminsDialog
                  centreId={centre.id}
                  centreName={centre.name}
                  admins={adminsByCentre.get(centre.id) ?? []}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <EditCentreDialog centre={centre} />
                  <InviteAdminDialog centreId={centre.id} centreName={centre.name} />
                  <CentreStatusToggle centreId={centre.id} isActive={centre.is_active} />
                  <DeleteCentreDialog centre={centre} />
                </div>
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

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
