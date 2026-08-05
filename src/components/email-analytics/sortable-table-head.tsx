"use client";

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Same URL-param-preserving convention as ListSearch/ListFilter — writes
// `sort`/`dir`, keeps every other param (search text, date range,
// pagination) already on the URL. No existing list page in the app has
// user-controlled sorting yet (they all use a single fixed .order()), so
// this is the first of its kind — built to the same convention rather than
// a one-off so the next sortable table can reuse it directly.
export function SortableTableHead({
  column,
  currentSort,
  currentDir,
  className,
  children,
}: {
  column: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = currentSort === column;

  function handleClick() {
    const params = new URLSearchParams(searchParams);
    params.set("sort", column);
    params.set("dir", isActive && currentDir === "asc" ? "desc" : "asc");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const Icon = isActive ? (currentDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {children}
        <Icon className="size-3" />
      </button>
    </TableHead>
  );
}
