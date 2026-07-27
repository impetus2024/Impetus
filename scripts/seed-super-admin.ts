// One-time setup: creates the first Super Admin account. Not exposed via any
// UI or route — run manually with credentials from env vars.
//   node --env-file=.env.local -r tsx/cjs scripts/seed-super-admin.ts
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SEED_SUPER_ADMIN_NAME;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password || !fullName || !url || !serviceRoleKey) {
    throw new Error(
      "Missing one of SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD, " +
        "SEED_SUPER_ADMIN_NAME, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error: countError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");

  if (countError) throw countError;

  if (count && count > 0) {
    console.log("A super_admin already exists — refusing to create another.");
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "super_admin" },
    user_metadata: { full_name: fullName },
  });

  if (error) throw error;

  console.log(`Super Admin created: ${data.user.email} (${data.user.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
