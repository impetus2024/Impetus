// Wrapper around the Supabase CLI for the two operations that write to
// whatever project is currently linked (`db push`, `db reset --linked`) and
// the operation that decides which project that is (`link`). Run only via
// the npm scripts in package.json — never call `supabase db push` or
// `supabase link` directly, so this gate can't be skipped by habit.
//
// `db reset` without `--linked` (the everyday local workflow) is NOT gated
// here — it only ever touches the local Docker Postgres instance and is
// safe by default; call the Supabase CLI directly for that.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function getLinkedProjectRef(): string | null {
  const refPath = join(process.cwd(), "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) return null;
  return readFileSync(refPath, "utf8").trim();
}

function run(args: string[]): never {
  const result = spawnSync("npx", ["supabase", ...args], { stdio: "inherit", shell: true });
  process.exit(result.status ?? 1);
}

function guardLink(args: string[]): void {
  const refFlagIndex = args.indexOf("--project-ref");
  const targetRef = refFlagIndex >= 0 ? args[refFlagIndex + 1] : "(unspecified — CLI will prompt)";
  console.log(`\n[supabase-guard] About to LINK this repo to project: ${targetRef}`);
  console.log(`[supabase-guard] Every subsequent \`db push\` targets whatever project is linked.\n`);

  if (!args.includes("--yes")) {
    console.error(
      `[supabase-guard] Refusing: re-run with --yes appended once you've confirmed "${targetRef}" ` +
        `is the project you mean to link (check it's not production unless that's intentional).`
    );
    process.exit(1);
  }
  run(args.filter((a) => a !== "--yes"));
}

function guardLinkedWrite(args: string[]): void {
  const linkedRef = getLinkedProjectRef();
  console.log(`\n[supabase-guard] About to run: supabase ${args.join(" ")}`);
  console.log(`[supabase-guard] Currently linked project ref: ${linkedRef ?? "(not linked)"}\n`);

  if (!linkedRef) {
    console.error("[supabase-guard] Refusing: no linked project found. Run `npm run supabase:link` first.");
    process.exit(1);
  }

  const confirmFlagIndex = args.indexOf("--confirm-ref");
  const typedRef = confirmFlagIndex >= 0 ? args[confirmFlagIndex + 1] : undefined;

  if (typedRef !== linkedRef) {
    console.error(
      `[supabase-guard] Refusing: this command writes to the LINKED project (${linkedRef}), which may ` +
        `be production.\nTo proceed on purpose, re-run with "--confirm-ref ${linkedRef}" appended — ` +
        `typing the ref yourself confirms you mean it, not just a copy-pasted flag.`
    );
    process.exit(1);
  }

  run(args.filter((a, i) => a !== "--confirm-ref" && args[i - 1] !== "--confirm-ref"));
}

function main() {
  const args = process.argv.slice(2);
  const [group, sub] = args;

  if (group === "link") {
    guardLink(args);
    return;
  }

  if (group === "db" && (sub === "push" || (sub === "reset" && args.includes("--linked")))) {
    guardLinkedWrite(args);
    return;
  }

  // Anything else passed through this wrapper (shouldn't normally happen —
  // package.json only wires the two gated cases above) — run unguarded
  // rather than silently no-op.
  run(args);
}

main();
