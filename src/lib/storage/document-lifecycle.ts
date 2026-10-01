import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteFile } from "@/lib/storage/r2";
import { logError, logInfo } from "@/lib/logger";
import { recordStorageEvents, type StorageAuditEvent } from "@/lib/storage/document-audit";
import {
  DOCUMENT_TABLES,
  referencesFromRows,
  type DocumentReference,
  type DocumentTable,
} from "@/lib/storage/document-registry";

// Storage cleanup for intentionally deleted records (a centre admin, a whole
// centre). The database row is the owner of a document; the storage key's
// folder is not (see MANAGED_DOCUMENT_PREFIXES), so an object is only ever
// deleted once the database says nothing references it any more:
//
//   1. capture the record's document keys BEFORE the database delete
//   2. delete the rows; if that fails, or its outcome is unknown, stop here —
//      the documents are kept
//   3. re-check every document column for each captured key, and delete only
//      the keys that are no longer referenced anywhere
//   4. record each outcome in the document audit trail
//
// A storage failure in 3 never undoes the database delete: the object is
// logged and recorded as an orphan for reconciliation to report.

// Table names come from DOCUMENT_TABLES, so these queries are built from a
// fixed list, never from input; the untyped client keeps that list generic.
type Client = SupabaseClient;

const IN_CHUNK = 100;

function chunks<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Document keys held by the rows of `table` whose `filterColumn` is one of
// `values`. Throws on a query error: a caller that cannot see what a delete
// will release must not go ahead with it.
export async function collectDocumentReferences(
  client: Client,
  table: DocumentTable["table"],
  filterColumn: string,
  values: string[]
): Promise<DocumentReference[]> {
  const spec = DOCUMENT_TABLES.find((t) => t.table === table)!;
  const refs: DocumentReference[] = [];
  for (const batch of chunks(values)) {
    const { data, error } = await client
      .from(table)
      .select([spec.idColumn, ...spec.columns].join(", "))
      .in(filterColumn, batch);
    if (error) throw new Error(`Could not read ${table} documents: ${error.code || error.message}`);
    refs.push(...referencesFromRows(spec, (data ?? []) as unknown as Record<string, unknown>[]));
  }
  return refs;
}

// The subset of `keys` that some document column, in any document table,
// still holds. Throws on a query error — "could not check" must never be
// read as "not referenced".
export async function findReferencedKeys(client: Client, keys: string[]): Promise<Set<string>> {
  const referenced = new Set<string>();
  const unique = Array.from(new Set(keys));
  const lookups = DOCUMENT_TABLES.flatMap((spec) =>
    spec.columns.flatMap((column) => chunks(unique).map((batch) => ({ table: spec.table, column, batch })))
  );
  await Promise.all(
    lookups.map(async ({ table, column, batch }) => {
      const { data, error } = await client.from(table).select(column).in(column, batch);
      if (error) throw new Error(`Could not check ${table}.${column} references: ${error.code || error.message}`);
      for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
        const key = row[column];
        if (key) referenced.add(key);
      }
    })
  );
  return referenced;
}

export type ReleaseSummary = { deleted: string[]; kept: string[]; orphaned: string[] };

export type ReleaseContext = { actorId?: string | null; centreId?: string | null; reason: string };

// Step 3 + 4 above. Call ONLY after the database delete has definitely
// succeeded. Never throws.
export async function releaseDocuments(
  client: Client,
  refs: DocumentReference[],
  context: ReleaseContext
): Promise<ReleaseSummary> {
  const summary: ReleaseSummary = { deleted: [], kept: [], orphaned: [] };
  const refByKey = new Map<string, DocumentReference>();
  for (const ref of refs) if (!refByKey.has(ref.key)) refByKey.set(ref.key, ref);
  if (refByKey.size === 0) return summary;

  const eventFor = (ref: DocumentReference, action: StorageAuditEvent["action"], reason: string): StorageAuditEvent => ({
    action,
    reason,
    entity_type: ref.entityType,
    entity_id: ref.entityId,
    centre_id: context.centreId ?? null,
    actor_id: context.actorId ?? null,
    document_field: ref.column,
    old_key: ref.key,
  });

  let stillReferenced: Set<string>;
  try {
    stillReferenced = await findReferencedKeys(client, Array.from(refByKey.keys()));
  } catch (err) {
    // Ownership could not be verified: delete nothing.
    logError(`Document cleanup skipped (${context.reason}): reference check failed; ${refByKey.size} object(s) kept:`, err);
    summary.orphaned.push(...refByKey.keys());
    await recordStorageEvents(
      Array.from(refByKey.values()).map((ref) => eventFor(ref, "orphan", `${context.reason}_reference_check_failed`))
    );
    return summary;
  }

  const events: StorageAuditEvent[] = [];
  const toDelete = Array.from(refByKey.values()).filter((ref) => {
    if (!stillReferenced.has(ref.key)) return true;
    summary.kept.push(ref.key);
    return false;
  });
  if (summary.kept.length > 0) {
    // Expected, not a failure: keeping a still-referenced object is exactly
    // what should happen, so this is INFO rather than a Sentry warning.
    logInfo(`Document cleanup (${context.reason}): ${summary.kept.length} object(s) still referenced elsewhere were kept.`);
  }

  const results = await Promise.allSettled(toDelete.map((ref) => deleteFile(ref.key)));
  results.forEach((result, i) => {
    const ref = toDelete[i];
    if (result.status === "fulfilled") {
      summary.deleted.push(ref.key);
      events.push(eventFor(ref, "cleanup", context.reason));
    } else {
      summary.orphaned.push(ref.key);
      logError(`Orphaned-object cleanup failed (${context.reason}): "${ref.key}" is still in storage:`, result.reason);
      events.push(eventFor(ref, "orphan", `${context.reason}_delete_failed`));
    }
  });

  await recordStorageEvents(events);
  return summary;
}

export type DeleteWithDocumentsResult =
  | { deleted: true; cleanup: ReleaseSummary }
  | { deleted: false; error: unknown };

// Steps 1-4 for a single delete operation. `deleteRows` reports the database
// outcome; any error (a rejection or an unknown outcome alike) means no
// document is touched.
export async function deleteWithDocumentCleanup(
  client: Client,
  capture: () => Promise<DocumentReference[]>,
  deleteRows: () => Promise<{ error: unknown }>,
  context: ReleaseContext
): Promise<DeleteWithDocumentsResult> {
  let refs: DocumentReference[];
  try {
    refs = await capture();
  } catch (error) {
    return { deleted: false, error };
  }

  let error: unknown;
  try {
    ({ error } = await deleteRows());
  } catch (thrown) {
    error = thrown;
  }
  if (error) return { deleted: false, error };

  return { deleted: true, cleanup: await releaseDocuments(client, refs, context) };
}
