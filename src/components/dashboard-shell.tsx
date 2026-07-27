import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { DashboardNav } from "@/components/dashboard-nav";

export function DashboardShell({
  title,
  userName,
  navItems,
  children,
}: {
  title: string;
  userName: string;
  navItems: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">{title}</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{userName}</span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <DashboardNav items={navItems} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
