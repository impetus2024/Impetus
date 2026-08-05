import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import type { NavKey } from "./nav-config";

export function AppShell({
  navKey,
  roleLabel,
  userName,
  userEmail,
  userAvatarUrl,
  greetingTitle,
  greetingDateLine,
  children,
}: {
  navKey: NavKey;
  roleLabel: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  greetingTitle: string;
  greetingDateLine: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh bg-muted/30">
      <AppSidebar navKey={navKey} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          navKey={navKey}
          roleLabel={roleLabel}
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          greetingTitle={greetingTitle}
          greetingDateLine={greetingDateLine}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
