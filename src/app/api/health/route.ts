import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStorageHealth } from "@/lib/storage/r2";
import { logError, logWarning } from "@/lib/logger";

// Unauthenticated by design (see proxy.ts's PUBLIC_PATHS) — an uptime
// monitor can't sign in, and nothing here returns data, only status.
// Always runs at request time: a cached "ok" would defeat the point.
export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("centres").select("id", { count: "exact", head: true });
    return !error;
  } catch {
    return false;
  }
}

export async function GET() {
  const [databaseOk, storageOk] = await Promise.all([checkDatabase(), checkStorageHealth()]);

  // Database is load-bearing for almost every request; R2 is not (only
  // upload/view-document flows touch it) — a storage outage is reported
  // but doesn't fail the whole check, so an uptime monitor doesn't page
  // on-call for a dependency the app is still mostly functional without.
  const status = !databaseOk ? "down" : !storageOk ? "degraded" : "ok";

  const body = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: databaseOk ? "ok" : "error",
      storage: storageOk ? "ok" : "error",
    },
  };

  if (!databaseOk) logError("Health check: database unreachable", body);
  else if (!storageOk) logWarning("Health check: storage unreachable", body);

  return NextResponse.json(body, { status: databaseOk ? 200 : 503 });
}
