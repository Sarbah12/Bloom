-- Row-level security tests. Each block raises an exception if a rule is broken,
-- which stops psql (ON_ERROR_STOP) and fails `npm run check`.

\set ON_ERROR_STOP on
\set QUIET on

-- Two people. Creating them must also create their settings rows.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.test');

do $$ begin
  if (select count(*) from public.profiles) <> 2
     or (select count(*) from public.cycle_settings) <> 2
     or (select count(*) from public.reminders) <> 2 then
    raise exception 'new-user trigger did not create profile/settings rows';
  end if;
  if (select max(updated_at) from public.cycle_settings) <> 'epoch' then
    raise exception 'placeholder settings rows must be dated epoch so device data wins';
  end if;
end $$;

-- An article that is published (after review) and one that is not.
insert into public.articles (slug, title, category, summary, body, review_status, reviewed_by, reviewed_on, published)
values ('cycle-phases', 'Phases', 'Basics', 's', '[]', 'reviewed', 'Dr Test', '2026-11-01', true),
       ('draft', 'Draft', 'Basics', 's', '[]', 'pending', null, null, false);

do $$ begin
  begin
    insert into public.articles (slug, title, category, summary, body, published)
    values ('unreviewed', 'X', 'Basics', 's', '[]', true);
    raise exception 'an unreviewed article was published';
  exception when check_violation then null;
  end;
end $$;

-- Every table in public has row-level security switched on.
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then raise exception 'tables without row-level security: %', missing; end if;
end $$;

-- ---------------------------------------------------------------- person A
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);

insert into public.period_logs (id, start_date, end_date)
values ('10000000-0000-4000-8000-000000000001', '2026-10-01', '2026-10-05');
insert into public.daily_logs (log_date, flow, energy, note, relief) values ('2026-10-01', 'heavy', 2, 'A private note', '{heat,rest}');
insert into public.symptom_logs (log_date, symptom, severity) values ('2026-10-01', 'cramps', 2);
insert into public.mood_logs (log_date, mood) values ('2026-10-01', 'anxious');
insert into public.medications (id, name, kind) values ('30000000-0000-4000-8000-000000000001', 'Iron', 'iron');
insert into public.medications (id, name, kind, pack_type, pack_start) values ('30000000-0000-4000-8000-000000000002', 'Pill', 'pill', 'combined_21_7', '2026-10-01');
update public.cycle_settings set life_stage = 'perimenopause';
update public.daily_logs set sleep_hours = 7.5, water_glasses = 6, exercise = 'light', weight_kg = 64.5, temperature_c = 36.6,
  meds_taken = '{30000000-0000-4000-8000-000000000001}' where log_date = '2026-10-01';
insert into public.journal_entries (id, entry_date, title, body)
values ('20000000-0000-4000-8000-000000000001', '2026-10-01', 'A', 'secret');
insert into public.user_consents (purpose, granted, policy_version) values ('cloud_backup', true, '2026-11');
update public.cycle_settings set typical_cycle_length = 30;

do $$ begin
  begin
    insert into public.period_logs (id, user_id, start_date)
    values ('10000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-00000000000b', '2026-10-01');
    raise exception 'A could insert a row owned by B';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.daily_logs set relief = '{"Heat; drop table x"}' where log_date = '2026-10-01';
    raise exception 'a malformed relief key was stored';
  exception when check_violation then null;
  end;
  begin
    update public.user_consents set granted = false;
    raise exception 'A could rewrite consent history';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.articles) <> 1 then
    raise exception 'unpublished article visible';
  end if;
  if (select granted from public.current_consents where purpose = 'cloud_backup') is not true then
    raise exception 'current_consents view wrong';
  end if;
  begin
    update public.medications set pack_type = 'combined_21_7', pack_start = '2026-10-01' where kind = 'iron';
    raise exception 'a pill pack was attached to a non-pill medication';
  exception when check_violation then null;
  end;
  begin
    update public.daily_logs set sleep_hours = 30 where log_date = '2026-10-01';
    raise exception 'an impossible sleep value was stored';
  exception when check_violation then null;
  end;
  if (public.export_my_data() -> 'medications' -> 0 ->> 'name') <> 'Iron' then
    raise exception 'export_my_data missing medications';
  end if;
  if (public.export_my_data() -> 'daily_logs' -> 0 ->> 'note') <> 'A private note' then
    raise exception 'export_my_data missing own data';
  end if;
end $$;

-- ---------------------------------------------------------------- person B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', false);

do $$
declare n int;
begin
  select (select count(*) from public.period_logs) + (select count(*) from public.daily_logs)
       + (select count(*) from public.symptom_logs) + (select count(*) from public.mood_logs)
       + (select count(*) from public.journal_entries) + (select count(*) from public.user_consents)
       + (select count(*) from public.medications)
    into n;
  if n <> 0 then raise exception 'B can see % of A''s health rows', n; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'B sees other profiles'; end if;
  if (select typical_cycle_length from public.cycle_settings) <> 28 then raise exception 'B sees A''s settings'; end if;

  update public.period_logs set start_date = '2020-01-01';
  delete from public.journal_entries;
  if jsonb_array_length(public.export_my_data() -> 'period_logs') <> 0 then
    raise exception 'B export includes A''s data';
  end if;
end $$;

-- ---------------------------------------------------------------- signed out
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);

do $$ begin
  begin
    perform count(*) from public.period_logs;
    raise exception 'anon can read period_logs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_my_account();
    raise exception 'anon can call delete_my_account';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.articles) <> 1 then raise exception 'anon cannot read published articles'; end if;
end $$;

