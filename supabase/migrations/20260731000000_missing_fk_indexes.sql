-- Every foreign key column below had no covering index (Postgres never
-- auto-indexes the referencing side of an FK, only the referenced PK).
-- parent_player_links is the highest-impact one: it's subquery'd inside
-- the "parents view own children's ..." RLS policy on attendance,
-- five_s_results, five_s_category_notes, five_s_group_notes,
-- five_s_question_responses, gate_pass_logs, injuries, and payments — every
-- one of those was a sequential scan of this table on every parent-role
-- request.

create index if not exists parent_player_links_parent_id_idx on public.parent_player_links (parent_id);
create index if not exists parent_player_links_player_id_idx on public.parent_player_links (player_id);
create index if not exists parent_player_links_centre_id_idx on public.parent_player_links (centre_id);

create index if not exists age_categories_centre_id_idx on public.age_categories (centre_id);
create index if not exists player_types_centre_id_idx on public.player_types (centre_id);

create index if not exists attendance_marked_by_idx on public.attendance (marked_by);

create index if not exists five_s_results_test_id_idx on public.five_s_results (test_id);
create index if not exists five_s_results_recorded_by_idx on public.five_s_results (recorded_by);
create index if not exists five_s_category_notes_recorded_by_idx on public.five_s_category_notes (recorded_by);
create index if not exists five_s_group_notes_recorded_by_idx on public.five_s_group_notes (recorded_by);
create index if not exists five_s_question_responses_question_id_idx on public.five_s_question_responses (question_id);
create index if not exists five_s_question_responses_recorded_by_idx on public.five_s_question_responses (recorded_by);

create index if not exists gate_pass_logs_performed_by_idx on public.gate_pass_logs (performed_by);
create index if not exists injuries_reported_by_idx on public.injuries (reported_by);

create index if not exists payments_package_id_idx on public.payments (package_id);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by);

create index if not exists packages_player_type_id_idx on public.packages (player_type_id);

create index if not exists players_age_category_id_idx on public.players (age_category_id);
create index if not exists players_created_by_idx on public.players (created_by);
create index if not exists players_package_id_idx on public.players (package_id);
create index if not exists players_player_type_id_idx on public.players (player_type_id);

create index if not exists batches_age_category_id_idx on public.batches (age_category_id);
create index if not exists batches_player_type_id_idx on public.batches (player_type_id);
