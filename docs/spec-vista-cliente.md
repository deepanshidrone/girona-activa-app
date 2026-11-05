# Especificación — Vista de cliente en móvil (BrotaFit)

- **Estado:** borrador de producto, pendiente de validar. No hay código asociado todavía.
- **Fecha:** 2026-11-04
- **Rama:** `dev`
- **Relacionado:** `docs/FRD.md` (sección 6, desactualizada), `docs/BUGS.md` (BUG-002), `input-negocio-GA/`

---

## 1. Objetivo

El socio del centro abre BrotaFit en el móvil y sabe qué entrena hoy, cómo va su plan y qué ha hecho. Además, puede avisar a su entrenador de cómo le ha ido una sesión.

La v1 tiene que ser **vendible por sí sola** (a Girona Activa y en demos a otros centros como Pragma) y dejar preparados, sin construirlos, el ranking, los informes, la comunidad y la nutrición.

---

## 2. Estado actual (revisado en código y BD el 2026-11-04)

| Pieza | Estado real |
|---|---|
| Alta del cliente | ✅ El empleado lo crea, se fija `app_metadata.role='client'`, llega el correo (Resend) → `/auth/confirm` → `/auth/set-password` → `/client` |
| Protección de rutas | ✅ `proxy.ts` separa `/dashboard` y `/client` por rol. ⚠️ El rol `admin` no se redirige fuera de `/client` |
| `/client` | ⚠️ Una sola página: tarjeta del plan activo, calendario mensual y hoja inferior con ejercicios. Tema claro, distinto del dashboard |
| Fuente de datos | ⚠️ Solo `plan_sessions` + `plan_session_exercises`, leídas con `createAdminClient()` (sin RLS) |
| Planes grupales | ❌ El cliente no ve los ejercicios: los de grupal viven en `group_sessions` (ciclo × bloque × dificultad) y no en `plan_session_exercises`. Los clientes apuntados a franjas de ciclo (`training_session_clients`) no aparecen |
| Registro realizado | ❌ No se muestran `session_logs` / `exercise_logs` |
| Historial, progreso, racha | ❌ No existen |
| Marca | ❌ "GIRONA ACTIVA", `/logo.png` y `#FF914D` fijos en `/client`, `/auth/set-password` y el correo de invitación |
| `app/client/set-password/` | Código muerto (lo sustituyó `app/auth/set-password/`, BUG-001) |
| RLS | ❌ BUG-002: un cliente con login puede leer y modificar los datos de todos los clientes vía API |

**Modelo de sesiones a medias:** `CLAUDE.md` describe `training_sessions` como tabla unificada, pero en la práctica:
- Los planes individuales y grupales (wizard) escriben en `plan_sessions` (242 filas).
- Los ciclos grupales escriben en `training_sessions` + `training_session_clients` (830 filas / 6 clientes asignados).
- `session_logs` cuelga solo de `plan_session_id`, así que hoy **no se puede registrar asistencia en una sesión de ciclo grupal** (`training_sessions`).

Esto condiciona la v1 (ver §7).

---

## 3. Decisiones de producto tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | El cliente **consulta** su plan y lo registrado por el empleado, y deja **feedback post-sesión** (dolor sí/no + comentario). **No** registra series, reps ni cargas | El registro lo hace el empleado en sala; duplicarlo crea conflictos. El feedback cubre el "dolor sí/no" que pide GA y es el mismo patrón de "comentario sobre un elemento" que pide Pragma para nutrición |
| D2 | De las notas del empleado, el cliente solo ve las **indicaciones del ejercicio planificado** (`plan_session_exercises.notes`, `group_session_exercises.notes`). Son internas: `clients.notes`, `plan_sessions.notes`, `training_sessions.notes`, `session_logs.notes` y `exercise_logs.notes` | Evitar que se lea algo escrito pensando que era interno. Hoy `/client` muestra `plan_sessions.notes` como "Nota del entrenador"; **se deja de mostrar** |
| D3 | **Racha** = número de sesiones programadas consecutivas a las que el cliente asistió. No la rompen los festivos, los fines de semana ni las sesiones canceladas por el centro | Justa con planes de 2 a 4 días por semana. Es la base de "días cumpliendo" del ranking |
| D4 | El agujero de RLS se registra como **BUG-002** y es **bloqueante**: no se da acceso a clientes reales hasta cerrarlo | Datos de salud (categoría especial del RGPD) |
| D5 | La vista de cliente usa el **tema oscuro** del dashboard, con nombre, logo y color primario del centro **leídos de configuración**, no fijos en el código | Coherencia visual y preparación para la marca blanca |

