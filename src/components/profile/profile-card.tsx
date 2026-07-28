import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { calculateAge } from "@/lib/age";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}

export function ProfileCard({
  name,
  dateOfBirth,
  batchName,
  playerTypeName,
  isActive,
  profilePictureUrl,
}: {
  name: string;
  dateOfBirth: string;
  batchName: string | null;
  playerTypeName: string | null;
  isActive: boolean;
  profilePictureUrl?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/50 py-6 shadow-soft">
      <CardContent className="flex flex-col items-center px-6 text-center">
        <Avatar className="size-24 ring-4 ring-primary/15">
          {profilePictureUrl && <AvatarImage src={profilePictureUrl} alt={name} />}
          <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>

        <p className="mt-4 text-lg font-semibold tracking-tight">{name}</p>
        <p className="text-sm text-muted-foreground">
          {playerTypeName ?? "Player"}
          {batchName ? ` · ${batchName}` : ""}
        </p>

        <div className="mt-5 grid w-full grid-cols-3 gap-2 border-t border-border/60 pt-4">
          <div>
            <p className="text-lg font-semibold tabular-nums">{calculateAge(dateOfBirth)}</p>
            <p className="text-xs text-muted-foreground">Age</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{batchName ? "Yes" : "No"}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{isActive ? "Active" : "Inactive"}</p>
            <p className="text-xs text-muted-foreground">Status</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
