import type { Database } from "@/lib/supabase/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/super-admin",
  centre_admin: "/centre-admin",
  coach: "/coach",
  medical: "/medical",
  parent: "/parent",
  // Staff/Finance share the centre_admin dashboard — same view access,
  // read-only (see the 20260803* migrations and each page's own
  // requireRole call for the actual enforcement).
  staff: "/centre-admin",
  finance: "/centre-admin",
};

export function roleHome(role: UserRole) {
  return ROLE_HOME[role];
}
