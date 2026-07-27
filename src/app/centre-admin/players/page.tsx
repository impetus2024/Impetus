import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { calculateAge } from "@/lib/age";
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
import { PlayerRowActions } from "./row-actions";

export default async function PlayersPage() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("players")
    .select("id, name, date_of_birth, is_active, batches(name), player_types(name)")
    .eq("centre_id", centreAdmin.centre_id!)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Player Management</h1>
        <Button render={<Link href="/centre-admin/players/new">Add Player</Link>} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Player Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((player) => (
            <TableRow key={player.id}>
              <TableCell>{player.name}</TableCell>
              <TableCell>{calculateAge(player.date_of_birth)}</TableCell>
              <TableCell>{player.batches?.name ?? "—"}</TableCell>
              <TableCell>{player.player_types?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={player.is_active ? "default" : "secondary"}>
                  {player.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <PlayerRowActions playerId={player.id} isActive={player.is_active} />
              </TableCell>
            </TableRow>
          ))}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState icon={Users} title="No players yet" message="Add your first player to get started." />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
