-- Custom, player-specific packages: created inline from the Add/Edit Player
-- form when a centre_admin picks "Custom" instead of one of the centre's
-- existing packages. Stored as a normal `packages` row (so every consumer of
-- `players.package_id` -- payments, the player profile, dashboards -- keeps
-- working completely unchanged) but flagged `is_custom` so it's excluded
-- from the reusable package pickers (Package Management, Add Player /
-- Add Payment dropdowns). `price` stays the authoritative "what this costs"
-- column used everywhere else; `custom_amount`/`discount` are only extra
-- context for how a custom package's price was derived.
alter table public.packages
  add column is_custom boolean not null default false,
  add column custom_amount numeric(10, 2),
  add column discount numeric(10, 2);
