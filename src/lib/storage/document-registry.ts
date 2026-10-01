// Every table that stores private document keys, and which columns hold them.
// The single list that entity deletion (document-lifecycle.ts) and DB<->storage
// reconciliation (reconcile.ts) read from, so a reference is never missed by
// one of them. Mirrors the audit_document_columns triggers in
// supabase/migrations/20261001000000_document_audit_events.sql — a new
// document column has to be added in both places.
//
// No "server-only": this is plain data, also used by the operator script
// scripts/reconcile-documents.ts.
export const DOCUMENT_TABLES = [
  {
    table: "players",
    entityType: "player",
    idColumn: "id",
    columns: ["aadhaar_doc_path", "medical_records_path", "profile_picture_path"],
  },
  {
    table: "staff_profiles",
    entityType: "staff_profile",
    idColumn: "profile_id",
    columns: ["aadhaar_doc_path", "birth_certificate_path", "profile_picture_path", "other_documents_path"],
  },
  {
    // Injuries are captured and released when the whole centre they belong to
    // is deleted (see deleteCentre), but deleting a single injury row has no
    // dedicated document-cleanup action: report_doc_path is only ever written
    // on insert (report-document.ts), so a direct row delete intentionally
    // leaves the object in storage for reconciliation to detect and report.
    table: "injuries",
    entityType: "injury",
    idColumn: "id",
    columns: ["report_doc_path"],
  },
] as const;

export type DocumentTable = (typeof DOCUMENT_TABLES)[number];
export type DocumentEntityType = DocumentTable["entityType"];

// Folders uploadDocFields writes private documents under (see the call sites:
// player-documents/<uuid>, staff-documents/<profileId>,
// injury-reports/<playerId>). The folder id is NOT a reliable owner — a new
// player's folder is a fresh random UUID, not the player's id — so ownership
// is always decided from the database references, never from the key.
// Anything outside these prefixes (centre logos, monthly highlights, or any
// unrelated object in a shared bucket) is not a managed document.
export const MANAGED_DOCUMENT_PREFIXES = [
  "player-documents/",
  "staff-documents/",
  "injury-reports/",
] as const;

export function isManagedDocumentKey(key: string): boolean {
  return MANAGED_DOCUMENT_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// One stored reference: a row's document column holding a storage key.
export type DocumentReference = {
  key: string;
  entityType: DocumentEntityType;
  entityId: string;
  column: string;
};

// Extracts the non-empty document keys from rows of one DOCUMENT_TABLES table.
export function referencesFromRows(
  table: DocumentTable,
  rows: Record<string, unknown>[]
): DocumentReference[] {
  const refs: DocumentReference[] = [];
  for (const row of rows) {
    for (const column of table.columns) {
      const key = row[column];
      if (typeof key === "string" && key) {
        refs.push({ key, entityType: table.entityType, entityId: String(row[table.idColumn]), column });
      }
    }
  }
  return refs;
}
