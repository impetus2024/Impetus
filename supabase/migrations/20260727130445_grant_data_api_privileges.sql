-- Newer Supabase projects no longer auto-expose newly created public-schema
-- tables to the Data API roles (anon/authenticated/service_role) — GRANTs
-- must be explicit. Row-level access is still fully controlled by the RLS
-- policies from the previous migration; these GRANTs only unlock the table
-- for the Data API, PostgREST enforces both.
--
-- anon is intentionally left out: every screen in this app requires sign-in,
-- so anon only ever calls Auth endpoints, never queries these tables.

grant select, insert, update, delete on
  public.centres,
  public.profiles,
  public.staff_profiles,
  public.player_types,
  public.age_categories,
  public.batches,
  public.packages,
  public.players,
  public.parent_player_links,
  public.gate_pass_logs,
  public.payments,
  public.attendance,
  public.injuries
to authenticated, service_role;

-- Future tables created in public should get the same grants automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

-- private.user_role()/private.user_centre_id() (used by nearly every RLS
-- policy) are unreachable for authenticated/service_role without this:
-- CREATE SCHEMA never grants USAGE to anyone but the owner. Without it,
-- calling these functions fails with "permission denied for schema
-- private" — and because that failure happens *while Postgres is
-- evaluating a table's RLS policy*, it surfaces to PostgREST as the far
-- more confusing "infinite recursion detected in policy for relation ..."
-- instead of the actual permission error.
grant usage on schema private to authenticated, service_role;
