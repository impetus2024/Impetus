-- Sister module to Monthly Highlights (20260805030000_monthly_highlights.sql)
-- — same shape (a content table + a `<table>_centres` many-to-many publish
-- mapping), same expiry rule, same RLS design. Reusing that structure
-- deliberately instead of inventing a new one: everything documented there
-- about the INSERT/RETURNING visibility branch and the A-references-B,
-- B-references-A RLS cycle applies identically here, so comments below only
-- note what's different (type/event_date, no image).

create type public.news_event_type as enum ('upcoming_event', 'news_announcement');

create table public.news_events (
  id uuid primary key default gen_random_uuid(),
  type public.news_event_type not null,
  title text not null,
  description text,
  -- Required for upcoming_event, must be absent for news_announcement — a
  -- CHECK constraint backstops the client-side form's conditional field the
  -- same way the app never trusts the client for centre scoping.
  event_date date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint event_date_matches_type check (
    (type = 'upcoming_event' and event_date is not null)
    or (type = 'news_announcement' and event_date is null)
  )
);

create index news_events_created_by_idx on public.news_events (created_by);
create index news_events_expires_at_idx on public.news_events (expires_at);

alter table public.news_events enable row level security;

create policy "super_admin full access to news_events" on public.news_events
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');


create table public.news_event_centres (
  news_event_id uuid not null references public.news_events (id) on delete cascade,
  centre_id uuid not null references public.centres (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (news_event_id, centre_id)
);


create index news_event_centres_centre_id_idx on public.news_event_centres (centre_id);

alter table public.news_event_centres enable row level security;

create policy "super_admin full access to news_event_centres" on public.news_event_centres
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre news_event links" on public.news_event_centres
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "centre_admin manages own or centre-published news_events" on public.news_events
  for all using (
    private.user_role() = 'centre_admin'
    and (
      created_by = auth.uid()
      or id in (
        select news_event_id
        from public.news_event_centres
        where centre_id = private.user_centre_id()
      )
    )
  )
  with check (
    private.user_role() = 'centre_admin'
  );
