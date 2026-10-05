-- Edit Batch may clear the head coach (the admin removes the current coach
-- before assigning a replacement, or leaves the slot empty until one is
-- picked). Everything else about the single-head-coach model stays as-is:
-- batches still reference at most one head coach and the FK to profiles is
-- unchanged.
--
-- RLS is unaffected: every coach-ownership policy compares
-- `head_coach_id = auth.uid()`, which is never TRUE for NULL, so a batch
-- with no head coach stays visible only to centre staff (plus its assistant
-- coach, if one is assigned) until someone is assigned.
--
-- The original batches_assistant_coach_not_head CHECK would already accept a
-- NULL head (PostgreSQL only rejects FALSE, and `assistant <> NULL` is NULL,
-- not FALSE) — but only accidentally. Restate it so "head is empty" is an
-- explicitly allowed case instead of a NULL-logic side effect, while the
-- assistant-equals-head duplicate rule keeps rejecting exactly what it did.
--
-- Revert with (manual, and only after a human has chosen the coaches — there
-- is no safe automatic backfill, because deciding which coach each now-headless
-- batch belongs to is an operational decision this migration cannot make):
--
--   1. Backfill FIRST. `set not null` fails with a NOT NULL violation for every
--      batch still at NULL head_coach_id, and the whole point of this migration
--      is that such batches are expected to exist. Assign each one a real head
--      coach (per batch, chosen by an operator):
--        update public.batches
--          set head_coach_id = '<operator-chosen coach profile id>'
--          where head_coach_id is null;
--      Running step 2 before every NULL is gone will fail and change nothing.
--
--   2. Only then restore the column:
--        alter table public.batches alter column head_coach_id set not null;
--
--   3. Restore the CHECK to its original wording, which is equivalent to the
--      restated one once head_coach_id is non-null again, and drops the
--      "head is empty" case the column can no longer be in:
--        alter table public.batches drop constraint batches_assistant_coach_not_head;
--        alter table public.batches add constraint batches_assistant_coach_not_head
--          check (assistant_coach_id is null or assistant_coach_id <> head_coach_id);
--
-- Do not run these against a database where an operator has not yet decided
-- who each headless batch's coach is: that would silently pick a coach nobody
-- reviewed.

alter table public.batches
  alter column head_coach_id drop not null;

alter table public.batches
  drop constraint batches_assistant_coach_not_head;

alter table public.batches
  add constraint batches_assistant_coach_not_head
  check (
    head_coach_id is null
    or assistant_coach_id is null
    or assistant_coach_id <> head_coach_id
  );

