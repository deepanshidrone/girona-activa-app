# FRD — BrotaFit (Girona Activa)
**Documento de requisitos funcionales**
Versión: 2.0 | Última actualización: 2026-11-06 | Repo: `deepanshidrone/girona-activa-app`

Este es el **documento de producto** de BrotaFit: qué hace la app, qué está hecho y qué falta. Se mantiene al día con cada funcionalidad (ver [§7](#7-cómo-se-mantiene-este-documento)). El detalle técnico (convenciones de código, migraciones, RLS) está en `CLAUDE.md`. Las especificaciones de módulos concretos están en `docs/spec-*.md`.

**Leyenda:** ✅ implementado · 🟡 parcial · ⏳ pendiente · ❌ fuera de alcance

---

## Índice
1. [Visión general](#1-visión-general)
2. [Usuarios y roles](#2-usuarios-y-roles)
3. [Mapa de módulos](#3-mapa-de-módulos)
4. [Módulos](#4-módulos)
5. [Requisitos transversales](#5-requisitos-transversales)
6. [Roadmap](#6-roadmap)
7. [Cómo se mantiene este documento](#7-cómo-se-mantiene-este-documento)
8. [Historial de versiones](#8-historial-de-versiones)

---

## 1. Visión general

Herramienta web para gestionar los entrenamientos de un centro: los entrenadores crean planes individuales y ciclos grupales, registran las sesiones y siguen a sus clientes. Los clientes, opcionalmente, consultan su plan desde el móvil.

Nació como app a medida de **Girona Activa** (centro de entrenamiento personal y fisioterapia en Girona) y se comercializa como **BrotaFit** a otros centros. El módulo opcional **TrainWall** muestra el entrenamiento en pantallas físicas de la sala.

| | |
|---|---|
| **Estado** | MVP en desarrollo activo en la rama `dev`. Sin versión en producción (sin go-live) |
| **URL dev** | `girona-activa-app-git-dev-brota-ai.vercel.app` (preview de Vercel) |
| **URL producción** | `app.gironaactiva.com` (DNS pendiente) / `girona-activa-app.vercel.app` |
| **Idioma** | Interfaz en castellano. Contenido de la galería de ejercicios en catalán |
| **Dispositivos** | Personal: PC y tablet. Clientes: móvil (mobile-first) |
| **Stack** | Next.js 16 (App Router, Server Actions) · Supabase (PostgreSQL, Auth, RLS, Storage, Realtime) · Vercel · Tailwind v4 + shadcn/ui · Resend (correo) |

**Marca blanca:** decidido que cada centro tendrá su propia instancia (mismo repo, un proyecto de Vercel y uno de Supabase por centro, con la configuración en la tabla `center_settings`). No se construye hasta que firme un segundo centro. Mientras tanto, no se añaden más textos ni datos de Girona Activa fijos en el código.

---

## 2. Usuarios y roles

| Rol | Quién es | Acceso |
|---|---|---|
| **admin** | Jefe del centro (también entrena). Puede haber varios | Todo |
| **employee** | Entrenador contratado | Todo el dashboard salvo **borrar clientes** y **gestionar empleados** (valores por defecto hasta que exista la página de Configuración) |
| **client** | Socio del centro | Solo su área `/client`, y solo si se le ha dado acceso. Muchos socios no usarán la app |

- El rol vive en `app_metadata.role` de Supabase Auth (viaja en el token y solo se cambia desde el servidor). `profiles.role` es una copia que mantiene un trigger.
- `proxy.ts` deniega por defecto: `/dashboard` solo para personal, `/client` solo para clientes.
- La base de datos aplica lo mismo con RLS (BUG-002): el personal ve todo el centro y el cliente no tiene acceso directo a ninguna tabla.

---

## 3. Mapa de módulos

| # | Módulo | Ruta | Estado |
|---|---|---|---|
| 4.1 | Acceso y cuentas | `/login`, `/auth/*` | ✅ |
| 4.2 | Clientes | `/dashboard/clientes` | ✅ |
| 4.3 | Empleados | `/dashboard/empleados` | ✅ |
| 4.4 | Galería de ejercicios | `/dashboard/ejercicios` | 🟡 faltan imágenes, edición y zonas |
| 4.5 | Planes individuales | `/dashboard/planes` | ✅ |
| 4.6 | Sesiones grupales (ciclos, plantillas, festivos) | `/dashboard/sesiones` | ✅ |
| 4.7 | Agenda del día y registro de sesión | `/dashboard/hoy` | 🟡 registro solo de sesiones individuales |
| 4.8 | TrainWall (pantallas en sala) | `/dashboard/pantallas`, `/pantalla/[id]` | 🟡 software hecho, hardware sin confirmar |
| 4.9 | Vista de cliente (móvil) | `/client` | 🟡 versión básica; v1 especificada |
| 4.10 | Perfil del personal | `/dashboard/perfil` | ✅ |
| 4.11 | Panel | `/dashboard` | ✅ |
| 4.12 | Configuración del centro | `/dashboard/configuracion` | ⏳ |
| 4.13 | Informes, ranking, comunidad, nutrición | — | ⏳ fases posteriores |

---

## 4. Módulos

### 4.1 Acceso y cuentas ✅

- Login con email y contraseña (Supabase Auth). Sesión persistente.
- Nadie se registra solo: el personal crea las cuentas.
- **Activación de cuenta:** el correo de invitación (Resend) lleva a `/auth/confirm`, que valida el enlace y manda a `/auth/set-password`. Esta página es común a todos los roles (BUG-001). Después, cada rol va a su inicio: el personal a `/dashboard` y los clientes a `/client`.
- El enlace de invitación caduca a las 24 horas; se puede reenviar.
- Usuario de pruebas: "Cliente Test" (cliente con login y un plan individual de lunes de noviembre a enero).

### 4.2 Clientes ✅

**Listado:** estadísticas (activos, nuevos este mes) y tabla de clientes.

**Alta de cliente** (`/clientes/nuevo`): crea **solo la ficha**, sin cuenta de acceso.

| Campo | Obligatorio |
|---|---|
| Nombre, apellido | ✅ |
| Sexo (Hombre / Mujer / Otro) | ✅ |
| Fecha de nacimiento | ✅ |
| Altura (cm), peso (kg) | ✅ |
| Fecha de inicio | ✅ |
| Email | ❌ Solo hace falta si el cliente va a usar la app |
| Comentarios (notas internas) | ❌ |

**Ficha del cliente** (`/clientes/[id]`):
- Datos personales y notas internas.
- **Acceso a la app** (opcional, decidido 2026-11-05): estado *sin acceso*, *invitado* o *activo*. Botones "Enviar invitación", "Reenviar invitación" y "Guardar email e invitar". Al invitar se crea la cuenta con rol `client` y se enlaza a la ficha.
  - No se puede invitar con un email de personal ni con uno ya enlazado a otro cliente.
  - Si el cliente ya ha entrado, no se reenvía.
- Plan activo con enlace a editar, botón "Nuevo plan" (preselecciona al cliente en el wizard) e historial de planes.
- **Adherencia** por plan: sesiones completadas / expiradas / pendientes y % de adherencia.
- Eliminar cliente (solo admin).

Reglas: un cliente solo tiene un plan activo a la vez.

### 4.3 Empleados ✅

Solo el admin gestiona empleados; el employee puede ver el listado.

- Listado del personal con su rol y estado.
- Alta de empleado o admin: crea la cuenta y envía la invitación con diseño corporativo.
- Ficha: editar datos y rol, activar o desactivar, cambiar la contraseña y ver las sesiones asignadas.
- ⏳ Pendiente: ocultar al employee los botones que no puede usar (hoy los ve, pero el servidor los rechaza).

### 4.4 Galería de ejercicios 🟡

- Catálogo en Supabase, ampliable desde la app. Hoy hay **238 ejercicios**: cadera (Maluc) 88, rodilla (Genoll) 59, core 50 y tobillo/pie (Turmell i peu) 41.
- Los primeros se importaron desde los Excel del cliente (script Python → SQL / CSV).
- **Filtros:** zona corporal, nivel, patrón de movimiento, grupo muscular, equipamiento, objetivo, nivel técnico y búsqueda por nombre.
- **Alta de ejercicio** (`/ejercicios/nuevo`): formulario completo. Los catálogos (por ejemplo, grupos musculares) se pueden crear al vuelo.
- **Campos:** nombre (catalán), nombre técnico, código, subpatrón, nivel 1-3, nivel técnico, progresión y regresión (FK a otro ejercicio), músculos secundarios, contraindicaciones, notas técnicas, errores comunes, zona, patrón, equipamiento y objetivo.
- **Pendiente:**
  - ⏳ Editar y borrar ejercicios desde la app.
  - ⏳ Imagen por ejercicio (Supabase Storage).
  - ⏳ Zona de hombro.
  - ⏳ Completar `regression_id` / `progression_id`. Mientras estén vacíos, el código usa el ejercicio base.
  - ❌ Vídeo (fase posterior).
- La galería es propiedad de Girona Activa: otro centro usaría la suya (o se le podría vender aparte).

**Selector de ejercicios (`ExercisePickerModal`)**, compartido por el wizard y la edición de planes:
- Modal a pantalla completa con los mismos filtros que la galería.
- Por ejercicio se configuran series, repeticiones, peso (opcional) y notas (opcional).
- El panel "En este día" muestra los ejercicios añadidos, con editar y eliminar.

### 4.5 Planes individuales ✅

**Wizard de creación** (`/planes/nuevo`), en 6 pasos:

| Paso | Contenido |
|---|---|
| 1. Cliente | Clientes activos. Se salta si se llega con `?client=uuid` |
| 2. Entrenador | Empleado asignado al plan |
| 3. Tipo | Individual o grupal (con elección de ciclo; ver 4.6) |
| 4. Nivel | 1 Regresión · 2 Base · 3 Progresión |
| 5. Parámetros | Fecha de inicio, hora, meses de duración, frecuencia semanal, días de la semana, duración por sesión (30 o 60 min) |
| 6. Calendario | Vista mensual; clic en un día abre el selector de ejercicios. La `×` roja quita una sesión. Guardar deja el plan activo |

**Edición de plan** (`/planes/[id]/editar`):
- Calendario mensual con estados de cada sesión: verde (completada), naranja (pendiente) y gris (expirada).
- Al pulsar un día se abre una hoja inferior con los ejercicios: añadir (con el selector), editar, eliminar y mover la sesión a otro día.

**Listado de planes**, con acceso a la edición de los activos.

### 4.6 Sesiones grupales ✅

El centro trabaja con **ciclos de 4 semanas** (20 días laborables). Cada día toca un bloque A, B o C. Cada bloque tiene ejercicios en **3 dificultades**: regresión, base y progresión.

**Plantillas de ciclo** (`/sesiones/plantillas`):
- Patrón mensual: cuadrícula de 4 semanas × 5 días; un clic cambia A → B → C.
- Franjas del día por día de la semana: hora, solapamiento y máximo de clientes (normalmente 6).
- Crear, editar, duplicar y eliminar plantillas. La "Plantilla estàndard" es la de por defecto y no se puede borrar.

**Nuevo ciclo** (`/sesiones/nuevo`):
1. Elegir la plantilla.
2. Fecha de inicio (cualquier día laborable), notas y ejercicios de A/B/C por dificultad.

Al guardar se generan las sesiones de los 20 días laborables, saltando fines de semana y festivos activos.

**Detalle del ciclo** (`/sesiones/[id]`):
- Pestaña **Ejercicios:** bloques A/B/C × 3 dificultades, con el selector con filtros.
- Pestaña **Planificación:** calendario de 4 semanas × 5 días. Cada franja abre un panel lateral para:
  - editar los ejercicios del bloque;
  - asignar el entrenador;
  - asignar clientes (máximo 6), cada uno con su dificultad.
  - Los festivos salen en gris, con un botón "Revertir".
- **Requisitos (octubre 2026):**
  - varias sesiones por día;
  - entrenador distinto por sesión;
  - poder cambiar el bloque de una sesión concreta;
  - máximo 6 clientes;
  - cada sesión grupal visible por separado en "Hoy".

**Listado de ciclos:** calendario de 4 semanas y estado (Activo / Próximo / Expirado).

**Plan grupal de un cliente** (wizard, tipo grupal): asigna al cliente a un ciclo con su nivel.
- Rotación A/B/C.
- Nivel 1 usa la regresión de cada ejercicio, nivel 2 la base y nivel 3 la progresión.

**Festivos** (`public_holidays`):
- Cargados de 2026 a 2027: nacionales, Cataluña y Sant Narcís (Girona).
- Cada festivo se puede desactivar (`is_active`), y el cambio manual queda protegido (`is_override`).
- `syncHolidaysFromApiAction(año)` carga un año desde la API Nager.Date, pero todavía no tiene interfaz (irá a Configuración).

### 4.7 Agenda del día y registro de sesión 🟡

**Hoy** (`/dashboard/hoy`):
- Sesiones del día, individuales y franjas grupales.
- Primero salen las del usuario conectado; el resto, agrupadas por entrenador.
- Estadísticas: total, completadas y pendientes.
- Las sesiones se muestran con su rango horario (07:00–08:00).

**Registro de sesión** (`/dashboard/hoy/[sessionId]`):
- El entrenador va ejercicio a ejercicio desde la tablet: series, reps, carga (kg), RPE (1-10), RIR (0-10), comentarios y opción "Saltar".
- Colores: RPE verde ≤ 3, amarillo ≤ 6, rojo > 6. RIR al revés (rojo ≤ 2, amarillo ≤ 5, verde > 5).
- "Completar sesión" se activa cuando todos los ejercicios están guardados.
- ⏳ **Solo funciona para sesiones individuales.** Registrar las grupales requiere enlazar `session_logs` con `training_sessions` (previsto en `docs/spec-vista-cliente.md` §7).

### 4.8 TrainWall — pantallas en sala 🟡

Módulo opcional. Diseño en `docs/arquitectura-pantallas.md` y propuesta comercial en `brota-ai-web/comercial/trainwall.html`.

- **Check-in** (`/dashboard/pantallas`): el entrenador elige el cliente o la clase, la sesión (sugerida por fecha) y la pantalla de destino. También puede finalizar la asignación.
- **Pantalla** (`/pantalla/[screenId]?token=…`): ruta pública protegida por un token no adivinable. Se actualiza en tiempo real (Supabase Realtime).
  - Sesión individual: tabla por bloques.
  - Sesión grupal: 3 columnas (regresión / base / progresión).
  - Sin sesión: reposo con el logo del centro.
- Hay 4 pantallas dadas de alta en la BD.
- **Pendiente:**
  - confirmar el número y el tamaño de las pantallas con Girona Activa, y comprar el hardware (monitor de 32" + Android TV box + Fully Kiosk);
  - decidir si "finalizar sesión" es manual o automático.

### 4.9 Vista de cliente (móvil) 🟡

**Especificación completa:** [`docs/spec-vista-cliente.md`](./spec-vista-cliente.md).

**Hoy:** `/client` es una sola página con tarjeta del plan activo, calendario mensual y detalle del día. Usa tema claro y marca de Girona Activa fija.

**v1 decidida:**
- Solo consulta, con feedback opcional (sin registrar pesos).
- Del entrenador, el cliente solo ve las indicaciones de cada ejercicio; las notas internas no.
- Pantallas:
  - Hoy;
  - Calendario;
  - Detalle de sesión;
  - Historial de sesiones seguidas;
  - Mi progreso;
  - Perfil.
- Los datos se le darán con vistas de solo lectura, sin columnas internas.

### 4.10 Perfil del personal ✅

- Editar el nombre visible y subir foto (bucket `avatars`). El email se ve, pero no se edita.
- El nombre, el avatar y el rol se muestran en el pie del sidebar.

### 4.11 Panel ✅

`/dashboard`: estadísticas y accesos rápidos.

### 4.12 Configuración del centro ⏳

Página `/dashboard/configuracion`, todavía sin crear:

| Sección | Quién |
|---|---|
| Festivos: listado con interruptor, alta de festivos locales y cierres, botón "Cargar festivos [año]" | employee y admin |
| Horarios del centro | employee y admin |
| Permisos por rol: qué puede hacer el employee (hoy fijo en `lib/auth/permissions.ts`) | solo admin |
| Marca y módulos: nombre, logo, color y módulos activos (`center_settings`) | solo admin |

### 4.13 Fases posteriores ⏳

Preparados en el modelo de datos de la spec de la vista de cliente, pero sin construir:
- **Informes y métricas:** del cliente (evolución de RPE, RIR y carga) y del centro (altas, bajas, leads).
- **Ranking:** con consentimiento del cliente (`ranking_opt_in`).
- **Comunidad.**
- **Nutrición:** para el prospecto Pragma Health Club.

---

## 5. Requisitos transversales

- **Seguridad:**
  - Toda Server Action comprueba la sesión y el rol (`requireStaff()` / `requirePermission()`) antes de tocar datos.
  - RLS por rol en todas las tablas (BUG-002).
  - Las claves secretas nunca llegan al navegador.
- **Privacidad:** las notas internas y los datos de salud del cliente solo los ve el personal.
- **Tema:** el dashboard usa fondo oscuro con naranja `#FF914D` como color primario.
- **Base de datos versionada:** los cambios de esquema van en `supabase/migrations/`.
- **Sin dependencias de un solo centro nuevas:** no se añaden más textos ni datos de Girona Activa fijos (ver marca blanca, §1).
- **Deuda conocida:**
  - Las sesiones individuales siguen en `plan_sessions`. Solo los ciclos grupales usan `training_sessions`; la unificación está a medias. Las filas individuales copiadas a `training_sessions` en octubre no se mantienen. Decisión pendiente: terminarla o renunciar a ella.
  - El correo de invitación y `/client` tienen la marca de Girona Activa fija.
  - El menú dice "Empleats" (en catalán).

---

## 6. Roadmap

### Antes del go-live (MVP)
- [ ] Vista de cliente v1 (spec aprobada)
- [ ] Registro de sesiones grupales
- [ ] Página de Configuración (festivos y permisos como mínimo)
- [ ] Imágenes de ejercicios y edición de ejercicios
- [ ] Zona de hombro en la galería
- [ ] Ocultar al employee las acciones sin permiso
- [ ] Proyecto de Supabase de pruebas (`brotafit-dev`) para probar las migraciones
- [ ] Planes de pago de Vercel (Pro) y Supabase (Pro, con backups) antes del uso comercial
- [ ] DNS `app.gironaactiva.com`, merge `dev` → `main` y tag `v1.0.0`

### Mejoras de producto (backlog; incluye el antiguo `FASE2.md`)
| Área | Mejora |
|---|---|
| Planes | Duplicar el plan anterior como base de uno nuevo; sugerencias de ejercicios a partir del plan anterior |
| Planes | Cambiar los días de la semana de todo el plan a la vez (por ejemplo, de L/X a M/J) |
| Planes | Arrastrar sesiones en el calendario de edición (drag & drop) |
| Planes | Al crear un plan, replicar los ejercicios de un día o de una semana al resto |
| Planes | Pulsación larga en el calendario del wizard para borrar una sesión (alternativa móvil a la `×`) |
| Galería | Vídeo por ejercicio |
| Galería | Vista visual por zona corporal (clic en el cuerpo → ejercicios) |
| Clientes | El cliente cambia su contraseña desde la app |
| Informes | Gráficos de evolución de RPE, RIR y carga por ejercicio |
| Centro | Métricas del centro: altas, bajas, leads, contactos fallidos |
| Calidad | Tests automáticos: Playwright (invitación, creación de plan, vista de cliente) y Vitest (calendario) |

### Si se vende a más centros
- [ ] Marca blanca: `center_settings`, textos y correo parametrizados, una instancia por centro

### Fuera de alcance por ahora
- ❌ App nativa (iOS / Android): la vista de cliente es web móvil
- ❌ Notificaciones push
- ❌ Multi-idioma de la interfaz
- ❌ Integración con wearables o apps de fitness
- ❌ Registro de pesos por parte del cliente (v1 solo consulta y feedback)

---

## 7. Cómo se mantiene este documento

- **Cada commit `feat:` actualiza este FRD en el mismo commit:**
  - cambiar el estado del módulo;
  - describir la funcionalidad;
  - mover del roadmap a "implementado".
- Las ideas nuevas van al roadmap (§6), no a archivos sueltos.
- Una funcionalidad grande tiene su propia `docs/spec-<tema>.md`, enlazada desde su módulo.
- Al cambiar de versión, se añade una fila en §8.

---

## 8. Historial de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 2026-08-14 | Primera versión (organizada por perfiles) |
| 1.1 | 2026-08-14 | Estrategia de ramas y versionado; modal de ejercicios |
| 2.0 | 2026-11-06 | Reorganizado por módulos. Incluye lo hecho de agosto a noviembre: entrenador asignado, agenda "Hoy" y registro con RPE/RIR, adherencia, ciclos de 4 semanas con plantillas, franjas y 3 dificultades, festivos, TrainWall, empleados, roles admin/employee/client con RLS (BUG-002) y alta de cliente con acceso opcional. Integra `FASE2.md` en el roadmap |
