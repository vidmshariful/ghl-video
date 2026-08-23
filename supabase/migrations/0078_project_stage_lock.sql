-- Let the studio pin a project's stage by hand.
--
-- The stage normally computes itself from the production line (owner
-- decision, 22 August 2026), so the two never drift. But sometimes reality
-- and the arithmetic disagree and the producer wants to say where a job is
-- outright. This flag records that they have: once set, the nightly and
-- per-move derivation leaves the stage alone, the same way it already leaves
-- closed and cancelled alone.
--
-- Default false, so every existing and future project keeps following the
-- line until somebody deliberately takes the wheel. A "follow the line
-- again" toggle clears it and hands control back to the arithmetic.

alter table public.projects
  add column if not exists stage_locked boolean not null default false;
