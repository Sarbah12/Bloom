-- Bloom — initial schema.
--
-- Principles
--   * Every personal row carries user_id and is protected by row-level
--     security: a signed-in person can only ever touch their own rows.
--   * Anonymous (not signed-in) requests can read published articles and
--     nothing else.
--   * Deleting the auth user cascades to every table, so "delete my account"
--     removes all health data in one statement.
--   * Ids for synced records are generated on the device (UUIDs), and
--     updated_at is set by the device, so offline edits merge by
--     last-write-wins. deleted_at tombstones carry deletions across devices.
--
-- The app stores data on the device first; these tables are an optional,
-- consent-gated backup.

-- ---------------------------------------------------------------------------
-- Profiles & settings (one row per person)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text check (char_length(display_name) <= 80),
  birth_year     smallint check (birth_year between 1900 and 2100),
  goals          text[] not null default '{}',
  onboarded_at   timestamptz,
  appearance     text not null default 'system' check (appearance in ('system', 'light', 'dark')),
  week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)),
  show_fertility boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.profiles is 'User information and preferences.';

create table public.cycle_settings (
  user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  typical_cycle_length  smallint not null default 28 check (typical_cycle_length between 15 and 90),
  typical_period_length smallint not null default 5 check (typical_period_length between 1 and 14),
  updated_at            timestamptz not null default now()
);
comment on table public.cycle_settings is 'Self-reported typical cycle and period length, used until history takes over.';

create table public.reminders (
  user_id                  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  period_soon_enabled      boolean not null default false,
  period_soon_days_before  smallint not null default 2 check (period_soon_days_before between 1 and 7),
  daily_check_in_enabled   boolean not null default false,
  daily_check_in_time      time not null default '20:00',
  fertile_window_enabled   boolean not null default false,
  discreet                 boolean not null default true,
  updated_at               timestamptz not null default now()
);
comment on table public.reminders is 'Notification preferences. Reminders are scheduled locally on the device.';

-- ---------------------------------------------------------------------------
-- Health records
-- ---------------------------------------------------------------------------

create table public.period_logs (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint period_logs_dates check (end_date is null or end_date >= start_date)
);
create index period_logs_user_start on public.period_logs (user_id, start_date);
comment on table public.period_logs is 'Period start and end dates. end_date is null while a period is ongoing. Daily flow lives in daily_logs.';

create table public.daily_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null,
  flow       text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  energy     smallint check (energy between 1 and 5),
  note       text check (char_length(note) <= 5000),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint daily_logs_one_per_day unique (user_id, log_date)
);
comment on table public.daily_logs is 'One check-in per calendar day: flow, energy and a short note.';

create table public.symptom_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null,
  symptom    text not null check (symptom ~ '^[a-z_]{1,40}$'),
  severity   smallint check (severity between 1 and 3),
  created_at timestamptz not null default now(),
  constraint symptom_logs_unique unique (user_id, log_date, symptom),
  constraint symptom_logs_day foreign key (user_id, log_date)
    references public.daily_logs (user_id, log_date) on delete cascade
);
comment on table public.symptom_logs is 'Physical symptoms recorded on a check-in day.';

create table public.mood_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null,
  mood       text not null check (mood ~ '^[a-z_]{1,40}$'),
  created_at timestamptz not null default now(),
  constraint mood_logs_unique unique (user_id, log_date, mood),
  constraint mood_logs_day foreign key (user_id, log_date)
    references public.daily_logs (user_id, log_date) on delete cascade
);
comment on table public.mood_logs is 'Moods and emotional changes recorded on a check-in day.';

create table public.cycle_predictions (
  user_id                  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  next_period_start        date,
  next_period_window_start date,
  next_period_window_end   date,
  ovulation_date           date,
  fertile_start            date,
  fertile_end              date,
  confidence               text check (confidence in ('low', 'medium', 'high')),
  average_cycle_length     smallint,
  average_period_length    smallint,
  engine_version           text not null,
  computed_at              timestamptz not null default now()
);
comment on table public.cycle_predictions is 'Latest on-device estimate, cached for other devices. Derived data: estimates only, never medical fact.';

