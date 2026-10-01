-- Document storage audit trail (Phase 3 of the document-storage reliability
-- work). One append-only row per change to a private document reference or
-- to the storage object behind it, so the lifecycle of every Aadhaar scan,
-- medical record, birth certificate, profile picture and injury report can be
-- reconstructed after the fact — including after the owning row is deleted.
--
-- Two writers:
--
--   1. audit_document_columns (trigger, below) records every change to a
--      document column — upload (NULL -> key), replace (key -> key) and
--      delete (key -> NULL, or the row itself deleted, including by cascade).
--      It runs inside the same transaction as the change, so a reference
--      change is never recorded without happening or the reverse. The insert
--      is wrapped in its own exception block: if the audit insert ever fails,
--      a WARNING is raised and the document write still commits — document
--      integrity takes priority over the audit trail.
--
--   2. Server code on the service-role client (src/lib/storage/
--      document-audit.ts) records what happened to the storage object
--      afterwards: cleanup (object deleted), orphan (object should have been
--      deleted but could not be) and missing (reconciliation found a
--      reference to an object that is not in storage). Best-effort: a failed
--      insert is logged and never fails the operation.
--
-- Deliberately no foreign keys: entity_id/centre_id/actor_id must outlive the
-- rows they point at (that is the point of an audit trail), and an FK with
-- ON DELETE SET NULL would both erase that history and need UPDATE, which the
-- append-only guard below forbids.
--
-- Storage keys are operational detail, not user data: readable by
-- super_admin only, never by centre-scoped roles. No file contents, signed
-- URLs, credentials or storage error payloads are stored.
--
-- Additive only: two new enums, one new table, two new functions and their
-- triggers. No existing table, policy or row is modified.

create type public.document_audit_action as enum (
  'upload',
  'replace',
  'delete',
  'cleanup',
  'orphan',
  'missing'
);

create type public.document_entity_type as enum (
  'player',
  'staff_profile',
  'injury'
);

create table public.document_audit_events (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: a storage event for an upload that was never saved (a rejected
  -- batch, a lost compare-and-swap) has no owning row.
  entity_type public.document_entity_type,
  entity_id uuid,
  centre_id uuid,
  -- The document column, e.g. 'aadhaar_doc_path'.
  document_field text,
  action public.document_audit_action not null,
  old_key text,
  new_key text,
  -- Short machine-readable context, e.g. 'row_deleted', 'replaced',
  -- 'discarded_upload', 'entity_deleted', 'storage_delete_failed'.
  reason text,
  -- auth.uid() for trigger rows written through an end-user request; the
  -- acting profile id passed by server code otherwise. NULL when unknown
  -- (service-role writes with no acting user).
  actor_id uuid,
  -- clock_timestamp, not now(): events written in one transaction keep their order.
  created_at timestamptz not null default clock_timestamp(),
  constraint document_audit_events_has_key check (old_key is not null or new_key is not null),
  constraint document_audit_events_reason_length check (reason is null or length(reason) <= 200)
);

create index document_audit_events_entity_idx
  on public.document_audit_events (entity_type, entity_id, created_at desc);
create index document_audit_events_created_at_idx
  on public.document_audit_events (created_at desc);
create index document_audit_events_action_created_at_idx
  on public.document_audit_events (action, created_at desc);
-- Reconciliation and investigation look events up by storage key.
create index document_audit_events_old_key_idx
  on public.document_audit_events (old_key) where old_key is not null;
create index document_audit_events_new_key_idx
  on public.document_audit_events (new_key) where new_key is not null;

alter table public.document_audit_events enable row level security;

-- Read-only for super_admin; no other role has any policy, so RLS denies
-- them everything. Writes come from the trigger below (security definer)
-- and the service-role client, both of which bypass RLS — same
-- "server writes, RLS only gates reads" shape as email_logs/whatsapp_logs,
-- except that no centre-scoped role can read this one: storage keys are
-- not something a centre user needs.
create policy "super_admin views document_audit_events" on public.document_audit_events
  for select using (private.user_role() = 'super_admin');

-- Defense in depth on top of RLS: the Data API roles cannot write at all.
revoke insert, update, delete, truncate on public.document_audit_events from anon, authenticated;
revoke select on public.document_audit_events from anon;

-- Append-only for everyone, including the service role (which bypasses RLS
-- but not triggers).
create or replace function public.prevent_document_audit_event_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'document_audit_events is append-only';
end;
$$;

revoke all on function public.prevent_document_audit_event_change() from public;

create trigger prevent_document_audit_event_change
  before update or delete on public.document_audit_events
  for each row execute function public.prevent_document_audit_event_change();

create trigger prevent_document_audit_event_truncate
  before truncate on public.document_audit_events
  for each statement execute function public.prevent_document_audit_event_change();

-- Records document column changes. Trigger arguments:
--   0: entity type ('player' | 'staff_profile' | 'injury')
--   1: the row's id column
--   2: the row's centre_id column, or '' to look it up from profiles
--   3..: the document columns to audit
create or replace function public.audit_document_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_data jsonb := coalesce(new_row, old_row);
  row_id uuid := (row_data ->> tg_argv[1])::uuid;
  row_centre uuid;
  col text;
  old_key text;
  new_key text;
begin
  for i in 3 .. tg_nargs - 1 loop
    col := tg_argv[i];
    old_key := nullif(old_row ->> col, '');
    new_key := nullif(new_row ->> col, '');
    continue when old_key is not distinct from new_key;

    begin
      if row_centre is null then
        if tg_argv[2] <> '' then
          row_centre := (row_data ->> tg_argv[2])::uuid;
        else
          -- staff_profiles has no centre_id of its own. During a cascade
          -- from auth.users the profile may already be gone: NULL then.
          select p.centre_id into row_centre from public.profiles p where p.id = row_id;
        end if;
      end if;

      insert into public.document_audit_events
        (entity_type, entity_id, centre_id, document_field, action, old_key, new_key, reason, actor_id)
      values (
        tg_argv[0]::public.document_entity_type,
        row_id,
        row_centre,
        col,
        (case
          when old_key is null then 'upload'
          when new_key is null then 'delete'
          else 'replace'
        end)::public.document_audit_action,
        old_key,
        new_key,
        case when tg_op = 'DELETE' then 'row_deleted' end,
        auth.uid()
      );
    exception when others then
      -- Never block the document write on the audit trail.
      raise warning 'document audit insert failed for %.% (%): %', tg_table_name, col, row_id, sqlerrm;
    end;
  end loop;

  return null;
end;
$$;

revoke all on function public.audit_document_columns() from public;

create trigger audit_document_columns
  after insert or delete
    or update of aadhaar_doc_path, medical_records_path, profile_picture_path
  on public.players
  for each row execute function public.audit_document_columns(
    'player', 'id', 'centre_id', 'aadhaar_doc_path', 'medical_records_path', 'profile_picture_path'
  );

create trigger audit_document_columns
  after insert or delete
    or update of aadhaar_doc_path, birth_certificate_path, profile_picture_path, other_documents_path
  on public.staff_profiles
  for each row execute function public.audit_document_columns(
    'staff_profile', 'profile_id', '',
    'aadhaar_doc_path', 'birth_certificate_path', 'profile_picture_path', 'other_documents_path'
  );

create trigger audit_document_columns
  after insert or delete or update of report_doc_path
  on public.injuries
  for each row execute function public.audit_document_columns(
    'injury', 'id', 'centre_id', 'report_doc_path'
  );
