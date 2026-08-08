-- Widen the age_categories.age range to 25 (was 4-20) per updated product
-- requirement.

alter table public.age_categories
  drop constraint age_categories_age_range,
  add constraint age_categories_age_range check (age is null or (age between 4 and 25));
