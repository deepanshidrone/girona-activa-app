# CLAUDE.md — Girona Activa App

Contexto completo del proyecto para Claude Code. Se carga automáticamente al inicio de cada sesión.
**Última actualización:** 2026-11-04 (traducido del catalán al castellano)

---

## Visión general

**Producto:** herramienta web de gestión de planes de entrenamiento para el centro Girona Activa (Girona, España).
Permite a los entrenadores crear planes individuales y grupales, registrar sesiones y hacer seguimiento de los clientes.

**URL dev (preview de Vercel):** `https://girona-activa-app-git-dev-brota-ai.vercel.app`
**URL producción (Vercel):** `https://girona-activa-app.vercel.app`
**Subdominio propio:** `app.gironaactiva.com` → pendiente de configurar el DNS
**Idioma de la UI:** castellano
**Estado:** MVP en desarrollo activo — rama `dev`, desplegado en Vercel

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 16, App Router, TypeScript |
| Estilos | Tailwind CSS v4 + shadcn/ui (new-york) |
| BD + Auth | Supabase (PostgreSQL + Supabase Auth) |
| Hosting | Vercel (org brota-ai, plan Hobby) |
| Repo | `deepanshidrone/girona-activa-app` (público) |
| Fuente | Outfit (Google Fonts) |

---

## Identidad de marca / tema visual

El dashboard tiene fondo oscuro (`#111111` body, `#1C1C1C` cards). El color primario de la app es el naranja.

```
--orange: #FF914D   /* naranja — color primario, botones, acentos */
--dark:   #1C1C1C   /* cards y paneles */
--body:   #111111   /* fondo general del dashboard */
--border: white/10  /* bordes (border-white/10) */
--text:   white     /* texto principal */
--muted:  white/40  /* texto secundario */
```

**Sidebar:** fondo `#1C1C1C`, texto blanco, ítem activo `#FF914D`.
**Botones primarios:** `bg-[#FF914D] hover:bg-[#e07a3a] text-white`
**Cards / paneles:** `bg-[#1C1C1C] rounded-2xl border border-white/10`
**Importante:** cualquier página nueva dentro del dashboard DEBE usar esta paleta oscura, no colores claros (`bg-white`, `text-[#1C1C1C]`, etc.).

---

## Variables de entorno

### `.env.local` (local — nunca subir a Git)
```
NEXT_PUBLIC_SUPABASE_URL=https://woomjsjbmrasydpirwap.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://woomjsjbmrasydpirwap.supabase.co/auth/v1/.well-known/jwks.json
RESEND_API_KEY=re_...
```

### Regla de seguridad crítica
- `SUPABASE_SECRET_KEY` y `RESEND_API_KEY` **nunca** se exponen al navegador
- Todas las operaciones de admin (crear usuarios, saltarse RLS) → Server Actions / Server Components
- `lib/supabase/admin.ts` expone `createAdminClient()`, que usa la secret key — **solo servidor**

---

## Autenticación y roles

- Proveedor: Supabase Auth (email + contraseña)
- Middleware `middleware.ts` (o `proxy.ts`): protege las rutas `/dashboard/**` y redirige a `/login` si no hay sesión

### Roles

| Rol | Tabla `profiles.role` | Acceso |
|---|---|---|
| `employee` | `employee` | Dashboard completo (entrenadores, admins) |
| `client` | `client` | Solo la vista de su plan (no implementada en el MVP) |

### Usuarios empleados (tabla `profiles`)

| Nombre | UUID | Email |
|---|---|---|
| Ezequiel (admin) | `29a82d0f-bab5-4a42-b4fc-68cfe64db63a` | ezequiel@gironaactiva.com |
| Maria | `62ba0e07-b75f-4528-9e36-87f774418882` | maria@gironaactiva.com |
| Rima Babani | `f47ae5ba-d477-4ddd-9bbb-69bc00d25a40` | miababani@gmail.com |

Nota: los empleados necesitan cuenta en Supabase Auth para aparecer como opción al asignar planes.
Para dar de alta a un empleado existente (que ya tiene cuenta): `UPDATE profiles SET full_name='Nombre', role='employee' WHERE id='uuid'`.

---

