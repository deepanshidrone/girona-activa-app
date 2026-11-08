-- Vista de cliente: acceso de lectura del cliente a SUS datos
-- docs/spec-vista-cliente.md §7.1 y §8.2
--
-- Diseño: el cliente sigue sin acceso directo a ninguna tabla (BUG-002). Solo
-- lee las vistas mi_*, que:
--   - se ejecutan con los permisos de su propietario (no security_invoker),
--   - filtran SIEMPRE por public.my_client_id() (el cliente de la sesión),
--   - no tienen columnas internas (notes de ficha, sesión y registros; D2),
--   - son security_barrier, para que un filtro del cliente no se evalúe antes
--     que el filtro de la vista,
--   - solo tienen GRANT SELECT para authenticated (sin insert/update/delete:
--     una vista simple es actualizable y escribiría con permisos del dueño).
-- Para el personal, my_client_id() es null y las vistas salen vacías.
--
-- Las mi_* NO pueden apoyarse en vistas security_invoker (client_sessions,
-- kpi_plan_spans): dentro de ellas los permisos se comprueban con el usuario
-- que consulta y la RLS se lo bloquea todo al cliente. Por eso la regla de
-- estados de las sesiones pasa a private.sesiones (esquema que la API no
-- publica), y de ella leen tanto client_sessions (KPIs) como mi_sesiones.
--
-- Además, client_sessions gana tres columnas al final: session_label,
-- difficulty y cycle_id (para el detalle de sesión y los ejercicios grupales).

-- 1. Cliente de la sesión ------------------------------------------------------
-- Solo si la sesión tiene rol client (hay fichas de prueba antiguas enlazadas
-- a cuentas de personal).
create or replace function public.my_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.clients c
  where c.user_id = (select auth.uid())
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'client'
  limit 1
$$;

comment on function public.my_client_id() is
  'id de clients del usuario de la sesión, solo con rol client (null en otro caso)';

revoke execute on function public.my_client_id() from public, anon;
grant execute on function public.my_client_id() to authenticated, service_role;

-- 2. Sesiones de cada cliente: private.sesiones + client_sessions --------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to service_role;

-- Vista con los permisos de su dueño: ve todas las sesiones de todos los
-- clientes. Nadie la lee directamente: solo client_sessions (filtrada para el
-- personal) y mi_sesiones (filtrada por el cliente de la sesión).
-- Mismas columnas y orden que client_sessions en 20261106120000_kpis_v1.sql,
-- más session_label, difficulty y cycle_id al final.
create view private.sesiones as
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
  end as status,
  ps.session_label,
  case tp.level when 1 then 'regression' when 3 then 'progression' else 'base' end as difficulty,
  tp.cycle_id
from public.plan_sessions ps
join (
  -- mismo cálculo que public.kpi_plan_spans (que es security_invoker)
  select p.id, p.client_id, p.type, p.assigned_employee_id as employee_id,
         p.session_duration, coalesce(p.ended_on, p.end_date) as eff_end
  from public.training_plans p
  where p.status <> 'draft'
) p on p.id = ps.plan_id
join public.training_plans tp on tp.id = ps.plan_id
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
  end,
  ts.session_label,
  coalesce(tsc.difficulty, 'base'),
  ts.cycle_id
from public.training_sessions ts
join public.training_session_clients tsc on tsc.session_id = ts.id
where ts.type = 'group';

revoke all on private.sesiones from public, anon, authenticated;
grant select on private.sesiones to service_role;

-- client_sessions sigue siendo security_invoker. Solo la leen las funciones
-- kpi_* (service_role); el filtro es una segunda barrera por si alguien le
-- vuelve a dar permiso a authenticated. Para un cliente o anon, nada.
create or replace view public.client_sessions with (security_invoker = on) as
select s.*
from private.sesiones s
where current_user = 'service_role' or (select public.is_staff());

revoke all on public.client_sessions from public, anon, authenticated;
grant select on public.client_sessions to service_role;

-- 3. Vistas del cliente ----------------------------------------------------------

-- Su ficha, sin notas internas, con su estado (misma regla que kpi_client_states).
create view public.mi_ficha with (security_barrier = true) as
select
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.sex,
  c.birth_date,
  c.height_cm,
  c.weight_kg,
  c.start_date,
  case
    when not exists (
      select 1 from public.client_periods cp
      where cp.client_id = c.id and cp.started_on <= public.kpi_today()
        and (cp.ended_on is null or cp.ended_on > public.kpi_today())
    ) then 'baja'
    when exists (
      select 1 from public.training_plans p
      where p.client_id = c.id and p.status <> 'draft'
        and p.start_date <= public.kpi_today()
        and coalesce(p.ended_on, p.end_date) >= public.kpi_today()
    ) then 'active'
    else 'inactive'
  end as state
from public.clients c
where c.id = public.my_client_id();

-- Sus planes (vigente e históricos) con el nombre del entrenador.
create view public.mi_planes with (security_barrier = true) as
select
  tp.id,
  tp.type,
  tp.level,
  tp.status,
  tp.start_date,
  tp.end_date,
  coalesce(tp.ended_on, tp.end_date) as eff_end,
  tp.duration_months,
  tp.weekly_frequency,
  tp.session_duration,
  tp.cycle_id,
  pr.full_name as trainer_name,
  (tp.status <> 'draft'
    and tp.start_date <= public.kpi_today()
    and coalesce(tp.ended_on, tp.end_date) >= public.kpi_today()) as is_current
