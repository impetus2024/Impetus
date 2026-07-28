"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./nav-config";

export function SidebarNavContent({
  groups,
  collapsed = false,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3">
      {groups.map((group, i) => (
        <div key={group.label ?? i} className="flex flex-col gap-2">
          {group.label && !collapsed && (
            <span className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
              {group.label}
            </span>
          )}
          {group.items.map((item) => {
            // Dashboard-root links (e.g. "/coach") have a single path
            // segment. Prefix-matching those against every nested route
            // (e.g. "/coach/5s-model/...") would keep Dashboard highlighted
            // everywhere, so only exact-match those; deeper links still
            // prefix-match their own nested sub-routes.
            const isRootHref = item.href.split("/").filter(Boolean).length <= 1;
            const active = isRootHref
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group/nav-item relative flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm text-sidebar-foreground/75 transition-all duration-150",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                  collapsed && "justify-center px-1.5"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg shadow-[0_1px_2px_rgba(16,24,40,0.06),0_2px_6px_rgba(16,24,40,0.06)] transition-transform duration-150 group-hover/nav-item:scale-105",
                    active ? "bg-sidebar-primary-foreground text-sidebar-primary" : "bg-card text-sidebar-primary"
                  )}
                >
                  <Icon className="size-[17px]" />
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (!collapsed) {
              return <div key={item.href}>{link}</div>;
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<div>{link}</div>} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
