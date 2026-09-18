-- ============================================================================
-- coach_role_lock_security_check.sql - Impetus
--
-- LOCAL-ONLY, ROLLBACK-ONLY verification for the coach role lock added in
-- supabase/migrations/20260918010000_lock_coach_role.sql.
--
-- NOT a migration: it lives in supabase/snippets/, which the Supabase CLI
-- never applies, so `supabase db push` / `db reset` can't pick it up.
--
-- WHAT IT DOES
--   Runs ten probes against the local database's public.profiles trigger
--   (prevent_role_escalation), each mimicking a caller by setting the same
--   request.jwt.claims GUC PostgREST sets from an access token - which is
--   exactly what private.user_role() reads - and records whether the write
--   was refused. Everything runs in ONE transaction that ends in ROLLBACK,
--   so no row is left changed and no user, role or centre is reassigned.
--
-- HOW TO RUN (local Supabase only)
--   docker cp supabase/snippets/coach_role_lock_security_check.sql \
--     supabase_db_Impetus:/tmp/coach_role_lock_check.sql
--   docker exec supabase_db_Impetus psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f /tmp/coach_role_lock_check.sql
--
-- EXPECTED RESULT
--   Ten rows, all with pass = t. Any pass = f is a real regression: read
--   the observed column, it carries the error message the caller actually
--   got (or 'APPLIED (no error)' when the write went through).
--
-- FIXTURES
--   Reads (never writes) the seeded accounts from scripts/seed-test-accounts.ts:
--   centreadmin@impetus.local (centre_admin), coach@impetus.local (coach) and
--   medical@impetus.local (medical), all in one centre. Run
--   `npm run seed:test-accounts` first if they are missing - the probes
--   assert on specific email addresses, so a missing seed shows up as a
--   failed probe rather than as a silent pass.
-- ============================================================================

begin;

create temporary table coach_role_lock_check (
  n serial,
  scenario text,
  expected text,
  observed text,
  pass boolean
) on commit drop;

-- Seeded ids plus the two JWT claim sets the probes need, precomputed once so
-- every probe sets the same request.jwt.claims PostgREST would have set.
create temporary table coach_role_lock_ctx as
select
  ca.id as centre_admin_id,
  ca.centre_id as centre_id,
  c.id as coach_id,
  c.full_name as coach_full_name,
  c.centre_id as coach_centre_id,
  m.id as medical_id,
  jsonb_build_object(
    'sub', ca.id,
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'centre_admin', 'centre_id', ca.centre_id)
  ) as centre_admin_claims,
  jsonb_build_object(
    'sub', c.id,
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'coach', 'centre_id', ca.centre_id)
  ) as coach_claims
from public.profiles ca
cross join public.profiles c
cross join public.profiles m
where ca.email = 'centreadmin@impetus.local'
  and c.email = 'coach@impetus.local'
  and m.email = 'medical@impetus.local';

-- 1. The new control, from the caller the Server Action check already covers.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select centre_admin_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles set role = 'medical' where id = (select coach_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('centre_admin sets coach.role = medical', 'rejected: A coach''s role cannot be changed.',
    v_msg, v_msg = 'A coach''s role cannot be changed.');
end $$;

-- 2. Same caller, escalating the coach instead of demoting.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select centre_admin_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles set role = 'centre_admin' where id = (select coach_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('centre_admin sets coach.role = centre_admin', 'rejected: A coach''s role cannot be changed.',
    v_msg, v_msg = 'A coach''s role cannot be changed.');
end $$;

-- 3. A coach's own token - not a centre_admin, so the pre-existing branch
--    below never fires for it. This is the case the lock exists for.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select coach_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles set role = 'centre_admin' where id = (select coach_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('a coach''s own token sets own role = centre_admin',
    'rejected: A coach''s role cannot be changed.',
    v_msg, v_msg = 'A coach''s role cannot be changed.');
end $$;

-- 4. A coach row is still editable: the lock is on the role, not the account.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select centre_admin_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles set full_name = 'coach lock probe' where id = (select coach_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
    update public.profiles
      set full_name = (select coach_full_name from coach_role_lock_ctx)
      where id = (select coach_id from coach_role_lock_ctx);
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('centre_admin edits coach.full_name (role untouched)',
    'applied: the coach lock is not raised',
    v_msg, v_msg = 'APPLIED (no error)');
end $$;

-- 5. Everything 20260804000000 allowed for non-coach staff still works.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select centre_admin_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles set role = 'staff' where id = (select medical_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
    update public.profiles set role = 'medical' where id = (select medical_id from coach_role_lock_ctx);
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('centre_admin sets medical.role = staff', 'applied (behaviour unchanged)',
    v_msg, v_msg = 'APPLIED (no error)');
end $$;

-- 6. Pre-existing escalation protection: still super_admin-only.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select centre_admin_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles set role = 'super_admin' where id = (select medical_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('centre_admin sets medical.role = super_admin',
    'rejected: Only a super admin can change a profile''s role.',
    v_msg, v_msg = 'Only a super admin can change a profile''s role.');
end $$;

-- 7. Pre-existing centre protection, and proof this change never writes
--    centre_id: still super_admin-only for a centre_admin caller.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select centre_admin_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles
      set centre_id = (select centre_id from coach_role_lock_ctx)
      where id = (select coach_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('centre_admin re-writes coach.centre_id (same value)',
    'applied: re-writing the identical centre is not a change',
    v_msg, v_msg = 'APPLIED (no error)');
end $$;

do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', (select centre_admin_claims::text from coach_role_lock_ctx), true);
  begin
    update public.profiles set centre_id = gen_random_uuid() where id = (select coach_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('centre_admin moves coach to a different centre_id',
    'rejected: Only a super admin can change a profile''s centre.',
    v_msg, v_msg = 'Only a super admin can change a profile''s centre.');
end $$;

-- 8. The carve-out that must survive: with no request JWT at all (GoTrue's
--    own connection and the service-role key both look like this, so
--    private.user_role() is NULL) the trusted server-side path is unaffected.
do $$
declare v_msg text;
begin
  perform set_config('request.jwt.claims', '', true);
  begin
    update public.profiles set role = 'medical' where id = (select coach_id from coach_role_lock_ctx);
    v_msg := 'APPLIED (no error)';
    update public.profiles set role = 'coach' where id = (select coach_id from coach_role_lock_ctx);
  exception when others then
    v_msg := sqlerrm;
  end;
  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('service-role / GoTrue caller (user_role() is null) sets coach.role = medical',
    'applied: the null carve-out is preserved', v_msg, v_msg = 'APPLIED (no error)');
end $$;

-- 9. Nothing above left the fixtures altered: every applied probe restored its
--    own value, and the whole transaction is rolled back below regardless.
do $$
declare v_ok boolean; v_seen text;
begin
  select c.role = 'coach'
         and c.centre_id = ctx.coach_centre_id
         and c.full_name = ctx.coach_full_name
         and m.role = 'medical',
         'coach=' || c.role::text || ', coach_centre=' || c.centre_id::text || ', medical=' || m.role::text
    into v_ok, v_seen
  from coach_role_lock_ctx ctx
  join public.profiles c on c.id = ctx.coach_id
  join public.profiles m on m.id = ctx.medical_id;

  insert into coach_role_lock_check (scenario, expected, observed, pass)
  values ('existing profile data intact after every probe',
    'coach still coach in their own centre, medical still medical',
    v_seen, coalesce(v_ok, false));
end $$;

select n, scenario, expected, observed, pass from coach_role_lock_check order by n;

\echo ''
\echo 'Every row must show pass = t. Rolling back - nothing above is persisted.'
\echo ''

rollback;
