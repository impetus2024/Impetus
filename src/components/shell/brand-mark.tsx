import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary shadow-sm">
        <Shield className="size-[18px] text-sidebar-primary-foreground" fill="currentColor" fillOpacity={0.18} />
      </div>
      {!collapsed && (
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Impetus
        </span>
      )}
    </div>
  );
}
