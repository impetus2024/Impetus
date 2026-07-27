"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalStorageFlag } from "@/hooks/use-local-storage-flag";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { SidebarNavContent } from "./sidebar-nav-content";
import { NAV_BY_KEY, type NavKey } from "./nav-config";

const STORAGE_KEY = "impetus:sidebar-collapsed";

export function AppSidebar({ navKey }: { navKey: NavKey }) {
  const groups = NAV_BY_KEY[navKey];
  const [collapsed, setCollapsed] = useLocalStorageFlag(STORAGE_KEY, false);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-sidebar transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <BrandMark collapsed={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNavContent groups={groups} collapsed={collapsed} />
      </div>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "px-0"
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
