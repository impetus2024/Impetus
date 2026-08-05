import type { UserRole } from "@/lib/auth/roles";

// Shared by Monthly Highlights and News & Events create actions: a Centre
// Admin always publishes to their own (session-resolved) centre and never
// gets a centre picker; a Super Admin selects one or more centres from the
// "centreIds" checkboxes. The client never gets to say which centre a
// Centre Admin's content belongs to — RLS independently enforces the same
// restriction if this is ever bypassed (see each module's migration).
export function resolveTargetCentreIds(
  actor: { role: UserRole; centre_id: string | null },
  formData: FormData
): string[] {
  if (actor.role === "centre_admin") {
    return actor.centre_id ? [actor.centre_id] : [];
  }
  return formData.getAll("centreIds").map(String);
}