---

## 4. Alcance v1

### 4.1 Qué ve y hace el cliente

1. **Inicio ("Hoy")**
   - Si hoy tiene sesión: hora, tipo (individual / grupal + bloque A/B/C), entrenador asignado y lista de ejercicios con series × reps × carga planificada para **su nivel**.
   - Si no: la próxima sesión ("Jueves 6 · 18:00 · Grupal B").
   - Resumen mini de progreso: sesiones de este mes y racha actual.
   - Si una sesión pasada está completada y sin feedback: tarjeta "¿Qué tal fue la sesión del martes?".
2. **Calendario**
   - Mes a mes, con un estado por día: programada, completada, no asistida, cancelada y festivo.
   - Navegación por todos los meses del plan activo.
   - Al pulsar un día se abre el detalle de la sesión.
3. **Detalle de sesión**
   - Futura: ejercicios planificados (nombre, series, reps, carga, indicaciones). En grupal, solo la columna de **su dificultad** en esa sesión (`training_session_clients.difficulty` o el nivel del plan).
   - Pasada y completada: lo planificado frente a lo hecho (series, reps, carga, RPE y RIR registrados por el empleado; ejercicio saltado).
   - Feedback: botón "Contar cómo fue", con dolor sí/no (y zona opcional en texto) y un comentario. Se puede editar durante 7 días.
4. **Historial**
   - Lista de sesiones pasadas, de la más reciente a la más antigua, con estado y acceso al detalle.
   - Incluye los planes anteriores (`training_plans` con estado distinto de `active`).
5. **Mi progreso** (personal, sin comparar con otros clientes)
   - Sesiones asistidas este mes y este año.
   - Racha actual y racha máxima (D3).
   - Adherencia del plan activo (% de sesiones asistidas sobre las programadas hasta hoy), la misma métrica que ya ve el empleado en la ficha.
6. **Perfil**
   - Nombre, email, fecha de alta y datos físicos (altura, peso) **en solo lectura** (derecho de acceso del RGPD).
   - Cambiar contraseña y cerrar sesión.

### 4.2 Lo que necesita el empleado para cerrar el circuito (mínimo)
- Ver el feedback del cliente en el detalle de la sesión y en la ficha del cliente. Si hay "dolor: sí", se resalta.
- Indicador "feedback sin leer" en la ficha del cliente.

### 4.3 Alta y acceso del cliente (decidido 2026-11-05)

Hasta ahora el alta creaba a la vez la ficha, la cuenta de acceso y enviaba la invitación. Se separan:

1. **Alta de cliente** (`/dashboard/clientes/nuevo`): crea solo la ficha. El **email es opcional** y se guarda en la nueva columna `clients.email`. No se envía nada.
2. **Detalle del cliente:** sección "Acceso a la app" con el estado:
   - **Sin acceso:** `clients.user_id` vacío.
   - **Invitado:** hay cuenta, pero el cliente nunca ha iniciado sesión.
   - **Activo:** el cliente ha iniciado sesión alguna vez.
   Botón "Enviar invitación" (sin acceso) o "Reenviar invitación" (invitado). Sin email, primero hay que añadirlo.
3. **Invitación:** crea la cuenta con `app_metadata.role = 'client'`, la enlaza a la ficha y envía el correo (Resend). El reenvío genera un enlace nuevo; el anterior caduca a las 24 h. El cliente fija su contraseña en `/auth/set-password` (ya existe).
4. **BUG-003:** el trigger de alta deja de poner `employee` por defecto y `profiles.role` se mantiene sincronizado con `app_metadata.role`.