## Estructura de archivos (estado actual)

```
girona-activa-app/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                          # Redirige a /login
│   ├── login/page.tsx
│   ├── actions/                          # Server Actions (TODOS los archivos de esta carpeta)
│   │   ├── clients.ts                    # createClientAction, getClientsAction
│   │   ├── plans.ts                      # createPlanAction (planes individuales)
│   │   ├── group-sessions.ts             # createGroupPlanAction, createGroupCycleAction (acepta template_id)
│   ├── cycle-templates.ts            # getTemplatesAction, createTemplateAction, updateTemplateAction,
│   │                                 # deleteTemplateAction, duplicateTemplateAction
│   └── holidays.ts                   # getHolidaysAction, getActiveHolidayDatesAction,
│                                     # toggleHolidayAction, addHolidayAction, syncHolidaysFromApiAction
│   │   ├── edit-plan.ts                  # moveSessionAction, addSessionExerciseAction, etc.
│   │   ├── session-logs.ts               # startSessionLogAction, saveExerciseLogAction,
│   │   │                                 # completeSessionLogAction, getTodaySessionsAction,
│   │   │                                 # getSessionDetailAction
│   │   └── delete-client.ts              # deleteClientAction
│   └── dashboard/
│       ├── layout.tsx
│       ├── page.tsx                      # Panel (estadísticas + acciones rápidas)
│       ├── hoy/
│       │   ├── page.tsx                  # Agenda del día — sesiones agrupadas por entrenador
│       │   └── [sessionId]/
│       │       ├── page.tsx              # Server component — carga el detalle de la sesión
│       │       └── session-runner.tsx    # Client component — registro de la sesión de entrenamiento
│       ├── clientes/
│       │   ├── page.tsx                  # Listado de clientes
│       │   ├── nuevo/page.tsx            # Alta de cliente (Server Action)
│       │   └── [id]/
│       │       ├── page.tsx              # Detalle del cliente + planes
│       │       └── delete-button.tsx
│       ├── ejercicios/
│       │   └── page.tsx                  # Galería de ejercicios con filtros
│       ├── planes/
│       │   ├── page.tsx                  # Listado de planes
│       │   ├── nuevo/
│       │   │   ├── page.tsx              # Server component — carga los datos del wizard
│       │   │   ├── wizard.tsx            # Client component — wizard de creación (6 pasos)
│       │   │   └── exercise-picker-modal.tsx  # Modal de galería de ejercicios (reutilizado)
│       │   └── [id]/editar/
│       │       ├── page.tsx              # Server component — carga la sesión a editar
│       │       └── edit-plan-calendar.tsx # Client component — calendario interactivo de edición
│       └── sesiones/
│           ├── page.tsx                  # Listado de ciclos + pestañas
│           ├── sesiones-tabs.tsx         # Client component — pestañas "Ciclos" | "Plantillas"
│           ├── plantilles/
│           │   ├── page.tsx              # Página de plantillas
│           │   └── plantillas-client.tsx # Client component — CRUD de plantillas + editor
│           └── nuevo/
│               ├── page.tsx              # Server component — carga ejercicios + plantillas
│               └── cycle-form.tsx        # Client component — 2 pasos: plantilla + configuración
├── components/
│   ├── app-sidebar.tsx                   # Sidebar con: Hoy, Clientes, Ejercicios, Planes, Sesiones grupales
│   └── ui/                              # Componentes shadcn/ui
├── lib/
│   ├── calendar-utils.ts             # generateCycleDates() — genera fechas laborables saltando festivos y fines de semana
│   ├── supabase/
│   │   ├── client.ts                    # createClient() — Client Components
│   │   ├── server.ts                    # createClient() — Server Components
│   │   └── admin.ts                     # createAdminClient() — se salta RLS, solo servidor
│   ├── group-sessions-utils.ts          # levelToDifficulty(), type Difficulty
│   └── utils.ts                         # cn()
└── middleware.ts                         # Protección de rutas
```

---

## Base de datos — tablas principales

### Modelo de datos — sesiones unificadas (octubre 2026)

