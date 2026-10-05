import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// players.parent_email may only change through updateParentProfile — the
// Parent Profile flow that requires the parentEmailChange intent flag, scopes
// the write to this centre and this player, and wins the updated_at
// compare-and-swap. The database trigger (prevent_parent_email_tamper)
// deliberately exempts the service-role key — it cannot tell one server-side
// write from another — so for application code THIS guard is the missing
// enforcement: a service-role mutation of players.parent_email that does not
// opt in throws instead of silently bypassing the workflow. Exactly one call
// site passes the opt-in: updateParentProfile's final write
// (src/app/centre-admin/players/actions.ts), which is already gated by
// requireRole("centre_admin"), the intent flag and the version check. Every
// other application use of this client that reaches players is a read.
export interface AdminClientOptions {
  // Reserved for the Parent Profile email-change flow. Do not pass this
  // anywhere else — it is what allows a service-role write to
  // players.parent_email to leave the database at all.
  allowParentEmailWrite?: boolean;
}

// Any payload shape carrying the protected column — single row, batch array,
// or an embedded child row — counts as a write to it.
function payloadWritesParentEmail(payload: unknown, depth = 0): boolean {
  if (depth > 4 || payload === null || typeof payload !== "object") return false;
  if (Array.isArray(payload)) return payload.some((row) => payloadWritesParentEmail(row, depth + 1));
  return Object.entries(payload).some(
    ([key, value]) => key === "parent_email" || payloadWritesParentEmail(value, depth + 1)
  );
}

// Wraps insert/update/upsert on the players table's query builder so a
// payload carrying parent_email throws before any request is sent. The
// wrapped methods return the underlying builder's own result, so every
// existing chain (… .update().eq().select()) keeps working unchanged;
// non-players tables and read builders pass straight through.
function guardPlayersParentEmailWrites<T>(builder: T): T {
  const methods = builder as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>;
  for (const name of ["insert", "update", "upsert"]) {
    const original = methods[name];
    if (typeof original !== "function") continue;
    const bound = original.bind(builder);
    methods[name] = (...args: unknown[]) => {
      if (payloadWritesParentEmail(args[0])) {
        throw new Error(
          "Blocked: players.parent_email may only be written by updateParentProfile's explicit " +
            "Parent Profile email-change flow (createAdminClient({ allowParentEmailWrite: true }))."
        );
      }
      return bound(...args);
    };
  }
  return builder;
}

// Service-role client: bypasses RLS. Only import from trusted server code
// (Server Actions, Route Handlers, the seed script) — never from anything
// that ships to the client, and never pass this client's queries results
// straight through to the client without checking the caller's own role first.
export function createAdminClient(options: AdminClientOptions = {}) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  if (!options.allowParentEmailWrite) {
    // The instance property shadows PostgrestClient.from; typing the
    // replacement against the full generic signature drags Postgrest's
    // conditional types into an infinite instantiation, so the assignment
    // goes through a structural view while the client keeps its declared type.
    const originalFrom = client.from.bind(client) as (table: never) => unknown;
    const structural = client as unknown as Record<string, unknown>;
    structural["from"] = (table: string) => {
      const builder = originalFrom(table as never);
      return table === "players" ? guardPlayersParentEmailWrites(builder) : builder;
    };
  }

  return client;
}