-- ---------------------------------------------------------------- partner mode
-- The functions raise P0001 for user errors, the same code as a failing test,
-- so expected failures are checked with a flag instead of letting them bubble.
reset role;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000c', 'c@example.test');
create temp table partner_code (code text);
grant all on partner_code to authenticated;
set role authenticated;

-- A invites and publishes a summary.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);
insert into partner_code select public.create_partner_invite('Ama');
insert into public.partner_snapshots (data) values
  ('{"asOf":"2026-11-15","period":{"isPeriodDay":true},"phase":{"phase":"menstrual"},"today":{"symptoms":["cramps"]},"fertile":{"start":"2026-11-25"}}');
do $$
declare failed boolean;
begin
  if (select code from partner_code) !~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$' then raise exception 'unexpected code format'; end if;
  if (select count(*) from public.partner_links where code_hash = encode(sha256(convert_to(replace((select code from partner_code), '-', ''), 'UTF8')), 'hex')) <> 1 then
    raise exception 'invite not stored as a hash';
  end if;
  failed := false;
  begin perform public.accept_partner_invite((select code from partner_code)); exception when sqlstate 'P0001' then failed := true; end;
  if not failed then raise exception 'sharer could accept their own code'; end if;
end $$;
do $$ begin
  begin
    perform public.partner_code_hash('x');
    raise exception 'partner_code_hash is callable directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- C (a stranger) guesses: wrong codes fail, and after 10 tries even the right one is refused.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', false);
do $$
declare failed boolean;
begin
  if public.accept_partner_invite('AAAA-AAAA') is not null then raise exception 'a wrong code was accepted'; end if;
  for i in 2..10 loop perform public.accept_partner_invite('AAAA-AAAA'); end loop;
  failed := false;
  begin perform public.accept_partner_invite((select code from partner_code)); exception when sqlstate 'P0001' then failed := true; end;
  if not failed then raise exception 'code guessing is not rate-limited'; end if;
end $$;

-- B accepts (lowercase, no dash still works) and sees only what is switched on.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', false);
do $$
declare v jsonb;
begin
  if public.accept_partner_invite(lower(replace((select code from partner_code), '-', '')), 'Kofi') <> 'Ama' then
    raise exception 'accept did not return the sharer''s label';
  end if;
  v := public.get_partner_view() -> 0;
  if v ->> 'label' <> 'Ama' or v -> 'period' is null or v -> 'phase' is null or v -> 'today' is null then
    raise exception 'partner view missing shared parts: %', v;
  end if;
  if v ? 'fertile' then raise exception 'fertile window shown while off by default'; end if;
  if (select count(*) from public.partner_snapshots) <> 0 then raise exception 'partner can read the raw summary table'; end if;
  begin
    update public.partner_links set share_fertile = true;
    raise exception 'partner could edit the link directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A changes what is shared; B's view follows.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);
select public.update_partner_sharing(true, true, false, true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', false);
do $$
declare v jsonb := public.get_partner_view() -> 0;
begin
  if v ? 'today' or not v ? 'fertile' then raise exception 'sharing choices not applied: %', v; end if;
end $$;

-- C sees nothing and can't end someone else's link.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', false);
do $$ begin
  if public.get_partner_view() <> '[]'::jsonb or (select count(*) from public.partner_links) <> 0 then
    raise exception 'a stranger can see a partner link';
  end if;
  perform public.end_partner_link((select id from public.partner_links limit 1));
end $$;

-- B ends the link: access stops and A's summary is deleted.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', false);
select public.end_partner_link((select id from public.partner_links where revoked_at is null));
do $$ begin
  if public.get_partner_view() <> '[]'::jsonb then raise exception 'partner still sees data after ending'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);
do $$
declare failed boolean;
begin
  if (select count(*) from public.partner_snapshots) <> 0 then raise exception 'summary kept after the link ended'; end if;
  -- An expired invite can't be used.
  delete from partner_code;
  insert into partner_code select public.create_partner_invite('Ama');
end $$;
reset role;
update public.partner_links set code_expires_at = now() - interval '1 minute' where revoked_at is null;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', false);
do $$
declare failed boolean := false;
begin
  if public.accept_partner_invite((select code from partner_code)) is not null then raise exception 'an expired code was accepted'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.get_partner_view();
    raise exception 'signed-out callers can use partner functions';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------- A's edits survived B, then A deletes their account
reset role;
do $$ begin
  if (select start_date from public.period_logs where id = '10000000-0000-4000-8000-000000000001') <> '2026-10-01'
     or (select count(*) from public.journal_entries) <> 1 then
    raise exception 'B was able to modify A''s rows';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', false);
select public.delete_my_account();
reset role;

do $$ begin
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-00000000000a') then
    raise exception 'account not deleted';
  end if;
  if (select count(*) from public.period_logs) + (select count(*) from public.daily_logs)
     + (select count(*) from public.symptom_logs) + (select count(*) from public.journal_entries)
     + (select count(*) from public.user_consents) + (select count(*) from public.medications) <> 0 then
    raise exception 'health data left behind after account deletion';
  end if;
  if not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000b') then raise exception 'B''s profile was removed'; end if;
  if exists (select 1 from public.partner_links where '00000000-0000-4000-8000-00000000000a' in (owner_id, partner_id))
     or exists (select 1 from public.partner_snapshots where owner_id = '00000000-0000-4000-8000-00000000000a') then
    raise exception 'partner links or summary left behind after account deletion';
  end if;
end $$;

\echo 'rls: 15 tables — all with row-level security; partner mode sharing, codes and revocation; isolation, consent history, deletion and export behave'
