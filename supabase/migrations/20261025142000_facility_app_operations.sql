create or replace view public.facility_ev_sessions
with (security_barrier = true)
as
select
  id,
  facility_id,
  bay_id,
  driver_name,
  license_plate,
  vehicle_model,
  battery_capacity_kwh,
  current_charge_percent,
  target_charge_percent,
  trip_distance_km,
  arrival_time,
  departure_time,
  status,
  queue_position,
  (user_id = (select auth.uid())) as is_owner,
  created_at,
  updated_at
from public.ev_sessions
where status <> 'DEPARTED';

revoke all on public.facility_ev_sessions from anon;
grant select on public.facility_ev_sessions to authenticated;

create table public.facility_signals (
  facility_id uuid primary key references public.facilities (id) on delete cascade,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.facility_signals (facility_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (facility_id) do nothing;

alter table public.facility_signals enable row level security;
revoke all on public.facility_signals from anon;
grant select on public.facility_signals to authenticated;

create policy "Authenticated users can read facility update signals"
  on public.facility_signals for select to authenticated
  using (true);

create or replace function public.signal_facility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_facility_id uuid;
begin
  if tg_op = 'DELETE' then
    v_facility_id := (to_jsonb(old) ->> 'facility_id')::uuid;
  else
    v_facility_id := (to_jsonb(new) ->> 'facility_id')::uuid;
  end if;

  insert into public.facility_signals as current_signal (facility_id, version, updated_at)
  values (v_facility_id, 1, now())
  on conflict (facility_id) do update
    set version = current_signal.version + 1,
        updated_at = now();

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger signal_ev_session_change
  after insert or update or delete on public.ev_sessions
  for each row execute function public.signal_facility_change();

create trigger signal_facility_config_change
  after insert or update or delete on public.facility_config
  for each row execute function public.signal_facility_change();

create trigger signal_bay_change
  after insert or update or delete on public.bays
  for each row execute function public.signal_facility_change();

revoke insert, update, delete on public.ev_sessions from authenticated;
grant select on public.ev_sessions to authenticated;

create or replace function public.create_ev_session(
  p_facility_id uuid,
  p_driver_name text,
  p_license_plate text,
  p_vehicle_model text,
  p_battery_capacity_kwh numeric,
  p_current_charge_percent numeric,
  p_target_charge_percent numeric,
  p_trip_distance_km numeric,
  p_departure_time timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_bay_id bigint;
  v_session_id uuid := gen_random_uuid();
  v_queue_position integer;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to add a vehicle.';
  end if;
  if p_departure_time <= now() then
    raise exception 'Departure time must be in the future.';
  end if;
  if p_battery_capacity_kwh <= 0
    or p_current_charge_percent < 0 or p_current_charge_percent > 100
    or p_target_charge_percent < p_current_charge_percent or p_target_charge_percent > 100
    or p_trip_distance_km < 0 then
    raise exception 'Vehicle charging details are invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_facility_id::text, 0));

  select b.id into v_bay_id
  from public.bays b
  where p_target_charge_percent > p_current_charge_percent
    and b.facility_id = p_facility_id
    and not exists (
      select 1
      from public.ev_sessions active
      where active.bay_id = b.id
        and active.status in ('WAITING', 'CHARGING')
    )
  order by b.id
  limit 1;

  select coalesce(max(s.queue_position), 0) + 1 into v_queue_position
  from public.ev_sessions s
  where s.facility_id = p_facility_id
    and s.status = 'WAITING';

  insert into public.ev_sessions (
    id,
    user_id,
    facility_id,
    bay_id,
    driver_name,
    license_plate,
    vehicle_model,
    battery_capacity_kwh,
    current_charge_percent,
    target_charge_percent,
    trip_distance_km,
    departure_time,
    status,
    queue_position
  ) values (
    v_session_id,
    v_user_id,
    p_facility_id,
    v_bay_id,
    trim(p_driver_name),
    upper(trim(p_license_plate)),
    trim(p_vehicle_model),
    p_battery_capacity_kwh,
    p_current_charge_percent,
    p_target_charge_percent,
    p_trip_distance_km,
    p_departure_time,
    case
      when p_target_charge_percent <= p_current_charge_percent then 'COMPLETED'
      when v_bay_id is null then 'WAITING'
      else 'CHARGING'
    end,
    case
      when p_target_charge_percent > p_current_charge_percent and v_bay_id is null then v_queue_position
      else null
    end
  );

  return v_session_id;
end;
$$;

create or replace function public.depart_ev_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.ev_sessions%rowtype;
  v_next_session_id uuid;
begin
  select * into v_session
  from public.ev_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Charging session was not found.';
  end if;
  if v_session.user_id <> auth.uid() and not public.is_facility_admin() then
    raise exception 'You can only depart your own vehicle.';
  end if;
  if v_session.status = 'DEPARTED' then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_session.facility_id::text, 0));

  update public.ev_sessions
  set status = 'DEPARTED', bay_id = null, queue_position = null, updated_at = now()
  where id = p_session_id;

  if v_session.bay_id is not null then
    select id into v_next_session_id
    from public.ev_sessions
    where facility_id = v_session.facility_id and status = 'WAITING'
    order by arrival_time, id
    limit 1
    for update;

    if v_next_session_id is not null then
      update public.ev_sessions
      set status = 'CHARGING', bay_id = v_session.bay_id, queue_position = null, updated_at = now()
      where id = v_next_session_id;
    end if;

  end if;

  with waiting as (
    select id, row_number() over (order by arrival_time, id)::integer as position
    from public.ev_sessions
    where facility_id = v_session.facility_id and status = 'WAITING'
  )
  update public.ev_sessions s
  set queue_position = waiting.position, updated_at = now()
  from waiting
  where s.id = waiting.id;
end;
$$;

create or replace function public.sync_my_ev_progress(
  p_session_id uuid,
  p_current_charge_percent numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.ev_sessions%rowtype;
  v_next_session_id uuid;
begin
  select * into v_session
  from public.ev_sessions
  where id = p_session_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Charging session not found or not owned by the signed-in user.';
  end if;
  if v_session.status <> 'CHARGING' then
    return;
  end if;
  if p_current_charge_percent < v_session.current_charge_percent
    or p_current_charge_percent > v_session.target_charge_percent then
    raise exception 'Charge progress must be between its current and target charge.';
  end if;

  if p_current_charge_percent >= v_session.target_charge_percent then
    perform pg_advisory_xact_lock(hashtextextended(v_session.facility_id::text, 0));

    update public.ev_sessions
    set current_charge_percent = v_session.target_charge_percent,
        status = 'COMPLETED',
        bay_id = null,
        queue_position = null,
        updated_at = now()
    where id = p_session_id;

    if v_session.bay_id is not null then
      select id into v_next_session_id
      from public.ev_sessions
      where facility_id = v_session.facility_id and status = 'WAITING'
      order by arrival_time, id
      limit 1
      for update;

      if v_next_session_id is not null then
        update public.ev_sessions
        set status = 'CHARGING', bay_id = v_session.bay_id, queue_position = null, updated_at = now()
        where id = v_next_session_id;
      end if;

      with waiting as (
        select id, row_number() over (order by arrival_time, id)::integer as position
        from public.ev_sessions
        where facility_id = v_session.facility_id and status = 'WAITING'
      )
      update public.ev_sessions s
      set queue_position = waiting.position, updated_at = now()
      from waiting
      where s.id = waiting.id;
    end if;
  else
    update public.ev_sessions
    set current_charge_percent = p_current_charge_percent, updated_at = now()
    where id = p_session_id;
  end if;
end;
$$;

revoke all on function public.create_ev_session(uuid, text, text, text, numeric, numeric, numeric, numeric, timestamptz) from public, anon;
revoke all on function public.depart_ev_session(uuid) from public, anon;
revoke all on function public.sync_my_ev_progress(uuid, numeric) from public, anon;
revoke all on function public.signal_facility_change() from public, anon, authenticated;
grant execute on function public.create_ev_session(uuid, text, text, text, numeric, numeric, numeric, numeric, timestamptz) to authenticated;
grant execute on function public.depart_ev_session(uuid) to authenticated;
grant execute on function public.sync_my_ev_progress(uuid, numeric) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'facility_signals'
  ) then
    alter publication supabase_realtime add table public.facility_signals;
  end if;
end;
$$;
