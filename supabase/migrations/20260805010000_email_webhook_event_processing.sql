-- Backs the event-handling side of the Resend webhook
-- (src/app/api/webhooks/resend). Two pieces:
--
-- 1. email_webhook_events: an idempotency guard. Resend (via Svix) redelivers
--    a webhook on timeout or a non-2xx response, so the same event can arrive
--    more than once carrying the same svix delivery id. That matters here
--    specifically because open_count/click_count are "+1 per event" counters
--    (a recipient genuinely opening an email twice must count twice) --
--    there's no way to tell a real second open apart from a redelivered
--    first one except by remembering which delivery ids were already
--    processed.
--
-- 2. record_email_event: does the lookup-by-resend_email_id and the
--    conditional column updates as one atomic statement, so a duplicate
--    delivery that loses the email_webhook_events race never touches
--    email_logs at all, and a genuine update can't race with itself.
create table public.email_webhook_events (
  webhook_event_id text primary key,
  received_at timestamptz not null default now()
);

alter table public.email_webhook_events enable row level security;

create policy "super_admin full access to email_webhook_events" on public.email_webhook_events
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

-- security definer, matching revoke_user_sessions: called exclusively by the
-- webhook route on the service-role client, never by a logged-in user, so
-- there's no caller-RLS to preserve the way toggle_gate_pass/
-- submit_skill_scores deliberately stay security invoker.
create or replace function public.record_email_event(
  p_webhook_event_id text,
  p_resend_email_id text,
  p_event_type public.email_status,
  p_error_message text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- First writer wins: if this delivery id was already recorded, the
  -- conflict means FOUND is false below and we return before touching
  -- email_logs a second time.
  insert into public.email_webhook_events (webhook_event_id)
  values (p_webhook_event_id)
  on conflict (webhook_event_id) do nothing;

  if not found then
    return;
  end if;

  update public.email_logs
  set
    status = p_event_type,
    delivered_at = case when p_event_type = 'delivered' then now() else delivered_at end,
    -- opened_at/clicked_at capture only the first occurrence; open_count/
    -- click_count below track every one.
    opened_at = case when p_event_type = 'opened' then coalesce(opened_at, now()) else opened_at end,
    clicked_at = case when p_event_type = 'clicked' then coalesce(clicked_at, now()) else clicked_at end,
    bounced_at = case when p_event_type = 'bounced' then now() else bounced_at end,
    failed_at = case when p_event_type = 'failed' then now() else failed_at end,
    complained_at = case when p_event_type = 'complained' then now() else complained_at end,
    open_count = open_count + case when p_event_type = 'opened' then 1 else 0 end,
    click_count = click_count + case when p_event_type = 'clicked' then 1 else 0 end,
    error_message = coalesce(p_error_message, error_message)
  where resend_email_id = p_resend_email_id;

  if not found then
    raise warning 'record_email_event: no email_logs row for resend_email_id %', p_resend_email_id;
  end if;
end;
$$;

revoke all on function public.record_email_event(text, text, public.email_status, text) from public;
grant execute on function public.record_email_event(text, text, public.email_status, text) to service_role;
