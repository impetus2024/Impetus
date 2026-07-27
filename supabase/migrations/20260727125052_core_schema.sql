-- Core schema for the Club Management System.
-- Roles: super_admin, centre_admin, coach, medical, parent.
-- Authorization model: role + centre_id live on `profiles`, mirrored from
-- auth.users.raw_app_meta_data (set only by the service role / admin API,
-- never client-writable) via the handle_new_user trigger below. RLS policies
-- read profiles through SECURITY DEFINER helpers in the `private` schema to
-- avoid recursive-RLS issues on the profiles table itself.

create schema if not exists private;

create type public.user_role as enum (
  'super_admin',
  'centre_admin',
  'coach',
  'medical',
  'parent'
);

create type public.gate_pass_action as enum ('check_in', 'check_out');
create type public.attendance_status as enum ('present', 'absent');

-- updated_at helper, reused by every table below
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Centres
-- ============================================================
create table public.centres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_number text not null,
  email text not null,
  logo_path text,
  country text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.centres
  for each row execute function public.set_updated_at();

-- ============================================================
-- Profiles (1 row per auth.users, role + centre scope)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  centre_id uuid references public.centres (id) on delete restrict,
  full_name text not null default '',
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint centre_required_for_staff check (
    (role in ('centre_admin', 'coach', 'medical') and centre_id is not null)
    or (role in ('super_admin', 'parent'))
  )
);

create index profiles_centre_id_idx on public.profiles (centre_id);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Extra staff-only details captured on the Administrator form.
create table public.staff_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  date_of_birth date,
  contact_number text,
  address_line1 text,
  address_line2 text,
  country text,
  state text,
  city text,
  pincode text,
  date_of_joining date,
  aadhaar_doc_path text,
  birth_certificate_path text,
  profile_picture_path text,
  other_documents_path text
);

-- Auth sync: role/centre_id come from raw_app_meta_data, set only via the
-- service-role admin API (see src/lib/supabase/admin.ts) — never trust
-- raw_user_meta_data for authorization, it is client-writable.
--
-- Fires on both INSERT and UPDATE: the admin API's createUser() writes the
-- row first and then a follow-up statement merges in raw_app_meta_data
-- (provider info, the role/centre_id we pass in), so an INSERT-only trigger
-- would capture the row before that merge lands. Using an upsert keeps a
-- single function correct for both triggers.
create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, centre_id, full_name, email)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'parent'),
    nullif(new.raw_app_meta_data ->> 'centre_id', '')::uuid,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update set
    role = excluded.role,
    centre_id = excluded.centre_id,
    full_name = excluded.full_name,
    email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_sync();

create trigger on_auth_user_updated
  after update of raw_app_meta_data, raw_user_meta_data, email on auth.users
  for each row execute function public.handle_auth_user_sync();

-- ============================================================
-- Helper functions for RLS (SECURITY DEFINER: bypass RLS on profiles
-- to avoid recursive policy evaluation)
-- ============================================================
create or replace function private.user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.user_centre_id() returns uuid
language sql stable security definer set search_path = public as $$
  select centre_id from public.profiles where id = auth.uid()
$$;

alter table public.centres enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_profiles enable row level security;

create policy "super_admin full access to centres" on public.centres
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre staff can view own centre" on public.centres
  for select using (
    private.user_role() in ('centre_admin', 'coach', 'medical')
    and id = private.user_centre_id()
  );

create policy "users can view own profile" on public.profiles
  for select using (id = auth.uid());

create policy "super_admin full access to profiles" on public.profiles
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre staff" on public.profiles
  for all using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and role in ('centre_admin', 'coach', 'medical')
  )
  with check (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and role in ('centre_admin', 'coach', 'medical')
  );

create policy "staff can view own staff_profile" on public.staff_profiles
  for select using (profile_id = auth.uid());

create policy "super_admin full access to staff_profiles" on public.staff_profiles
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre staff_profiles" on public.staff_profiles
  for all using (
    private.user_role() = 'centre_admin'
    and profile_id in (
      select id from public.profiles where centre_id = private.user_centre_id()
    )
  )
  with check (
    private.user_role() = 'centre_admin'
    and profile_id in (
      select id from public.profiles where centre_id = private.user_centre_id()
    )
  );

