-- Recuperar contraseña desde el login: registro de solicitudes para limitar envíos.
--
-- La acción requestPasswordResetAction (pública, sin sesión) anota cada
-- solicitud aquí y, antes de enviar el correo, comprueba los límites:
--   - por email: como mucho 1 cada 2 minutos y 5 al día (no se envía más,
--     pero la respuesta al usuario es siempre la misma);
--   - por IP: como mucho 10 por hora (a partir de ahí se avisa de que espere).
-- Solo la usa service_role: RLS activada y sin políticas, sin permisos para
-- anon ni authenticated. Las filas de más de 7 días se borran en cada solicitud.

create table public.password_reset_requests (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  created_at timestamptz not null default now()
);

comment on table public.password_reset_requests is
  'Solicitudes de "Olvidé mi contraseña" para limitar envíos (solo service_role)';

create index password_reset_requests_email_idx on public.password_reset_requests (email, created_at desc);
create index password_reset_requests_ip_idx on public.password_reset_requests (ip, created_at desc);
create index password_reset_requests_created_idx on public.password_reset_requests (created_at);

alter table public.password_reset_requests enable row level security;

revoke all on public.password_reset_requests from public, anon, authenticated;
grant all on public.password_reset_requests to service_role;
