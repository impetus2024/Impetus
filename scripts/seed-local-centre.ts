// One-off local-testing helper: creates a bare centre when none exists yet,
// so seed-test-accounts.ts (which requires an existing centre to attach
// test accounts to) has something to target. Skips if any centre already
// exists — this isn't meant to create a second one. Not part of the app —
// run manually:
//   node --env-file=.env.local -r tsx/cjs scripts/seed-local-centre.ts [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { assertLocalOrConfirmed, isDryRun } from "./lib/db-guard";

async function main() {
  const target = assertLocalOrConfirmed("seed-local-centre");
  const dryRun = isDryRun();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!target.url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(target.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: existingError } = await supabase
    .from("centres")
    .select("id, name")
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    console.log(`A centre already exists — skipping: ${existing.name} (${existing.id})`);
    return;
  }

  if (dryRun) {
    console.log('[dry-run] Would create centre: "Test Centre"');
    return;
  }

  const { data: centre, error } = await supabase
    .from("centres")
    .insert({
      name: "Test Centre",
      contact_number: "0000000000",
      email: "centre@impetus.local",
      country: "India",
    })
    .select("id, name")
    .single();
  if (error) throw error;

  console.log(`Created centre: ${centre.name} (${centre.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
