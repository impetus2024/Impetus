-- Foundation for Resend email tracking. Nothing writes to this table yet
-- (sendAccountInviteEmail in src/lib/email/send.ts doesn't log here) — this
-- migration only lays down the schema so a future webhook handler
-- (Resend -> POST /api/webhooks/resend) and the send call sites have
-- somewhere to record delivery status.
--
-- One row per send attempt. Status is the current/most-recently-known state
-- from Resend's webhook events; the per-event timestamp columns preserve the
-- full lifecycle (an email can be delivered *and* later opened *and* later
-- clicked -- collapsing that into a single `status` column would lose
-- whichever event isn't the most recent one).
create type public.email_status as enum (
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'failed',
  'complained'
);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  -- Resend's id for the send (their /emails response, and the `data.id` on
  -- every webhook event) -- how an incoming webhook maps back to this row.
  -- Null for sends that failed before Resend returned one.
  resend_email_id text,
  -- App-defined purpose of the email (e.g. 'account_invite',
  -- 'password_reset') -- free text rather than an enum since this set is
  -- expected to grow as more transactional emails are added.
  email_type text not null,
  -- The actual subject line sent, for display in the email log (see
  -- email-analytics) -- nullable rather than derived from email_type at
  -- read time, since two emails of the same type won't always share a
  -- subject forever (e.g. once send.ts's copy diverges per type).
  subject text,
  recipient_email text not null,
  -- Nullable: on delete set null keeps the log row (and its delivery
  -- history) around as an audit trail even if the profile is later removed.
  recipient_profile_id uuid references public.profiles (id) on delete set null,
  centre_id uuid references public.centres (id) on delete set null,
  status public.email_status not null default 'sent',
  -- Bounce/complaint/failure detail from the webhook payload, if any.
  error_message text,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  failed_at timestamptz,
  complained_at timestamptz,
  -- Resend fires a separate webhook event per open/click (e.g. re-opening
  -- an email, clicking multiple links) -- opened_at/clicked_at only capture
  -- the first occurrence, these counters track how many.
  open_count integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial (nulls excluded) so multiple failed-before-Resend-returned-an-id
-- rows don't collide, while still guaranteeing one row per real Resend send
-- for webhook mapping.
create unique index email_logs_resend_email_id_idx on public.email_logs (resend_email_id) where resend_email_id is not null;
create index email_logs_recipient_profile_id_idx on public.email_logs (recipient_profile_id);
-- Composite, not a lone centre_id index: every analytics query filters by
-- centre_id and a sent_at range together (see email-analytics), and orders
-- by sent_at by default — same reasoning as payments_centre_id_payment_date_idx.
create index email_logs_centre_id_sent_at_idx on public.email_logs (centre_id, sent_at desc);
create index email_logs_recipient_email_idx on public.email_logs (recipient_email);
create index email_logs_status_idx on public.email_logs (status);

create trigger set_updated_at before update on public.email_logs
  for each row execute function public.set_updated_at();

alter table public.email_logs enable row level security;

-- Writes come exclusively from server-side code on the service-role client
-- (the send call site, and the future webhook handler) -- both bypass RLS,
-- so no insert/update policy is needed for any authenticated role, same as
-- the auth-sync trigger writing `profiles`. Only read policies below.
create policy "super_admin full access to email_logs" on public.email_logs
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre email_logs" on public.email_logs
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );
