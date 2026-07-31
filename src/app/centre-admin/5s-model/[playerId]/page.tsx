import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FiveSResultsView } from "@/components/profile/five-s-results-view";

export default async function CentreAdmin5sModelResultsPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, batches(name)")
    .eq("id", playerId)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!player) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          render={
            <Link href="/centre-admin/5s-model" aria-label="Back to 5S Model">
              <ArrowLeft />
            </Link>
          }
        />
        <div>
          <h1 className="text-2xl font-semibold">{player.name}</h1>
          <p className="text-sm text-muted-foreground">
            {player.batches?.name ?? "—"} · 5S Model Results
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
        <CardContent className="px-6">
          <FiveSResultsView playerId={playerId} gateUntilPublished />
        </CardContent>
      </Card>
    </div>
  );
}
