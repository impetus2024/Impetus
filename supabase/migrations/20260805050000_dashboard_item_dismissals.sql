-- Per-user "hide from my dashboard feed" marker for News & Events and
-- Monthly Highlights. Dismissing never touches the underlying item — it
-- stays visible to every other user, and unchanged in the admin management
-- tables (getNewsEvents/getMonthlyHighlights only filter dismissals when
-- explicitly asked to, which the dashboard feed does and the management
-- tables never do). One table per content type, mirroring the
-- <table>_centres pattern, rather than a single polymorphic table — keeps a
-- real FK (and its on-delete cascade) instead of a loose item_id/item_type
-- pair, consistent with keeping these two features fully parallel.

create table public.news_event_dismissals (
  news_event_id uuid not null references public.news_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (news_event_id, user_id)
);

alter table public.news_event_dismissals enable row level security;

create policy "users manage own news_event dismissals" on public.news_event_dismissals
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());


create table public.monthly_highlight_dismissals (
  monthly_highlight_id uuid not null references public.monthly_highlights (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (monthly_highlight_id, user_id)
);

alter table public.monthly_highlight_dismissals enable row level security;

create policy "users manage own monthly_highlight dismissals" on public.monthly_highlight_dismissals
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