-- ============================================================
-- Per-centre configurable lookups: player types, age categories
-- ============================================================
create table public.player_types (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (centre_id, name)
);

create table public.age_categories (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (centre_id, name)
);

alter table public.player_types enable row level security;
alter table public.age_categories enable row level security;

create policy "super_admin full access to player_types" on public.player_types
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own player_types" on public.player_types
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "centre staff can view own player_types" on public.player_types
  for select using (
    private.user_role() in ('coach', 'medical') and centre_id = private.user_centre_id()
  );

create policy "super_admin full access to age_categories" on public.age_categories
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own age_categories" on public.age_categories
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "centre staff can view own age_categories" on public.age_categories
  for select using (
    private.user_role() in ('coach', 'medical') and centre_id = private.user_centre_id()
  );

-- ============================================================
-- Batches
-- ============================================================
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  name text not null,
  head_coach_id uuid not null references public.profiles (id) on delete restrict,
  player_type_id uuid references public.player_types (id) on delete set null,
  age_category_id uuid not null references public.age_categories (id) on delete restrict,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batches_centre_id_idx on public.batches (centre_id);
create index batches_head_coach_id_idx on public.batches (head_coach_id);

create trigger set_updated_at before update on public.batches
  for each row execute function public.set_updated_at();

alter table public.batches enable row level security;

create policy "super_admin full access to batches" on public.batches
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre batches" on public.batches
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach views own assigned batches" on public.batches
  for select using (
    private.user_role() = 'coach' and head_coach_id = auth.uid()
  );

create policy "medical views own centre batches" on public.batches
  for select using (
    private.user_role() = 'medical' and centre_id = private.user_centre_id()
  );

-- ============================================================
-- Packages
-- ============================================================
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  name text not null,
  player_type_id uuid references public.player_types (id) on delete set null,
  price numeric(10, 2) not null,
  duration text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index packages_centre_id_idx on public.packages (centre_id);

create trigger set_updated_at before update on public.packages
  for each row execute function public.set_updated_at();

alter table public.packages enable row level security;

create policy "super_admin full access to packages" on public.packages
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre packages" on public.packages
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

-- ============================================================
-- Players
-- Aadhaar/passport numbers are application-layer encrypted (AES-256-GCM,
-- see src/lib/crypto/field-encryption.ts) before being stored here as
-- ciphertext — the DB never holds the plaintext or the encryption key.
-- ============================================================
create table public.players (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  age_category_id uuid references public.age_categories (id) on delete set null,
  email text,
  contact_number text,
  player_type_id uuid references public.player_types (id) on delete set null,
  package_id uuid references public.packages (id) on delete set null,
  batch_id uuid references public.batches (id) on delete set null,
  gender text,
  blood_group text,
  height_cm numeric(5, 2),
  weight_kg numeric(5, 2),
  birth_mark text,
  medical_condition text,
  food_allergy text,
  aiff_number text,
  passport_number_encrypted text,
  aadhaar_number_encrypted text,
  aadhaar_doc_path text,
  medical_records_path text,
  profile_picture_path text,
  father_name text,
  mother_name text,
  parent_email text not null,
  parent_contact_number text,
  address_line1 text,
  address_line2 text,
  country text,
  state text,
  city text,
  pincode text,
  is_checked_in boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_centre_id_idx on public.players (centre_id);
create index players_batch_id_idx on public.players (batch_id);
create index players_parent_email_idx on public.players (parent_email);

create trigger set_updated_at before update on public.players
  for each row execute function public.set_updated_at();

alter table public.players enable row level security;

create policy "super_admin full access to players" on public.players
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre players" on public.players
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach views players in own batches" on public.players
  for select using (
    private.user_role() = 'coach'
    and batch_id in (select id from public.batches where head_coach_id = auth.uid())
  );

create policy "medical views own centre players" on public.players
  for select using (
    private.user_role() = 'medical' and centre_id = private.user_centre_id()
  );

-- ============================================================
-- Parent <-> player links (a parent may have multiple children)
-- ============================================================
create table public.parent_player_links (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, player_id)
);