Todas las sesiones (individuales y grupales) están unificadas en `training_sessions` y `training_session_clients`. Las tablas legacy `plan_sessions` y `group_cycle_slots` se mantienen por compatibilidad, pero ya no se usan para funcionalidad nueva.

**`training_sessions`** — evento u ocurrencia concreta en el calendario:
```
id UUID PK
type                  'individual' | 'group'
session_date DATE     ← siempre fecha absoluta (no solo day_index)
session_time TIME
assigned_employee_id  → profiles
session_label         'A' | 'B' | 'C'
cycle_id              → group_cycles   (sesiones grupales)
plan_id               → training_plans (sesiones individuales)
day_index INTEGER     0-19 (dentro del ciclo, para sesiones grupales)
max_clients INTEGER   (sesiones grupales, normalmente 6)
status                'scheduled' | 'completed' | 'cancelled'
notes TEXT
```

**`training_session_clients`** — participación de un cliente en una sesión (tabla de unión con atributos):
```
id UUID PK
session_id  → training_sessions
client_id   → clients
difficulty  'regression' | 'base' | 'progression'   ← por cliente, progresivo
UNIQUE(session_id, client_id)
```

Para sesiones individuales: 1 fila en `training_session_clients`.
Para sesiones grupales: hasta `max_clients` filas, cada una con su `difficulty` (el nivel puede cambiar de una sesión a otra para registrar la progresión del cliente).

### Tablas existentes

| Tabla | Descripción |
|---|---|
| `profiles` | `id` (FK auth.users), `full_name`, `role` (employee/client) |
| `clients` | Perfil del cliente: `first_name`, `last_name`, `sex`, `birth_date`, `height_cm`, `weight_kg`, `start_date`, `email`, `notes`, `is_active` |
| `body_zones` | Catálogo de zonas corporales |
| `muscle_groups` | Catálogo de grupos musculares |
| `movement_patterns` | Catálogo de patrones de movimiento |
| `equipment` | Catálogo de equipamiento |
| `objectives` | Catálogo de objetivos |
| `exercises` | `name`, `technical_name`, `level` (1-3), `technical_level`, `body_zone_id`, `movement_pattern_id`, `equipment_id`, `objective_id`, `regression_id` (FK a sí misma), `progression_id` (FK a sí misma) |
| `exercise_muscle_groups` | Unión ejercicio ↔ grupo muscular |
| `group_cycles` | Ciclos de sesiones grupales (4 semanas): `start_date`, `notes` |
| `group_sessions` | Plantilla de ejercicios por bloque A/B/C × dificultad regression/base/progression |
| `group_session_exercises` | Ejercicios de la plantilla: `exercise_id`, `sets`, `reps`, `weight_kg`, `order_index` |
| `training_sessions` | **Tabla unificada** — todas las sesiones individuales y grupales como eventos concretos del calendario |
| `training_session_clients` | **Unión** — qué cliente participa en qué sesión y a qué nivel (`difficulty`) |
| `training_plans` | Contrato de suscripción del cliente: `client_id`, `assigned_employee_id`, `type`, `level`, `status`, `duration_months`, `weekly_frequency`, `session_duration`, `start_date`, `end_date` |
| `public_holidays` | Festivos: `date` (PK), `name`, `scope` (national/catalonia/girona), `is_active`, `is_override` |
| `cycle_templates` | Plantillas predefinidas para crear ciclos: `name`, `notes`, `is_default`, `created_by` |
| `cycle_template_days` | Patrón mensual de la plantilla: 20 filas (day_index 0-19) con `block_label` A/B/C |
| `cycle_template_slots` | Franjas del día de la plantilla por día de la semana: `day_of_week` (0-4), `session_time`, `has_overlap`, `max_clients` |
| `plan_sessions` | ⚠️ Legacy — sesiones individuales (migradas a `training_sessions`) |
| `group_cycle_slots` | ⚠️ Legacy — franjas de ciclos grupales (migradas a `training_sessions`) |
| `plan_session_exercises` | Ejercicios de las sesiones individuales |
| `session_logs` | Registro de ejecución: `started_at`, `completed_at`, `status` |
| `exercise_logs` | `sets_done`, `reps_done`, `load_kg`, `rpe` (1-10), `rir` (0-10), `skipped` |

### Convenciones de RLS

