"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth/actions";
import { BrandMark } from "./brand-mark";
import { SidebarNavContent } from "./sidebar-nav-content";
import { NAV_BY_KEY, type NavGroup, type NavKey } from "./nav-config";

// Floating white circular icon-chip look used for standalone icon actions
// in the topbar (menu trigger, notifications, theme toggle) — matches the
// reference design's search/filter/bell buttons, distinct from a plain
// ghost button that's only visible on hover.
const ICON_CHIP_BUTTON = "rounded-full bg-card shadow-sm hover:bg-muted";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "U";
}

function useBreadcrumb(groups: NavGroup[], roleLabel: string) {
  const pathname = usePathname();
  return useMemo(() => {
    let best: { group?: string; label: string } | null = null;
    for (const group of groups) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          if (!best || item.href.length > (best.label.length || 0)) {
            best = { group: group.label, label: item.label };
          }
        }
      }
    }
    return { roleLabel, ...best };
  }, [groups, pathname, roleLabel]);
}

export function AppTopbar({
  navKey,
  roleLabel,
  userName,
  userEmail,
}: {
  navKey: NavKey;
  roleLabel: string;
  userName: string;
  userEmail: string;
}) {
  const groups = NAV_BY_KEY[navKey];
  const { theme, setTheme } = useTheme();
  const breadcrumb = useBreadcrumb(groups, roleLabel);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [allItems, query]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70 sm:px-6">
      {/* Mobile nav trigger */}
      <Sheet>
        <SheetTrigger
          render={<button className={buttonVariants({ variant: "ghost", size: "icon", className: cn(ICON_CHIP_BUTTON, "lg:hidden") })} />}
        >
          <Menu className="size-5" />
          <span className="sr-only">Open navigation</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-16 justify-center border-b border-sidebar-border px-4">
            <SheetTitle className="text-sidebar-foreground">
              <BrandMark />
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto py-3">
            <SidebarNavContent groups={groups} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Breadcrumb */}
      <div className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        <span className="text-muted-foreground">{breadcrumb.roleLabel}</span>
        {breadcrumb.group && (
          <>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
            <span className="text-muted-foreground">{breadcrumb.group}</span>
          </>
        )}
        {breadcrumb.label && (
          <>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{breadcrumb.label}</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Quick nav search */}
      <Popover open={searchOpen && results.length > 0} onOpenChange={setSearchOpen}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <div className="relative hidden w-56 md:block lg:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Jump to a page..."
                className="h-9 rounded-full bg-muted/60 pl-9"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />
            </div>
          }
        />
        <PopoverContent align="start" className="w-72 p-1.5">
          {results.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
              >
                <Icon className="size-4 text-muted-foreground" />
                {item.label}
              </Link>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger
          render={<button className={buttonVariants({ variant: "ghost", size: "icon", className: cn(ICON_CHIP_BUTTON, "relative") })} />}
        >
          <Bell className="size-[18px]" />
          <span className="sr-only">Notifications</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-4 text-center text-sm text-muted-foreground">
          You&apos;re all caught up.
        </PopoverContent>
      </Popover>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        className={ICON_CHIP_BUTTON}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="size-[18px] scale-100 dark:scale-0" />
        <Moon className="absolute size-[18px] scale-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      {/* Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton
          render={
            <button
              aria-label="Account menu"
              className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <Avatar>
            <AvatarFallback className="bg-primary/10 font-medium text-primary">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">{userName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{userEmail}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