alter table public.parent_player_links enable row level security;

create policy "super_admin full access to parent_player_links" on public.parent_player_links
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages links for own centre players" on public.parent_player_links
  for all using (
    private.user_role() = 'centre_admin'
    and player_id in (select id from public.players where centre_id = private.user_centre_id())
  )
  with check (
    private.user_role() = 'centre_admin'
    and player_id in (select id from public.players where centre_id = private.user_centre_id())
  );

create policy "parents view own links" on public.parent_player_links
  for select using (private.user_role() = 'parent' and parent_id = auth.uid());

-- Now that parent_player_links exists, add the players policy for parents.
create policy "parents view own children" on public.players
  for select using (
    private.user_role() = 'parent'
    and id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

-- ============================================================
-- Gate pass logs
-- ============================================================
create table public.gate_pass_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  centre_id uuid not null references public.centres (id) on delete cascade,
  action public.gate_pass_action not null,
  reason text not null,
  performed_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index gate_pass_logs_player_id_idx on public.gate_pass_logs (player_id);
create index gate_pass_logs_centre_id_idx on public.gate_pass_logs (centre_id);

alter table public.gate_pass_logs enable row level security;

create policy "super_admin full access to gate_pass_logs" on public.gate_pass_logs
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre gate_pass_logs" on public.gate_pass_logs
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "parents view own children's gate_pass_logs" on public.gate_pass_logs
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

-- ============================================================
-- Payments (manual record-keeping only, no gateway integration)
-- ============================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  package_id uuid references public.packages (id) on delete set null,
  amount numeric(10, 2) not null,
  payment_date date not null,
  notes text,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index payments_centre_id_idx on public.payments (centre_id);
create index payments_player_id_idx on public.payments (player_id);

alter table public.payments enable row level security;

create policy "super_admin full access to payments" on public.payments
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre payments" on public.payments
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "parents view own children's payments" on public.payments
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

-- ============================================================
-- Attendance
-- ============================================================
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  attendance_date date not null,
  status public.attendance_status not null,
  marked_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (batch_id, player_id, attendance_date)
);

create index attendance_batch_id_idx on public.attendance (batch_id);
create index attendance_player_id_idx on public.attendance (player_id);

alter table public.attendance enable row level security;

create policy "super_admin full access to attendance" on public.attendance
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre attendance" on public.attendance
  for select using (
    private.user_role() = 'centre_admin'
    and batch_id in (select id from public.batches where centre_id = private.user_centre_id())
  );

create policy "coach manages attendance for own batches" on public.attendance
  for all using (
    private.user_role() = 'coach'
    and batch_id in (select id from public.batches where head_coach_id = auth.uid())
  )
  with check (
    private.user_role() = 'coach'
    and batch_id in (select id from public.batches where head_coach_id = auth.uid())
  );

create policy "parents view own children's attendance" on public.attendance
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

-- ============================================================
-- Injuries
-- ============================================================
create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  centre_id uuid not null references public.centres (id) on delete cascade,
  date_of_injury date not null,
  activity_type text,
  body_region text,
  nature text,
  cause text,
  treating_person text,
  initial_treatment text,
  description text,
  report_doc_path text,
  reported_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index injuries_player_id_idx on public.injuries (player_id);
create index injuries_centre_id_idx on public.injuries (centre_id);

create trigger set_updated_at before update on public.injuries
  for each row execute function public.set_updated_at();

alter table public.injuries enable row level security;

create policy "super_admin full access to injuries" on public.injuries
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre injuries" on public.injuries
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach manages injuries for own batch players" on public.injuries
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

create policy "medical manages own centre injuries" on public.injuries
  for all using (
    private.user_role() = 'medical' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'medical' and centre_id = private.user_centre_id()
  );

create policy "parents view own children's injuries" on public.injuries
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );
