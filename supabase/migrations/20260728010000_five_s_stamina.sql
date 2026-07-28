-- Stamina category: each test (Beep Test, Cooper Test) additionally records
-- a VO2 Max figure and per-test remarks alongside the score, plus one
-- overall remarks note per player/category. Additive nullable columns on
-- five_s_results (used only where a category's test format calls for them)
-- rather than new tables per test — Speed's tests are unaffected.

alter table public.five_s_results
  add column vo2_max numeric(6, 2),
  add column remarks text;

create table public.five_s_category_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  category public.five_s_category not null,
  -- Denormalized from players.centre_id, same reasoning as five_s_results.centre_id.
  centre_id uuid not null references public.centres (id) on delete cascade,
  remarks text not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, category)
);

create index five_s_category_notes_player_id_idx on public.five_s_category_notes (player_id);
create index five_s_category_notes_centre_id_idx on public.five_s_category_notes (centre_id);

create trigger set_updated_at before update on public.five_s_category_notes
  for each row execute function public.set_updated_at();

alter table public.five_s_category_notes enable row level security;

create policy "super_admin full access to five_s_category_notes" on public.five_s_category_notes
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre five_s_category_notes" on public.five_s_category_notes
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach manages five_s_category_notes for own batch players" on public.five_s_category_notes
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select p.id from public.players p
      join public.batches b on b.id = p.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select p.id from public.players p
      join public.batches b on b.id = p.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

create policy "parents view own children's five_s_category_notes" on public.five_s_category_notes
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

grant select, insert, update, delete on public.five_s_category_notes to authenticated, service_role;

-- Stamina category test catalog.
insert into public.five_s_tests (category, name, unit, display_order) values
  ('stamina', 'Beep Test', 'level', 1),
  ('stamina', 'Cooper Test', 'm', 2);
