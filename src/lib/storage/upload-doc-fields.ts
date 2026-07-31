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
// returning early with a user-facing message on the first invalid one
// (wrong type/too large) instead of silently dropping it. A genuine R2/
// infra failure doesn't block the record from saving, but is now logged
// instead of vanishing.
export async function uploadDocFields<Column extends string>(
  formData: FormData,
  docFields: DocField<Column>[],
  folder: string,
  actorId?: string
): Promise<{ values: Partial<Record<Column, string>>; error?: string }> {
  const values: Partial<Record<Column, string>> = {};

  for (const { formKey, column } of docFields) {
    const file = formData.get(formKey);
    if (!(file instanceof File) || file.size === 0) continue;

    try {
      values[column] = await uploadFile(file, folder, "private", actorId);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return { values, error: `${err.message} (${sanitizeFilenameForDisplay(file.name)})` };
      }
      logError(`Upload failed for "${formKey}" in ${folder}:`, err);
    }
  }

  return { values };
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
