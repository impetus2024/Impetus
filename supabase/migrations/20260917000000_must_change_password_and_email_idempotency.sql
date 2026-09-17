-- Two additive changes, both supporting the transactional-email hardening
-- in src/lib/email/send.ts and the temporary-credential flow in
-- src/lib/auth/provision-user.ts. Nothing existing is dropped, rewritten or
-- recalculated: both columns are new and nullable/defaulted, so every row
-- that exists today keeps its current meaning.

-- 1. profiles.must_change_password
--
-- provisionUser/resetUserPassword hand out a randomly generated temporary
-- password (emailed, and in the reset case also shown once to the admin so
-- it can be relayed out of band). Until now nothing forced the recipient to
-- replace it: a temp password that was emailed in clear text stayed a valid
-- long-lived credential forever. This flag is set whenever such a credential
-- is generated and is cleared only by a successful password change made by
-- the account owner (changeOwnPassword, and the /reset-password flow).
--
-- Default false so every existing account is unaffected — this is not a
-- retroactive force-reset of the whole user base.
alter table public.profiles
  add column must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'Set when a temporary password is generated for this account (provisionUser/resetUserPassword). Enforced in verifySession (src/lib/auth/dal.ts), which redirects to /reset-password until it is cleared by a successful password change.';

-- The "centre_admin manages own centre staff" policy on profiles has no FOR
-- clause, so it governs UPDATE for centre_admin over every column of a staff
-- row — including this new one. Clearing the flag from a staff member's row
-- would leave an emailed temporary password valid indefinitely, so the
-- column is locked to service-role writes the same way role/centre_id are
-- locked to super_admin (see 20260731010000_prevent_role_escalation.sql).
--
-- A separate trigger rather than an edit to prevent_role_escalation(): that
-- function is about role/centre escalation, and additive is safer than
-- rewriting a security-relevant function that is already deployed.
--
-- private.user_role() reads app_metadata.role out of the request JWT. The
-- service-role key carries no app_metadata, so it evaluates to NULL there
-- and the flag stays writable from provision-user.ts / the password-change
-- actions, which all use createAdminClient(). Same reasoning as the
-- handle_auth_user_sync carve-out in prevent_role_escalation().
create or replace function public.prevent_must_change_password_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.user_role() is not null
     and new.must_change_password is distinct from old.must_change_password then
    raise exception 'profiles.must_change_password can only be changed server-side.';
  end if;
  return new;
end;
$$;

create trigger prevent_must_change_password_tamper before update on public.profiles
  for each row execute function public.prevent_must_change_password_tamper();

-- 2. email_logs.idempotency_key
--
-- The email-change notification (sendEmailChangedEmail) must go out exactly
-- once per successful change, including when the same form is submitted
-- twice or a Server Action is retried. The send itself is de-duplicated by
-- Resend's own Idempotency-Key header; this column is the durable record of
-- which keys have already been used, so the second attempt can be skipped
-- before it reaches Resend at all.
--
-- Nullable, and the index is partial, because every other email type
-- (account_invite, password_reset) is deliberately re-sendable and writes no
-- key — matching how resend_email_id is indexed in 20260805000000.
alter table public.email_logs
  add column idempotency_key text;

comment on column public.email_logs.idempotency_key is
  'Caller-supplied de-duplication key for emails that must be sent at most once (see sendTransactionalEmail in src/lib/email/send.ts). NULL for re-sendable email types.';

create unique index email_logs_idempotency_key_idx
  on public.email_logs (idempotency_key)
  where idempotency_key is not null;
