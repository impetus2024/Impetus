// One-off local-testing helper: populates every table with realistic mock
// data (player types, age categories, packages, batches, players, parent
// links, payments, gate pass logs, attendance, injuries) against the
// existing test accounts from seed-test-accounts.ts, so each role's
// dashboard and list pages have something real to show. Not part of the
// app — run manually:
//   node --env-file=.env.local -r tsx/cjs scripts/seed-mock-data.ts [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { assertLocalOrConfirmed, isDryRun } from "./lib/db-guard";

const SEEDED_PLAYER_NAMES = [
  "Arjun Mehta",
  "Rohan Sharma",
  "Kabir Singh",
  "Aditya Rao",
  "Vihaan Nair",
  "Ishaan Gupta",
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function monthsAgo(n: number, day = 10) {
  const d = new Date();
  d.setMonth(d.getMonth() - n, day);
  return d.toISOString().slice(0, 10);
}

function yearsAgo(n: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const target = assertLocalOrConfirmed("seed-mock-data");
  const dryRun = isDryRun();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!target.url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(target.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, role, centre_id")
    .in("email", [
      "centreadmin@impetus.local",
      "coach@impetus.local",
      "medical@impetus.local",
      "parent@impetus.local",
    ]);
  if (profilesError) throw profilesError;

  const byEmail = Object.fromEntries((profiles ?? []).map((p) => [p.email, p]));
  const centreAdmin = byEmail["centreadmin@impetus.local"];
  const coach = byEmail["coach@impetus.local"];
  const medical = byEmail["medical@impetus.local"];
  const parent = byEmail["parent@impetus.local"];
  if (!centreAdmin || !coach || !medical || !parent) {
    throw new Error("Missing one or more test accounts — run seed-test-accounts.ts first.");
  }
  // Derive the target centre from the test accounts themselves (there may
  // be more than one centre in the DB from other testing) rather than
  // guessing "the first centre".
  if (!centreAdmin.centre_id || centreAdmin.centre_id !== coach.centre_id) {
    throw new Error("centreadmin/coach test accounts are not on the same centre — check seed-test-accounts.ts output.");
  }
  const { data: centre, error: centreError } = await supabase
    .from("centres")
    .select("id, name")
    .eq("id", centreAdmin.centre_id)
    .single();
  if (centreError) throw centreError;

  // Idempotency guard: the seeded players are named and centre-scoped, so
  // their presence means this centre's mock dataset already exists — the
  // rest of this script uses plain .insert() (not upsert) for the tables
  // that depend on them, which would otherwise duplicate every rerun.
  const { data: existingPlayers, error: existingPlayersError } = await supabase
    .from("players")
    .select("id")
    .eq("centre_id", centre.id)
    .in("name", SEEDED_PLAYER_NAMES)
    .limit(1);
  if (existingPlayersError) throw existingPlayersError;
  if (existingPlayers && existingPlayers.length > 0) {
    console.log(`Mock data already seeded for centre "${centre.name}" — skipping (rerun-safe).`);
    return;
  }

  if (dryRun) {
    console.log(
      `[dry-run] Would seed for centre "${centre.name}": 3 player types, 3 age categories, ` +
        `3 packages, 2 batches, ${SEEDED_PLAYER_NAMES.length} players, 2 parent links, ` +
        `${SEEDED_PLAYER_NAMES.length * 3} payments, 6 gate pass logs, ` +
        `${SEEDED_PLAYER_NAMES.length * 7} attendance records, 2 injury reports.`
    );
    return;
  }

  // ---- player types ----
  const { data: playerTypes, error: ptError } = await supabase
    .from("player_types")
    .upsert(
      [
        { centre_id: centre.id, name: "Elite" },
        { centre_id: centre.id, name: "Development" },
        { centre_id: centre.id, name: "Grassroots" },
      ],
      { onConflict: "centre_id,name" }
    )
    .select("id, name");
  if (ptError) throw ptError;
  const elite = playerTypes!.find((p) => p.name === "Elite")!;
  const development = playerTypes!.find((p) => p.name === "Development")!;
  const grassroots = playerTypes!.find((p) => p.name === "Grassroots")!;

  // ---- age categories ----
  const { data: ageCategories, error: acError } = await supabase
    .from("age_categories")
    .upsert(
      [
        { centre_id: centre.id, name: "U-12" },
        { centre_id: centre.id, name: "U-15" },
        { centre_id: centre.id, name: "U-18" },
      ],
      { onConflict: "centre_id,name" }
    )
    .select("id, name");
  if (acError) throw acError;
  const u12 = ageCategories!.find((a) => a.name === "U-12")!;
  const u15 = ageCategories!.find((a) => a.name === "U-15")!;

  // ---- packages ----
  const { data: packages, error: pkgError } = await supabase
    .from("packages")
    .insert([
      { centre_id: centre.id, name: "Monthly - Elite", player_type_id: elite.id, price: 3500, duration: "1 Month" },
      { centre_id: centre.id, name: "Monthly - Development", player_type_id: development.id, price: 2500, duration: "1 Month" },
      { centre_id: centre.id, name: "Annual - Grassroots", player_type_id: grassroots.id, price: 20000, duration: "12 Months" },
    ])
    .select("id, name");
  if (pkgError) throw pkgError;
  const eliteMonthly = packages!.find((p) => p.name === "Monthly - Elite")!;
  const devMonthly = packages!.find((p) => p.name === "Monthly - Development")!;

  // ---- batches ----
  const { data: batches, error: batchError } = await supabase
    .from("batches")
    .insert([
      {
        centre_id: centre.id,
        name: "Morning U-15 Elite",
        head_coach_id: coach.id,
        player_type_id: elite.id,
        age_category_id: u15.id,
        start_time: "06:00",
        end_time: "07:30",
      },
      {
        centre_id: centre.id,
        name: "Evening U-12 Development",
        head_coach_id: coach.id,
        player_type_id: development.id,
        age_category_id: u12.id,
        start_time: "16:00",
        end_time: "17:30",
      },
    ])
    .select("id, name");
  if (batchError) throw batchError;
  const eliteBatch = batches!.find((b) => b.name === "Morning U-15 Elite")!;
  const devBatch = batches!.find((b) => b.name === "Evening U-12 Development")!;

  // ---- players ----
  const playerRows = [
    {
      name: "Arjun Mehta",
      date_of_birth: yearsAgo(14),
      age_category_id: u15.id,
      batch_id: eliteBatch.id,
      player_type_id: elite.id,
      package_id: eliteMonthly.id,
      parent_email: "parent@impetus.local",
      father_name: "Test Parent",
      is_checked_in: false,
    },
    {
      name: "Rohan Sharma",
      date_of_birth: yearsAgo(15),
      age_category_id: u15.id,
      batch_id: eliteBatch.id,
      player_type_id: elite.id,
      package_id: eliteMonthly.id,
      parent_email: "rohan.parent@example.com",
      father_name: "Vikram Sharma",
      is_checked_in: true,
    },
    {
      name: "Kabir Singh",
      date_of_birth: yearsAgo(14),
      age_category_id: u15.id,
      batch_id: eliteBatch.id,
      player_type_id: elite.id,
      package_id: eliteMonthly.id,
      parent_email: "kabir.parent@example.com",
      father_name: "Harpreet Singh",
      is_checked_in: false,
    },
    {
      name: "Aditya Rao",
      date_of_birth: yearsAgo(11),
      age_category_id: u12.id,
      batch_id: devBatch.id,
      player_type_id: development.id,
      package_id: devMonthly.id,
      parent_email: "parent@impetus.local",
      father_name: "Test Parent",
      is_checked_in: false,
    },
    {
      name: "Vihaan Nair",
      date_of_birth: yearsAgo(12),
      age_category_id: u12.id,
      batch_id: devBatch.id,
      player_type_id: development.id,
      package_id: devMonthly.id,
      parent_email: "vihaan.parent@example.com",
      father_name: "Suresh Nair",
      is_checked_in: true,
    },
    {
      name: "Ishaan Gupta",
      date_of_birth: yearsAgo(11),
      age_category_id: u12.id,
      batch_id: devBatch.id,
      player_type_id: development.id,
      package_id: devMonthly.id,
      parent_email: "ishaan.parent@example.com",
      father_name: "Manoj Gupta",
      is_checked_in: false,
    },
  ];

  const { data: players, error: playerError } = await supabase
    .from("players")
    .insert(
      playerRows.map((p) => ({
        centre_id: centre.id,
        created_by: centreAdmin.id,
        gender: "Male",
        blood_group: "O+",
        ...p,
      }))
    )
    .select("id, name, batch_id, parent_email");
  if (playerError) throw playerError;

  const arjun = players!.find((p) => p.name === "Arjun Mehta")!;
  const aditya = players!.find((p) => p.name === "Aditya Rao")!;
  const eliteBatchPlayers = players!.filter((p) => p.batch_id === eliteBatch.id);
  const devBatchPlayers = players!.filter((p) => p.batch_id === devBatch.id);

  // ---- player_batches: mirrors each player's primary batch_id above.
  // Coach-facing rosters (attendance, 5S, injuries) read from this table,
  // not players.batch_id directly — see the player_batches migration.
  const { error: playerBatchError } = await supabase.from("player_batches").insert(
    players!.map((p) => ({ player_id: p.id, batch_id: p.batch_id!, centre_id: centre.id }))
  );
  if (playerBatchError) throw playerBatchError;

  // ---- parent <-> player links (Test Parent has two children) ----
  const { error: linkError } = await supabase.from("parent_player_links").insert([
    { parent_id: parent.id, player_id: arjun.id, centre_id: centre.id },
    { parent_id: parent.id, player_id: aditya.id, centre_id: centre.id },
  ]);
  if (linkError) throw linkError;

  // ---- payments: 3 months of history per player ----
  const paymentRows = players!.flatMap((p) =>
    [0, 1, 2].map((monthsBack) => ({
      centre_id: centre.id,
      player_id: p.id,
      package_id: eliteBatchPlayers.includes(p) ? eliteMonthly.id : devMonthly.id,
      amount: eliteBatchPlayers.includes(p) ? 3500 : 2500,
      payment_date: monthsAgo(monthsBack, 5),
      notes: "Monthly fee",
      recorded_by: centreAdmin.id,
    }))
  );
  const { error: paymentError } = await supabase.from("payments").insert(paymentRows);
  if (paymentError) throw paymentError;

  // ---- gate pass logs: a few check-ins/outs over the last few days ----
  const gatePassRows = [
    { player_id: eliteBatchPlayers[0].id, action: "check_in" as const, reason: "Morning training session", daysBack: 0 },
    { player_id: eliteBatchPlayers[1].id, action: "check_in" as const, reason: "Morning training session", daysBack: 0 },
    { player_id: eliteBatchPlayers[0].id, action: "check_out" as const, reason: "Session completed", daysBack: 0 },
    { player_id: devBatchPlayers[0].id, action: "check_in" as const, reason: "Evening training session", daysBack: 1 },
    { player_id: devBatchPlayers[1].id, action: "check_in" as const, reason: "Evening training session", daysBack: 1 },
    { player_id: devBatchPlayers[1].id, action: "check_out" as const, reason: "Picked up by parent", daysBack: 1 },
  ];
  const { error: gateError } = await supabase.from("gate_pass_logs").insert(
    gatePassRows.map((g) => ({
      player_id: g.player_id,
      centre_id: centre.id,
      action: g.action,
      reason: g.reason,
      performed_by: centreAdmin.id,
      created_at: new Date(Date.now() - g.daysBack * 86400000).toISOString(),
    }))
  );
  if (gateError) throw gateError;

  // ---- attendance: last 7 days for both batches ----
  const attendanceRows: {
    batch_id: string;
    player_id: string;
    attendance_date: string;
    status: "present" | "absent";
    marked_by: string;
  }[] = [];
  for (let d = 0; d < 7; d++) {
    const date = daysAgo(d);
    for (const p of eliteBatchPlayers) {
      attendanceRows.push({
        batch_id: eliteBatch.id,
        player_id: p.id,
        attendance_date: date,
        status: Math.random() > 0.15 ? "present" : "absent",
        marked_by: coach.id,
      });
    }
    for (const p of devBatchPlayers) {
      attendanceRows.push({
        batch_id: devBatch.id,
        player_id: p.id,
        attendance_date: date,
        status: Math.random() > 0.15 ? "present" : "absent",
        marked_by: coach.id,
      });
    }
  }
  const { error: attendanceError } = await supabase.from("attendance").insert(attendanceRows);
  if (attendanceError) throw attendanceError;

  // ---- injuries ----
  const { error: injuryError } = await supabase.from("injuries").insert([
    {
      player_id: eliteBatchPlayers[2].id,
      centre_id: centre.id,
      date_of_injury: daysAgo(3),
      activity_type: "Training",
      body_region: "Ankle",
      nature: "Sprain",
      cause: "Landed awkwardly during a drill",
      treating_person: "Test Medical",
      initial_treatment: "Ice, compression, rest",
      description: "Mild grade 1 ankle sprain during agility drills.",
      reported_by: medical.id,
    },
    {
      player_id: devBatchPlayers[2].id,
      centre_id: centre.id,
      date_of_injury: daysAgo(10),
      activity_type: "Match",
      body_region: "Knee",
      nature: "Bruise",
      cause: "Collision with another player",
      treating_person: "Test Medical",
      initial_treatment: "Ice pack applied, monitored for swelling",
      description: "Minor bruising, no swelling after 48 hours.",
      reported_by: medical.id,
    },
  ]);
  if (injuryError) throw injuryError;

  console.log("Mock data seeded successfully:");
  console.log(`- Centre: ${centre.name}`);
  console.log(`- ${playerTypes!.length} player types, ${ageCategories!.length} age categories, ${packages!.length} packages`);
  console.log(`- ${batches!.length} batches (head coach: coach@impetus.local)`);
  console.log(`- ${players!.length} players (${paymentRows.length} payments, ${attendanceRows.length} attendance records)`);
  console.log(`- Test Parent (parent@impetus.local) linked to: Arjun Mehta, Aditya Rao`);
  console.log(`- 2 injury reports, 6 gate pass log entries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
