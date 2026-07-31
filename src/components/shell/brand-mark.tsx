import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center", collapsed && "justify-center")}>
      {collapsed ? (
        <Image src="/logo-icon.png" alt="Impetus" width={36} height={36} className="size-9" priority />
      ) : (
        <Image src="/logo.png" alt="Impetus" width={1071} height={418} className="h-8 w-auto" priority />
      )}
    </div>
  );
}
