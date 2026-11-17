// Wrapper around the Supabase CLI for the operations that write to whatever
// project is currently linked (`db push`, `db reset --linked`) and the
// operation that decides which project that is (`link`). Run only via the
// npm scripts in package.json — never call `supabase db push` or
// `supabase link` directly, so this gate can't be skipped by habit.
//
// Allow-list only: `link`, `db push`, `db reset`. Every other command is
// refused. `db reset --linked` is HARD-BLOCKED for any project in
// PRODUCTION_PROJECT_REFS — no flag overrides that. `--db-url` is refused for
// push/reset because it would bypass the linked-project check entirely.
//
// `db reset` without `--linked` (the everyday local workflow) only touches the
// local Docker Postgres instance and passes through.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Supabase project refs that must never be reset. Add a ref here when a new
// production project is created.
export const PRODUCTION_PROJECT_REFS: readonly string[] = ["hgxljbhxuquclnfmgzws"];

export type GuardDecision =
  | { action: "run"; args: string[] }
  | { action: "refuse"; reason: string };

const refuse = (reason: string): GuardDecision => ({ action: "refuse", reason });

// Matches `--flag` and `--flag=value` (cobra accepts `--linked=true`).
const hasFlag = (args: string[], flag: string) =>
  args.some((a) => a === flag || a.startsWith(`${flag}=`));

function getLinkedProjectRef(): string | null {
  const refPath = join(process.cwd(), "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) return null;
  return readFileSync(refPath, "utf8").trim();
}

function decideLink(args: string[]): GuardDecision {
  const refFlagIndex = args.indexOf("--project-ref");
  const targetRef = refFlagIndex >= 0 ? args[refFlagIndex + 1] : "(unspecified — CLI will prompt)";
  if (!args.includes("--yes")) {
    return refuse(
      `Refusing: re-run with --yes appended once you've confirmed "${targetRef}" ` +
        `is the project you mean to link (check it's not production unless that's intentional).`
    );
  }
  return { action: "run", args: args.filter((a) => a !== "--yes") };
}

function decideLinkedWrite(args: string[], linkedRef: string | null): GuardDecision {
  if (!linkedRef) {
    return refuse("Refusing: no linked project found. Run `npm run supabase:link` first.");
  }

  if (args[1] === "reset" && PRODUCTION_PROJECT_REFS.includes(linkedRef)) {
    return refuse(
      `BLOCKED: \`db reset --linked\` would wipe the PRODUCTION project (${linkedRef}). ` +
        `This is hard-blocked and cannot be overridden with --confirm-ref. Link a non-production ` +
        `project first, or restore from backup (docs/BACKUP_RECOVERY.md).`
    );
  }

  const confirmIndex = args.indexOf("--confirm-ref");
  const typedRef = confirmIndex >= 0 ? args[confirmIndex + 1] : undefined;
  if (typedRef !== linkedRef) {
    return refuse(
      `Refusing: this command writes to the LINKED project (${linkedRef}), which may ` +
        `be production.\nTo proceed on purpose, re-run with "--confirm-ref ${linkedRef}" appended — ` +
        `typing the ref yourself confirms you mean it, not just a copy-pasted flag.`
    );
  }

  return { action: "run", args: args.filter((a, i) => a !== "--confirm-ref" && args[i - 1] !== "--confirm-ref") };
}

export function decide(args: string[], linkedRef: string | null): GuardDecision {
  const [group, sub] = args;

  if (group === "link") return decideLink(args);

  if (group === "db" && (sub === "push" || sub === "reset")) {
    if (hasFlag(args, "--db-url")) {
      return refuse("Refusing: --db-url bypasses the linked-project check and is not allowed here.");
    }
    if (sub === "push" || hasFlag(args, "--linked")) return decideLinkedWrite(args, linkedRef);
    return { action: "run", args }; // plain local `db reset`
  }

  return refuse(
    `Refusing: "${args.join(" ") || "(no command)"}" is not an allowed command. ` +
      `Allowed: link, db push, db reset. Call the Supabase CLI directly for read-only commands.`
  );
}

function main() {
  const args = process.argv.slice(2);
  const linkedRef = getLinkedProjectRef();
  console.log(`\n[supabase-guard] supabase ${args.join(" ")}  (linked: ${linkedRef ?? "none"})\n`);

  const decision = decide(args, linkedRef);
  if (decision.action === "refuse") {
    console.error(`[supabase-guard] ${decision.reason}`);
    process.exit(1);
  }
  const result = spawnSync("npx", ["supabase", ...decision.args], { stdio: "inherit", shell: true });
  process.exit(result.status ?? 1);
}

if (require.main === module) main();
