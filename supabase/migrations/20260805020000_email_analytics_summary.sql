-- Backs the Centre Admin / Super Admin Email Analytics dashboards. Same
-- reasoning as payments_by_month: counting sent/delivered/opened/clicked/
-- bounced/failed/complained for a date range is a single-pass aggregate --
-- doing it by pulling every email_logs row for the window into JS and
-- counting there would transfer every row over the wire for no reason.
--
-- Counts come from the per-event timestamp columns (delivered_at is not
-- null, etc.), not the `status` column -- status is only the *current*
-- state (see email_logs's own migration comment), so counting by status
-- would undercount e.g. "Delivered" for any email that was later opened
-- (status has since moved on to 'opened').
--
-- security invoker (the default) deliberately, not definer -- matching
-- payments_by_month: this runs as the calling user, so the existing RLS
-- policies on email_logs ("centre_admin views own centre email_logs" /
-- "super_admin full access to email_logs") still scope the result exactly
-- as a direct select would. p_centre_id is an additional, explicit filter
-- on top of that -- not a substitute for it -- so a bug in how a caller
-- resolves p_centre_id still can't leak another centre's counts.
create or replace function public.email_analytics_summary(
  p_centre_id uuid,
  p_since timestamptz,
  p_until timestamptz
) returns table (
  sent_count bigint,
  delivered_count bigint,
  opened_count bigint,
  clicked_count bigint,
  bounced_count bigint,
  failed_count bigint,
  complained_count bigint
)
language sql
stable
as $$
  select
    count(*) filter (where sent_at is not null) as sent_count,
    count(*) filter (where delivered_at is not null) as delivered_count,
    count(*) filter (where opened_at is not null) as opened_count,
    count(*) filter (where clicked_at is not null) as clicked_count,
    count(*) filter (where bounced_at is not null) as bounced_count,
    count(*) filter (where failed_at is not null) as failed_count,
    count(*) filter (where complained_at is not null) as complained_count
  from public.email_logs
  where centre_id = p_centre_id
    and sent_at >= p_since
    and sent_at < p_until;
$$;

grant execute on function public.email_analytics_summary(uuid, timestamptz, timestamptz) to authenticated;
