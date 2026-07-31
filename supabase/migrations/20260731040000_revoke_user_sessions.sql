-- Penetration test finding: neither the self-service password reset nor
-- the admin-triggered one (resetUserPassword) invalidated the target
-- user's existing sessions. Confirmed exploitable: a live access token
-- obtained before the reset kept working against authenticated queries
-- after the password was changed specifically to lock that access out.
--
-- supabase-js's admin API only exposes signOut(jwt, scope) — it needs the
-- session's own JWT, which an admin resetting someone else's password
-- never has. There is no supported client-side call for "revoke every
-- session belonging to user X". This function does it directly against
-- GoTrue's own session/refresh-token tables (auth.sessions,
-- auth.refresh_tokens) via security definer.
--
-- Caveat that no amount of DB-side revocation removes: this app's own
-- session check (verifySession -> getClaims) is a local, stateless JWT
-- signature check by design (no DB round trip, see src/lib/auth/dal.ts) —
-- so an *already-issued* access token stays valid until its own natural
-- expiry (jwt_expiry in supabase/config.toml, currently 3600s) regardless
-- of what happens server-side. This function closes the bigger half of
-- the gap (the session can no longer be refreshed, and any check that
-- does hit Supabase's own servers — e.g. getUser() — will see it as
-- revoked immediately) but does not achieve instant revocation of a
-- token already in an attacker's hands. Achieving that would mean
-- switching every request's auth check from getClaims() to getUser()
-- (a network round trip per request) or drastically shortening
-- jwt_expiry — both bigger, unrelated tradeoffs, called out here rather
-- than made silently.
create or replace function public.revoke_user_sessions(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.sessions where user_id = target_user_id;
  delete from auth.refresh_tokens where user_id = target_user_id::text;
end;
$$;

-- Deliberately not granted to authenticated/anon — this must only ever be
-- called with the service-role key (see resetUserPassword), never by a
-- logged-in user on their own behalf or anyone else's.
revoke all on function public.revoke_user_sessions(uuid) from public;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
