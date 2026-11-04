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
- **Solución:** (pendiente) ver `docs/spec-vista-cliente.md`, apartado "Permisos y privacidad". Debe resolverse antes de dar acceso a la app a clientes reales.
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
