-- =============================================================================
-- BUG-002 — RLS por rol
-- =============================================================================
-- Antes: políticas "cualquier usuario con sesión puede todo" en casi todas las
-- tablas. Como las políticas permisivas se combinan con OR, anulaban las
-- específicas de cliente, y un cliente con login podía leer y modificar los
-- datos de todos los clientes usando la clave pública. Además, cualquier
-- usuario podía cambiar su propio profiles.role.
--
-- Después:
--   - Personal (app_metadata.role = 'employee' o 'admin', leído del token):
--     acceso completo a las tablas del centro. La diferencia entre admin y
--     employee se controla en las Server Actions (lib/auth/permissions.ts).
--   - Clientes: sin acceso directo a las tablas. La vista de cliente lee desde
--     el servidor; cuando se construya (docs/spec-vista-cliente.md) se le darán
--     vistas de solo lectura sin las columnas internas.
--   - Cada usuario lee su propio perfil y solo puede editar nombre y avatar.
--   - screen_assignments mantiene lectura pública: las pantallas de TrainWall
--     (sin login) escuchan sus cambios en tiempo real. Solo contiene ids y horas.
--   - screens deja de ser pública (exponía el token secreto de cada pantalla).
--
-- Las Server Actions usan createAdminClient() (service_role), que se salta RLS:
-- este cambio no afecta a lo que hacen, solo al acceso directo por API.
-- =============================================================================

-- 1. Rol de personal leído del token de sesión (no consulta tablas).
create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('employee', 'admin'), false)
$$;

comment on function public.is_staff() is
  'true si el usuario de la sesión es employee o admin según app_metadata.role del JWT';

-- 2. Borrar todas las políticas actuales del esquema public.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

-- Las funciones antiguas leían profiles.role, que el propio usuario podía cambiar.
drop function if exists public.is_employee();
drop function if exists public.is_client();

-- 3. Tablas del centro: solo personal.
do $$
declare
  t text;
begin
  foreach t in array array[
    -- clientes y planes
    'clients',
    'training_plans',
    'plan_sessions',
    'plan_session_exercises',
    'training_sessions',
    'training_session_clients',
    'session_logs',
    'exercise_logs',
    -- ciclos grupales y plantillas
    'group_cycles',
    'group_sessions',
    'group_session_exercises',
    'group_cycle_slots',
    'group_cycle_slot_clients',
    'group_plan_templates',
    'group_template_sessions',
    'group_template_session_exercises',
    'cycle_templates',
    'cycle_template_days',
    'cycle_template_slots',
    'public_holidays',
    -- galería de ejercicios y catálogos
    'exercises',
    'exercise_muscle_groups',
    'exercise_movement_patterns',
    'body_zones',
    'muscle_groups',
    'movement_patterns',
    'equipment',
    'objectives',
    -- TrainWall
    'screens',
    'screen_assignments'
  ]
  loop
    execute format(
      'create policy "personal_todo" on public.%I for all to authenticated '
      'using ((select public.is_staff())) with check ((select public.is_staff()))',
      t
    );
  end loop;
end
$$;

-- 4. TrainWall: lectura pública de las asignaciones para el tiempo real de las pantallas.
create policy "pantallas_leen_asignaciones"
  on public.screen_assignments for select
  to anon, authenticated
  using (true);

-- 5. Perfiles.
create policy "perfil_propio_leer"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "personal_lee_perfiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_staff()));

create policy "perfil_propio_editar"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Desde la sesión solo se pueden editar nombre y avatar. El rol y el resto de
-- datos de empleado se cambian desde el servidor (employees.ts, service_role).
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;

-- 6. Datos: completar app_metadata.role en usuarios que no lo tenían, tomando
-- el valor de profiles. Sin rol en el token, el usuario no entra en ninguna área.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
from public.profiles p
where p.id = u.id
  and p.role in ('client', 'employee', 'admin')
  and (u.raw_app_meta_data ->> 'role') is null;