Todas las tablas usan:
```sql
FOR ALL USING (auth.role() = 'authenticated')
```
(No `is_employee()` — no funciona bien en contexto de servidor)

Permisos necesarios (ejecutar después de crear tablas nuevas):
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

### Trigger importante
```sql
-- Crea automáticamente una fila en profiles al crear un usuario en auth.users
-- role por defecto: 'employee'. Para clientes: pasar role='client' en raw_user_meta_data
create trigger on_auth_user_created after insert on auth.users ...
```

---

## Funcionalidades implementadas (estado actual)

### Clientes (`/dashboard/clientes`)
- Listado con estadísticas (activos, nuevos este mes)
- Alta de cliente: crea la cuenta en Supabase Auth + la fila en `clients` + envía el email para fijar la contraseña
- Detalle del cliente: datos personales + plan activo + historial de planes
- Desde el detalle: botón "Nuevo plan" que preselecciona al cliente en el wizard
- Eliminar cliente

### Galería de ejercicios (`/dashboard/ejercicios`)
- Filtros: zona corporal, patrón de movimiento, grupo muscular, equipamiento, objetivo, nivel
- Cada ejercicio puede tener `regression_id` y `progression_id` (FK a exercises)

### Planes de entrenamiento (`/dashboard/planes`)

#### Wizard de creación (6 pasos) — `planes/nuevo/wizard.tsx`
1. **Cliente** — selección del cliente (se salta si se llega con `?client=uuid`)
2. **Entrenador** — selección del empleado asignado (`assigned_employee_id`)
3. **Tipo** — Individual / Grupal + selección de ciclo (si es grupal)
4. **Nivel** — 1 (Regresión), 2 (Base), 3 (Progresión)
5. **Parámetros** — fecha de inicio, hora de la sesión, meses de duración, frecuencia, días de la semana, duración por sesión
6. **Calendario** — previsualización + guardar

**Planes grupales:** generan sesiones A/B/C en rotación (index % 3) a partir de un `group_cycle` existente.
- Nivel 1 → `regression` (usa `exercise.regression_id`; si es null, usa el base)
- Nivel 2 → `base`
- Nivel 3 → `progression` (usa `exercise.progression_id`; si es null, usa el base)

**Planes individuales:** calendario interactivo donde se añaden ejercicios por día con `ExercisePickerModal`.

#### Editar plan — `planes/[id]/editar/`
- Calendario interactivo mensual
- Clic en un día: hoja inferior (bottom sheet) con los ejercicios de esa sesión
- Añadir ejercicios: usa `ExercisePickerModal` (galería con filtros)
- Editar / eliminar ejercicios existentes
- Mover la sesión a otro día

### Agenda del día (`/dashboard/hoy`)
- Muestra las sesiones del día actual de todos los clientes
- Orden: primero las sesiones del usuario conectado, el resto agrupadas por entrenador
- Estadísticas: total, completadas, pendientes

### Registro de sesión (`/dashboard/hoy/[sessionId]`)
- Flujo de entrenamiento sesión a sesión: ejercicio por ejercicio
- Por cada ejercicio: Series, Reps, Carga (kg), RPE (1-10), RIR (0-10), Comentarios, opción "Saltar"
- RPE: verde ≤ 3, amarillo ≤ 6, rojo > 6
- RIR: rojo ≤ 2, amarillo ≤ 5, verde > 5 (lógica invertida)
- "Completar sesión" solo se activa cuando todos los ejercicios están guardados

### Ciclos de sesiones grupales (`/dashboard/sesiones`)

#### Lista de ciclos (`/dashboard/sesiones`)
- Muestra todos los ciclos con calendario de 4 semanas y estado (Activo / Próximo / Expirado)
- Pestañas "Ciclos" | "Plantillas" (`sesiones-tabs.tsx`)

#### Plantillas de ciclo (`/dashboard/sesiones/plantillas`)
- Listado de plantillas predefinidas con vista previa del patrón mensual A/B/C
- Crear / editar / duplicar / eliminar plantillas (la plantilla por defecto no se puede eliminar)
- Editor de plantilla: cuadrícula de 4 semanas × 5 días (clic para ciclar A→B→C→A) + gestor de franjas del día
- Franjas: se pueden añadir o eliminar por día de la semana y configurar solapamiento y máximo de clientes
- Plantilla por defecto: "Plantilla estàndard" (`id: 00000000-0000-0000-0000-000000000001`)
- Acciones CRUD en `app/actions/cycle-templates.ts`

