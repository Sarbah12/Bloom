-- Cramp relief: what helped on a day with cramps.
--
-- Cramp strength needs no new column: it is the severity (1 mild, 2 moderate,
-- 3 severe) on that day's 'cramps' row in symptom_logs, which already exists.
-- Row-level security on daily_logs already covers the new column.

alter table public.daily_logs
  add column relief text[] not null default '{}'
    constraint daily_logs_relief_keys check (
      cardinality(relief) <= 20
      and array_to_string(relief, ',') ~ '^([a-z_]{1,40}(,|$))*$'
    );

comment on column public.daily_logs.relief is 'What helped with cramps that day, as catalog keys such as heat or stretching.';
