import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
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
import { AddInjuryDialog } from "@/components/injuries/add-injury-dialog";

export default async function MedicalInjuriesPage() {
  const medical = await requireRole("medical");
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("players")
    .select("id, name, age_categories(name), player_types(name)")
    .eq("centre_id", medical.centre_id!)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Injuries</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Age Category</TableHead>
            <TableHead>Player Type</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}</TableCell>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.age_categories?.name ?? "—"}</TableCell>
              <TableCell>{p.player_types?.name ?? "—"}</TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/medical/injuries/${p.id}`}>View Injuries</Link>}
                />
                <AddInjuryDialog
                  playerId={p.id}
                  playerName={p.name}
                  revalidatePathTarget={`/medical/injuries/${p.id}`}
                />
              </TableCell>
            </TableRow>
          ))}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState icon={Users} title="No players yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
