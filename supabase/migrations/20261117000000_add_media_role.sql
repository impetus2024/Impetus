-- New role: 'media' (Media Team Access). Can create/edit/delete Monthly
-- Highlights and News & Events for its own centre, and nothing else. Split
-- into its own migration because Postgres won't let a newly added enum value
-- be referenced by any statement in the same transaction it was added in
-- (same reason as 20260803130000_add_staff_finance_roles.sql).
alter type public.user_role add value 'media';
