import "server-only";
import { uploadFile, deleteFile, UploadValidationError } from "@/lib/storage/r2";
import { logError } from "@/lib/logger";

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

// Shared by every action that accepts a batch of optional document uploads
// (players, staff, injuries) — validates and uploads each present file,
// surfacing a user-facing message for the first invalid one (wrong
// type/too large, in field order) instead of silently dropping it. A
// genuine R2/infra failure doesn't block the record from saving, but is
// logged instead of vanishing.
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
      logError(`Upload failed for "${formKey}" in ${folder}:`, err);
    }
  }

  return validationError ? { values, error: validationError } : { values };
}

// Call after a record's doc columns are successfully overwritten with the
// keys from uploadDocFields — deletes whichever old keys just got replaced,
// so a re-uploaded Aadhaar/medical doc doesn't leave the previous copy live
// in R2 forever with nothing in the DB pointing to it. Best-effort and
// non-blocking: a failed delete here is orphaned storage, not a correctness
// problem for the record that already saved successfully, so it's logged
// rather than surfaced to the user.
export function deleteReplacedDocs<Column extends string>(
  oldValues: Partial<Record<Column, string | null>>,
  newValues: Partial<Record<Column, string>>
) {
  for (const column of Object.keys(newValues) as Column[]) {
    const oldKey = oldValues[column];
    const newKey = newValues[column];
    if (oldKey && oldKey !== newKey) {
      deleteFile(oldKey).catch((err) =>
        logError(`Failed to delete replaced document "${oldKey}":`, err)
      );
    }
  }
}
