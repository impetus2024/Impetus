-- Adding a player (with a package or custom package) never created a
-- `payments` row, so the dashboard's "Payments" chart and the Payment
-- History page stayed empty until a centre_admin separately used "Add
-- Payment". `is_registration_payment` marks the one payment row that
-- represents a player's package assignment (created alongside the player,
-- kept in sync -- not duplicated -- whenever their package changes later),
-- as opposed to ad-hoc payments recorded from the Payments page. The
-- partial unique index enforces "at most one" at the database level instead
-- of trusting application code alone.
alter table public.payments
  add column is_registration_payment boolean not null default false;

create unique index payments_one_registration_per_player_idx
  on public.payments (player_id)
  where is_registration_payment;

-- Audit trail for package assignment changes on a player (initial
-- assignment at creation, plus every later change from Edit Player / the
-- Parent Profile tab), shown on the player's Package Details section so a
-- centre_admin can see when and what changed. Snapshots old/new package
-- name + amount as plain columns rather than package_id FKs: a custom
-- package is updated in place (see resolvePackageId in players/actions.ts),
-- so an old package_id would just show today's values instead of what was
-- true at the time of the change.
create table public.package_change_logs (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  old_package_name text,
  old_amount numeric(10, 2),
  new_package_name text,
  new_amount numeric(10, 2),
  changed_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index package_change_logs_player_id_idx on public.package_change_logs (player_id);
create index package_change_logs_centre_id_created_at_idx on public.package_change_logs (centre_id, created_at);

alter table public.package_change_logs enable row level security;

create policy "super_admin full access to package_change_logs" on public.package_change_logs
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre package_change_logs" on public.package_change_logs
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre package_change_logs" on public.package_change_logs
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

grant select, insert, update, delete on public.package_change_logs to authenticated, service_role;
