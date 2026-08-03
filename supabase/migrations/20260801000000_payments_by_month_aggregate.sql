-- Performance review: both centre-admin and super-admin dashboards fetched
-- every payments row (amount, payment_date) for the last 6 months just to
-- sum them per month in JS -- transferring every row over the wire and
-- re-scanning that same array once per month (O(6n)) instead of letting
-- Postgres aggregate it in a single GROUP BY. Same duplicated logic existed
-- in both src/app/centre-admin/page.tsx and src/app/super-admin/page.tsx.
--
-- security invoker (the default) deliberately, not definer: this runs as
-- the calling user, so the existing RLS policies on payments ("centre_admin
-- manages own centre payments" / "super_admin full access to payments")
-- still scope the result exactly as a direct select would -- this function
-- doesn't grant any access the caller didn't already have.
create or replace function public.payments_by_month(p_centre_id uuid, p_since date)
returns table(month date, total numeric)
language sql
stable
as $$
  select date_trunc('month', payment_date)::date as month, sum(amount) as total
  from public.payments
  where centre_id = p_centre_id and payment_date >= p_since
  group by 1
  order by 1;
$$;

grant execute on function public.payments_by_month(uuid, date) to authenticated;
