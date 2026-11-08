-- CRM fase 1: leads que llegan por el formulario de la web (docs/spec-crm.md §7)
--
-- Entrada: la función de Netlify de la web del centro envía cada lead a la
-- ruta pública /api/leads, firmada con HMAC. La ruta valida y escribe con
-- service_role. Un lead es un envío del formulario: no se fusionan duplicados
-- (se señalan al leer, §7.3).
--
-- Acceso: SOLO servidor. RLS activada sin políticas y sin permisos para anon
-- ni authenticated. El permiso leads.gestionar (lib/auth/permissions.ts) es
-- configurable: un employee sin él no debe poder leer los leads por la API con
-- su sesión, así que todo pasa por Server Actions con requirePermission().
--
-- Datos personales de no clientes; las respuestas pueden tener datos de salud.
-- Sin borrado automático por decisión del propietario (D6, revisión legal
-- pendiente). La limpieza del go-live conserva esta tabla (D13).
--
-- Nada específico de un centro: las preguntas del formulario y los canales
-- llegan como datos (answers, channel_*).

-- 1. Prefijo telefónico por defecto del centro ----------------------------------
-- Se usa para normalizar teléfonos (duplicados) y montar el enlace de WhatsApp.
alter table public.center_settings
  add column default_country_code text not null default '34'
    check (default_country_code ~ '^[0-9]{1,4}$');

comment on column public.center_settings.default_country_code is
  'Prefijo telefónico del país del centro, sin "+" (34 = España)';

-- 2. Leads ------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),

  -- Origen
  source text not null check (source in ('web')),
  form_name text check (form_name is null or char_length(form_name) between 1 and 100),
  external_id text check (external_id is null or char_length(external_id) between 1 and 100),
  received_at timestamptz not null,
  page_url text check (page_url is null or char_length(page_url) <= 500),

  -- Contacto
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text check (email is null or (char_length(email) <= 254 and email = lower(email))),
  phone text check (phone is null or char_length(phone) <= 30),
  phone_normalized text check (phone_normalized is null or phone_normalized ~ '^[0-9]{3,20}$'),

  -- Canal ("cómo nos has conocido") y contenido del formulario
  channel_key text check (channel_key is null or char_length(channel_key) <= 50),
  channel_label text check (channel_label is null or char_length(channel_label) <= 100),
  message text check (message is null or char_length(message) <= 5000),
  answers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 30),

  -- Consentimiento RGPD aceptado en el formulario
  consent_at timestamptz not null,
  consent_text text not null check (char_length(consent_text) between 1 and 1000),
  privacy_policy_url text check (privacy_policy_url is null or char_length(privacy_policy_url) <= 500),

  -- Gestión
  seen_at timestamptz,
  seen_by uuid references public.profiles(id) on delete set null,
  is_spam boolean not null default false,
  spam_marked_at timestamptz,
  spam_marked_by uuid references public.profiles(id) on delete set null,
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  notes_updated_at timestamptz,
  notes_updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_contacto_obligatorio check (email is not null or phone is not null),
  -- Idempotencia: un reenvío del mismo envío de Netlify no crea otro lead (D11).
  -- En Postgres los null no chocan: los leads sin external_id (alta manual, fase 2) no se ven afectados.
  constraint leads_envio_unico unique (source, external_id)
);

comment on table public.leads is
  'CRM: contactos que llegan por la web (docs/spec-crm.md). Solo servidor (service_role)';
comment on column public.leads.received_at is
  'Fecha del envío del formulario (fecha de negocio), no la de llegada a la app';
comment on column public.leads.external_id is
  'Id del envío en el origen (Netlify Forms). Con source, evita duplicados al reenviar';
comment on column public.leads.phone_normalized is
  'Solo dígitos y sin el prefijo del país del centro. Para detectar duplicados y montar enlaces';
comment on column public.leads.answers is
  'Respuestas del formulario en orden: [{"key","label","value"}], con la pregunta tal como la vio la persona';
comment on column public.leads.consent_text is
  'Texto exacto de la casilla de consentimiento aceptada';

create index leads_received_at_idx on public.leads (received_at desc);
create index leads_email_idx on public.leads (email) where email is not null;
create index leads_phone_idx on public.leads (phone_normalized) where phone_normalized is not null;
-- Contador del menú: leads no vistos y no marcados como spam.
create index leads_sin_ver_idx on public.leads (received_at) where seen_at is null and not is_spam;

-- 3. Acceso: solo service_role ------------------------------------------------------
alter table public.leads enable row level security;

revoke all on public.leads from public, anon, authenticated;
grant all on public.leads to service_role;