#### Festivos (`public_holidays`)
- 16 festivos de 2026 precargados: nacionales de España + Cataluña + Sant Narcís (Girona)
- `is_active = false` → el festivo se ignora al generar ciclos (el día pasa a ser laborable)
- `is_override = true` → marcado manualmente por un empleado (`syncHolidaysFromApiAction` no lo sobrescribe)
- `toggleHolidayAction(date)`: cambia `is_active` y pone `is_override = true`
- `syncHolidaysFromApiAction(year)`: llama a la API Nager.Date (ES + ES-CT) y hace upsert. Pendiente: integrarlo en una página de Configuración
- La gestión completa de festivos (añadir festivos locales nuevos, puentes, etc.) irá a una futura sección de **Configuración**

#### Creación de ciclo (`/dashboard/sesiones/nuevo`)
- **Paso 1** — Selección de plantilla (patrón mensual + franjas del día)
- **Paso 2** — Fecha de inicio, notas y ejercicios de cada sesión A/B/C
- Al guardar: `createGroupCycleAction` carga el patrón y las franjas de la plantilla seleccionada desde la BD (si falla, usa `CYCLE_PATTERN_20` y `DAY_SLOT_TEMPLATE` fijos en el código)
- Genera automáticamente `training_sessions` para los 20 días laborables del ciclo
- La generación de fechas usa `generateCycleDates()` de `lib/calendar-utils.ts`: empieza en `start_date` (puede ser cualquier día laborable, no necesariamente lunes) y avanza día a día saltando fines de semana y festivos activos de `public_holidays`

#### Editor de ciclo (`/dashboard/sesiones/[id]`)
- Pestaña "Ejercicios": ejercicios de los 3 bloques A/B/C × 3 dificultades
- Pestaña "Planificación": calendario de 4 semanas × 5 días
  - Cada franja es clicable → abre un panel lateral
  - Panel: editar ejercicios del bloque + asignar empleado + asignar clientes (máx. 6)
  - Celdas de festivo: aparecen en gris con el nombre del festivo + botón "Revertir" que llama a `toggleHolidayAction` (cambio local optimista)

#### Requisitos funcionales de las sesiones grupales (definidos en octubre de 2026)
- **Varias sesiones por día:** en un día de un ciclo puede haber más de una sesión grupal. Se define al crear el ciclo ("Nuevo ciclo").
- **Empleado por sesión:** cada sesión grupal concreta puede tener asignado un empleado distinto.
- **Cambio de bloque:** en un día concreto en el que por defecto toca el bloque A, una de las sesiones grupales puede ser del bloque B (o C). El usuario elige el bloque de cada sesión al definir el ciclo.
- **Máximo 6 clientes por sesión:** cada sesión grupal tiene un límite de 6 clientes. Se configura al crear el ciclo.
- **Visibilidad en "Hoy":** las sesiones grupales deben aparecer una a una en la página "Hoy", con el empleado asignado y el bloque correspondiente.

---

## Patrones de código importantes

### `export const dynamic = 'force-dynamic'`
Añadirlo en todas las páginas Server Component que hacen fetch a Supabase, para evitar la caché de Vercel.

### Server Actions — todos los exports deben ser `async`
En archivos marcados con `'use server'`, **todos** los exports (tipos, funciones) deben ser `async`.
Exportar un tipo o una función no async rompe Turbopack con:
`Error: Only async functions are allowed to be exported in a "use server" file.`
**Solución:** mover los tipos y funciones no async a archivos separados (ej.: `lib/group-sessions-utils.ts`).

### PostgREST devuelve las relaciones como arrays
Al hacer un join con `select('training_plans(...)')`, TypeScript puede inferir un array.
Hay que protegerse así:
```ts
const getPlan = (s: any) => Array.isArray(s.training_plans) ? s.training_plans[0] : s.training_plans
```

