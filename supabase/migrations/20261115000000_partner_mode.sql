-- Partner mode: share a small, chosen summary of your cycle with one partner.
--
-- The partner never reads your tables. Your phone publishes a summary it
-- computes itself (partner_snapshots); the partner reads it only through
-- get_partner_view(), which returns just the parts you switched on and only
-- while the link is active. Invites are one-time codes stored as a hash,
-- valid for 24 hours. Either person can end the link at any time.

create table public.partner_links (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  partner_id      uuid references auth.users (id) on delete cascade,
  -- How each person appears to the other (chosen by each, never an email).
  owner_label     text not null default '' check (char_length(owner_label) <= 40),
  partner_label   text not null default '' check (char_length(partner_label) <= 40),
  code_hash       text check (char_length(code_hash) = 64),
  code_expires_at timestamptz,
  share_period    boolean not null default true,
  share_phase     boolean not null default true,
  share_today     boolean not null default true,
  share_fertile   boolean not null default false,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  constraint partner_links_not_self check (partner_id is null or partner_id <> owner_id)
);
comment on table public.partner_links is 'Partner mode: who may see whose summary, and which parts. Written only through the partner_* functions.';

-- One open link (pending or active) per person sharing.
create unique index partner_links_one_open on public.partner_links (owner_id) where revoked_at is null;
create index partner_links_partner on public.partner_links (partner_id) where revoked_at is null;

create table public.partner_snapshots (
  owner_id   uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 8192),
  updated_at timestamptz not null default now()
);
comment on table public.partner_snapshots is 'The summary a person''s phone publishes for their partner. Read by the partner only via get_partner_view().';

-- Guards against guessing invite codes.
create table public.partner_code_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
create index partner_code_attempts_user on public.partner_code_attempts (user_id, at);

alter table public.partner_links enable row level security;
alter table public.partner_snapshots enable row level security;
alter table public.partner_code_attempts enable row level security;
revoke all on public.partner_links, public.partner_snapshots, public.partner_code_attempts from anon;

-- Both people can see their link; nobody writes it directly.
create policy "partner_links: see own" on public.partner_links
  for select to authenticated
  using ((select auth.uid()) in (owner_id, partner_id));
revoke insert, update, delete on public.partner_links from authenticated;

-- Only the owner reads and writes their own summary.
create policy "partner_snapshots: own" on public.partner_snapshots
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Attempts are bookkeeping for the functions below; no direct access.
revoke all on public.partner_code_attempts from authenticated;

-- ---------------------------------------------------------------------------

create function public.partner_code_hash(code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;
revoke all on function public.partner_code_hash(text) from public, anon, authenticated;

-- Creates (or replaces) a pending invite. Returns the code, e.g. 'K7QM-2XPA'.
create function public.create_partner_invite(label text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
begin
  if me is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.partner_links where owner_id = me and revoked_at is null and accepted_at is not null) then
    raise exception 'You already share with a partner. End that first.' using errcode = 'P0001';
  end if;
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  update public.partner_links set revoked_at = now(), code_hash = null
    where owner_id = me and revoked_at is null and accepted_at is null;
  insert into public.partner_links (owner_id, owner_label, code_hash, code_expires_at)
    values (me, left(coalesce(label, ''), 40), public.partner_code_hash(code), now() + interval '24 hours');
  return substr(code, 1, 4) || '-' || substr(code, 5, 4);
end;
$$;

-- The partner enters the code. Returns how the sharer appears, or null when the
-- code is wrong or expired. (No error there: an error would roll back the
-- attempt record, and guesses must be counted.)
create function public.accept_partner_invite(code text, label text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  link public.partner_links;
begin
  if me is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if (select count(*) from public.partner_code_attempts where user_id = me and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many tries. Wait an hour and try again.' using errcode = 'P0001';
  end if;
  insert into public.partner_code_attempts (user_id) values (me);

  select * into link from public.partner_links
    where code_hash = public.partner_code_hash(code)
      and revoked_at is null and accepted_at is null and code_expires_at > now()
    for update;
  if not found then
    return null;
  end if;
  if link.owner_id = me then
    raise exception 'That''s your own code — share it with your partner.' using errcode = 'P0001';
  end if;

  update public.partner_links
    set partner_id = me, partner_label = left(coalesce(label, ''), 40), accepted_at = now(), code_hash = null, code_expires_at = null
    where id = link.id;
  return link.owner_label;
end;
$$;

-- The sharer chooses what their partner sees.
create function public.update_partner_sharing(period boolean, phase boolean, today boolean, fertile boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  update public.partner_links
    set share_period = period, share_phase = phase, share_today = today, share_fertile = fertile
    where owner_id = auth.uid() and revoked_at is null;
end;
$$;

-- Either person ends the link. The summary is deleted with it.
create function public.end_partner_link(link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  update public.partner_links
    set revoked_at = now(), code_hash = null, code_expires_at = null
    where id = link_id and me in (owner_id, partner_id) and revoked_at is null
    returning owner_id into owner;
  if owner is not null then
    delete from public.partner_snapshots where owner_id = owner;
  end if;
end;
$$;

-- What the signed-in partner may see: only switched-on parts, only while active.
create function public.get_partner_view()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'link_id', l.id,
      'label', l.owner_label,
      'updated_at', s.updated_at,
      'as_of', s.data -> 'asOf',
      'period', case when l.share_period then s.data -> 'period' end,
      'phase', case when l.share_phase then s.data -> 'phase' end,
      'today', case when l.share_today then s.data -> 'today' end,
      'fertile', case when l.share_fertile then s.data -> 'fertile' end
    )) order by l.accepted_at), '[]'::jsonb)
  from public.partner_links l
  left join public.partner_snapshots s on s.owner_id = l.owner_id
  where l.partner_id = auth.uid() and l.revoked_at is null and l.accepted_at is not null
$$;

revoke all on function public.create_partner_invite(text) from public, anon;
revoke all on function public.accept_partner_invite(text, text) from public, anon;
revoke all on function public.update_partner_sharing(boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.end_partner_link(uuid) from public, anon;
revoke all on function public.get_partner_view() from public, anon;
grant execute on function public.create_partner_invite(text) to authenticated;
grant execute on function public.accept_partner_invite(text, text) to authenticated;
grant execute on function public.update_partner_sharing(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.end_partner_link(uuid) to authenticated;
grant execute on function public.get_partner_view() to authenticated;

-- Include partner mode in "download my data".
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
    'partner_links', coalesce((select jsonb_agg(jsonb_build_object('role', case when x.owner_id = auth.uid() then 'sharing' else 'partner' end, 'created_at', x.created_at, 'accepted_at', x.accepted_at, 'revoked_at', x.revoked_at, 'share_period', x.share_period, 'share_phase', x.share_phase, 'share_today', x.share_today, 'share_fertile', x.share_fertile) order by x.created_at) from public.partner_links x where auth.uid() in (x.owner_id, x.partner_id)), '[]'),
    'partner_snapshot', (select to_jsonb(x) from public.partner_snapshots x where x.owner_id = auth.uid()),
    'user_consents', coalesce((select jsonb_agg(to_jsonb(x) order by x.recorded_at) from public.user_consents x where x.user_id = auth.uid()), '[]'),
    'cycle_predictions', (select to_jsonb(x) from public.cycle_predictions x where x.user_id = auth.uid())
  );
$$;
