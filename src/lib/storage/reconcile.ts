import { HeadObjectCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOCUMENT_TABLES,
  MANAGED_DOCUMENT_PREFIXES,
  isManagedDocumentKey,
  referencesFromRows,
  type DocumentEntityType,
  type DocumentReference,
} from "@/lib/storage/document-registry";

// DB <-> storage reconciliation for private documents. DETECTION ONLY: nothing
// in this module deletes, moves or rewrites anything, in storage or in the
// database. It is run explicitly by an operator (scripts/reconcile-documents.ts),
// never from a user request — it reads every document reference and lists
// every object under the managed prefixes.
//
// No "server-only" import, so the operator script can load it; it holds no
// credentials of its own — callers pass in a service-role database client and
// a storage inventory.
//
// Statuses, per storage key:
//   referenced   — exactly one row references it, and the object exists
//   shared       — more than one reference (row/column) points at it, and the
//                  object exists; every key is meant to belong to one upload,
//                  so this needs a look before any future cleanup
//   missing      — referenced, but the object is not in storage (the UI shows
//                  such a document as "unavailable" once the signed URL 404s);
//                  the reference is evidence and is never cleared from here
//   unreferenced — in storage under a managed prefix, nothing references it,
//                  and it is older than the grace period
//   grace_period — in storage, unreferenced, but too recent (or of unknown
//                  age) to call orphaned: its save may still be in flight, or
//                  its outcome may be unknown (see insertInjuryWithReport)

export type StorageObject = { key: string; lastModified: Date | null; size: number | null };

export interface DocumentInventory {
  list(prefix: string): Promise<StorageObject[]>;
  exists(key: string): Promise<boolean>;
}

export type ReconciliationStatus = "referenced" | "shared" | "missing" | "unreferenced" | "grace_period";

export type ReconciliationEntry = {
  key: string;
  status: ReconciliationStatus;
  exists: boolean;
  referenceCount: number;
  references: { entityType: DocumentEntityType; entityId: string; column: string }[];
  ageSeconds: number | null;
  sizeBytes: number | null;
};

export type ReconciliationReport = {
  generatedAt: string;
  gracePeriodHours: number;
  prefixes: readonly string[];
  summary: Record<ReconciliationStatus, number>;
  entries: ReconciliationEntry[];
};

export const DEFAULT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

const PAGE_SIZE = 1000;

// Lists one bucket through the S3 API (R2 in deployed environments, local
// Supabase Storage in tests). Errors propagate: a listing that failed must
// never be read as "nothing is in storage" — that would report every
// reference as missing.
export function s3Inventory(client: S3Client, bucket: string): DocumentInventory {
  return {
    async list(prefix) {
      const objects: StorageObject[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
        );
        for (const obj of page.Contents ?? []) {
          if (!obj.Key) continue;
          objects.push({ key: obj.Key, lastModified: obj.LastModified ?? null, size: obj.Size ?? null });
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return objects;
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
        throw err;
      }
    },
  };
}

// Every non-empty document reference in every DOCUMENT_TABLES table, paged so
// no table is silently truncated at the Data API's row limit.
export async function collectAllDocumentReferences(db: SupabaseClient): Promise<DocumentReference[]> {
  const refs: DocumentReference[] = [];
  for (const spec of DOCUMENT_TABLES) {
    const anyDocument = spec.columns.map((column) => `${column}.not.is.null`).join(",");
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from(spec.table)
        .select([spec.idColumn, ...spec.columns].join(", "))
        .or(anyDocument)
        .order(spec.idColumn)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Could not read ${spec.table} document references: ${error.code || error.message}`);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      refs.push(...referencesFromRows(spec, rows));
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return refs;
}

// Pure classification. `objects` is the inventory of the managed prefixes;
// `existsOutsidePrefixes` answers existence for referenced keys that fall
// outside them (which the listing cannot see). Objects outside the managed
// prefixes are not documents and are left out entirely.
export function classifyDocuments(
  refs: DocumentReference[],
  objects: StorageObject[],
  options: { now: Date; gracePeriodMs: number; existsOutsidePrefixes?: Map<string, boolean> }
): ReconciliationEntry[] {
  const refsByKey = new Map<string, DocumentReference[]>();
  for (const ref of refs) refsByKey.set(ref.key, [...(refsByKey.get(ref.key) ?? []), ref]);

  const objectByKey = new Map<string, StorageObject>();
  for (const obj of objects) if (isManagedDocumentKey(obj.key)) objectByKey.set(obj.key, obj);

  const keys = new Set([...refsByKey.keys(), ...objectByKey.keys()]);
  const entries: ReconciliationEntry[] = [];

  for (const key of keys) {
    const keyRefs = refsByKey.get(key) ?? [];
    const obj = objectByKey.get(key);
    const exists = obj !== undefined || options.existsOutsidePrefixes?.get(key) === true;
    const ageMs = obj?.lastModified ? options.now.getTime() - obj.lastModified.getTime() : null;

    let status: ReconciliationStatus;
    if (keyRefs.length > 0 && !exists) status = "missing";
    else if (keyRefs.length > 1) status = "shared";
    else if (keyRefs.length === 1) status = "referenced";
    // Unknown age is treated as recent: never call an object orphaned
    // without evidence that it is old.
    else if (ageMs === null || ageMs < options.gracePeriodMs) status = "grace_period";
    else status = "unreferenced";

    entries.push({
      key,
      status,
      exists,
      referenceCount: keyRefs.length,
      references: keyRefs.map(({ entityType, entityId, column }) => ({ entityType, entityId, column })),
      ageSeconds: ageMs === null ? null : Math.floor(ageMs / 1000),
      sizeBytes: obj?.size ?? null,
    });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

// Collects the database references and the storage inventory, then
// classifies them. Read-only.
export async function reconcileDocuments(options: {
  db: SupabaseClient;
  inventory: DocumentInventory;
  now?: Date;
  gracePeriodMs?: number;
}): Promise<ReconciliationReport> {
  const now = options.now ?? new Date();
  const gracePeriodMs = options.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;

  const refs = await collectAllDocumentReferences(options.db);
  const objects: StorageObject[] = [];
  for (const prefix of MANAGED_DOCUMENT_PREFIXES) objects.push(...(await options.inventory.list(prefix)));

  const existsOutsidePrefixes = new Map<string, boolean>();
  for (const key of new Set(refs.map((ref) => ref.key))) {
    if (!isManagedDocumentKey(key)) existsOutsidePrefixes.set(key, await options.inventory.exists(key));
  }

  const entries = classifyDocuments(refs, objects, { now, gracePeriodMs, existsOutsidePrefixes });
  const summary: Record<ReconciliationStatus, number> = {
    referenced: 0,
    shared: 0,
    missing: 0,
    unreferenced: 0,
    grace_period: 0,
  };
  for (const entry of entries) summary[entry.status] += 1;

  return {
    generatedAt: now.toISOString(),
    gracePeriodHours: gracePeriodMs / (60 * 60 * 1000),
    prefixes: MANAGED_DOCUMENT_PREFIXES,
    summary,
    entries,
  };
}
