-- =============================================================================
-- KPIs v1 — modelo de datos y cálculos del panel de indicadores
-- =============================================================================
-- Especificación: docs/spec-kpis.md (§5 reglas de cálculo, §7 modelo de datos).
--
--  1. is_admin(): rol admin leído del token (como is_staff()).
--  2. center_settings (solo la zona horaria; la marca llegará con la vista de
--     cliente) y kpi_today(): "hoy" en la zona horaria del centro.
--  3. Estados del cliente: client_end_reasons + client_periods (historial de
--     altas y bajas). clients.is_active pasa a ser un reflejo de los periodos.
--  4. Planes: ended_on (fin efectivo) y estado 'cancelled' (cerrado por baja).
--  5. Horas: profiles.weekly_hours, training_sessions.duration_min y
--     cycle_template_slots.duration_min.
--  6. session_logs.training_session_id: base para registrar sesiones grupales.
--  7. Objetivos: kpi_targets y cycle_week_targets.
--  8. Datos de demo: columna is_demo en las tablas raíz.
--  9. Vistas kpi_plan_spans y client_sessions (sesiones de cada cliente,
--     individuales y grupales, con su estado).
-- 10. Funciones kpi_* que solo puede ejecutar el servidor (service_role).
-- =============================================================================

-- 1. Rol admin -----------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

comment on function public.is_admin() is
  'true si el usuario de la sesión es admin según app_metadata.role del JWT';

-- 2. Configuración del centro (mínima) y "hoy" ------------------------------
create table if not exists public.center_settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'Europe/Madrid',
  updated_at timestamptz not null default now()
);

comment on table public.center_settings is
  'Configuración del centro (una fila). La marca y los módulos llegarán con docs/spec-vista-cliente.md §7.4';

insert into public.center_settings (id) values (1) on conflict (id) do nothing;

alter table public.center_settings enable row level security;
create policy "personal_lee" on public.center_settings for select to authenticated
  using ((select public.is_staff()));
create policy "admin_escribe" on public.center_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- security definer: la usan vistas con security_invoker y debe funcionar
-- para cualquier usuario sin darle acceso a center_settings.
create or replace function public.kpi_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select timezone from public.center_settings where id = 1),
    'Europe/Madrid'
  ))::date
$$;

comment on function public.kpi_today() is 'Fecha de hoy en la zona horaria del centro';

-- 3. Estados del cliente ---------------------------------------------------------
create table public.client_end_reasons (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  requires_notes boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.client_end_reasons is
  'Motivos de baja del cliente. Catálogo configurable por centro (docs/spec-kpis.md §7.2)';

insert into public.client_end_reasons (label, sort_order, requires_notes) values
  ('Precio', 10, false),
  ('Horario o falta de tiempo', 20, false),
  ('Cambio de domicilio', 30, false),
  ('Lesión o motivo de salud', 40, false),
  ('No está satisfecho con el servicio', 50, false),
  ('Ha cumplido su objetivo', 60, false),
  ('Otro', 99, true);

create table public.client_periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  started_on date not null,
  ended_on date,
  end_reason_id uuid references public.client_end_reasons (id),
  end_notes text,
  started_by uuid references public.profiles (id) on delete set null,
  ended_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_periods_fechas check (ended_on is null or ended_on >= started_on),
  constraint client_periods_motivo check (ended_on is null or end_reason_id is not null)
);

comment on table public.client_periods is
  'Historial de altas y bajas del cliente. ended_on = fecha de baja (desde ese día está de baja); null = periodo abierto';

create unique index client_periods_un_abierto on public.client_periods (client_id) where ended_on is null;
create index client_periods_client on public.client_periods (client_id, started_on);

-- Cada cliente existente empieza con un periodo abierto desde su fecha de inicio.
insert into public.client_periods (client_id, started_on, started_by)
select c.id, c.start_date, (select p.id from public.profiles p where p.id = c.created_by)
from public.clients c;

-- Alta de cliente → primer periodo (vale para la app, el script de demo y SQL).
create or replace function public.clients_crear_periodo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.client_periods (client_id, started_on, started_by)
  values (new.id, new.start_date, (select p.id from public.profiles p where p.id = new.created_by));
  return new;
