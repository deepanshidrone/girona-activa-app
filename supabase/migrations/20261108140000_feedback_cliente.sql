-- Feedback del cliente tras una sesión (docs/spec-vista-cliente.md §4.1.3, §4.2, §7.2)
--
-- Tabla genérica "el cliente comenta algo de su plan": hoy sesiones de
-- entrenamiento; mañana, ingestas de nutrición (target_type 'meal') o
-- peticiones de cambio (kind 'change_request').
--
-- Acceso:
--   - Personal: política personal_todo (como el resto de tablas del centro).
--   - Cliente: SIN políticas. Lee lo suyo con la vista mi_feedback y escribe
--     solo con la Server Action submitSessionFeedbackAction (requireClient(),
--     client_id siempre de la sesión, plazo de 7 días desde la sesión).
-- Son datos de salud (dolor): solo el propio cliente y el personal del centro.

create table public.client_feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  target_type text not null check (target_type in ('plan_session', 'training_session')),
  target_id uuid not null,
  kind text not null default 'feedback' check (kind in ('feedback')),
  pain boolean not null,
  pain_area text check (pain_area is null or char_length(pain_area) <= 200),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_by uuid references public.profiles(id) on delete set null,
  read_at timestamptz,
  unique (client_id, target_type, target_id, kind)
);

comment on table public.client_feedback is
  'Feedback del cliente (dolor sí/no, zona y comentario) sobre una sesión. target_id = id de plan_sessions o training_sessions según target_type';

create index client_feedback_client_idx on public.client_feedback (client_id, created_at desc);
create index client_feedback_unread_idx on public.client_feedback (created_at desc) where read_at is null;

alter table public.client_feedback enable row level security;
create policy "personal_todo" on public.client_feedback for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

revoke all on public.client_feedback from public, anon;
grant select, insert, update, delete on public.client_feedback to authenticated;
grant all on public.client_feedback to service_role;

-- Vista del cliente: su feedback, con el mismo patrón que las demás mi_*
-- (permisos del dueño, filtro por my_client_id(), solo lectura).
create view public.mi_feedback with (security_barrier = true) as
select
  f.id,
  f.target_type,
  f.target_id,
  f.pain,
  f.pain_area,
  f.comment,
  f.created_at,
  f.updated_at,
  f.read_at is not null as read_by_staff
from public.client_feedback f
where f.client_id = public.my_client_id()
  and f.kind = 'feedback';

revoke all on public.mi_feedback from public, anon, authenticated;
grant select on public.mi_feedback to authenticated, service_role;
comment on view public.mi_feedback is 'Vista de cliente: su feedback de sesiones';
