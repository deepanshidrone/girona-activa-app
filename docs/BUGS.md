# Registro de bugs — BrotaFit

Registro de bugs abiertos y resueltos. Se mantiene en cada sesión de trabajo.

## Cómo se usa

- Cada bug tiene un ID correlativo `BUG-NNN` que no se reutiliza.
- **Al detectar un bug:** se añade en **Abiertos** con la plantilla de abajo.
- **Al arreglarlo:** el mensaje del commit lleva el ID, por ejemplo `fix(BUG-002): descripción corta`. Si un commit toca varios bugs, se listan todos (`fix(BUG-002, BUG-003): ...`).
- **Después del commit:** el bug se mueve a **Resueltos** con el hash del commit y la forma de verificarlo. Esto va en un commit `docs:` posterior, porque el hash solo se conoce después de commitear.
- Para encontrar el cambio de un bug: `git log --grep BUG-001`.

### Plantilla

```
### BUG-NNN — Título corto
- **Detectado:** AAAA-MM-DD
- **Caso QA:** ID del caso de `qa/` que falló (si viene de una ronda de pruebas)
- **Síntoma:** qué ve el usuario
- **Dónde:** pantalla o archivo
- **Causa:** (cuando se conozca)
- **Solución:** qué se cambió
- **Commit:** hash
- **Verificado:** quién y cómo
```

---

## Abiertos

### BUG-002 — RLS abierta: un cliente con login puede leer y modificar datos de todos los clientes
- **Detectado:** 2026-11-04 (revisión de políticas para la especificación de la vista de cliente)
- **Síntoma:** no se ve en la interfaz. Un cliente con login puede usar la clave pública y su propia sesión para llamar a la API de Supabase (PostgREST) y leer o modificar `clients` (con `notes` internas y datos de salud de todos los clientes), `training_plans`, `plan_sessions`, `plan_session_exercises`, `training_sessions`, `training_session_clients`, `public_holidays`, catálogos de ejercicios, `screens` y `screen_assignments` (por ejemplo, cambiar lo que muestra una pantalla de TrainWall).
- **Dónde:** políticas RLS en Supabase (`woomjsjbmrasydpirwap`) y varias server actions de `app/actions/`.
- **Causa:** las políticas permisivas se combinan con OR. Las políticas genéricas `auth.role() = 'authenticated'` / `true` para el rol `authenticated` anulan las políticas específicas de cliente que ya existen ("Cliente lee sus planes", "Cliente lee sus sesiones", etc.). Además, varias server actions usan `createAdminClient()` sin comprobar sesión ni rol: `saveExerciseLogAction`, `completeSessionLogAction`, todo `holidays.ts`, y sin comprobar el rol en `group-sessions.ts`, `cycle-templates.ts`, `screens.ts`, `plans.ts` y `exercises.ts`.
- **Solución:** migración `20261105213646_bug002_rls_por_rol.sql` (políticas por rol con `is_staff()` leído del token; clientes sin acceso directo a tablas; `screens` cerrada; `profiles` solo editable en nombre y avatar). Helper `lib/auth/permissions.ts` y control de acceso en todas las Server Actions. `proxy.ts` deniega por defecto.
- **Commit:**
- **Verificado:** 2026-11-05, por Claude: migración aplicada; 26 pruebas por API con el usuario "Cliente Test" y sin sesión (no lee ni modifica datos del centro, no puede cambiarse el rol) y simulación en BD de sesiones employee/admin (ven todos los datos). Pendiente: prueba manual del dashboard por el propietario.

### BUG-003 — Los usuarios nuevos se crean con `profiles.role = 'employee'`
- **Detectado:** 2026-11-05 (al crear el usuario de prueba "Cliente Test")
- **Síntoma:** un cliente dado de alta desde el dashboard puede quedar con `profiles.role = 'employee'`. No da permisos (el acceso sale de `app_metadata.role`), pero `profiles.role` se usa para listar empleados y para elegir el entrenador de una sesión grupal, así que el cliente podría aparecer como entrenador.
- **Dónde:** trigger `on_auth_user_created` → `public.handle_new_user()`; `app/actions/clients.ts` y `app/actions/employees.ts`
- **Causa:** el trigger lee `app_metadata.role` al insertar el usuario y, si no lo encuentra, pone `'employee'`. Supabase crea el usuario antes de que el código fije `app_metadata.role` (con `generateLink` + `updateUserById`, o con `createUser`), así que el trigger no lo ve.
- **Solución:** (pendiente) por defecto el rol menos privilegiado (`client`) y mantener `profiles.role` sincronizado cuando cambie `app_metadata.role` (trigger de actualización en `auth.users`). Revisar los perfiles existentes.
- **Commit:**
- **Verificado:**

---

## Resueltos

### BUG-001 — El empleado nuevo entra sin fijar contraseña
- **Detectado:** 2026-11-01
- **Síntoma:** al pulsar "Activar el meu compte" en el correo de alta, el empleado o admin entraba directo al dashboard con la sesión iniciada, sin establecer contraseña. Al cerrar sesión no podía volver a entrar.
- **Dónde:** `app/auth/confirm/page.tsx`
- **Causa:** tras validar el enlace, solo los clientes iban a la pantalla de contraseña (`/client/set-password`). Empleados y admins iban a `/dashboard`.
- **Solución:** página compartida `app/auth/set-password/page.tsx` para todos los roles. `/auth/confirm` manda allí a cualquiera que llegue por el enlace del correo.
- **Commit:** `ff47534` (anterior a este registro, por eso su mensaje no lleva el ID)
- **Verificado:** 2026-11-01, por el propietario: alta de un empleado admin en el preview de `dev` y activación desde otro PC.