end
$$;

create trigger clients_crear_periodo
after insert on public.clients
for each row execute function public.clients_crear_periodo();

-- clients.is_active = tiene un periodo abierto (se mantiene por compatibilidad).
create or replace function public.client_periods_sync_is_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := coalesce(new.client_id, old.client_id);
begin
  update public.clients c
  set is_active = exists (
    select 1 from public.client_periods cp where cp.client_id = v_client and cp.ended_on is null
  )
  where c.id = v_client;
  return null;
end
$$;

create trigger client_periods_sync_is_active
after insert or update or delete on public.client_periods
for each row execute function public.client_periods_sync_is_active();

-- 4. Planes ------------------------------------------------------------------------
alter table public.training_plans add column ended_on date;

comment on column public.training_plans.ended_on is
  'Fin efectivo cuando el plan se cierra antes de end_date (plan sustituido o baja del cliente)';

alter table public.training_plans drop constraint training_plans_status_check;
alter table public.training_plans add constraint training_plans_status_check
  check (status = any (array['active', 'completed', 'draft', 'cancelled']));

-- Planes ya sustituidos: terminan el día antes de que empiece el siguiente.
update public.training_plans p
set ended_on = greatest(p.start_date, least(p.end_date, n.next_start - 1))
from (
  select p1.id, (
    select min(p2.start_date) from public.training_plans p2
    where p2.client_id = p1.client_id and p2.id <> p1.id and p2.created_at > p1.created_at
  ) as next_start
  from public.training_plans p1
  where p1.status = 'completed'
) n
where n.id = p.id and n.next_start is not null and n.next_start - 1 < p.end_date;

-- 5. Horas -----------------------------------------------------------------------
alter table public.profiles add column weekly_hours numeric(4, 1)
  check (weekly_hours is null or (weekly_hours >= 0 and weekly_hours <= 80));
comment on column public.profiles.weekly_hours is
  'Horas semanales disponibles para sesiones (base del % de ocupación por entrenador)';

alter table public.training_sessions add column duration_min integer not null default 60
  check (duration_min > 0 and duration_min <= 240);
alter table public.cycle_template_slots add column duration_min integer not null default 60
  check (duration_min > 0 and duration_min <= 240);

-- 6. Registro de sesiones grupales (solo el dato; la interfaz llegará aparte) ----
alter table public.session_logs add column training_session_id uuid
  references public.training_sessions (id) on delete cascade;
alter table public.session_logs add constraint session_logs_una_sesion
  check (num_nonnulls(plan_session_id, training_session_id) = 1);
create unique index session_logs_grupal_cliente on public.session_logs (training_session_id, client_id)
  where training_session_id is not null;

