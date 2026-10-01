import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";
import type { TablesInsert } from "@/lib/supabase/database.types";

// What server code records in document_audit_events: what happened to a
// storage OBJECT. Changes to the database REFERENCE (upload/replace/delete)
// are recorded by the audit_document_columns trigger in the same transaction
// as the change, so they are never written from here — see
// supabase/migrations/20261001000000_document_audit_events.sql.
//
//   cleanup — the object was deleted from storage
//   orphan  — the object should have been deleted but was not (storage delete
//             failed, or ownership could not be verified); it may now be in
//             storage with nothing referencing it
//   missing — reconciliation found a reference to an object not in storage
export type StorageAuditEvent = Pick<
  TablesInsert<"document_audit_events">,
  "entity_type" | "entity_id" | "centre_id" | "document_field" | "old_key" | "actor_id"
> & {
  action: "cleanup" | "orphan" | "missing";
  reason: string;
};

// Best-effort by design: the storage operation being recorded has already
// happened (or failed) and nothing here may change its outcome, so this never
// throws. A failed insert is logged with the event count only — not the keys
// or the database error payload, which would repeat them.
export async function recordStorageEvents(events: StorageAuditEvent[]): Promise<void> {
  if (events.length === 0) return;
  try {
    const { error } = await createAdminClient().from("document_audit_events").insert(events);
    if (error) logError(`Failed to record ${events.length} document audit event(s):`, error.code || error.message);
  } catch (err) {
    logError(`Failed to record ${events.length} document audit event(s):`, err instanceof Error ? err.name : "unknown");
  }
}