Migración de datos: `clients.email` se rellena con el email de la cuenta en los clientes que ya la tienen. Los clientes antiguos sin cuenta quedan sin email hasta que un empleado lo introduzca.

Fuera de este cambio: trasladar a la cuenta un cambio de email de la ficha, y retirar el acceso a un cliente sin borrar su ficha.

### 4.4 Requisitos no funcionales
- Mobile-first (375 px de referencia), pulsables de al menos 44 px y navegación con una mano.
- Instalable como PWA ("Añadir a pantalla de inicio": manifest + icono del centro). Sin notificaciones push.
- "Hoy" se calcula en la zona horaria del centro (`Europe/Madrid`), no en UTC. El código actual usa `toISOString()`, que falla entre las 00:00 y las 01:00/02:00.
- Textos de interfaz en castellano, sin textos ni colores de Girona Activa en el código.

---

## 5. Fuera de alcance de la v1 (y en qué orden lo veo)

| Fase | Funcionalidad | Nota |
|---|---|---|
| v1.1 | **Peso movido** personal (kg totales semana / mes / año + equivalencias) | Necesita registro fiable de cargas en grupal (§7.3). Equivalencias configurables por centro |
| v1.1 | Campo explícito "mensaje para el cliente" por sesión | Sustituye la ambigüedad de las notas (D2) |
| v1.2 | **Ranking** entre clientes (días asistidos, racha, peso movido; semana / mes / año) | Requiere consentimiento (§8.4) |
| v1.2 | **Informes de evolución** (PDF o pantalla, enviables por el empleado) | Pueden apoyarse en IA más adelante (spec GA) |
| v2 | **Nutrición** (plan por ingestas + comentarios o peticiones de cambio por ingesta) | Pedido por Pragma, sin contratar. Reutiliza `client_feedback` (§7.2) |
| v2 | **Comunidad** (actividades, noticias del centro, formación, recetas) | Contenido del centro → clientes, con un gestor de contenidos en el dashboard |
| — | Registro de entrenamiento por el propio cliente | Descartado por D1. Se revisa si un centro tiene clientes que entrenan solos |
| — | Notificaciones push / email de recordatorio | Fuera, como en el FRD |
| — | Reservas o cambios de hora por el cliente | Lo gestiona el centro (agenda) |

---

## 6. Pantallas y navegación (móvil)

Barra inferior fija con 4 pestañas: **Hoy · Calendario · Progreso · Perfil**. El historial se abre desde Calendario y desde Progreso.

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ [logo] Centro        Hola, Ana│   │ ‹   Noviembre 2026   ›       │
├──────────────────────────────┤   │ Lu Ma Mi Ju Vi Sa Do         │
│ HOY · Martes 4               │   │        ●  ●     ·  ·        │
│ 18:00 · Grupal · Bloque B    │   │  ✓  ✓  ✗  ●  ○  ·  ·        │
│ Con Maria                    │   │  ○  F  ○  ○  ○  ·  ·        │
│ ┌──────────────────────────┐ │   │ ✓ hecha ✗ falta ○ prevista  │
│ │ Sentadilla goblet  4×8 16│ │   │ F festivo  ─ cancelada      │
│ │ Remo con banda    3×12   │ │   ├──────────────────────────────┤
│ │ Plancha           3×30"  │ │   │ Ver historial →              │
│ └──────────────────────────┘ │   │                              │
│ ¿Qué tal fue el jueves? [→]  │   │                              │
│ Este mes 6 · Racha 🔥 9      │   │                              │
├──────────────────────────────┤   ├──────────────────────────────┤
│  Hoy   Calendario  Progreso  Perfil│ (misma barra)              │
└──────────────────────────────┘   └──────────────────────────────┘

DETALLE DE SESIÓN (pantalla completa, botón atrás)
┌──────────────────────────────┐
│ ← Jueves 30 oct · Completada │
│ Individual · 45 min · Ezequiel│
├──────────────────────────────┤
│ Press banca                  │
│ Plan  4×8 · 40 kg            │
│ Hecho 4×8 · 42,5 kg · RPE 7  │
│ ⓘ "Baja controlando 3 s"     │  ← indicación del ejercicio (visible)
│ ──────────────────────────── │
│ Peso muerto     (saltado)    │
├──────────────────────────────┤
│ Tu feedback                  │
│ ¿Dolor?  [No] [Sí → zona…]   │
│ Comentario  [_____________]  │
│            [Enviar]          │
└──────────────────────────────┘

