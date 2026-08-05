import type { UserRole } from "@/lib/auth/roles";

// Every role that can view a dashboard showing the News & Events / Monthly
// Highlights feed, and therefore may dismiss items from it — currently
// every role there is, but kept explicit (not "requireRole with no args")
// so a future role added without dashboard access doesn't get pulled in by
// default.
export const DASHBOARD_VIEWER_ROLES: UserRole[] = [
  "super_admin",
  "centre_admin",
  "staff",
  "finance",
  "coach",
  "medical",
  "parent",
];
