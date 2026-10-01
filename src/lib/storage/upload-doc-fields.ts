import "server-only";
import { uploadFile, deleteFile, UploadValidationError } from "@/lib/storage/r2";
import { logError } from "@/lib/logger";
import { recordStorageEvents, type StorageAuditEvent } from "@/lib/storage/document-audit";
import type { DocumentEntityType } from "@/lib/storage/document-registry";

type DocField<Column extends string> = { formKey: string; column: Column };

// The stored R2 key never uses the client-supplied filename (see r2.ts —
// it's always folder/uuid.ext), so this only ever reaches a user-facing
// error message today. Sanitized anyway rather than trusting it's safe in
// every future context it might get used in: stripped of control
// characters (which could make an error message render oddly) and capped
// in length (a multi-KB "filename" is a plausible malformed-client edge
// case, not something to echo back as-is).
function sanitizeFilenameForDisplay(name: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping control chars
  const cleaned = name.replace(/[\x00-\x1f\x7f]/g, "").trim();
  return cleaned.length > 100 ? `${cleaned.slice(0, 97)}...` : cleaned || "unnamed file";
}

// Shown when a document fails to reach storage for a real infra reason
// (R2 unreachable, credentials, network) as opposed to a validation rejection.
export const DOCUMENT_UPLOAD_FAILED_MESSAGE =
  "A document couldn't be uploaded, so nothing was saved. Try again in a moment.";

// Shown when the document a save was replacing changed underneath it — another
// request (or a second tab) replaced the same document first.
export const DOCUMENT_CHANGED_MESSAGE =
  "A document on this record was changed by someone else, so nothing was saved. Reload the page and try again.";

// Shared by every action that accepts a batch of optional document uploads
// (players, staff) — validates and uploads each present file. The batch is
// all-or-nothing: if ANY file is rejected (wrong type/too large, reported in
// field order) or fails to reach storage, `values` comes back empty with an
// error, and the objects the other files already put in storage are deleted
// again, so the caller can neither save a path to a failed upload nor leave
// this request's successful uploads unreferenced. Old, known-good objects are
// never touched here.
//
// Files upload concurrently (Promise.allSettled), not one at a time — this
// is called from the app's highest-traffic write paths (create/update
// player, update player profile, create administrator), each submitting up
// to 4 documents at once, and sequential uploads meant paying for the sum
// of every file's R2 round trip instead of the slowest one. isRateLimited/
// recordAttempt in uploadFile are synchronous ahead of its first await, so
// running the calls concurrently still records one attempt per file, in
// the same order, before any of them actually start transferring — the
// rate-limit budget isn't affected by the switch.
export async function uploadDocFields<Column extends string>(
  formData: FormData,
  docFields: DocField<Column>[],
  folder: string,
  actorId?: string
): Promise<{ values: Partial<Record<Column, string>>; error?: string }> {
  const present = docFields
    .map((field) => ({ ...field, file: formData.get(field.formKey) }))
    .filter(
      (field): field is DocField<Column> & { file: File } =>
        field.file instanceof File && field.file.size > 0
    );

  const results = await Promise.allSettled(
    present.map(({ file }) => uploadFile(file, folder, "private", actorId))
  );

  const values: Partial<Record<Column, string>> = {};
  let validationError: string | undefined;
  let storageFailed = false;

  for (let i = 0; i < present.length; i++) {
    const { formKey, column, file } = present[i];
    const result = results[i];

    if (result.status === "fulfilled") {
      values[column] = result.value;
      continue;
    }

    const err = result.reason;
    if (err instanceof UploadValidationError) {
      // First validation error in field order wins — matches the old
      // sequential loop's "return on the first invalid one" behavior.
      validationError ??= `${err.message} (${sanitizeFilenameForDisplay(file.name)})`;
    } else {
      storageFailed = true;
      logError(`Upload failed for "${formKey}" in ${folder}:`, err);
    }
  }

  if (!validationError && !storageFailed) return { values };

  // Something failed: the uploads that did succeed belong to a request that
  // will not be saved, so remove them rather than leave them unreferenced.
  await discardUploadedDocs(values);
  return { values: {}, error: validationError ?? DOCUMENT_UPLOAD_FAILED_MESSAGE };
}

