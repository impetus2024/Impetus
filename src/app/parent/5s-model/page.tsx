import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { getParentChildren } from "@/lib/parent/children";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FiveSResultsView } from "@/components/profile/five-s-results-view";

export default async function Parent5sModelPage({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string }>;
}) {
  const parent = await requireRole("parent");
  const { playerId } = await searchParams;

  const children = await getParentChildren(parent.id);
  const player = children.find((c) => c.id === playerId);

  if (!player) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          render={
            <Link href={`/parent/player?playerId=${player.id}&section=5s`} aria-label="Back to player">
              <ArrowLeft />
            </Link>
          }
        />
        <div>
          <h1 className="text-2xl font-semibold">{player.name}</h1>
          <p className="text-sm text-muted-foreground">5S Model Results</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
        <CardContent className="px-6">
          <FiveSResultsView playerId={player.id} gateUntilPublished />
        </CardContent>
      </Card>
    </div>
  );
}
