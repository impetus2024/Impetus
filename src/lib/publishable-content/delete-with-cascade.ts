import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type PublishableTable = "monthly_highlights" | "news_events";

// Shared service-role delete step for Monthly Highlights and News & Events:
// both cascade to a `<table>_centres` many-to-many publish mapping across
// every centre the row is published to, which a Centre Admin doesn't have
// RLS DELETE rights on for any centre but their own (see each module's
// migration for why the mapping table's policy never subqueries the content
// table back). Callers must confirm access via their own RLS-scoped select
// BEFORE calling this — it does not re-check authorization itself, it only
// bypasses the cascade's own RLS check once that's already been
// established, same pattern as deleteCentre in super-admin/centres/actions.ts.
export async function deleteViaServiceRole(table: PublishableTable, id: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from(table).delete().eq("id", id);
  return !error;
}
