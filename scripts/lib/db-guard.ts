// Shared safety gate for every script that writes to the database
// (seed-*.ts today). Import this — never duplicate environment detection
// or the refusal logic in individual scripts.
//
// Detection rule: NEXT_PUBLIC_SUPABASE_URL's hostname tells us local
// (127.0.0.1/localhost, from `supabase start`) vs a hosted *.supabase.co
// project. A hosted project can't be told apart from its URL alone — Supabase
// Cloud has no separate "staging" subdomain — so preview/staging is only
// ever recognized via SUPABASE_ENV/VERCEL_ENV being explicitly set to
// "preview"; anything hosted and not explicitly marked preview is treated
// as production, the safe-by-default assumption.

export type DbEnvironment = "local" | "preview" | "production" | "unknown";

export interface DbTarget {
  environment: DbEnvironment;
  url: string;
  projectRef: string;
}

function detectEnvironment(url: string): DbEnvironment {
  if (!url) return "unknown";
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return "unknown";
  }
  if (hostname === "127.0.0.1" || hostname === "localhost") return "local";
  if (hostname.endsWith(".supabase.co")) {
    if (process.env.SUPABASE_ENV === "preview" || process.env.VERCEL_ENV === "preview") {
      return "preview";
    }
    return "production";
  }
  return "unknown";
}

function extractProjectRef(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "unknown";
  }
}

export function resolveDbTarget(): DbTarget {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const environment = detectEnvironment(url);
  const projectRef = environment === "local" ? "local" : extractProjectRef(url);
  return { environment, url, projectRef };
}

export function printDbTarget(target: DbTarget, scriptName: string): void {
  console.log(`\n[${scriptName}] Target environment: ${target.environment.toUpperCase()}`);
  console.log(`[${scriptName}] Project URL:         ${target.url || "(not set)"}`);
  console.log(`[${scriptName}] Project ref:         ${target.projectRef}\n`);
}

/**
 * Call this first, before any database write. Refuses to continue unless the
 * target is local, or the caller has deliberately opted in with BOTH
 * ALLOW_REMOTE_DB=true and --allow-remote — two independent signals so a
 * single stray env var left set in a shell can't silently unlock this.
 */
export function assertLocalOrConfirmed(scriptName: string): DbTarget {
  const target = resolveDbTarget();
  printDbTarget(target, scriptName);

  if (target.environment === "local") return target;

  const envOverride = process.env.ALLOW_REMOTE_DB === "true";
  const cliOverride = process.argv.includes("--allow-remote");

  if (envOverride && cliOverride) {
    console.warn(
      `[${scriptName}] WARNING: running against a ${target.environment.toUpperCase()} database ` +
        `(${target.projectRef}). ALLOW_REMOTE_DB=true and --allow-remote were both set — proceeding.\n`
    );
    return target;
  }

  console.error(
    `[${scriptName}] REFUSING TO RUN: this script writes to the database, and the target is ` +
      `"${target.environment}", not local.\n` +
      `  Project URL: ${target.url || "(not set)"}\n` +
      `  Project ref: ${target.projectRef}\n\n` +
      `If you mean to run this against that project on purpose, set ALLOW_REMOTE_DB=true AND pass ` +
      `--allow-remote. Never do this against production.\n`
  );
  process.exit(1);
}

export function isDryRun(): boolean {
  return process.argv.includes("--dry-run");
}
