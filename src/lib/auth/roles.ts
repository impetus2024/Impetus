import type { Database } from "@/lib/supabase/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/super-admin",
  centre_admin: "/centre-admin",
  coach: "/coach",
  medical: "/medical",
  parent: "/parent",
};

export function roleHome(role: UserRole) {
  return ROLE_HOME[role];
}