from public.training_plans tp
left join public.profiles pr on pr.id = tp.assigned_employee_id
where tp.client_id = public.my_client_id()
  and tp.status <> 'draft';

-- Sus sesiones (individuales y grupales) con estado, bloque, dificultad y entrenador.
create view public.mi_sesiones with (security_barrier = true) as
select
  cs.source,
  cs.source_id,
  cs.session_date,
  cs.session_time,
  cs.type,
  cs.duration_min,
  cs.status,
  cs.session_label,
  cs.difficulty,
  cs.cycle_id,
  pr.full_name as trainer_name
from private.sesiones cs
left join public.profiles pr on pr.id = cs.employee_id
where cs.client_id = public.my_client_id();

-- Ejercicios planificados de sus sesiones, con las indicaciones (D2: sí se ven).
--   individual          plan_session_exercises
--   plan grupal         group_sessions del ciclo del plan × bloque × dificultad del nivel
--   sesión de ciclo     group_sessions del ciclo × bloque × dificultad del cliente
create view public.mi_ejercicios_planificados with (security_barrier = true) as
select
  'plan_session'::text as source,
  ps.id as source_id,
  pse.id as planned_id,
  pse.order_index,
  e.id as exercise_id,
  e.name as exercise_name,
  e.image_url,
  pse.sets,
  pse.reps,
  pse.weight_kg,
  pse.notes as instructions
from public.plan_session_exercises pse
join public.plan_sessions ps on ps.id = pse.session_id
join public.training_plans tp on tp.id = ps.plan_id
join public.exercises e on e.id = pse.exercise_id
where tp.client_id = public.my_client_id()
  and tp.type = 'individual'
union all
select
  'plan_session'::text,
  ps.id,
  gse.id,
  gse.order_index,
  e.id,
  e.name,
  e.image_url,
  gse.sets,
  gse.reps,
  gse.weight_kg,
  gse.notes
from public.plan_sessions ps
join public.training_plans tp on tp.id = ps.plan_id
join public.group_sessions gs
  on gs.cycle_id = tp.cycle_id
 and gs.label = ps.session_label
 and gs.difficulty = case tp.level when 1 then 'regression' when 3 then 'progression' else 'base' end
join public.group_session_exercises gse on gse.session_id = gs.id
join public.exercises e on e.id = gse.exercise_id
where tp.client_id = public.my_client_id()
  and tp.type = 'group'
union all
select
  'training_session'::text,
  ts.id,
  gse.id,
  gse.order_index,
  e.id,
  e.name,
  e.image_url,
  gse.sets,
  gse.reps,
  gse.weight_kg,
  gse.notes
from public.training_sessions ts
join public.training_session_clients tsc on tsc.session_id = ts.id
join public.group_sessions gs
  on gs.cycle_id = ts.cycle_id
 and gs.label = ts.session_label
 and gs.difficulty = coalesce(tsc.difficulty, 'base')
join public.group_session_exercises gse on gse.session_id = gs.id
join public.exercises e on e.id = gse.exercise_id
where tsc.client_id = public.my_client_id()
  and ts.type = 'group';

-- Lo que registró el empleado en sus sesiones, sin notas internas.
create view public.mi_registros with (security_barrier = true) as
select
  sl.id,
  case when sl.training_session_id is not null then 'training_session' else 'plan_session' end as source,
  coalesce(sl.training_session_id, sl.plan_session_id) as source_id,
  sl.date,
  sl.status,
  sl.started_at,
  sl.completed_at
from public.session_logs sl
where sl.client_id = public.my_client_id();

create view public.mi_registros_ejercicios with (security_barrier = true) as
select
  el.id,
  el.session_log_id,
  el.plan_exercise_id,
  el.exercise_id,
  e.name as exercise_name,
  el.sets_done,
  el.reps_done,
  el.load_kg,
  el.rpe,
  el.rir,
  el.skipped
from public.exercise_logs el
join public.session_logs sl on sl.id = el.session_log_id
left join public.exercises e on e.id = el.exercise_id
where sl.client_id = public.my_client_id();

-- Festivos activos del centro (para el calendario; no son datos personales).
create view public.festivos_centro with (security_barrier = true) as
select h.date, h.name
from public.public_holidays h
where h.is_active;

-- 4. Permisos: solo lectura para usuarios con sesión -----------------------------
revoke all on public.mi_ficha, public.mi_planes, public.mi_sesiones,
  public.mi_ejercicios_planificados, public.mi_registros,
  public.mi_registros_ejercicios, public.festivos_centro
  from public, anon, authenticated;

grant select on public.mi_ficha, public.mi_planes, public.mi_sesiones,
  public.mi_ejercicios_planificados, public.mi_registros,
  public.mi_registros_ejercicios, public.festivos_centro
  to authenticated, service_role;

comment on view public.mi_ficha is 'Vista de cliente: su ficha sin notas internas y su estado';
comment on view public.mi_planes is 'Vista de cliente: sus planes';
comment on view public.mi_sesiones is 'Vista de cliente: sus sesiones con estado';
comment on view public.mi_ejercicios_planificados is 'Vista de cliente: ejercicios planificados de sus sesiones';
comment on view public.mi_registros is 'Vista de cliente: registros de sus sesiones, sin notas';
comment on view public.mi_registros_ejercicios is 'Vista de cliente: registros por ejercicio, sin notas';
comment on view public.festivos_centro is 'Festivos activos del centro';
