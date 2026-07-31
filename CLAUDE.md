@AGENTS.md

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## Database Safety (permanent, non-negotiable)

**Always assume the connected database may be production.** This app's only environment signal
is `NEXT_PUBLIC_SUPABASE_URL` — a hosted `*.supabase.co` project is treated as production unless
proven otherwise. Every script that writes to the database (`scripts/seed-*.ts`) calls
`assertLocalOrConfirmed()` from `scripts/lib/db-guard.ts` for exactly this reason — never bypass,
duplicate, or work around that check.

**Never execute destructive SQL or CLI commands automatically, even when asked to "just run it."**
This includes, without exception, unless the user has explicitly confirmed the target is local or
has explicitly authorized a specific remote run in the same conversation:

- `supabase db reset` / `supabase db reset --linked`
- `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE`, bare `DELETE FROM` without a `WHERE` a human reviewed
- Destructive or non-additive migrations (dropping/altering existing columns, tables, policies)
- Any `scripts/seed-*.ts` script, or any script under `scripts/`, against a non-local target
- `supabase link` to a project without the user naming which project and why

**Before any database mutation, in this order:**

1. Determine the target environment — read `NEXT_PUBLIC_SUPABASE_URL` (or run the relevant
   script's own guard, which prints environment/URL/project ref before doing anything).
2. Display that target information to the user.
3. If the environment is not local, stop and get the user's explicit, specific confirmation before
   proceeding — a prior approval for a different action does not carry over.

**Tooling that enforces this today** (extend it, don't route around it, when adding new
database-writing scripts):

- `scripts/lib/db-guard.ts` — shared environment detection + refusal, used by every seed script.
  Supports `--dry-run` and requires both `ALLOW_REMOTE_DB=true` and `--allow-remote` to target
  anything non-local.
- `scripts/lib/supabase-guard.ts` — wraps `supabase db push`, `supabase db reset --linked`, and
  `supabase link`; run these only via `npm run db:push` / `npm run db:reset:linked` /
  `npm run supabase:link`, never by calling the Supabase CLI for those three operations directly.
- `e2e/helpers.ts`'s `assertSafeE2ETarget()` — refuses to run data-mutating Playwright specs
  (`auth.spec.ts`, `workflows.spec.ts`) against a non-local `PLAYWRIGHT_BASE_URL` unless
  `ALLOW_REMOTE_E2E=true` is set for a dedicated staging target.

See `docs/DEPLOYMENT.md` (safe deploy/migration workflow), `docs/BACKUP_RECOVERY.md` (cascade
delete blast radius, restore process), and `e2e/README.md` (safe E2E workflow) for the full
picture.