-- 7. Objetivos ------------------------------------------------------------------------
create table public.kpi_targets (
  key text primary key,
  label text not null,
  unit text not null,
  value_min numeric,
  value_max numeric,
  sort_order int not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.kpi_targets is 'Objetivos y umbrales de los indicadores, editables por el admin';

insert into public.kpi_targets (key, label, unit, value_min, value_max, sort_order) values
  ('churn_max',               'Churn mensual (máximo)',               '%',    null, 5,    10),
  ('retention_min',           'Retención (mínimo)',                   '%',    70,   null, 20),
  ('adherence_min',           'Adherencia del centro (mínimo)',       '%',    80,   null, 30),
  ('group_occupancy_min',     'Ocupación grupal (mínimo)',            '%',    70,   null, 40),
  ('trainer_occupancy_range', 'Ocupación por entrenador (rango)',     '%',    60,   85,   50),
  ('alert_inactive_days',     'Alerta: días inactivo',                'días', 30,   null, 60),
  ('alert_plan_end_days',     'Alerta: días antes del fin del plan',  'días', 14,   null, 70),
  ('alert_adherence_min',     'Alerta: adherencia individual mínima', '%',    60,   null, 80),
  ('renewal_window_days',     'Ventana de renovación',                'días', 14,   null, 90);

create table public.cycle_week_targets (
  week smallint primary key check (week between 1 and 4),
  phase_name text not null,
  rpe_min numeric not null,
  rpe_max numeric not null,
  rir_min numeric not null,
  rir_max numeric not null
);

comment on table public.cycle_week_targets is
  'Objetivo de RPE y RIR de cada semana del ciclo de 4 semanas (datos del centro, no código)';

insert into public.cycle_week_targets values
  (1, 'Consolidar técnica', 6, 6, 6, 6),
  (2, 'Submáximo',          7, 7, 3, 3),
  (3, 'Máximo',             8, 8, 2, 2),
  (4, 'Estabilización',     7, 8, 2, 3);

-- 8. Datos de demo -------------------------------------------------------------------
alter table public.clients add column is_demo boolean not null default false;
alter table public.profiles add column is_demo boolean not null default false;
alter table public.group_cycles add column is_demo boolean not null default false;
alter table public.cycle_templates add column is_demo boolean not null default false;

-- RLS de las tablas nuevas ---------------------------------------------------------
alter table public.client_end_reasons enable row level security;
alter table public.client_periods enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.cycle_week_targets enable row level security;

create policy "personal_todo" on public.client_end_reasons for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "personal_todo" on public.client_periods for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "personal_lee" on public.kpi_targets for select to authenticated
  using ((select public.is_staff()));
create policy "admin_escribe" on public.kpi_targets for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "personal_lee" on public.cycle_week_targets for select to authenticated
  using ((select public.is_staff()));
create policy "admin_escribe" on public.cycle_week_targets for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant all on public.center_settings, public.client_end_reasons, public.client_periods,
  public.kpi_targets, public.cycle_week_targets to authenticated, service_role;

-- 9. Vistas base -----------------------------------------------------------------------

-- Planes con su fin efectivo (sin borradores).
create view public.kpi_plan_spans with (security_invoker = on) as
select
  p.id,
  p.client_id,
  p.type,
  p.assigned_employee_id as employee_id,
  p.session_duration,
  p.status,
  p.start_date,
  coalesce(p.ended_on, p.end_date) as eff_end,
  p.created_at
from public.training_plans p
where p.status <> 'draft';

-- Una fila por (cliente, sesión), individual o grupal, con su estado:
--   cancelled   sesión cancelada o posterior al fin efectivo del plan
--   completed   hay un registro completado de ese cliente
--   unrecorded  (solo grupal) sesión pasada en la que no se registró a nadie
--   missed      sesión pasada sin registro completado
--   scheduled   hoy o futura, sin completar
-- Las filas 'individual' de training_sessions son una copia antigua: no se usan.
create view public.client_sessions with (security_invoker = on) as
select
  'plan_session'::text as source,
  ps.id as source_id,
  p.client_id,
  ps.session_date,
  ps.session_time,
  p.type,
  p.employee_id,
  p.session_duration as duration_min,
  case
    when ps.session_date > p.eff_end then 'cancelled'
    when exists (
      select 1 from public.session_logs sl
      where sl.plan_session_id = ps.id and sl.status = 'completed'
    ) then 'completed'
    when ps.session_date < public.kpi_today() then 'missed'
    else 'scheduled'
  end as status
from public.plan_sessions ps
join public.kpi_plan_spans p on p.id = ps.plan_id
union all
select
  'training_session'::text,
  ts.id,
  tsc.client_id,
  ts.session_date,
  ts.session_time,
  'group'::text,
  ts.assigned_employee_id,
  ts.duration_min,
  case
    when ts.status = 'cancelled' then 'cancelled'
    when exists (
      select 1 from public.session_logs sl
      where sl.training_session_id = ts.id and sl.client_id = tsc.client_id and sl.status = 'completed'
    ) then 'completed'
    when ts.session_date < public.kpi_today() and not exists (
      select 1 from public.session_logs sl where sl.training_session_id = ts.id
    ) then 'unrecorded'
    when ts.session_date < public.kpi_today() then 'missed'
    else 'scheduled'
  end
from public.training_sessions ts
join public.training_session_clients tsc on tsc.session_id = ts.id
where ts.type = 'group';

comment on view public.client_sessions is
  'Sesiones de cada cliente (individuales y grupales) con su estado. Base de la adherencia (docs/spec-kpis.md §5.3)';

revoke all on public.kpi_plan_spans, public.client_sessions from anon;

-- 10. Funciones de cálculo -------------------------------------------------------------

-- Estado de cada cliente en una fecha: 'active' | 'inactive' | 'baja'
-- (null si aún no se había dado de alta). Atribuido al entrenador y al tipo
-- de su último plan empezado en esa fecha.
create or replace function public.kpi_client_states(p_date date)
returns table (client_id uuid, client_name text, state text, employee_id uuid, plan_type text, since date)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    c.first_name || ' ' || c.last_name,
    case
      when cov.started_on is not null then
        case when exists (
          select 1 from public.kpi_plan_spans p
          where p.client_id = c.id and p.start_date <= p_date and p.eff_end >= p_date
        ) then 'active' else 'inactive' end
      else 'baja'
    end,
    lp.employee_id,
    lp.type,
    coalesce(cov.started_on, ended.ended_on)
  from public.clients c
  left join lateral (
    select cp.started_on from public.client_periods cp
    where cp.client_id = c.id and cp.started_on <= p_date and (cp.ended_on is null or cp.ended_on > p_date)
    limit 1
  ) cov on true
  left join lateral (
    select max(cp.ended_on) as ended_on from public.client_periods cp
    where cp.client_id = c.id and cp.started_on <= p_date and cp.ended_on <= p_date
  ) ended on true
  left join lateral (
    select p.employee_id, p.type from public.kpi_plan_spans p
    where p.client_id = c.id and p.start_date <= p_date
    order by p.start_date desc, p.created_at desc
    limit 1
  ) lp on true
  where cov.started_on is not null or ended.ended_on is not null
$$;

-- Días laborables (lunes a viernes, sin festivos activos) entre dos fechas.
create or replace function public.kpi_working_days(p_from date, p_to date)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from generate_series(p_from, p_to, interval '1 day') d
  where extract(isodow from d) < 6
    and not exists (
      select 1 from public.public_holidays h where h.date = d::date and h.is_active
    )
$$;

-- Métricas mensuales en formato largo: una fila por (mes, métrica, dimensión,
-- entrenador, tipo de plan). El servidor filtra por entrenador y tipo y suma
-- num y den para obtener cualquier periodo de meses enteros.
--
--   state       dim active|inactive|baja       clientes al final del mes (o hoy)
--   altas       dim new|reactivation           periodos iniciados en el mes
--   bajas       dim <motivo>                    periodos cerrados en el mes
--   churn_base  —                               clientes de alta al empezar el mes
--   retention   dim renewed|not_renewed|pending planes cuyo fin efectivo cae en el mes
--   sessions    dim <estado de client_sessions> sesiones de cliente del mes
--   occ         dim 'isodow|HH24:MI'            num apuntados, den plazas (grupales)
--   occ_att     dim 'isodow|HH24:MI'            num asistidos, den apuntados (grupales registradas)
--   hours       —                               minutos de sesión asignados
--   avail       —                               minutos disponibles (weekly_hours)
--   imparted    —                               sesiones registradas como completadas por el entrenador
--   rpe / rir   dim semana del ciclo 1-4        num suma, den nº de registros (grupales)
create or replace function public.kpi_monthly(p_from date, p_to date)
returns table (month date, metric text, dim text, employee_id uuid, plan_type text, num numeric, den numeric)
language sql
stable
set search_path = ''
as $$
  with
  today as (select public.kpi_today() as d),
  win as (
    select coalesce((select value_min from public.kpi_targets where key = 'renewal_window_days'), 14)::int as days
  ),
  m as (
    select
      gs::date as ms,
      (gs + interval '1 month' - interval '1 day')::date as me,
      least((gs + interval '1 month' - interval '1 day')::date, (select d from today)) as ref
    from generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month') gs
    where gs::date <= (select d from today)
  ),
  first_period as (
    select cp.client_id, min(cp.started_on) as first_on from public.client_periods cp group by cp.client_id
  )

  -- Clientes por estado al final del mes
  select m.ms, 'state', s.state, s.employee_id, s.plan_type, count(*)::numeric, null::numeric
  from m cross join lateral public.kpi_client_states(m.ref) s
  group by m.ms, s.state, s.employee_id, s.plan_type

  union all
  -- Altas: nuevas y reactivaciones
  select m.ms, 'altas',
    case when cp.started_on = fp.first_on then 'new' else 'reactivation' end,
    lp.employee_id, lp.type, count(*), null
  from m
  join public.client_periods cp on cp.started_on between m.ms and m.ref
  join first_period fp on fp.client_id = cp.client_id
  left join lateral (
    select p.employee_id, p.type from public.kpi_plan_spans p
    where p.client_id = cp.client_id and p.start_date <= m.ref
    order by p.start_date desc, p.created_at desc limit 1
  ) lp on true
  group by 1, 2, 3, 4, 5

  union all
  -- Bajas por motivo
  select m.ms, 'bajas', coalesce(r.label, 'Sin motivo'), lp.employee_id, lp.type, count(*), null
  from m
  join public.client_periods cp on cp.ended_on between m.ms and m.ref
  left join public.client_end_reasons r on r.id = cp.end_reason_id
  left join lateral (
    select p.employee_id, p.type from public.kpi_plan_spans p
    where p.client_id = cp.client_id and p.start_date <= cp.ended_on
    order by p.start_date desc, p.created_at desc limit 1
  ) lp on true
  group by 1, 2, 3, 4, 5

  union all
  -- Base del churn: de alta al empezar el mes
  select m.ms, 'churn_base', null, lp.employee_id, lp.type, count(*), null
  from m
  join public.client_periods cp on cp.started_on < m.ms and (cp.ended_on is null or cp.ended_on >= m.ms)
  left join lateral (
    select p.employee_id, p.type from public.kpi_plan_spans p
    where p.client_id = cp.client_id and p.start_date < m.ms
    order by p.start_date desc, p.created_at desc limit 1
  ) lp on true
  group by 1, 2, 3, 4, 5

  union all
  -- Retención: planes que terminan en el mes
  select m.ms, 'retention',
    case
      when p.status <> 'cancelled' and exists (
        select 1 from public.kpi_plan_spans q
        where q.client_id = p.client_id and q.id <> p.id
          and q.start_date > p.start_date
          and q.start_date <= p.eff_end + (select days from win)
      ) then 'renewed'
      when p.status <> 'cancelled' and p.eff_end + (select days from win) > (select d from today) then 'pending'
      else 'not_renewed'
    end,
    p.employee_id, p.type, count(*), null
  from m
  join public.kpi_plan_spans p on p.eff_end between m.ms and m.ref
  group by 1, 2, 3, 4, 5

  union all
  -- Sesiones de cliente por estado
  select m.ms, 'sessions', cs.status, cs.employee_id, cs.type, count(*), null
  from m
  join public.client_sessions cs on cs.session_date between m.ms and m.me
  group by 1, 2, 3, 4, 5

  union all
  -- Ocupación grupal por franja (día de la semana y hora)
  select m.ms, 'occ',
    extract(isodow from ts.session_date)::int || '|' || to_char(ts.session_time, 'HH24:MI'),
    ts.assigned_employee_id, 'group',
    sum((select count(*) from public.training_session_clients tsc where tsc.session_id = ts.id)),
    sum(coalesce(ts.max_clients, 0))
  from m
  join public.training_sessions ts on ts.session_date between m.ms and m.me
  where ts.type = 'group' and ts.status <> 'cancelled'
  group by 1, 2, 3, 4, 5

  union all
  -- Asistencia real en sesiones grupales registradas
  select m.ms, 'occ_att',
    extract(isodow from ts.session_date)::int || '|' || to_char(ts.session_time, 'HH24:MI'),
    ts.assigned_employee_id, 'group',
    sum((select count(*) from public.session_logs sl where sl.training_session_id = ts.id and sl.status = 'completed')),
    sum((select count(*) from public.training_session_clients tsc where tsc.session_id = ts.id))
  from m
  join public.training_sessions ts on ts.session_date between m.ms and m.ref
  where ts.type = 'group' and ts.status <> 'cancelled'
    and exists (select 1 from public.session_logs sl where sl.training_session_id = ts.id)
  group by 1, 2, 3, 4, 5

  union all
  -- Horas asignadas: sesiones individuales (una por cliente)
  select m.ms, 'hours', null, p.employee_id, 'individual', sum(p.session_duration), null
  from m
  join public.plan_sessions ps on ps.session_date between m.ms and m.me
  join public.kpi_plan_spans p on p.id = ps.plan_id and p.type = 'individual'
  where ps.session_date <= p.eff_end
  group by 1, 2, 3, 4, 5

  union all
  -- Horas asignadas: planes grupales del wizard (una vez por entrenador, día y hora)
  select x.ms, 'hours', null, x.employee_id, 'group', sum(x.session_duration), null
  from (
    select distinct m.ms, p.employee_id, ps.session_date, ps.session_time, p.session_duration
    from m
    join public.plan_sessions ps on ps.session_date between m.ms and m.me
    join public.kpi_plan_spans p on p.id = ps.plan_id and p.type = 'group'
    where ps.session_date <= p.eff_end
  ) x
  group by 1, 2, 3, 4, 5

  union all
  -- Horas asignadas: sesiones de ciclo grupal
  select m.ms, 'hours', null, ts.assigned_employee_id, 'group', sum(ts.duration_min), null
  from m
  join public.training_sessions ts on ts.session_date between m.ms and m.me
  where ts.type = 'group' and ts.status <> 'cancelled'
  group by 1, 2, 3, 4, 5

  union all
  -- Minutos disponibles por entrenador
  select m.ms, 'avail', null, pr.id, null,
    pr.weekly_hours * 60 / 5 * public.kpi_working_days(m.ms, m.me), null
  from m
  cross join public.profiles pr
  where pr.role in ('employee', 'admin') and pr.is_active and pr.weekly_hours is not null

  union all
  -- Sesiones impartidas (registradas como completadas)
  select m.ms, 'imparted', null, sl.employee_id,
    case when sl.training_session_id is not null then 'group' else p.type end,
    count(*), null
  from m
  join public.session_logs sl on sl.date between m.ms and m.ref and sl.status = 'completed'
  left join public.plan_sessions ps on ps.id = sl.plan_session_id
  left join public.training_plans p on p.id = ps.plan_id
  group by 1, 2, 3, 4, 5

  union all
  -- RPE y RIR por semana del ciclo (sesiones grupales registradas)
  select m.ms, k.metric, (ts.day_index / 5 + 1)::text, ts.assigned_employee_id, 'group',
    sum(k.val), count(k.val)
  from m
  join public.session_logs sl on sl.date between m.ms and m.ref and sl.training_session_id is not null
  join public.training_sessions ts on ts.id = sl.training_session_id
  join public.exercise_logs el on el.session_log_id = sl.id and not coalesce(el.skipped, false)
  cross join lateral (values ('rpe', el.rpe::numeric), ('rir', el.rir::numeric)) k(metric, val)
  where k.val is not null and ts.day_index is not null
  group by 1, 2, 3, 4, 5
$$;

-- Progresión de carga de cada cliente de alta en p_to: carga media de cada
-- ejercicio en las últimas 4 semanas frente a las 4 anteriores.
--   up (> +2 %) | flat | down (< −2 %) | nodata (sin ejercicios comparables)
create or replace function public.kpi_progress(p_to date)
returns table (client_id uuid, employee_id uuid, plan_type text, class text, variation numeric)
language sql
stable
set search_path = ''
as $$
  with
  w as (
    select sl.client_id, el.exercise_id, sl.date, el.load_kg
    from public.exercise_logs el
    join public.session_logs sl on sl.id = el.session_log_id
    where sl.status = 'completed'
      and not coalesce(el.skipped, false)
      and el.load_kg > 0
      and el.exercise_id is not null
      and sl.date between p_to - 55 and p_to
  ),
  per_ex as (
    select w.client_id, w.exercise_id,
      avg(w.load_kg) filter (where w.date > p_to - 28) as recent,
      avg(w.load_kg) filter (where w.date <= p_to - 28) as prev
    from w group by 1, 2
  ),
  comp as (
    select per_ex.client_id, avg((recent - prev) / prev) as variation
    from per_ex where recent is not null and prev is not null
    group by 1
  )
  select s.client_id, s.employee_id, s.plan_type,
    case
      when comp.variation is null then 'nodata'
      when comp.variation > 0.02 then 'up'
      when comp.variation < -0.02 then 'down'
      else 'flat'
    end,
    round(comp.variation * 100, 1)
  from public.kpi_client_states(p_to) s
  left join comp on comp.client_id = s.client_id
  where s.state <> 'baja'
$$;

-- Alertas para actuar, a fecha de hoy.
--   inactive       de alta sin plan vigente desde hace más de N días
--   plan_ending    plan vigente que termina en N días o menos sin plan posterior
--   low_adherence  adherencia de los últimos 30 días por debajo del umbral
create or replace function public.kpi_alerts()
returns table (kind text, client_id uuid, client_name text, value numeric, ref_date date, employee_id uuid, plan_type text)
language sql
stable
set search_path = ''
as $$
  with
  today as (select public.kpi_today() as d),
  t as (
    select
      coalesce((select value_min from public.kpi_targets where key = 'alert_inactive_days'), 30)::int as inactive_days,
      coalesce((select value_min from public.kpi_targets where key = 'alert_plan_end_days'), 14)::int as plan_end_days,
      coalesce((select value_min from public.kpi_targets where key = 'alert_adherence_min'), 60) as adherence_min
  ),
  s as (select * from public.kpi_client_states((select d from today)))

  select 'inactive', s.client_id, s.client_name,
    ((select d from today) - x.since)::numeric, x.since, s.employee_id, s.plan_type
  from s
  cross join lateral (
    select greatest(
      s.since,
      coalesce((select max(p.eff_end) + 1 from public.kpi_plan_spans p
                where p.client_id = s.client_id and p.eff_end < (select d from today)), s.since)
    ) as since
  ) x
  where s.state = 'inactive' and (select d from today) - x.since > (select inactive_days from t)

  union all
  select 'plan_ending', s.client_id, s.client_name,
    (p.eff_end - (select d from today))::numeric, p.eff_end, p.employee_id, p.type
  from s
  join public.kpi_plan_spans p on p.client_id = s.client_id
    and p.start_date <= (select d from today)
    and p.eff_end between (select d from today) and (select d from today) + (select plan_end_days from t)
  where s.state = 'active'
    and not exists (
      select 1 from public.kpi_plan_spans q
      where q.client_id = p.client_id and q.id <> p.id and q.start_date > p.start_date
    )

  union all
  select 'low_adherence', s.client_id, s.client_name,
    round(100.0 * a.completed / (a.completed + a.missed), 0), null, s.employee_id, s.plan_type
  from s
  cross join lateral (
    select
      count(*) filter (where cs.status = 'completed') as completed,
      count(*) filter (where cs.status = 'missed') as missed
    from public.client_sessions cs
    where cs.client_id = s.client_id
      and cs.session_date between (select d from today) - 30 and (select d from today)
  ) a
  where s.state <> 'baja'
    and a.completed + a.missed >= 4
    and 100.0 * a.completed / (a.completed + a.missed) < (select adherence_min from t)
$$;

-- Solo el servidor (service_role) puede ejecutar los cálculos.
revoke execute on function public.kpi_client_states(date) from public, anon, authenticated;
revoke execute on function public.kpi_working_days(date, date) from public, anon, authenticated;
revoke execute on function public.kpi_monthly(date, date) from public, anon, authenticated;
revoke execute on function public.kpi_progress(date) from public, anon, authenticated;
revoke execute on function public.kpi_alerts() from public, anon, authenticated;
grant execute on function public.kpi_client_states(date) to service_role;
grant execute on function public.kpi_working_days(date, date) to service_role;
grant execute on function public.kpi_monthly(date, date) to service_role;
grant execute on function public.kpi_progress(date) to service_role;
grant execute on function public.kpi_alerts() to service_role;
