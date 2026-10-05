-- players.parent_email may only change through updateParentProfile (the
-- Parent Profile "Change email" + Save flow with its intent flag and its
-- updated_at compare-and-swap), and prevent_parent_email_tamper guards every
-- UPDATE. INSERT was deliberately left open — creating a player necessarily
-- sets its parent email — but that opening also swallows a DELETE + re-INSERT
-- of the SAME primary key: a centre_admin holds "FOR ALL" on their own
-- centre's players, so a crafted Data API sequence could delete a player row,
-- insert a replacement carrying the identical id and an arbitrary
-- parent_email, and land an in-place email change no UPDATE trigger ever saw.
--
-- "The client supplied the id" is the whole bypass, so the guard is scoped to
-- exactly that: an authenticated end-user may not supply players.id on INSERT
-- at all. No legitimate flow needs to — createPlayer
-- (src/app/centre-admin/players/actions.ts), the seed scripts and the e2e
-- fixtures all omit it and let the database assign one — and with supplied
-- ids refused, a deleted id can never come back: the primary key already
-- stops reuse of a live id, and this trigger stops reuse of a deleted one.
--
-- To tell "omitted" from "supplied", the column default moves INTO this
-- trigger: with no default an omitted id arrives here as NULL (BEFORE ROW
-- triggers run before the NOT NULL / PRIMARY KEY checks, so assigning it in
-- here is safe), while a supplied id arrives as exactly what the client sent.
--
-- Same carve-out as prevent_parent_email_tamper: private.user_role() reads
-- app_metadata.role from the request JWT, so it is NULL for the service-role
-- key (seeds, e2e fixtures, backfills), for GoTrue, and for direct database
-- sessions (dashboard/SQL editor, restores). Those contexts keep working
-- exactly as before, including supplying an explicit id. Every authenticated
-- Data API request carries a role, and those are the inserts blocked here.
-- DELETE is deliberately untouched: the application has no player-deletion
-- flow, and with ids un-suppliable there is no invariant left for a deletion
-- to break. RLS policies are untouched.
--
-- Additive except for the DROP DEFAULT. Revert with:
--   alter table public.players alter column id set default gen_random_uuid();
--   drop trigger prevent_player_id_reinsert on public.players;
--   drop function public.prevent_player_id_reinsert();
create or replace function public.prevent_player_id_reinsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  elsif private.user_role() is not null then
    raise exception 'players.id cannot be supplied on insert; let the database assign it.';
  end if;
  return new;
end;
$$;

alter table public.players alter column id drop default;

create trigger prevent_player_id_reinsert before insert on public.players
  for each row execute function public.prevent_player_id_reinsert();
