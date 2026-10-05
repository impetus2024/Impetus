import { createClient } from "@supabase/supabase-js";

// Ensures the storage bucket the app is configured with (R2_BUCKET_NAME, and
// R2_PRIVATE_BUCKET_NAME when set) exists before any spec runs.
//
// In production an operator creates it once by hand (see docs/DEPLOYMENT.md).
// Locally nothing does, so on a fresh `supabase db reset` the specs that
// upload a document — the administrator-creation workflow, for example — fail
// with NoSuchBucket. The documents specs create it themselves, but they need
// the bucket to themselves and therefore run last (see playwright.config.ts),
// so it has to exist from the start. Creates it private, exactly as those
// specs do; never runs against a hosted project and no-ops when unconfigured
// (the specs skip themselves then).
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return;
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) return;

  const buckets = [
    process.env.R2_BUCKET_NAME,
    process.env.R2_PRIVATE_BUCKET_NAME,
  ].filter((name): name is string => Boolean(name));
  if (buckets.length === 0) return;

  const db = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const bucket of new Set(buckets)) {
    const { error } = await db.storage.createBucket(bucket, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      console.warn(`[e2e] could not ensure storage bucket "${bucket}": ${error.message}`);
    }
  }
}