### `ExercisePickerModal` — componente reutilizado
Definido en `app/dashboard/planes/nuevo/exercise-picker-modal.tsx`.
Se usa en:
- `planes/nuevo/wizard.tsx` (creación de planes individuales)
- `planes/[id]/editar/edit-plan-calendar.tsx` (edición de planes)

Props necesarias: `exercises`, `exerciseCatalog`, `existingExercises`, `bodyZones`, `movementPatterns`, `muscleGroups`, `equipment`, `objectives`, `dayLabel`, `onAdd`, `onRemove`, `onUpdate`, `onClose`.
Los ejercicios deben tener `muscle_group_ids: string[]` (join vía `exercise_muscle_groups`).

---

## Flujo de Git

```
dev   → preview de Vercel (rama de trabajo habitual)
main  → producción de Vercel
```

```bash
git add [archivos]
git commit -m "feat/fix/chore: descripción"
git push origin dev
```

### Migraciones de base de datos (desde el 2026-11-04)

La estructura de la BD se versiona en `supabase/migrations/`. **No se hacen cambios de esquema a mano en el editor SQL de Supabase.**

- `20261104120000_baseline.sql`: foto del esquema tal como estaba el 2026-11-04 (pg_dump de `public` + objetos fuera de `public`: trigger `on_auth_user_created`, event trigger `ensure_rls`, bucket `avatars`, publicación Realtime). Incluye las políticas abiertas de BUG-002. Sustituye a los antiguos `trainwall-tables.sql` y `group-slots-migration.sql` (ya estaban aplicados).
- Flujo para un cambio nuevo:
  1. `npx.cmd supabase migration new nombre_del_cambio` → escribir el SQL en el archivo creado
  2. Revisarlo y hacer commit junto con el código que lo usa
  3. Aplicarlo: `npx.cmd supabase db push --remote` (pide confirmación; se hace cuando el propietario lo aprueba)
  4. Comprobarlo: `npx.cmd supabase migration list --remote`
- Si algún día se cambia algo a mano en el panel, hay que capturarlo después en una migración.
- Los datos (galería, festivos, clientes) **no** están en las migraciones; solo la estructura.
- Sin Docker en este PC, `supabase db dump/pull` no funcionan directamente. Para hacer un volcado: `npx.cmd supabase db dump --remote --dry-run` muestra el script de `pg_dump` (con un usuario temporal) y se ejecuta con el `pg_dump` local (`C:\Program Files\PostgreSQL\17\bin`, solo herramientas cliente). En Windows hay que cambiar `--quote-all-identifier` por `--quote-all-identifiers`.
- Pendiente antes del go-live: un segundo proyecto de Supabase de pruebas (`brotafit-dev`) donde probar las migraciones antes de producción.

### Registro de bugs

Los bugs abiertos y resueltos se registran en [docs/BUGS.md](./docs/BUGS.md) (IDs `BUG-NNN`).
- Al detectar un bug, añadirlo en "Abiertos".
- El commit que lo arregla lleva el ID en el mensaje: `fix(BUG-002): descripción`.
- Después del commit, moverlo a "Resueltos" con el hash (en un commit `docs:` aparte).
- Consultar este archivo antes de empezar a trabajar en un bug, para ver si ya está registrado.

---

## Cambios recientes (2026-09-22)

- **Wizard de 6 pasos:** el paso 2 se dedica a elegir entrenador (separado del paso 1 de cliente)
- **ExercisePickerModal al editar plan:** se sustituyó el `<select>` por la galería con filtros
- **Aspa para eliminar una sesión del calendario (paso 6 del wizard):** botón `×` rojo en la esquina superior derecha de cada día con sesión
- **Agenda "Hoy" arreglada:** fallaba por el join `profiles:assigned_employee_id` sin FK declarada → fetch separado de profiles y merge en JS
- **Adherencia en el perfil del cliente:** estadísticas completada/expirada/pendiente + % de adherencia en el bloque del plan activo y en el historial
- **Estados en el calendario de editar plan:** colores verde (completada), naranja (pendiente), gris (expirada)
- **`components/ui/input.tsx`:** `bg-white text-[#1C1C1C]` (antes `bg-transparent`, invisible sobre fondo oscuro)
- **`components/ui/label.tsx`:** añadido `text-white`
- **`components/ui/select.tsx`:** `bg-white text-[#1C1C1C]` (antes `bg-transparent`)

