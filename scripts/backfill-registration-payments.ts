// One-off backfill: createPlayer/updatePlayer only started writing a
// registration payment (payments.is_registration_payment) and a
// package_change_logs row going forward, from 20260811000000. Players
// created before that migration was applied have a package assigned but no
// matching payment row, so they never show up in Payment History or the
// dashboard chart. This finds exactly those players (package_id set, no
// existing is_registration_payment=true row) and writes the one payment +
// one log row each would have gotten automatically, using their own
// package's current price and their own created_at as the payment date —
// same values the app itself would have produced.
//
// Purely additive: only inserts new payments/package_change_logs rows.
// Never updates or deletes an existing row.
//
//   node --env-file=.env.local -r tsx/cjs scripts/backfill-registration-payments.ts --dry-run
//   node --env-file=.env.local -r tsx/cjs scripts/backfill-registration-payments.ts
//   ALLOW_REMOTE_DB=true node --env-file=.env.local -r tsx/cjs scripts/backfill-registration-payments.ts --dry-run --allow-remote
import { createClient } from "@supabase/supabase-js";
import { assertLocalOrConfirmed, isDryRun } from "./lib/db-guard";

async function main() {
  const target = assertLocalOrConfirmed("backfill-registration-payments");
  const dryRun = isDryRun();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!target.url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(target.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, centre_id, package_id, created_by, created_at")
    .not("package_id", "is", null);
  if (playersError) throw playersError;

  const { data: existingRegPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("player_id")
    .eq("is_registration_payment", true);
  if (paymentsError) throw paymentsError;

  const alreadyHasPayment = new Set((existingRegPayments ?? []).map((p) => p.player_id));
  const candidates = (players ?? []).filter((p) => !alreadyHasPayment.has(p.id));

  if (candidates.length === 0) {
    console.log("Nothing to backfill — every player with a package already has a registration payment.");
    return;
  }

  const packageIds = Array.from(new Set(candidates.map((p) => p.package_id as string)));
  const { data: packages, error: packagesError } = await supabase
    .from("packages")
    .select("id, name, price")
    .in("id", packageIds);
  if (packagesError) throw packagesError;
  const packageById = new Map((packages ?? []).map((pkg) => [pkg.id, pkg]));

  type Row = {
    player_id: string;
    player_name: string;
    centre_id: string;
    package_id: string;
    package_name: string;
    amount: number;
    payment_date: string;
    changed_by: string;
    created_at: string;
  };

  const rows: Row[] = [];
  const skipped: string[] = [];

  for (const player of candidates) {
    const pkg = packageById.get(player.package_id as string);
    if (!pkg) {
      skipped.push(`${player.name} (${player.id}) — package ${player.package_id} not found, skipping`);
      continue;
    }
    rows.push({
      player_id: player.id,
      player_name: player.name,
      centre_id: player.centre_id,
      package_id: player.package_id as string,
      package_name: pkg.name,
      amount: pkg.price,
      payment_date: player.created_at.slice(0, 10),
      changed_by: player.created_by,
      created_at: player.created_at,
    });
  }

  console.log(`\nFound ${rows.length} player(s) missing a registration payment:`);
  for (const r of rows) {
    console.log(`  • ${r.player_name} — ${r.package_name} — ${r.amount} — ${r.payment_date}`);
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} player(s):`);
    for (const s of skipped) console.log(`  ! ${s}`);
  }
  console.log(`\nTotal amount to be recorded: ${rows.reduce((sum, r) => sum + r.amount, 0)}`);

  if (dryRun) {
    console.log("\n[dry-run] No rows written.");
    return;
  }

  if (rows.length === 0) {
    console.log("\nNo valid rows to insert.");
    return;
  }

  const { error: insertPaymentsError } = await supabase.from("payments").insert(
    rows.map((r) => ({
      centre_id: r.centre_id,
      player_id: r.player_id,
      package_id: r.package_id,
      amount: r.amount,
      payment_date: r.payment_date,
      recorded_by: r.changed_by,
      is_registration_payment: true,
    }))
  );
  if (insertPaymentsError) throw insertPaymentsError;

  const { error: insertLogsError } = await supabase.from("package_change_logs").insert(
    rows.map((r) => ({
      centre_id: r.centre_id,
      player_id: r.player_id,
      old_package_name: null,
      old_amount: null,
      new_package_name: r.package_name,
      new_amount: r.amount,
      changed_by: r.changed_by,
      created_at: r.created_at,
    }))
  );
  if (insertLogsError) throw insertLogsError;

  console.log(`\nDone. Inserted ${rows.length} payment(s) and ${rows.length} log row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
