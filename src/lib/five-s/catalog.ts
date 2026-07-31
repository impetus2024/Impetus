import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type FiveSTest = Database["public"]["Tables"]["five_s_tests"]["Row"];
type FiveSQuestion = Database["public"]["Tables"]["five_s_questions"]["Row"];

// five_s_tests/five_s_questions are fixed reference data — seeded once by
// migrations, never edited through the app (see their own migration
// comments) — so every coach/parent/centre_admin sees the same rows
// regardless of who's asking. Every 5S page (hub, all 5 category-entry
// pages, the results view, and publish's completeness check) re-queried
// one or both of these on every load; this makes that a cache hit instead
// of a DB round trip. Uses the service-role client deliberately — this
// data has no per-user variance for RLS to scope, and a cached function
// can't depend on the request-scoped cookie-based client anyway.
//
// Total catalog size is small (well under 100 rows combined across both
// tables), so callers that only need one category or a count filter/derive
// it from the full cached list rather than re-querying — cheaper than a
// second round trip once the first is already cached.
export const getFiveSTests = unstable_cache(
  async (): Promise<FiveSTest[]> => {
    const admin = createAdminClient();
    const { data } = await admin.from("five_s_tests").select("*").order("display_order");
    return data ?? [];
  },
  ["five-s-tests-catalog"],
  { revalidate: 3600 }
);

export const getFiveSQuestions = unstable_cache(
  async (): Promise<FiveSQuestion[]> => {
    const admin = createAdminClient();
    const { data } = await admin.from("five_s_questions").select("*").order("display_order");
    return data ?? [];
  },
  ["five-s-questions-catalog"],
  { revalidate: 3600 }
);