---

## Roadmap

- [ ] **DNS:** configurar `app.gironaactiva.com` → Vercel
- [ ] **Merge dev → main** cuando el MVP sea estable, tag `v1.0.0`
- [ ] **Vista de cliente:** calendario móvil del plan activo (el cliente ve su plan). Especificación en `docs/spec-vista-cliente.md`
- [ ] **Imágenes de ejercicios:** Supabase Storage — mostrar foto/vídeo en la galería
- [ ] **Zonas de ejercicio pendientes:** rodilla, cadera, columna/core, hombro (vienen de Excels del cliente)
- [ ] **Gráficos de evolución:** RPE/RIR/carga por ejercicio a lo largo del tiempo (aplazado)
- [ ] **Pulsación larga en el calendario (wizard):** mantener pulsado un día con sesión → modal de confirmación para eliminarla (alternativa al aspa actual, más adecuada para móvil)
- [ ] **TrainWall:** visualización de ejercicios en pantalla (pantalla grande en el gimnasio). Arquitectura HW/SW ya diseñada — ver [CLAUDE-TW.md](./CLAUDE-TW.md). Pendiente: confirmar con el cliente e implementar.
- [ ] **Gestión de planes:** ver el plan activo y el historial desde el perfil del cliente (mejora de UX)
- [ ] **Más empleados:** añadir entrenadores nuevos cuando se incorporen
- [ ] **Página de Configuración** (`/dashboard/configuracio`) — sección general para los parámetros del centro:
  - **Festivos:** listado completo de `public_holidays` con interruptor `is_active` por día, formulario para añadir festivos nuevos (puentes, cierres del centro) y botón "Cargar festivos [año]" que llama a `syncHolidaysFromApiAction` (API Nager.Date). Por ahora, 2026 y 2027 ya están cargados a mano; para 2028 y siguientes habrá que ejecutar la sincronización.
  - **Horarios del centro:** posibilidad futura de definir horarios de apertura y cierre
  - Acceso restringido al rol `employee`

---

## TrainWall — sistema de pantallas en sala

**TrainWall** es el nombre comercial de la funcionalidad de pantallas físicas en el centro. Se vende como módulo opcional de **BrotaFit** (nombre comercial de esta app cuando se vende a terceros). Los documentos de venta (`comercial/brotafit.html`, `comercial/trainwall.html`) viven en el repo `brota-ai`, no aquí.

**Archivos de diseño (referencia, NO implementado todavía):**
- `docs/context-pantallas.md` — contexto de negocio original
- `docs/arquitectura-pantallas.md` — arquitectura hardware/software detallada

### Qué hace

Muestra en pantallas físicas del centro el entrenamiento activo de cada cliente (individual o grupal) cuando el entrenador hace el check-in. La pantalla se actualiza en tiempo real mediante Supabase Realtime, sin recargar.

### Decisiones clave

- **Check-in:** manual por el empleado en el MVP (sin QR/NFC). El empleado selecciona el cliente o la clase grupal, confirma la sesión (sugerida automáticamente por fecha, editable) y elige la pantalla de destino.
- **Hardware (x4 pantallas):** monitor de 32" LED/LCD (no Smart, no OLED) + Android TV box (~50 €) + Fully Kiosk Browser Plus (7,90 €/dispositivo, pago único). Coste total estimado: ~750-950 €.
- **Gestión remota:** desde cualquier ordenador de la red del centro vía `http://<ip>:2323` — no hace falta ninguna unidad central física.
- **Tiempo real:** Supabase Realtime (`postgres_changes` sobre `screen_assignments`, filtrado por `screen_id`).
- **Pantalla grupal:** muestra 3 columnas (regresión / base / progresión), porque varias personas de nivel distinto comparten la misma pantalla.
- **Seguridad:** lectura mediante RLS de solo lectura (sin emails ni teléfonos del cliente). Ninguna escritura posible desde el token de la pantalla. El check-in siempre pasa por Server Actions autenticadas.

