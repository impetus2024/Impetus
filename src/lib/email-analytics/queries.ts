import "server-only";
import { createClient } from "@/lib/supabase/server";
import { pageRange } from "@/lib/pagination";
import type { Database } from "@/lib/supabase/database.types";

export type EmailStatus = Database["public"]["Enums"]["email_status"];

export type EmailAnalyticsSummary = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
};

const EMPTY_SUMMARY: EmailAnalyticsSummary = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  failed: 0,
  complained: 0,
  deliveryRate: 0,
  openRate: 0,
  clickRate: 0,
  bounceRate: 0,
};

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

// centreId always comes from the caller having already resolved it from the
// authenticated session (centre_admin) or an explicit super_admin selection
// (see the two page.tsx call sites) — never accepted here from raw request
// input. email_analytics_summary itself runs security invoker (see its
// migration), so RLS on email_logs backstops this even if a caller ever got
// that wrong.
export async function getEmailAnalyticsSummary(
  centreId: string,
  since: Date,
  until: Date
): Promise<EmailAnalyticsSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("email_analytics_summary", {
      p_centre_id: centreId,
      p_since: since.toISOString(),
      p_until: until.toISOString(),
    })
    .single();

  if (error || !data) return EMPTY_SUMMARY;

  const sent = data.sent_count;
  const delivered = data.delivered_count;
  const opened = data.opened_count;
  const clicked = data.clicked_count;
  const bounced = data.bounced_count;

  return {
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    failed: data.failed_count,
    complained: data.complained_count,
    deliveryRate: rate(delivered, sent),
    // Open/click rate relative to delivered (not sent) — the standard email
    // metric convention, since an email that never arrived can't be opened.
    openRate: rate(opened, delivered),
    clickRate: rate(clicked, delivered),
    bounceRate: rate(bounced, sent),
  };
}

export type EmailLogListItem = {
  id: string;
  recipient_email: string;
  subject: string | null;
  status: EmailStatus;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
};

export type EmailLogSortColumn =
  | "sent_at"
  | "delivered_at"
  | "opened_at"
  | "clicked_at"
  | "recipient_email"
  | "status"
  | "open_count"
  | "click_count";

const SORTABLE_COLUMNS = new Set<string>([
  "sent_at",
  "delivered_at",
  "opened_at",
  "clicked_at",
  "recipient_email",
  "status",
  "open_count",
  "click_count",
]);

export function isEmailLogSortColumn(value: string | undefined): value is EmailLogSortColumn {
  return value !== undefined && SORTABLE_COLUMNS.has(value);
}

export async function getEmailLogs(
  centreId: string,
  params: {
    q?: string;
    since: Date;
    until: Date;
    sort: EmailLogSortColumn;
    dir: "asc" | "desc";
    page: number;
  }
): Promise<{ logs: EmailLogListItem[]; count: number }> {
  const supabase = await createClient();
  const [from, to] = pageRange(params.page);

  let query = supabase
    .from("email_logs")
    .select(
      "id, recipient_email, subject, status, sent_at, delivered_at, opened_at, open_count, clicked_at, click_count",
      { count: "exact" }
    )
    .eq("centre_id", centreId)
    .gte("sent_at", params.since.toISOString())
    .lt("sent_at", params.until.toISOString());

  if (params.q) query = query.ilike("recipient_email", `%${params.q}%`);

  query = query
    .order(params.sort, { ascending: params.dir === "asc" })
    .range(from, to);

  const { data, count } = await query;
  return { logs: data ?? [], count: count ?? 0 };
}

export type EmailLogDetail = EmailLogListItem & {
  email_type: string;
  bounced_at: string | null;
  failed_at: string | null;
  complained_at: string | null;
  error_message: string | null;
};

// Scoped by centreId AND id together — a centre_admin's centreId always
// comes from their own session, so this can never return another centre's
// row; a super_admin's centreId is whichever centre is currently selected in
// the UI, so a detail link only ever points at a row from that same centre's
// list in the first place.
export async function getEmailLogDetail(centreId: string, id: string): Promise<EmailLogDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_logs")
    .select(
      "id, recipient_email, subject, email_type, status, sent_at, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, failed_at, complained_at, error_message"
    )
    .eq("centre_id", centreId)
    .eq("id", id)
    .maybeSingle();

  return data;
}
