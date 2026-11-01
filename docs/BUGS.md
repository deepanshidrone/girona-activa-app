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
- **Síntoma:** qué ve el usuario
- **Dónde:** pantalla o archivo
- **Causa:** (cuando se conozca)
- **Solución:** qué se cambió
- **Commit:** hash
- **Verificado:** quién y cómo
```

---

## Abiertos

_Ninguno registrado._

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