### Modelo de datos (tablas nuevas pendientes de crear)

```sql
screens
  id uuid pk
  name text              -- "Pantalla 1", "Zona funcional", etc.
  location text          -- opcional
  access_token text      -- secreto no adivinable, va en la URL del dispositivo
  created_at

screen_assignments
  id uuid pk
  screen_id uuid         -- FK screens
  session_type text      -- 'individual' | 'group'
  client_id uuid         -- FK clients (solo individual)
  plan_session_id uuid   -- FK plan_sessions (solo individual)
  group_session_id uuid  -- FK group_cycle_sessions (solo group) ← nombre real de la tabla
  assigned_by uuid       -- FK profiles (empleado que hace el check-in)
  started_at timestamptz
  ended_at timestamptz   -- null mientras está activa; solo una activa por screen_id
```

⚠️ `docs/arquitectura-pantallas.md` usa `group_sessions`, pero la tabla real es **`group_cycle_sessions`**.

### Ruta de la pantalla

`/pantalla/[screenId]?token=<access_token>` — ruta pública (no requiere login), protegida por un token no adivinable. Al cargar, se suscribe a Realtime. Estado de reposo: logo del centro.

### Preguntas abiertas (sin decidir)

- "Finalizar sesión": ¿botón manual del empleado o cierre automático pasado `session_duration`?
- ¿Conexión Ethernet o WiFi para las pantallas? (depende de si hay toma de red en cada ubicación)
- Número real de pantallas y tamaño — confirmar con Girona Activa antes de comprar el hardware.

### Próximos pasos de TrainWall

- [ ] Confirmar número y tamaño de pantallas con el cliente
- [x] Crear las tablas `screens` y `screen_assignments` en Supabase — ya existen en la BD (comprobado el 2026-11-04) y están en la migración base `supabase/migrations/20261104120000_baseline.sql`
- [x] Server Actions: `createScreenAssignmentAction`, `endScreenAssignmentAction` — en `app/actions/screens.ts`
- [x] Ruta `/pantalla/[screenId]` con Supabase Realtime y estado de reposo — `app/pantalla/[screenId]/page.tsx` + `screen-display.tsx`
- [x] API route `/pantalla/[screenId]/data` para recargar los datos en tiempo real — `app/pantalla/[screenId]/data/route.ts`
- [x] UI de check-in en el dashboard (`/dashboard/pantallas`) — `app/dashboard/pantallas/`
- [x] RLS de solo lectura para la ruta de la pantalla — incluida en el SQL
- [x] "Pantallas" añadido al sidebar de navegación

### Display de TV (pantalla física)

- **Tipografía en pantalla:** tamaño de fuente en `vw` (3.2vw para el nombre del cliente, 1.35vw para los ejercicios) — escala automáticamente en una TV de 32"
- **Sesión individual:** tabla de 5 columnas (bloque, ejercicio, series, reps, carga), agrupada por bloques (A1/A2, B, C1/C2...)
- **Sesión grupal:** 3 columnas (Regresión = amarillo, Base = rojo, Progresión = verde), cada una con bloques y ejercicios por nivel
- **Estado de reposo:** logo centrado con baja opacidad cuando no hay sesión activa
- **Logo GA:** fijo abajo a la derecha, siempre visible, opacidad 50%
- **Realtime:** suscripción vía `supabase_realtime` a `screen_assignments` filtrada por `screen_id` — cuando el entrenador hace el check-in, la pantalla se refresca automáticamente sin recargar
- **Seguridad:** URL protegida por `access_token` en el query param — si el token no coincide, devuelve 404

---

## Notas para futuras sesiones

- **ID del proyecto de Supabase:** `woomjsjbmrasydpirwap`
- **Org de Vercel:** `brota-ai`
- La galería de ejercicios **no está completa** — los ejercicios se van añadiendo por zonas. `regression_id` / `progression_id` estarán vacíos hasta que la galería esté completa; el código ya usa el base si son null.
- La app usa el mismo sistema de diseño que la web de marketing de BrotaAI, pero en modo oscuro.
- El cliente principal es Girona Activa (centro de entrenamiento, zona de Girona). Los usuarios reales del dashboard son los entrenadores.