create table public.journal_entries (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  title      text not null default '' check (char_length(title) <= 200),
  body       text not null default '' check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index journal_entries_user_date on public.journal_entries (user_id, entry_date desc);
comment on table public.journal_entries is 'Private journal. A deleted entry keeps only its id and deleted_at (title/body are blanked).';

-- ---------------------------------------------------------------------------
-- Consent audit log (append-only)
-- ---------------------------------------------------------------------------

create table public.user_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose        text not null check (purpose in ('cloud_backup', 'ai_assistant', 'product_analytics', 'terms', 'privacy_policy')),
  granted        boolean not null,
  policy_version text not null check (char_length(policy_version) <= 40),
  recorded_at    timestamptz not null default now()
);
create index user_consents_user_purpose on public.user_consents (user_id, purpose, recorded_at desc);
comment on table public.user_consents is 'Every consent decision, kept as a history. The latest row per purpose is the current choice.';

create view public.current_consents
with (security_invoker = true) as
select distinct on (user_id, purpose) user_id, purpose, granted, policy_version, recorded_at
from public.user_consents
order by user_id, purpose, recorded_at desc;

-- ---------------------------------------------------------------------------
-- Educational content (public)
-- ---------------------------------------------------------------------------

create table public.articles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  locale          text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  title           text not null,
  category        text not null check (category in ('Basics', 'Symptoms', 'Mood', 'Fertility', 'Care')),
  summary         text not null,
  body            jsonb not null,
  sources         jsonb not null default '[]',
  reading_minutes smallint check (reading_minutes between 1 and 60),
  review_status   text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  reviewed_by     text,
  reviewed_on     date,
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint articles_published_needs_review check (not published or review_status = 'reviewed')
);
comment on table public.articles is 'Menstrual health articles. Only clinically reviewed articles can be published.';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.cycle_settings    enable row level security;
alter table public.reminders         enable row level security;
alter table public.period_logs       enable row level security;
alter table public.daily_logs        enable row level security;
alter table public.symptom_logs      enable row level security;
alter table public.mood_logs         enable row level security;
alter table public.cycle_predictions enable row level security;
alter table public.journal_entries   enable row level security;
alter table public.user_consents     enable row level security;
alter table public.articles          enable row level security;

-- Signed-out requests never touch personal tables, policy or not.
revoke all on public.profiles, public.cycle_settings, public.reminders, public.period_logs,
  public.daily_logs, public.symptom_logs, public.mood_logs, public.cycle_predictions,
  public.journal_entries, public.user_consents, public.current_consents
  from anon;

create policy "profiles: own row" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'cycle_settings', 'reminders', 'period_logs', 'daily_logs', 'symptom_logs',
    'mood_logs', 'cycle_predictions', 'journal_entries'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || ': own rows', t);
  end loop;
end $$;

-- Consents are a history: you can add and read your own, never rewrite them.
create policy "user_consents: read own" on public.user_consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_consents: add own" on public.user_consents
  for insert to authenticated with check ((select auth.uid()) = user_id);
revoke update, delete on public.user_consents from authenticated;

create policy "articles: published are public" on public.articles
  for select to anon, authenticated using (published);
revoke insert, update, delete on public.articles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- New users get their settings rows
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Placeholder rows are dated 1970 so that, on the first backup, settings
  -- already on the phone (always newer) win over these defaults.
  insert into public.profiles (id, updated_at) values (new.id, 'epoch');
  insert into public.cycle_settings (user_id, updated_at) values (new.id, 'epoch');
  insert into public.reminders (user_id, updated_at) values (new.id, 'epoch');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Account deletion and export
-- ---------------------------------------------------------------------------

-- Deletes the caller's account. Every table cascades from auth.users, so this
-- removes all of their health data. Irreversible.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Everything stored for the caller, as one JSON document. Runs with the
-- caller's rights, so row-level security decides what is included.
create function public.export_my_data()
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
    'user_consents', coalesce((select jsonb_agg(to_jsonb(x) order by x.recorded_at) from public.user_consents x where x.user_id = auth.uid()), '[]'),
    'cycle_predictions', (select to_jsonb(x) from public.cycle_predictions x where x.user_id = auth.uid())
  );
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
