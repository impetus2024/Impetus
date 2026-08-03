import Link from "next/link";
import {
  User,
  Users,
  ClipboardCheck,
  HeartPulse,
  Package2,
  FileText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileSection =
  | "profile"
  | "parent"
  | "attendance"
  | "injuries"
  | "packageDetails"
  | "documents"
  | "5s";

const DEFAULT_SECTIONS: ProfileSection[] = ["profile", "parent", "attendance", "injuries", "5s"];

const SECTION_META: Record<ProfileSection, { label: string; icon: LucideIcon }> = {
  profile: { label: "Player Profile", icon: User },
  parent: { label: "Parent Profile", icon: Users },
  attendance: { label: "Attendance", icon: ClipboardCheck },
  injuries: { label: "Injuries", icon: HeartPulse },
  packageDetails: { label: "Package Details", icon: Package2 },
  documents: { label: "Documents", icon: FileText },
  "5s": { label: "5S Model Result", icon: Sparkles },
};

export function ProfileMenu({
  basePath,
  active,
  sections = DEFAULT_SECTIONS,
}: {
  /** e.g. "/centre-admin/players/[id]" or "/parent/player?playerId=[id]" — section gets appended as `?section=` or `&section=`. */
  basePath: string;
  active: ProfileSection;
  /** Which sections to show, in order. Defaults to the standard 5 — pass explicitly to add more, e.g. Package Details/Documents. */
  sections?: ProfileSection[];
}) {
  const sep = basePath.includes("?") ? "&" : "?";

  return (
    <nav className="flex flex-col gap-1">
      {sections.map((id) => {
        const s = { id, ...SECTION_META[id] };
        const Icon = s.icon;
        const isActive = s.id === active;
        return (
          <Link
            key={s.id}
            href={`${basePath}${sep}section=${s.id}`}
            className={cn(
              "flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm text-foreground/75 transition-colors",
              "hover:bg-muted",
              isActive && "bg-primary font-medium text-primary-foreground hover:bg-primary"
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
                isActive ? "bg-primary-foreground text-primary" : "bg-card text-primary"
              )}
            >
              <Icon className="size-[17px]" />
            </span>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