// Deletes objects THIS request uploaded that ended up not being referenced
// (a rejected batch, a lost compare-and-swap, a failed insert). Never call it
// with keys read from the database — those are the record's known-good
// documents. A failed delete is logged loudly as an orphaned object (the
// request has already failed; there is nothing more the caller can do).
// Each outcome is recorded in the document audit trail (cleanup / orphan);
// the owning row is not known here — on a create it never existed.
export async function discardUploadedDocs(
  newValues: Partial<Record<string, string>>
): Promise<void> {
  const entries = Object.entries(newValues).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const results = await Promise.allSettled(entries.map(([, key]) => deleteFile(key)));
  const events: StorageAuditEvent[] = [];
  results.forEach((result, i) => {
    const [column, key] = entries[i];
    if (result.status === "rejected") {
      logError(
        `Orphaned-object cleanup failed: "${key}" was uploaded by a request that did not save it and is still in storage:`,
        result.reason
      );
    }
    events.push({
      action: result.status === "fulfilled" ? "cleanup" : "orphan",
      reason: result.status === "fulfilled" ? "discarded_upload" : "discarded_upload_delete_failed",
      document_field: column,
      old_key: key,
    });
  });
  await recordStorageEvents(events);
}

// Compare-and-swap on the document columns a save is replacing: chain onto the
// UPDATE so it only matches while each replaced column still holds the value
// this request read before uploading (or is still NULL). If another request
// replaced the same document first, the update matches zero rows instead of
// overwriting it — which is what keeps that request's object referenced, and
// makes `existing` a correct list of what may be deleted afterwards. Columns
// this request did not upload are not guarded, so replacing a different
// document concurrently is not treated as a conflict.
type DocGuardQuery<Q> = { filter(column: string, operator: "eq" | "is", value: string | null): Q };

export function guardDocColumns<Q extends DocGuardQuery<Q>>(
  query: Q,
  existing: Partial<Record<string, string | null>> | null,
  newValues: Partial<Record<string, string>>
): Q {
  let guarded = query;
  for (const column of Object.keys(newValues)) {
    const current = existing?.[column] ?? null;
    guarded = current === null ? guarded.filter(column, "is", null) : guarded.filter(column, "eq", current);
  }
  return guarded;
}

// Call after a record's doc columns are successfully overwritten with the
// keys from uploadDocFields — deletes whichever old keys just got replaced,
// so a re-uploaded Aadhaar/medical doc doesn't leave the previous copy live
// in R2 forever with nothing in the DB pointing to it. Best-effort and
// non-blocking: a failed delete here is orphaned storage, not a correctness
// problem for the record that already saved successfully, so it's logged
// rather than surfaced to the user. Each outcome is recorded in the document
// audit trail against the record (cleanup, or orphan when the delete failed).
export type DocAuditContext = {
  entityType: DocumentEntityType;
  entityId: string;
  centreId?: string | null;
  actorId?: string | null;
};

export function deleteReplacedDocs<Column extends string>(
  oldValues: Partial<Record<Column, string | null>>,
  newValues: Partial<Record<Column, string>>,
  audit?: DocAuditContext
) {
  for (const column of Object.keys(newValues) as Column[]) {
    const oldKey = oldValues[column];
    const newKey = newValues[column];
    if (oldKey && oldKey !== newKey) {
      const event = {
        entity_type: audit?.entityType,
        entity_id: audit?.entityId,
        centre_id: audit?.centreId ?? null,
        actor_id: audit?.actorId ?? null,
        document_field: column,
        old_key: oldKey,
      };
      deleteFile(oldKey).then(
        () => recordStorageEvents([{ ...event, action: "cleanup", reason: "replaced" }]),
        (err) => {
          logError(`Failed to delete replaced document "${oldKey}":`, err);
          return recordStorageEvents([{ ...event, action: "orphan", reason: "replaced_delete_failed" }]);
        }
      );
    }
  }
}