PROGRESO                          PERFIL
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ Racha actual 9 · Máx 14      │  │ Ana García                   │
│ Este mes 6   · Este año 71   │  │ ana@…  · socia desde mar 2026│
│ Adherencia del plan  86 %    │  │ Altura 168 · Peso 61 (solo   │
│ [barras por mes]             │  │ lectura)                     │
│ Historial de sesiones →      │  │ Cambiar contraseña           │
│ Planes anteriores →          │  │ Cerrar sesión                │
└──────────────────────────────┘  └──────────────────────────────┘
```

Estados vacíos: sin plan activo ("Tu entrenador está preparando tu plan"), plan terminado (último plan + historial) y cuenta sin ficha de cliente ("Contacta con tu centro").

Rutas propuestas: `/client` (Hoy), `/client/calendario`, `/client/sesion/[id]`, `/client/historial`, `/client/progreso`, `/client/perfil`.

---

## 7. Cambios en el modelo de datos

### 7.1 Lectura unificada de "sesiones del cliente"
La vista de cliente no debe conocer las dos fuentes (`plan_sessions` y `training_sessions`). Se propone una **vista SQL `client_sessions`** (con `security_invoker = on`, para que respete la RLS de quien consulta) con una fila por (cliente, sesión):

| Columna | Origen |
|---|---|
| `client_id`, `session_date`, `session_time`, `type`, `session_label`, `assigned_employee_id` | `plan_sessions` + `training_plans`, o `training_sessions` + `training_session_clients` |
| `difficulty` | `training_session_clients.difficulty` o, si no hay, el nivel del plan (1→regression, 2→base, 3→progression) |
| `status` | `cancelled` si la sesión está cancelada; `completed` si hay `session_logs.status='completed'`; `missed` si la fecha ya ha pasado sin log; `scheduled` en otro caso |
| `source`, `source_id` | `plan_session` / `training_session` y su id, para abrir el detalle |

Los ejercicios del detalle salen de `plan_session_exercises` (individual) o de `group_sessions` + `group_session_exercises` filtrados por ciclo, bloque y dificultad (grupal).

> A medio plazo, lo correcto es terminar la migración a `training_sessions` (CLAUDE.md ya la da por hecha). La vista desacopla la app de cliente de esa migración: si se completa, solo cambia la definición de la vista.

### 7.2 Tabla nueva `client_feedback` (genérica, preparada para nutrición)
```
client_feedback
  id            uuid pk
  client_id     uuid  → clients            (siempre el propio cliente)
  target_type   text  'training_session'   (v2: 'meal' para nutrición)
  target_id     uuid                       (id de la sesión o de la ingesta)
  pain          boolean null               (solo training_session)
  pain_area     text null
  comment       text null
  kind          text  'feedback'           (v2: 'change_request' para "pedir cambio" en nutrición)
  created_at, updated_at
  read_by       uuid null → profiles
  read_at       timestamptz null
  UNIQUE (client_id, target_type, target_id, kind)
```
Una sola tabla "el cliente comenta sobre algo de su plan" sirve hoy para sesiones y mañana para las ingestas de Pragma, y el empleado tiene una sola bandeja. A cambio, no hay FK real sobre `target_id`; la integridad se valida en la server action.

### 7.3 Asistencia en sesiones de ciclo grupal
`session_logs` solo admite `plan_session_id`. Se añade `training_session_id uuid null → training_sessions` con un CHECK (exactamente uno de los dos informado) y la regla de **un log por (sesión, cliente)**. Sin esto, la racha y la asistencia de quien va a grupales por ciclo salen vacías. Es un cambio pequeño en el registro del empleado ("Hoy" → registro de sesión grupal).

### 7.4 Configuración del centro (marca blanca)
```
center_settings   (una fila; con multi-inquilino pasaría a una por centro)
  name, short_name, logo_url, primary_color, timezone ('Europe/Madrid'),
  email_from_name, email_from_address,
  features jsonb   {"ranking": false, "nutrition": false, "community": false}
