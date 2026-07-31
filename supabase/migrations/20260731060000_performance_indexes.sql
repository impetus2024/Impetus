-- Performance review: every FK already has a covering index (see
-- 20260731000000_missing_fk_indexes.sql), but several of the app's busiest
-- queries filter on more than just the FK column and had to fall back to a
-- sort or a scan of every row for that filter value. Adding the second
-- column to the existing single-column index (and dropping the
-- now-redundant single-column one, since a composite index still serves
-- any query that only filters on its leading column) covers these without
-- adding a separate, overlapping index.

-- players: "centre_id + is_active" is the single most repeated filter
-- combination in the app — every "active roster" lookup (players list,
-- injuries, 5S model, payments/gate-pass/batches dropdowns, dashboard
-- counts) runs it.
drop index if exists public.players_centre_id_idx;
create index players_centre_id_is_active_idx on public.players (centre_id, is_active);

-- payments: the payments list orders by payment_date desc within a centre;
-- without payment_date in the index, that's a sort every load once a
-- centre has more than a handful of rows.
drop index if exists public.payments_centre_id_idx;
create index payments_centre_id_payment_date_idx on public.payments (centre_id, payment_date desc);

-- gate_pass_logs: same reasoning as payments — the gate pass log is always
-- read within a centre, ordered/filtered by created_at.
drop index if exists public.gate_pass_logs_centre_id_idx;
create index gate_pass_logs_centre_id_created_at_idx on public.gate_pass_logs (centre_id, created_at);

-- attendance: distinct from the existing unique(batch_id, player_id,
-- attendance_date) constraint — that index's column order (player_id
-- before attendance_date) doesn't serve "all of this batch's attendance,
-- ordered/filtered by date" the way this does. Used by the coach
-- attendance page's "last 5 dates" query and any future date-range report.
create index attendance_batch_id_attendance_date_idx on public.attendance (batch_id, attendance_date);
