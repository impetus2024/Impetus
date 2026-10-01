import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/supabase/database.types";
import { uploadDocFields, discardUploadedDocs } from "@/lib/storage/upload-doc-fields";
import { logError } from "@/lib/logger";

const REPORT_DOC_FIELDS = [{ formKey: "reportDocument", column: "report_doc_path" as const }];

export const INJURY_SAVE_FAILED_MESSAGE = "Failed to save injury report.";

// Inserts an injury with its optional report document under the same
// integrity model as player/staff documents (upload-doc-fields.ts): a report
// that fails to upload fails the save instead of saving the injury without
// it, and a rejected insert removes the object this request uploaded.
//
// Injuries are only ever created — nothing updates report_doc_path — so there
// is no replacement to guard (no compare-and-swap, no old object to delete).
//
// Kept out of the "use server" actions file on purpose: every export there is
// a callable Server Action endpoint, and this takes a Supabase client.
export async function insertInjuryWithReport(
  supabase: SupabaseClient<Database>,
  formData: FormData,
  injury: Omit<TablesInsert<"injuries">, "report_doc_path">,
  actorId?: string
): Promise<{ error?: string }> {
  const uploads = await uploadDocFields(
    formData,
    REPORT_DOC_FIELDS,
    `injury-reports/${injury.player_id}`,
    actorId
  );
  if (uploads.error) return { error: uploads.error };

  const { error } = await supabase.from("injuries").insert({ ...injury, ...uploads.values });

  if (error) {
    logError(`Failed to save injury report for player ${injury.player_id}:`, error);
    // A Postgres error code means the insert was rejected, so the report is
    // unreferenced. Without one (network failure, timeout) the row may have
    // been written, so the object is kept: an orphan is recoverable, a row
    // pointing at a deleted report is not.
    if (error.code) {
      await discardUploadedDocs(uploads.values);
    } else if (uploads.values.report_doc_path) {
      logError(
        `Injury insert outcome unknown; keeping uploaded report "${uploads.values.report_doc_path}" (possible orphan):`,
        error
      );
    }
    return { error: INJURY_SAVE_FAILED_MESSAGE };
  }

  return {};
}
