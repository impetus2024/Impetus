-- Age Category names (e.g. "Cubs", "U12") are an arbitrary label chosen by
-- each centre and don't reliably map to a real age. The 5S Model needs the
-- actual numeric age behind a category, so add it alongside the name.
-- Nullable: existing categories keep working until a centre_admin edits
-- them in; the app enforces the 4-20 dropdown for new/renamed entries.

alter table public.age_categories
  add column age smallint,
  add constraint age_categories_age_range check (age is null or (age between 4 and 20));
