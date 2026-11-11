-- CRM fase 1.1 (docs/spec-crm.md §16 y §17):
-- - Alta manual: un admin (permiso leads.gestionar) registra a alguien que se ha
--   interesado en el propio centro. Cambia el origen y se guarda quién lo dio de alta.
-- - Estado comercial del lead, que el admin cambia a mano.
-- Misma tabla y mismo acceso (solo service_role).

-- 1. Origen 'manual' -------------------------------------------------------------
alter table public.leads drop constraint leads_source_check;
alter table public.leads
  add constraint leads_source_check check (source in ('web', 'manual'));

-- Un alta manual no viene de un envío externo: sin id, formulario ni página.
alter table public.leads
  add constraint leads_manual_sin_envio check (
    source <> 'manual' or (external_id is null and form_name is null and page_url is null)
  );

-- 2. Quién lo dio de alta ----------------------------------------------------------
alter table public.leads
  add column created_by uuid references public.profiles(id) on delete set null;

comment on column public.leads.created_by is
  'Quién dio de alta el lead a mano (source = manual). Nulo en los que llegan por la web';

-- 3. Estado comercial (§17) -------------------------------------------------------------
-- "Visto" y "spam" siguen aparte: visto no es contactado y el spam no es un estado comercial.
alter table public.leads
  add column status text not null default 'nuevo'
    constraint leads_status_check check (status in
      ('nuevo', 'contactado', 'sin_contestacion', 'entrenamiento_iniciado', 'no_convertido')),
  add column status_changed_at timestamptz,
  add column status_changed_by uuid references public.profiles(id) on delete set null;

comment on column public.leads.status is
  'Estado comercial: nuevo, contactado, sin_contestacion, entrenamiento_iniciado o no_convertido';
comment on column public.leads.status_changed_at is
  'Último cambio de estado (nulo si sigue en el inicial). Base de las alertas de seguimiento (fase 2)';

create index leads_status_idx on public.leads (status, received_at desc);

-- 4. Comentarios ------------------------------------------------------------------------
comment on table public.leads is
  'CRM: contactos que llegan por la web o se dan de alta en el centro (docs/spec-crm.md). Solo servidor (service_role)';
comment on column public.leads.received_at is
  'Fecha de negocio: la del envío del formulario (web) o la del alta (manual), no la de llegada a la app';
comment on column public.leads.phone_normalized is
  'Teléfono en formato internacional E.164 sin el "+" (prefijo del país incluido). Para detectar duplicados y montar enlaces';