```
La usan `/client`, `/auth/set-password`, el login y el correo de invitación. Así salen del código "GIRONA ACTIVA", `/logo.png` y `#FF914D`. Los `features` activan pestañas futuras sin desplegar código distinto por centro.

### 7.5 Preparación para el ranking (solo columnas, sin lógica)
- `clients.ranking_opt_in boolean default false` y `clients.display_alias text null`: el cliente decide si aparece y con qué nombre.
- Peso movido = Σ `sets_done × reps_done × load_kg` de `exercise_logs` no saltados. No requiere columnas nuevas, pero sí que el empleado registre la carga de forma consistente.
- Las equivalencias (vaca, coche, avión…) irán a una tabla `weight_equivalences` por centro cuando se construya.

---

## 8. Permisos y privacidad

### 8.1 Qué ve el cliente

| Dato | Cliente | Nota |
|---|---|---|
| Su ficha: nombre, email, sexo, nacimiento, altura, peso, fecha de alta | ✅ lectura | Derecho de acceso del RGPD |
| `clients.notes` (notas internas) | ❌ | |
| Sus planes (activo e históricos): tipo, nivel, fechas, frecuencia | ✅ lectura | |
| Sus sesiones y los ejercicios planificados con indicaciones | ✅ lectura | Grupal: solo su dificultad |
| Notas de sesión (`plan_sessions.notes`, `training_sessions.notes`) | ❌ | D2 |
| Sus registros (`session_logs`, `exercise_logs`): series, reps, carga, RPE, RIR, saltado | ✅ lectura | Sin la columna `notes` |
| `session_logs.notes`, `exercise_logs.notes` | ❌ | D2 |
| Su feedback | ✅ lectura y escritura (7 días) | |
| Nombre del entrenador asignado | ✅ solo `full_name` | No ve teléfono, especialidades ni fecha de alta del empleado |
| Otros clientes (nombre, asistencia, compañeros de grupo) | ❌ | Hasta el ranking con consentimiento |
| Catálogo de ejercicios y festivos | ✅ lectura | |
| Ciclos, plantillas, pantallas, empleados | ❌ | |

### 8.2 Cómo cerrarlo (BUG-002, requisito previo)
1. **Función de rol basada en el JWT**, que funciona en servidor y en navegador sin consultar tablas:
   `is_staff()` → `(auth.jwt() -> 'app_metadata' ->> 'role') in ('employee','admin')`.
   La razón de que `is_employee()` "no funcionara en servidor" era probablemente que consulta `profiles`; con el JWT ese problema desaparece.
2. **Eliminar** todas las políticas `auth.role() = 'authenticated'` / `true` para `authenticated` en tablas con datos de clientes o de operación, y sustituirlas por `is_staff()`.
3. **Políticas de cliente solo de lectura** basadas en `clients.user_id = auth.uid()`. Algunas ya existen ("Cliente lee sus planes", "Cliente lee sus sesiones", "Cliente lee sus ejercicios") y empezarán a tener efecto al quitar las genéricas. Faltan las de `training_sessions` y `training_session_clients` (solo sus filas), `session_logs` y `exercise_logs` (solo las suyas), `group_sessions` y `group_session_exercises` (solo los ciclos en los que participa), `clients` (solo su fila) y `client_feedback` (las suyas; inserción y actualización solo con su `client_id`).
4. **Columnas internas:** RLS filtra filas, no columnas. Para no exponer `notes`, el cliente lee **a través de vistas sin esas columnas** (`client_sessions`, `client_exercise_logs`, `my_client_profile`), o se revoca `SELECT` por columna al rol `authenticated` sobre `notes` (las server actions del dashboard usan `service_role` y no se ven afectadas). Recomendación: vistas, que se leen mejor y se prueban más fácilmente.
5. **La vista de cliente deja de usar `createAdminClient()`** y lee con el cliente de Supabase de la sesión del usuario. Así RLS es la defensa real y el filtro en servidor pasa a ser una segunda capa.
6. **Server actions:** todas las de `app/actions/` deben comprobar sesión y rol (`employee`/`admin`) antes de usar el cliente admin. Lo más limpio es un helper común (`requireStaff()`). Las del cliente (`submitFeedbackAction`) usan `requireClient()` y fijan siempre el `client_id` desde la sesión, nunca desde el formulario.
7. **`proxy.ts`:** tratar `admin` como `employee` (redirigirlo fuera de `/client`).
8. **TrainWall:** `screens` y `screen_assignments` tienen `UPDATE true` para `authenticated`; pasarlo a `is_staff()`.
9. **Comprobación:** un script o caso QA que, con la sesión de un cliente de prueba y la clave pública, intente leer `clients`, `training_plans` de otro cliente y `screens`, y verifique que no obtiene filas.

