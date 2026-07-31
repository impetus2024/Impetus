// One-off local-testing helper: provisions one account per role (Centre
// Admin, Coach, Medical, Parent) against the first existing centre, all
// with DEV_DEFAULT_PASSWORD. Not part of the app — run manually:
//   node --env-file=.env.local -r tsx/cjs scripts/seed-test-accounts.ts [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { assertLocalOrConfirmed, isDryRun } from "./lib/db-guard";

async function main() {
  const target = assertLocalOrConfirmed("seed-test-accounts");
  const dryRun = isDryRun();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.DEV_DEFAULT_PASSWORD;

  if (!target.url || !serviceRoleKey || !password) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DEV_DEFAULT_PASSWORD"
    );
  }

  const supabase = createClient(target.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: centre, error: centreError } = await supabase
    .from("centres")
    .select("id, name")
    .limit(1)
    .maybeSingle();

  if (centreError) throw centreError;
  if (!centre) {
    console.log("No centre exists yet — create one first, then rerun this script.");
    return;
  }

  const accounts: { email: string; fullName: string; role: string; centreId: string | null }[] = [
    { email: "centreadmin@impetus.local", fullName: "Test Centre Admin", role: "centre_admin", centreId: centre.id },
    { email: "coach@impetus.local", fullName: "Test Coach", role: "coach", centreId: centre.id },
    { email: "medical@impetus.local", fullName: "Test Medical", role: "medical", centreId: centre.id },
    { email: "parent@impetus.local", fullName: "Test Parent", role: "parent", centreId: null },
  ];

  for (const account of accounts) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", account.email)
      .maybeSingle();

    if (existing) {
      console.log(`Already exists, skipping: ${account.email}`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] Would create ${account.role}: ${account.email}`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      app_metadata: { role: account.role, centre_id: account.centreId },
      user_metadata: { full_name: account.fullName },
    });

    if (error) {
      console.error(`Failed to create ${account.email}:`, error.message);
      continue;
    }

    console.log(`Created ${account.role}: ${account.email} (${data.user.id})`);
  }

  console.log(`\nCentre used: ${centre.name} (${centre.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
