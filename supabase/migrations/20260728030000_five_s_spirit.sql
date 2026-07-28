-- Spirit category: a fixed questionnaire (not a numeric test), organized
-- into sections (Adversity Quotient, Discipline, Personal Hygiene), each
-- question answered on a 4-point frequency scale. Separate tables from
-- five_s_tests/five_s_results since the shape is entirely different
-- (fixed question catalog + single-choice response vs. named test + score).

create type public.five_s_answer_scale as enum ('rarely', 'sometimes', 'frequently', 'always');

create table public.five_s_questions (
  id uuid primary key default gen_random_uuid(),
  category public.five_s_category not null,
  section text not null,
  question text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.five_s_question_responses (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  question_id uuid not null references public.five_s_questions (id) on delete cascade,
  -- Denormalized from players.centre_id, same reasoning as five_s_results.centre_id.
  centre_id uuid not null references public.centres (id) on delete cascade,
  answer public.five_s_answer_scale not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, question_id)
);

create index five_s_question_responses_player_id_idx on public.five_s_question_responses (player_id);
create index five_s_question_responses_centre_id_idx on public.five_s_question_responses (centre_id);

create trigger set_updated_at before update on public.five_s_question_responses
  for each row execute function public.set_updated_at();

alter table public.five_s_questions enable row level security;
alter table public.five_s_question_responses enable row level security;

create policy "authenticated can view five_s_questions" on public.five_s_questions
  for select using (auth.uid() is not null);

create policy "super_admin full access to five_s_question_responses" on public.five_s_question_responses
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre five_s_question_responses" on public.five_s_question_responses
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach manages five_s_question_responses for own batch players" on public.five_s_question_responses
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

create policy "parents view own children's five_s_question_responses" on public.five_s_question_responses
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

grant select, insert, update, delete on public.five_s_questions, public.five_s_question_responses
  to authenticated, service_role;

-- Spirit category question catalog.
insert into public.five_s_questions (category, section, question, display_order) values
  ('spirit', 'Adversity Quotient', 'When his/her team loses a match, he/she keeps practicing and stays focused to do better next time.', 1),
  ('spirit', 'Adversity Quotient', 'Even if he/she makes mistakes during a game, he/she focuses on learning from them and improving his/her skills.', 2),
  ('spirit', 'Adversity Quotient', 'When he/she faces a strong opponent, he/she doesn''t get scared and keeps trying his/her best.', 3),
  ('spirit', 'Adversity Quotient', 'If he/she gets a low mark on a test, he/she asks his/her teacher or classmates for help to understand what he/she did wrong.', 4),
  ('spirit', 'Adversity Quotient', 'When he/she has difficult homework or a project, he/she divides it into smaller parts and does them step by step.', 5),
  ('spirit', 'Adversity Quotient', 'When his/her teacher scolds him/her, he/she takes it as an opportunity to improve his/her behavior.', 6),
  ('spirit', 'Adversity Quotient', 'When he/she has a bad game, his/her family supports and motivates him/her.', 7),
  ('spirit', 'Adversity Quotient', 'When there''s a fight at home, he/she talks calmly with his/her family to find a solution together.', 8),
  ('spirit', 'Adversity Quotient', 'When his/her friend is having a hard time, he/she helps them and listens to what they have to say.', 9),
  ('spirit', 'Adversity Quotient', 'If he/she has a problem with a friend, he/she talks to them to find a solution they both like.', 10),
  ('spirit', 'Discipline', 'He/She only uses his/her phone when he/she is allowed to so that he/she can focus on his/her training and studies.', 11),
  ('spirit', 'Discipline', 'He/She sets aside a specific amount of time every day to study.', 12),
  ('spirit', 'Discipline', 'He/She makes sure to finish his/her homework and submit it on time.', 13),
  ('spirit', 'Discipline', 'After working hard in practice, he/she makes sure to sleep and rest to recover better.', 14),
  ('spirit', 'Discipline', 'Before going to sleep, he/she stops using devices to sleep better.', 15),
  ('spirit', 'Discipline', 'He/She eats healthy food, which gives him/her energy and helps him/her play better.', 16),
  ('spirit', 'Discipline', 'Before he/she submits his/her homework, he/she checks it to make sure it''s right and easy to understand.', 17),
  ('spirit', 'Discipline', 'He/She does not go out often and takes rests instead to perform better in training sessions.', 18),
  ('spirit', 'Discipline', 'When he/she has important football games, he/she spends less time on the phone to stay focused.', 19),
  ('spirit', 'Discipline', 'Instead of social media, he/she watches football and learns to play better.', 20),
  ('spirit', 'Personal Hygiene', 'He/She brushes his/her teeth twice every day.', 21),
  ('spirit', 'Personal Hygiene', 'He/She takes a bath or shower every day.', 22),
  ('spirit', 'Personal Hygiene', 'He/She washes his/her hands before eating.', 23),
  ('spirit', 'Personal Hygiene', 'He/She washes his/her hands after using the toilet.', 24),
  ('spirit', 'Personal Hygiene', 'He/She uses a nail cutter to cut his/her nails instead of biting them.', 25),
  ('spirit', 'Personal Hygiene', 'He/She uses a hand sanitizer when he/she can''t find soap or water to keep his/her hands clean.', 26),
  ('spirit', 'Personal Hygiene', 'He/She washes his/her hair at least twice a week.', 27),
  ('spirit', 'Personal Hygiene', 'He/She gets a clean and short haircut done regularly.', 28),
  ('spirit', 'Personal Hygiene', 'He/She puts lotion on his/her skin to keep it soft and not dry.', 29),
  ('spirit', 'Personal Hygiene', 'He/She uses nice-smelling soap to stay fresh and smell nice all day long.', 30),
  ('spirit', 'Personal Hygiene', 'He/She wears clean clothes every day to school and practice.', 31),
  ('spirit', 'Personal Hygiene', 'He/She cleans his/her football studs every day after practice.', 32),
  ('spirit', 'Personal Hygiene', 'He/She covers his/her wounds with a bandage or dressing to protect them from dirt and germs.', 33),
  ('spirit', 'Personal Hygiene', 'He/She uses a tissue to wipe his/her mouth and hands while eating to stay neat.', 34),
  ('spirit', 'Personal Hygiene', 'He/She wears clean stockings to every practice session.', 35);
