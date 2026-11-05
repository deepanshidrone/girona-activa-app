-- =============================================================================
-- Alta de clientes sin acceso obligatorio + BUG-003
-- =============================================================================
-- 1. clients.email: la ficha guarda el email (opcional). Hasta ahora solo
--    existía en la cuenta de acceso (auth.users), así que un cliente sin
--    cuenta no tenía email guardado. Ver docs/spec-vista-cliente.md §4.3.
-- 2. BUG-003: el trigger de alta ponía profiles.role = 'employee' por defecto
--    porque Supabase crea el usuario antes de que el código fije
--    app_metadata.role. Ahora:
--      - por defecto, 'client' (el rol menos privilegiado);
--      - un trigger de actualización copia app_metadata.role a profiles.role
--        cada vez que cambia, así que profiles queda siempre sincronizado.
--    El acceso real sigue saliendo de app_metadata.role (ver BUG-002).
-- =============================================================================

-- 1. Email en la ficha del cliente
alter table public.clients add column if not exists email text;

comment on column public.clients.email is
  'Email de contacto, opcional. Necesario para invitar al cliente a la app.';

update public.clients c
set email = u.email
from auth.users u
where u.id = c.user_id
  and c.email is null;

-- 2. BUG-003: rol por defecto al crear el perfil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
begin
  if v_role is null or v_role not in ('client', 'employee', 'admin') then
    v_role := 'client';
  end if;

  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Mantener profiles.role sincronizado con app_metadata.role
create or replace function public.sync_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
begin
  if v_role in ('client', 'employee', 'admin')
     and v_role is distinct from (old.raw_app_meta_data ->> 'role') then
    update public.profiles set role = v_role where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists "on_auth_user_role_changed" on "auth"."users";
create trigger "on_auth_user_role_changed"
  after update of raw_app_meta_data on "auth"."users"
  for each row execute function public.sync_profile_role();

-- Corregir los perfiles que ya estén desincronizados
update public.profiles p
set role = u.raw_app_meta_data ->> 'role'
from auth.users u
where u.id = p.id
  and (u.raw_app_meta_data ->> 'role') in ('client', 'employee', 'admin')
  and p.role is distinct from (u.raw_app_meta_data ->> 'role');
