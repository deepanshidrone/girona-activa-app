-- =============================================================================
-- KPIs v1 — permisos de las vistas
-- =============================================================================
-- Las vistas kpi_plan_spans y client_sessions (20261106120000_kpis_v1.sql) se
-- crearon sin permisos de lectura para service_role, así que las funciones
-- kpi_* fallaban con "permission denied for view kpi_plan_spans" al llamarlas
-- desde el servidor.
--
-- authenticated también puede leerlas: son security_invoker, así que se aplica
-- la RLS de las tablas de debajo (solo personal; los clientes no ven nada).
-- =============================================================================

grant select on public.kpi_plan_spans, public.client_sessions to service_role, authenticated;
