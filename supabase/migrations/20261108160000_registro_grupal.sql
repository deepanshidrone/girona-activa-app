-- Registro de sesiones grupales por el empleado (docs/spec-vista-cliente.md §7.3)
--
-- Al pasar lista, cada cliente apuntado a la sesión (training_session_clients)
-- queda con un session_logs:
--   status 'completed' → vino (y opcionalmente se registran sus ejercicios)
--   status 'absent'    → no vino
-- Hace falta 'absent' para distinguir "no vino nadie" de "no se pasó lista":
-- client_sessions marca 'unrecorded' cuando la sesión no tiene ningún registro.
-- Con 'absent', la vista y las funciones kpi_* funcionan sin cambios: solo
-- 'completed' cuenta como asistida y cualquier registro cuenta como lista pasada.
-- 'absent' solo se usa en sesiones grupales.

alter table public.session_logs drop constraint session_logs_status_check;
alter table public.session_logs add constraint session_logs_status_check
  check (status in ('in_progress', 'completed', 'absent'));

alter table public.session_logs add constraint session_logs_absent_solo_grupal
  check (status <> 'absent' or training_session_id is not null);

comment on column public.session_logs.status is
  'in_progress | completed (asistió) | absent (no asistió; solo sesiones grupales)';