### 8.3 Datos de salud
El feedback de dolor, los datos físicos y, en el futuro, la anamnesis y la valoración son datos de salud. Acceso limitado al propio cliente y al personal del centro, sin aparecer en el ranking ni en la comunidad. La firma del RGPD forma parte de la ficha que pide GA (fuera de esta spec).

### 8.4 Ranking (cuando llegue)
Solo aparecen los clientes con `ranking_opt_in = true` y con su `display_alias` (o nombre e inicial). Se expone mediante una vista o función agregada que devuelve únicamente alias y métricas, nunca filas de `clients`.

---

## 9. Dependencias y orden de trabajo sugerido

1. **BUG-002** (RLS + server actions + `proxy.ts`). Bloqueante.
2. `center_settings` y retirada de la marca fija (cliente, set-password, login y correo).
3. `session_logs.training_session_id` y registro de asistencia en sesiones de ciclo grupal.
4. Vista `client_sessions` y vistas de lectura sin notas.
5. Pantallas v1: Hoy → Calendario → Detalle → Historial → Progreso → Perfil.
6. `client_feedback` y su visualización en el dashboard.
7. PWA (manifest).
8. Ronda de QA en `qa/rondas/` con un cliente individual, uno de plan grupal y uno de ciclo grupal.

Limpieza asociada: borrar `app/client/set-password/` y actualizar `docs/FRD.md` §6 y §9 (el FRD dejaba fuera el registro por el cliente; aquí se mantiene fuera salvo el feedback).

---

## 10. Preguntas abiertas

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| P1 | ¿Quién decide que una sesión pasada sin log es "no asistida"? ¿Puede el empleado marcar "falta justificada" para no romper la racha? | v1: sin log = no asistida. v1.1: estado `excused` que no rompe la racha |
| P2 | ¿El cliente ve las cargas de las sesiones **futuras** o solo series y reps? En grupal, la carga planificada a veces no aplica | Mostrar la carga solo si está informada |
| P3 | ¿Ve el cliente el bloque A/B/C y el nombre de la fase (semana 1 "Consolidar técnica"… semana 4 "Estabilización", spec GA)? | Bloque sí. Fase cuando el ciclo la guarde (hoy no existe el dato) |
| P4 | ¿Plazo de edición del feedback (7 días) y quién lo lee: el entrenador asignado o cualquier empleado? | 7 días; lo ven todos los empleados y se resalta para el asignado |
| P5 | ¿Debe avisarse al empleado (email) cuando un cliente marca "dolor: sí"? | No en v1 (sin notificaciones); se resalta en "Hoy" y en la ficha |
| P6 | Nutrición (Pragma): ¿el plan lo hace un nutricionista del centro dentro de BrotaFit o se importa? | Pendiente de la propuesta comercial a Pragma |
| P7 | ~~Marca blanca: ¿`center_settings` en BD o variables de entorno?~~ | **Decidido 2026-11-04:** en BD, con valores de Girona Activa por ahora |
| P8 | ¿El cliente puede pedir que se borre su cuenta o descargar sus datos desde la app (RGPD)? | v1: se pide al centro; el centro lo gestiona desde el dashboard |
