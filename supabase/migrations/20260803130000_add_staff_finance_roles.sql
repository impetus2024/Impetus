-- New read-only roles: 'staff' and 'finance'. Same centre-scoped visibility
-- as centre_admin (added in the next migration), but no write access to
-- anything except their own password (self-service change, unrelated to
-- RLS). Split into its own migration because Postgres won't let a newly
-- added enum value be referenced by any statement in the same transaction
-- it was added in ("unsafe use of new value of enum type").
alter type public.user_role add value 'staff';
alter type public.user_role add value 'finance';
