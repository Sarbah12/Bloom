-- Body and lifestyle on check-ins, and the medications people take.
-- Weight and temperature are stored metric; the app converts for display.

alter table public.daily_logs
  add column sleep_hours   numeric(3, 1) check (sleep_hours between 0 and 16),
  add column water_glasses smallint check (water_glasses between 0 and 20),
  add column exercise      text check (exercise in ('none', 'light', 'moderate', 'intense')),
  add column weight_kg     numeric(4, 1) check (weight_kg between 20 and 300),
  add column temperature_c numeric(4, 2) check (temperature_c between 34 and 42),
  -- Ids of medications ticked that day.
  add column meds_taken    uuid[] not null default '{}' check (cardinality(meds_taken) <= 30);

comment on column public.daily_logs.temperature_c is 'For the person''s own records. Not used to estimate fertility.';

create table public.medications (
  id               uuid primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null default '' check (char_length(name) <= 80),
  kind             text not null check (kind in ('pill', 'pain_relief', 'iron', 'supplement', 'other')),
  dose             text check (char_length(dose) <= 40),
  reminder_enabled boolean not null default false,
  reminder_time    time not null default '08:00',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index medications_user on public.medications (user_id);
comment on table public.medications is 'Medications and supplements. A removed one keeps only its id and deleted_at (name is blanked).';

alter table public.medications enable row level security;
revoke all on public.medications from anon;

create policy "medications: own rows" on public.medications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Include medications in the "download my data" export.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'cycle_settings', (select to_jsonb(c) from public.cycle_settings c where c.user_id = auth.uid()),
    'reminders', (select to_jsonb(r) from public.reminders r where r.user_id = auth.uid()),
    'period_logs', coalesce((select jsonb_agg(to_jsonb(x) order by x.start_date) from public.period_logs x where x.user_id = auth.uid() and x.deleted_at is null), '[]'),
    'daily_logs', coalesce((select jsonb_agg(to_jsonb(x) order by x.log_date) from public.daily_logs x where x.user_id = auth.uid() and x.deleted_at is null), '[]'),
    'symptom_logs', coalesce((select jsonb_agg(to_jsonb(x) order by x.log_date) from public.symptom_logs x where x.user_id = auth.uid()), '[]'),
    'mood_logs', coalesce((select jsonb_agg(to_jsonb(x) order by x.log_date) from public.mood_logs x where x.user_id = auth.uid()), '[]'),
    'journal_entries', coalesce((select jsonb_agg(to_jsonb(x) order by x.entry_date) from public.journal_entries x where x.user_id = auth.uid() and x.deleted_at is null), '[]'),
    'medications', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.medications x where x.user_id = auth.uid() and x.deleted_at is null), '[]'),
    'user_consents', coalesce((select jsonb_agg(to_jsonb(x) order by x.recorded_at) from public.user_consents x where x.user_id = auth.uid()), '[]'),
    'cycle_predictions', (select to_jsonb(x) from public.cycle_predictions x where x.user_id = auth.uid())
  );
$$;
