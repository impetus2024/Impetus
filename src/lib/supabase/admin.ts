import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Service-role client: bypasses RLS. Only import from trusted server code
// (Server Actions, Route Handlers, the seed script) — never from anything
// that ships to the client, and never pass this client's queries results
// straight through to the client without checking the caller's own role first.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
