import { Badge } from "@/components/ui/badge";

// Shared "Target Centres" cell for the Monthly Highlights and News & Events
// management tables.
export function TargetCentresBadges({ centres }: { centres: { id: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {centres.map((centre) => (
        <Badge key={centre.id} variant="secondary">
          {centre.name}
        </Badge>
      ))}
    </div>
  );
}
