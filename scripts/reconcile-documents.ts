// Operator tool: reconciles private document references in the database
// against the objects in storage and prints a JSON report (see
// src/lib/storage/reconcile.ts for what each status means).
//
// DETECTION ONLY. This never deletes or modifies a storage object, and never
// clears or rewrites a database reference — an "unreferenced" or "missing"
// result is evidence to investigate, not something acted on here.
//
//   node --env-file=.env.local -r tsx/cjs scripts/reconcile-documents.ts
//   node --env-file=.env.local -r tsx/cjs scripts/reconcile-documents.ts --grace-hours 48 --out report.json
//   node --env-file=.env.local -r tsx/cjs scripts/reconcile-documents.ts --record-missing
//
// --record-missing is the one write: it appends a 'missing' event to
// document_audit_events for each missing reference not already recorded as
// missing. Gated by db-guard (local only unless ALLOW_REMOTE_DB=true AND
// --allow-remote). Without it the script only reads.
//
// The report contains storage keys and record ids: treat it as operational
// data, not something to share with centre users.
import { writeFileSync } from "node:fs";
import { S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { assertLocalOrConfirmed, printDbTarget, resolveDbTarget } from "./lib/db-guard";
import type { Database } from "../src/lib/supabase/database.types";
import { DEFAULT_GRACE_PERIOD_MS, reconcileDocuments, s3Inventory } from "../src/lib/storage/reconcile";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

// Same configuration as src/lib/storage/r2.ts (private bucket, optional
// endpoint override for local S3-compatible storage).
function storageClient() {
  const endpointOverride = process.env.R2_ENDPOINT;
  return new S3Client({
    region: process.env.R2_REGION ?? "auto",
    endpoint: endpointOverride ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(endpointOverride),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function main() {
  const recordMissing = process.argv.includes("--record-missing");
  const target = recordMissing ? assertLocalOrConfirmed("reconcile-documents") : resolveDbTarget();
  if (!recordMissing) printDbTarget(target, "reconcile-documents");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET_NAME ?? process.env.R2_BUCKET_NAME;
  if (!target.url || !serviceRoleKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  if (!bucket) throw new Error("R2_BUCKET_NAME is not set");

  const graceHours = argValue("--grace-hours");
  const gracePeriodMs = graceHours ? Number(graceHours) * 60 * 60 * 1000 : DEFAULT_GRACE_PERIOD_MS;
  if (!Number.isFinite(gracePeriodMs) || gracePeriodMs < 0) throw new Error("--grace-hours must be a non-negative number");

  const db = createClient<Database>(target.url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const report = await reconcileDocuments({ db, inventory: s3Inventory(storageClient(), bucket), gracePeriodMs });

  console.error(`[reconcile-documents] ${JSON.stringify(report.summary)}`);

  if (recordMissing) {
    const missing = report.entries.filter((entry) => entry.status === "missing");
    const known = new Set<string>();
    for (let i = 0; i < missing.length; i += 100) {
      const { data, error } = await db
        .from("document_audit_events")
        .select("old_key")
        .eq("action", "missing")
        .in("old_key", missing.slice(i, i + 100).map((entry) => entry.key));
      if (error) throw error;
      for (const row of data ?? []) if (row.old_key) known.add(row.old_key);
    }
    const events = missing
      .filter((entry) => !known.has(entry.key))
      .flatMap((entry) =>
        entry.references.map((ref) => ({
          action: "missing" as const,
          reason: "reconciliation",
          entity_type: ref.entityType,
          entity_id: ref.entityId,
          document_field: ref.column,
          old_key: entry.key,
        }))
      );
    let recorded = events.length;
    if (events.length > 0) {
      const { error: insertError } = await db.from("document_audit_events").insert(events);
      if (insertError) {
        // Detection succeeded and the report below is still valid, so an
        // audit-trail write failure must not abort the run (the reference
        // listing and storage listing above still fail the command). Log the
        // count and code only — the keys are already in the report.
        recorded = 0;
        console.error(
          `[reconcile-documents] failed to record ${events.length} missing-object event(s) (${insertError.code || insertError.message}); report unaffected`
        );
      }
    }
    console.error(`[reconcile-documents] recorded ${recorded} missing-object event(s)`);
  }

  const out = argValue("--out");
  const json = JSON.stringify(report, null, 2);
  if (out) {
    writeFileSync(out, json);
    console.error(`[reconcile-documents] report written to ${out}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error("[reconcile-documents] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
