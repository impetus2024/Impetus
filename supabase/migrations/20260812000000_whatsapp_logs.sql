-- Foundation for Route Mobile WhatsApp send tracking (Phase 1: the
-- new-player onboarding welcome message only). One row per send attempt,
-- written exclusively by src/lib/whatsapp/send.ts on the service-role
-- client -- same "server writes, RLS only gates reads" shape as
-- email_logs. No per-status-event timestamps yet (Phase 2's Route Mobile
-- callback handler will need its own migration once that's implemented --
-- deliberately not building ahead of it here).
create type public.whatsapp_status as enum (
  'sent',
  'failed',
  'skipped'
);

create table public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  -- Nullable: the WhatsApp number lives on the player row regardless of
  -- whether the parent profile link succeeded (see resolveParentProfileId
  -- in players/actions.ts) -- on delete set null keeps the log row around
  -- as an audit trail if the profile is later removed.
  parent_profile_id uuid references public.profiles (id) on delete set null,
  -- The normalized (+E.164) number actually sent to, not necessarily
  -- identical to the raw stored players.parent_contact_number value.
  recipient_phone text not null,
  template_name text not null,
  -- Route Mobile's request_id from a 202 Accepted response -- confirms
  -- only that they *accepted* the message for processing, not delivery.
  -- Null for 'failed'/'skipped' rows that never got one.
  route_mobile_request_id text,
  status public.whatsapp_status not null,
  error_message text,
  created_at timestamptz not null default now()
);

-- Partial (nulls excluded), mirrors email_logs_resend_email_id_idx -- lets
-- a future Phase 2 webhook map a callback back to this row by request_id.
create unique index whatsapp_logs_route_mobile_request_id_idx on public.whatsapp_logs (route_mobile_request_id) where route_mobile_request_id is not null;
create index whatsapp_logs_player_id_idx on public.whatsapp_logs (player_id);
create index whatsapp_logs_centre_id_created_at_idx on public.whatsapp_logs (centre_id, created_at desc);
create index whatsapp_logs_status_idx on public.whatsapp_logs (status);

alter table public.whatsapp_logs enable row level security;

-- Writes come exclusively from src/lib/whatsapp/send.ts on the
-- service-role client, which bypasses RLS -- same reasoning as
-- email_logs. Only read policies below; this is an audit trail, not a
-- user-editable resource.
create policy "super_admin full access to whatsapp_logs" on public.whatsapp_logs
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre whatsapp_logs" on public.whatsapp_logs
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre whatsapp_logs" on public.whatsapp_logs
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );
