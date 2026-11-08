# Especificación — Panel de indicadores (KPIs) del centro

- **Estado:** v1 implementada en `dev` (2026-11-06), pendiente de la ronda de QA. Ver §15.
- **Fecha:** 2026-11-06
- **Rama:** `dev`
- **Relacionado:** `docs/FRD.md` (§4.14 y roadmap §6), `docs/spec-vista-cliente.md` (§7.1 vista `client_sessions`, §7.2 `client_feedback`, §7.3 registro grupal y §7.4 `center_settings`), `input-negocio-GA/Especificaciones de la app – Girona Activa.pdf` (apartado "CRM y KPIs")

---

## 1. Objetivo

El admin (el jefe del centro) abre un panel y, en un minuto, sabe si el centro crece o se vacía, qué clientes se le pueden ir, cómo están repartidos sus entrenadores, si le sobran o le faltan franjas grupales y si los clientes progresan. Cada indicador le lleva a una acción concreta: llamar a un cliente, reasignar carga, abrir o cerrar una franja o revisar una programación.

**Principio rector (decidido 2026-11-06):** manda lo que pide el negocio (la lista de KPIs de Girona Activa), no los datos que existen hoy. Si un dato falta, se crea y se empieza a registrar. **Todos los indicadores de la v1 se implementan aunque hoy salgan vacíos**: cada gráfico se ve con su estado vacío y los datos llegan con los desarrollos que los generan.

---

## 2. Estado actual (revisado en código y BD el 2026-11-06)

Todos los datos son de prueba.

| Pieza | Estado | Impacto |
|---|---|---|
| Panel `/dashboard` | 3 contadores (clientes activos, ejercicios, planes activos) y un subtítulo fijo en catalán "centre de gestió de Girona Activa" | Se amplía (franja para el admin) y se retira el texto fijo |
| `clients` (14) | Todos con `is_active = true`. **Ningún código cambia `is_active`**. La única baja posible es el borrado físico (`delete-client.ts`), que elimina el historial | Hoy no se pueden medir bajas, churn ni reactivaciones |
| `training_plans` (22) | `status`: 11 `active`, 11 `completed`. Un plan solo pasa a `completed` cuando se crea otro para el mismo cliente; al llegar a `end_date` no cambia. **9 planes "activos" tienen la fecha de fin ya pasada**. 16 de 22 sin `assigned_employee_id`. 6 clientes con más de un plan | El estado guardado no es fiable: la vigencia se calcula con fechas. Hacen falta un entrenador obligatorio y una fecha de fin efectiva |
| `plan_sessions` (255) | Sesiones individuales; 223 sin hora | Base de la adherencia individual |
| `training_sessions` grupales (632) | `max_clients = 6` en todas; 631 sin entrenador; solo una tiene clientes (`training_session_clients`, 6 filas). No tienen duración | La ocupación grupal se puede calcular, pero saldría casi a cero. Falta la duración para las horas por entrenador |
| `session_logs` (3) / `exercise_logs` (3) | Todos del 2026-09-22. `session_logs` solo admite `plan_session_id`: **las sesiones grupales no se pueden registrar** | Asistencia, adherencia y progreso sin datos. Los clientes de grupales saldrían siempre al 0 % |
| Adherencia en la ficha del cliente | Completadas ÷ **todas** las sesiones del plan, incluidas las futuras | Contradice la definición de `spec-vista-cliente.md`. Se unifica (§5.3) |
| `profiles` | 2 admin, 3 employee; `hire_date` en 2. Sin horas de trabajo | Falta el dato para el % de ocupación por entrenador |
| Precios, cuotas, pagos, gastos, leads, motivo de baja, `center_settings` | No existen | Lo económico va a la fase 2 y los leads al CRM fase 1. El motivo de baja entra en esta spec |

**Lo que pide Girona Activa** (PDF de Ezequiel, 2026-10-29): leads, altas y bajas, churn ("−5 %"), retención (renovación), ocupación por profesional, facturación, gastos, ticket medio y LTV. Un panel solo para el gestor, con tarjetas con gráfico de tendencia y un resumen con IA.

---

## 3. Decisiones de producto tomadas

| # | Decisión | Motivo |
|---|---|---|
| K1 | Fases: **KPIs v1** (este documento) → **CRM fase 1, leads** (todos los contactos de la web registrados en BrotaFit, también los fallidos) → **KPIs fase 2, económicos** (facturación, gastos, ticket medio y LTV, cuando esté definido cómo se registran los ingresos) | El negocio pide todo; se ordena por dependencia de datos |
| K2 | Todos los KPIs de la v1 se implementan aunque hoy no haya datos, con estados vacíos explícitos | El panel tiene que existir para poder enseñarlo, probarlo y llenarlo |
| K3 | Tres estados de cliente: **Activo** (con plan vigente), **Inactivo** (de alta sin plan vigente) y **Baja** (se ha ido) | Distingue al que se va del que está entre planes |
| K4 | La baja es **siempre manual**. Un inactivo nunca pasa a baja automáticamente; si lleva más de N días inactivo (30 por defecto, configurable), sale una **alerta** | El churn solo es fiable si cada baja es una decisión registrada; la alerta empuja a actuar |
| K5 | Al volver un cliente de baja se **reactiva la misma ficha**, y se guarda el **historial de periodos de alta y baja** | No se pierde la baja anterior y se pueden medir recuperaciones y, en la fase 2, el LTV |
| K6 | **Cualquier miembro del personal** (employee o admin) puede dar de baja y reactivar, con motivo obligatorio y registro de quién lo hizo | Quien se entera de que el cliente se va suele ser el entrenador |
| K7 | El borrado físico de clientes queda solo para el RGPD (derecho de supresión) | Borrar destruye el histórico de los KPIs |
| K8 | El panel de indicadores es **solo para el admin**, sin excepciones en la v1. El employee no ve ni sus propios indicadores | Información de gestión y de personas; el PDF lo pide así |
| K9 | El resumen con IA **queda fuera** de la v1 y no se reserva hueco en la pantalla | La IA integrada es un módulo transversal que se definirá aparte |
| K10 | Los datos de prueba se generan con un **script de demo** (12 meses de historia y escenarios conocidos) en el **proyecto de Supabase actual** (decidido 2026-11-06: hoy todo son datos de prueba y no se crea otro proyecto). Las pruebas manuales cuentan igual en los KPIs. **Antes del go-live se limpia la BD** de todos los datos de prueba | Hace falta histórico para ver y validar los gráficos, y sirve para las demos comerciales |
| K11 | Los KPIs se calculan con **fechas de negocio** (alta, baja, sesión, completado), nunca con `created_at` | Así los datos con fecha pasada (demo o corrección manual) caen en su mes |
| K12 | Una sola definición de **adherencia** para toda la app (panel, ficha del cliente y vista de cliente) | Hoy hay dos definiciones distintas |

---

## 4. Indicadores de la v1

Todos admiten periodo, comparativa y filtros (§6), salvo lo indicado. "Clientes de alta" significa clientes con un periodo de alta abierto (Activos + Inactivos).

### 4.1 Clientes

| KPI | Definición | Filtros |
|---|---|---|
| **Clientes por estado** | Activos, Inactivos y Baja en la fecha final del periodo; evolución mensual (12 meses) en barras apiladas | Entrenador (el de su último plan), tipo de plan |
| **Altas** | Periodos de alta iniciados en el periodo, separados en **nuevas** (primer periodo del cliente) y **reactivaciones** | Entrenador y tipo de plan (los de su último plan a final de mes) |
| **Bajas** | Periodos cerrados en el periodo, con reparto por **motivo** | Entrenador (el de su último plan), tipo de plan |
| **Churn mensual** | Bajas del mes ÷ clientes de alta el día 1 de ese mes. En periodos de varios meses, la media de los meses. Sin clientes de alta al empezar: "sin datos" (no 0 %) | Entrenador, tipo de plan |
| **Retención (renovación)** | De los planes cuya fecha de fin efectiva cae en el periodo, % que tienen un plan siguiente del mismo cliente que empieza **antes** o **como mucho 14 días después** (ventana configurable). Un plan sustituido antes de su fin cuenta como renovado. Un plan cerrado por una baja cuenta como no renovado. Los planes que terminaron hace menos de 14 días quedan **pendientes** y no cuentan hasta que se cierra la ventana | Entrenador, tipo de plan |

### 4.2 Asistencia

| KPI | Definición | Filtros |
|---|---|---|
| **Adherencia del centro** | Sesiones completadas ÷ sesiones programadas con fecha dentro del periodo y **hasta hoy**, sin contar las canceladas ni las posteriores al fin efectivo del plan (§5.3). Individuales y grupales | Entrenador, tipo de plan |
| **Sesiones** | Programadas, completadas y no asistidas en el periodo, por tipo | Entrenador, tipo de plan |

### 4.3 Ocupación

| KPI | Definición | Filtros |
|---|---|---|
| **Ocupación grupal** | Plazas ocupadas (clientes apuntados en `training_session_clients`) ÷ plazas ofertadas (Σ `max_clients` de las sesiones grupales no canceladas). Junto a ella, la **asistencia real** (completadas ÷ apuntadas). Mapa de calor día de la semana × hora | Entrenador |
| **Horas asignadas por entrenador** | Σ duración de las sesiones del periodo asignadas al entrenador: individuales (`training_plans.session_duration` del plan) y grupales (`training_sessions.duration_min`). Las sesiones sin entrenador van a una fila **"Sin asignar"** | — (ya es por entrenador) |
| **Ocupación por entrenador (%)** | Horas asignadas ÷ horas disponibles. Horas disponibles = `profiles.weekly_hours` ÷ 5 × días laborables del periodo (lunes a viernes, sin festivos activos). Sin `weekly_hours`: "configura las horas" en lugar del % | — |

### 4.4 Entrenadores

Tabla comparativa con una fila por entrenador (más "Sin asignar"):
- clientes activos asignados (su último plan vigente);
- sesiones impartidas (`session_logs` completados con su `employee_id`);
- horas asignadas y % de ocupación;
- adherencia de sus clientes;
- retención y bajas de sus clientes.

Solo se filtra por periodo y tipo de plan.

### 4.5 Progreso de los clientes

| KPI | Definición | Filtros |
|---|---|---|
| **Progresión de carga** | Por cliente y ejercicio, carga media (`load_kg`, ejercicios no saltados) de las últimas 4 semanas del periodo frente a las 4 anteriores. Un cliente **progresa** si la variación media de sus ejercicios comparables es > +2 %, **mantiene** si está entre −2 % y +2 %, y **retrocede** si es < −2 %. Sin ejercicios comparables (al menos un registro en cada ventana): "sin datos suficientes". Se muestra el % de cada grupo | Entrenador, tipo de plan |
| **RPE y RIR frente al objetivo** | RPE y RIR medios registrados en sesiones grupales, por **semana del ciclo** (1-4, a partir de `training_sessions.day_index`), frente al rango objetivo de esa semana (§7.6) | Entrenador |
| **Dolor reportado** | % de sesiones con feedback del cliente en las que marcó dolor = sí (`client_feedback`, ver `spec-vista-cliente.md` §7.2) | Entrenador, tipo de plan |

### 4.6 Alertas para actuar

Lista con enlace a la ficha del cliente, siempre calculada a fecha de hoy (no depende del periodo):

| Alerta | Regla (umbral configurable) |
|---|---|
| Inactivo hace demasiado | De alta, sin plan vigente, y más de **30 días** desde el fin efectivo de su último plan (o desde su alta si nunca tuvo plan) |
| Plan a punto de terminar sin renovar | Plan vigente que termina en **14 días** o menos y sin un plan posterior creado |
| Adherencia baja | Adherencia < **60 %** en los últimos 30 días, con al menos 4 sesiones programadas en ese tiempo (para evitar ruido) |

### 4.7 Fuera de la v1

| Indicador | Fase |
|---|---|
| Leads, contactos y conversión | CRM fase 1 |
| Facturación, gastos, ticket medio y LTV | KPIs fase 2 (antes hay que definir cómo se registran los ingresos) |
| Resumen con IA | Módulo de IA integrada, sin fecha |
| Informe en PDF | Más adelante, junto con los informes con IA |

---

## 5. Reglas de cálculo comunes

### 5.1 Fecha de referencia y zona horaria
- "Hoy" y los límites de mes se calculan en la zona horaria del centro (`center_settings.timezone`, `Europe/Madrid` por defecto), nunca con `toISOString()` en UTC.
- Las semanas van de lunes a domingo. Los días laborables son de lunes a viernes, sin los festivos activos de `public_holidays`.

### 5.2 Vigencia de un plan
- **Fin efectivo** = `coalesce(training_plans.ended_on, end_date)`.
- `ended_on` se rellena cuando el plan se cierra antes de tiempo: al crear un plan nuevo para el cliente (= día anterior al inicio del nuevo) o al dar de baja al cliente (= fecha de baja).
- Un plan está **vigente** en la fecha D si `start_date ≤ D ≤ fin efectivo`. Un plan cancelado por una baja tiene como fin efectivo la fecha de baja, así que sigue contando como vigente en los meses anteriores.
- El campo `status` se mantiene por compatibilidad, pero los KPIs no dependen de él. Los planes caducados dejan de contar como activos sin que nadie tenga que cerrarlos.

### 5.3 Adherencia (definición única)
- Se basa en la vista unificada `client_sessions` de `spec-vista-cliente.md` §7.1 (creada con esta v1): una fila por cliente y sesión, sea individual o grupal, con estado `completed`, `missed`, `scheduled`, `cancelled` o `unrecorded`.
- **`unrecorded`** (solo grupales): sesión pasada en la que no se registró a nadie. Se trata como "asistencia no tomada", no como falta, y no cuenta en la adherencia. Así, mientras no exista el registro de sesiones grupales, sus clientes salen "sin datos" y no al 0 %. El panel muestra cuántas plazas quedan fuera por este motivo.
- **Adherencia = completadas ÷ (completadas + no asistidas)**, contando solo las sesiones con fecha ≤ hoy y ≤ fin efectivo del plan.
- Una sesión `in_progress` de hoy no cuenta todavía; una de un día pasado cuenta como no asistida.
- La ficha del cliente (`clientes/[id]/page.tsx`) pasa a usar esta misma definición.

### 5.4 Estado del cliente en la fecha D
1. **Baja**, si no tiene ningún periodo de alta que cubra D.
2. **Activo**, si tiene un periodo que cubre D y un plan vigente en D.
3. **Inactivo**, en el resto de casos.

Así los estados de cualquier fecha pasada se reconstruyen a partir de los periodos y los planes, **sin guardar fotos diarias**.

### 5.5 Atribución al entrenador
- Un cliente se atribuye al entrenador de su **último plan** (vigente o, si no tiene, el más reciente).
- Las sesiones individuales se atribuyen al entrenador del plan; las grupales, al `assigned_employee_id` de la sesión.
- "Sesiones impartidas" usa quién registró realmente la sesión (`session_logs.employee_id`).

### 5.6 Sin datos frente a cero
Cada KPI distingue **"0"** (hubo base y el resultado es cero) de **"sin datos"** (no hay base para calcularlo). "Sin datos" se muestra como "—" con una explicación corta ("No hay sesiones registradas en este periodo"). Ningún KPI muestra un 0 % cuando el divisor es cero.

---

## 6. Periodos, comparativas, objetivos y filtros

- **Periodo:** selector *Este mes* (por defecto) · *Mes anterior* · *Trimestre* · *Año* · *Últimos 12 meses*. Sin rango libre de fechas. Los gráficos de evolución muestran siempre 12 meses, mes a mes, terminando en el periodo elegido.
- **Comparativa:** cada número muestra la variación frente al **periodo anterior** de la misma duración (▲ +12 % respecto a octubre). Un interruptor cambia a la comparativa con el **mismo periodo del año anterior**; sin datos de entonces, se muestra "sin datos".
- **Objetivos:** cada KPI puede tener un objetivo editable por el admin, con semáforo verde, ámbar (a menos del 10 % del umbral) o rojo. Valores iniciales:

| Clave | KPI / regla | Valor inicial |
|---|---|---|
| `churn_max` | Churn mensual | ≤ 5 % |
| `retention_min` | Retención | ≥ 70 % |
| `adherence_min` | Adherencia del centro | ≥ 80 % |
| `group_occupancy_min` | Ocupación grupal | ≥ 70 % |
| `trainer_occupancy_range` | Ocupación por entrenador | 60-85 % (por encima, sobrecarga) |
| `alert_inactive_days` | Alerta de inactividad | 30 días |
| `alert_plan_end_days` | Aviso de plan que termina | 14 días |
| `alert_adherence_min` | Alerta de adherencia individual | < 60 % |
| `renewal_window_days` | Ventana de renovación | 14 días |

- **Filtros globales:** **entrenador** y **tipo de plan** (individual o grupal). Se aplican a todas las pestañas; en los KPIs donde no tienen sentido se indica "no se filtra por entrenador".
- Los filtros y el periodo van en la URL (`?periodo=2026-10&entrenador=…&tipo=grupal`), para poder guardar o compartir una vista.

---

## 7. Cambios en el modelo de datos

Todos van en migraciones (`supabase/migrations/`) y siguen la convención RLS `is_staff()` de `CLAUDE.md`, salvo lo indicado.

### 7.1 Historial de altas y bajas: tabla nueva `client_periods`
```
client_periods
  id             uuid pk
  client_id      uuid  → clients (on delete cascade)
  started_on     date  not null          fecha de alta (o de reactivación)
  ended_on       date  null              fecha de baja; null = periodo abierto
  end_reason_id  uuid  null → client_end_reasons   obligatorio si ended_on
  end_notes      text  null              comentario interno de la baja
  started_by     uuid  null → profiles
  ended_by       uuid  null → profiles
  created_at, updated_at
  CHECK (ended_on is null or ended_on >= started_on)
  UNIQUE INDEX un solo periodo abierto por cliente (where ended_on is null)
```
- **Migración de datos:** a cada cliente existente se le crea un periodo abierto con `started_on = clients.start_date`.
- Al dar de alta un cliente se crea su primer periodo (`started_on = start_date`).
- `clients.is_active` se mantiene sincronizado (true si tiene un periodo abierto), para no romper el código que lo usa. La fuente de verdad es `client_periods`.

### 7.2 Motivos de baja: tabla nueva `client_end_reasons`
`id`, `label`, `sort_order`, `is_active`. Es un catálogo configurable por centro, con estos valores iniciales (pendientes de validar con Girona Activa):
- Precio;
- Horario o falta de tiempo;
- Cambio de domicilio;
- Lesión o motivo de salud;
- No está satisfecho con el servicio;
- Ha cumplido su objetivo;
- Otro (con comentario obligatorio).

### 7.3 Planes: cambios en `training_plans`
- `ended_on date null`: fin efectivo cuando el plan se cierra antes de su `end_date` (§5.2).
- Nuevo valor de `status`: `cancelled` (plan cerrado por una baja).
- `assigned_employee_id` pasa a ser **obligatorio** al crear un plan (wizard y plan grupal). Los planes antiguos sin entrenador se quedan en "Sin asignar".
- Al crear un plan nuevo, el anterior pasa a `completed` (como hoy) y además recibe `ended_on`.

### 7.4 Sesiones grupales: cambio en `training_sessions`
- `duration_min integer not null default 60`. Se rellena desde la plantilla de franjas al crear el ciclo, y `cycle_template_slots` gana también `duration_min`.

### 7.5 Empleados: cambio en `profiles`
- `weekly_hours numeric null`: horas semanales disponibles para sesiones. Se edita en la ficha del empleado (solo admin). Cuando exista el horario del centro en Configuración, podrá calcularse a partir de él sin cambiar el KPI.

### 7.6 Objetivos de la progresión del ciclo: tabla nueva `cycle_week_targets`
```
cycle_week_targets
  week          int pk  (1-4)
  phase_name    text    "Consolidar técnica", "Submáximo", "Máximo", "Estabilización"
  rpe_min, rpe_max   numeric
  rir_min, rir_max   numeric
```
- Datos iniciales con la progresión de Girona Activa: 6/6, 7/3, 8/2 y 7-8/2-3. Son datos de la BD, no código.
- Más adelante podrá ser por objetivo del mes (fuerza, potencia…) si el ciclo guarda su objetivo.

### 7.7 Objetivos y umbrales: tabla nueva `kpi_targets`
`key text pk`, `value_min numeric null`, `value_max numeric null`, `updated_by → profiles`, `updated_at`. Datos iniciales: los de §6. Lectura para el personal; **escritura solo para el admin** (`is_admin()`).

### 7.8 Configuración del centro
Si cuando se haga esta parte aún no existe `center_settings` (`spec-vista-cliente.md` §7.4), se crea con al menos `timezone`. El resto de campos (marca y módulos) son de esa spec.

### 7.9 Dependencias de la vista de cliente (compartidas)
- **`session_logs.training_session_id`** y el registro de sesiones grupales (`spec-vista-cliente.md` §7.3). Sin esto, la asistencia, la adherencia y el progreso de los grupales salen vacíos.
- **Vista `client_sessions`** (§7.1 de esa spec): base de la adherencia (§5.3).
- **Tabla `client_feedback`** (§7.2 de esa spec): base del KPI de dolor.

Los KPIs se pueden publicar antes que estas piezas: los indicadores que dependen de ellas se ven con su estado vacío (K2).

### 7.10 Datos de demo
- Columna `is_demo boolean not null default false` en las tablas raíz que crea el script: `clients`, `profiles`, `group_cycles` y `cycle_templates`. Las tablas hijas se borran en cascada; antes de implementarlo hay que revisar que todas las FK tengan `on delete cascade`.
- Los KPIs **no** filtran por `is_demo`. La demo y las pruebas manuales conviven en la misma BD y cuentan igual. La marca sirve para que `--reset` borre solo la demo; la limpieza del go-live borra todos los datos de prueba, marcados o no (§11.4).

---

## 8. Baja y reactivación del cliente (flujo nuevo)

**Dar de baja** (ficha del cliente, botón "Dar de baja", para cualquier miembro del personal):
1. Modal con **fecha de baja** (hoy por defecto; puede ser pasada, nunca futura), **motivo** (lista §7.2, obligatorio) y **comentario** (opcional; obligatorio con "Otro").
2. Al confirmar:
   - se cierra el periodo abierto (`ended_on`, motivo, `ended_by`);
   - el plan vigente pasa a `cancelled` con `ended_on = fecha de baja`;
   - se **borran las sesiones futuras** de ese plan sin registro (`plan_sessions` posteriores a la fecha de baja), y se quita al cliente de las sesiones grupales futuras (`training_session_clients`);
   - el historial pasado no se toca.
3. El cliente desaparece de "Hoy", del wizard y de las franjas grupales. Sigue en el listado con el filtro "Baja".

**Reactivar** (ficha de un cliente de baja, botón "Reactivar"):
1. Fecha de reactivación (hoy por defecto, puede ser pasada).
2. Se crea un periodo nuevo y el cliente queda **Inactivo** hasta que tenga plan. La pantalla ofrece "Crear plan" (wizard con el cliente preseleccionado).
3. No se puede crear un plan para un cliente de baja sin reactivarlo antes.

**Listado de clientes:**
- filtro por estado (Activo / Inactivo / Baja), por defecto Activo + Inactivo;
- etiqueta de estado en cada fila;
- las estadísticas de la cabecera usan la definición de §5.4.

**Ficha del cliente:**
- estado actual;
- historial de periodos (alta, baja y motivo);
- adherencia con la definición de §5.3.

---

## 9. Pantallas y navegación

- **Ruta:** `/dashboard/indicadores`.
- **Menú lateral:** entrada "Indicadores", visible **solo para el admin**.
- **Panel `/dashboard`:** el admin ve además una franja con 4 números (clientes activos, churn del mes, adherencia del mes y alertas pendientes) y el enlace "Ver indicadores". El employee ve el Panel como hasta ahora. Se retira el texto fijo "centre de gestió de Girona Activa".
- **Dispositivos:** diseñado para escritorio y tablet. En móvil se adapta a una columna para consultar, sin una versión aparte.
- **Tema:** el oscuro del dashboard. Los colores del semáforo y de los gráficos se definen como tokens, no fijos por centro.

```
/dashboard/indicadores
┌──────────────────────────────────────────────────────────────────────┐
│ Indicadores      [Este mes ▾] [vs mes anterior ⇄] [Entrenador ▾] [Tipo ▾]│
│ [Resumen] [Clientes] [Ocupación] [Entrenadores] [Progreso]  [Objetivos] │
├──────────────────────────────────────────────────────────────────────┤
│ RESUMEN                                                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│ │Clientes act.│ │Altas  6     │ │Bajas  2     │ │Churn 3,1 % ●│      │
│ │ 48  ▲ +4 %  │ │ ▲ +2        │ │ ▼ −1        │ │ obj ≤ 5 %   │      │
│ │ ╱╲_╱‾‾      │ │ _╱‾╲_╱      │ │ ‾╲_╱╲_      │ │ ‾╲__╱‾      │      │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│ │Retención    │ │Adherencia   │ │Ocup. grupal │ │Ocup. entren.│      │
│ │ 72 % ●      │ │ — sin datos │ │ 41 % ●      │ │ 68 % ●      │      │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
│ ┌─────────────┐                                                      │
│ │Progresan    │   ALERTAS PARA ACTUAR (hoy)                 [CSV]    │
│ │ 58 % ●      │   • 5 inactivos hace más de 30 días        →         │
│ └─────────────┘   • 3 planes terminan en ≤ 14 días sin renovar →     │
│                   • 4 clientes con adherencia < 60 %       →         │
└──────────────────────────────────────────────────────────────────────┘

CLIENTES: barras apiladas Activo/Inactivo/Baja (12 meses) · altas nuevas vs
          reactivaciones · bajas por motivo · churn mensual con línea objetivo ·
          retención mensual (con "pendientes de ventana")
OCUPACIÓN: mapa de calor día × hora (apuntados / plazas, y asistencia real) ·
          horas asignadas y % por entrenador (barras con banda objetivo)
ENTRENADORES: tabla (clientes activos, sesiones impartidas, horas, % ocupación,
          adherencia, retención, bajas) + fila "Sin asignar"           [CSV]
PROGRESO: progresa / mantiene / retrocede · RPE y RIR por semana del ciclo
          frente a la banda objetivo · % de sesiones con dolor
```

- Cada tarjeta del resumen lleva a su pestaña. Cada alerta abre la lista de clientes afectados con enlace a la ficha.
- **Objetivos:** el botón abre un panel lateral (solo admin) para editar los valores de §6.
- **Estados vacíos:** todas las tarjetas y gráficos se pintan siempre (ejes, leyenda y banda objetivo) con el mensaje de "sin datos" que corresponda (§5.6).
- **Exportar CSV:** alertas, tabla de entrenadores, clientes por estado, bajas con motivo y la serie mensual de cada gráfico. CSV en UTF-8 con BOM y separador `;` (para que Excel en castellano lo abra bien). El nombre del archivo incluye la sección y el periodo (`indicadores_bajas_2026-10.csv`).

---

## 10. Permisos y privacidad

### 10.1 Permisos nuevos en `lib/auth/permissions.ts`

| Permiso | employee (por defecto) | Uso |
|---|---|---|
| `indicadores.ver` | `false` | Página `/dashboard/indicadores`, franja del Panel, editar objetivos y exportar |
| `clientes.baja` | `true` | Dar de baja y reactivar clientes |

- En la v1, `indicadores.ver` no se abrirá al employee (K8). El permiso existe para que la página de Configuración pueda cambiarlo más adelante sin tocar las acciones.
- Editar los objetivos requiere además el rol admin (también lo exige la RLS de `kpi_targets`).

### 10.2 Cómo se protege
- **Página y Server Actions:** `/dashboard/indicadores`, sus acciones (datos, objetivos y exportación) y la franja del Panel empiezan con `requirePermission('indicadores.ver')`. Si no se tiene el permiso, la página devuelve 404 (no se revela que existe) y la entrada del menú no se pinta. Las acciones de baja y reactivación usan `requirePermission('clientes.baja')`.
- **Cálculos en la BD:** los KPIs se calculan en funciones SQL (`kpi_*`) del esquema `public` con `revoke execute ... from public, anon, authenticated` y `grant execute ... to service_role`. Solo el servidor (`createAdminClient()`, después de comprobar el permiso) puede llamarlas, nunca un cliente o un employee desde la API.
- **RLS de las tablas nuevas:**
  - `client_periods` y `client_end_reasons`: `is_staff()`, porque cualquier miembro del personal da de baja.
  - `cycle_week_targets` y `kpi_targets`: lectura para `is_staff()` y escritura solo para `is_admin()`.
  - `is_admin()` se crea igual que `is_staff()`, leyendo `app_metadata.role` del token.
- **Clientes:** sin acceso a ninguna tabla nueva.
- **Comprobación (QA):** con la sesión de un employee y con la de un cliente se intenta abrir `/dashboard/indicadores`, llamar a una Server Action de KPIs por POST y ejecutar una función `kpi_*` por la API. Las tres cosas deben fallar.

### 10.3 Qué ve el admin de los empleados
Nombre, horas semanales, horas y sesiones asignadas e impartidas, % de ocupación y los indicadores agregados de sus clientes (adherencia, retención y bajas). Ningún dato salarial ni de evaluación personal.

### 10.4 Datos de los clientes
- Los indicadores son agregados. Las listas de alertas muestran nombres porque llevan a una acción, y el admin ya ve esas fichas.
- El dolor reportado y los motivos de baja ("Lesión o motivo de salud") son datos de salud: solo personal del centro, nunca en exportaciones fuera de la sección de bajas y nunca en el ranking.

---

## 11. Datos de demo y pruebas

### 11.1 Entorno
- La demo se carga en el **proyecto de Supabase actual** (`woomjsjbmrasydpirwap`), el mismo que usan el local, el preview y la futura producción. No se crea otro proyecto: hoy todos los datos son de prueba.
- No hay que cambiar variables de entorno ni en local ni en Vercel.

### 11.2 Script de demo (`scripts/seed-demo.ts`)
- Solo se ejecuta con una confirmación explícita (variable `ALLOW_DEMO_SEED=true`). Tras el go-live se desactiva, para que nunca escriba datos falsos sobre datos reales.
- Es **determinista** (semilla fija): siempre genera los mismos datos, así que los valores esperados de los KPIs se conocen.
- Genera **12 meses** hasta hoy:
  - unos 60 clientes con altas repartidas y estacionalidad (picos en enero y septiembre, caída en agosto);
  - bajas con motivo y alguna reactivación;
  - planes con renovaciones y planes que terminan sin renovar;
  - 3-4 entrenadores demo con horas semanales;
  - ciclos grupales con franjas llenas y otras vacías;
  - sesiones registradas con RPE, RIR y cargas que progresan, y feedback con y sin dolor.
- Incluye **escenarios con nombre**, cada uno con su resultado esperado: un cliente constante, uno que va dejando de venir (alerta de adherencia), uno inactivo hace 45 días (alerta de inactividad), uno con el plan a punto de terminar, un entrenador sobrecargado (> 85 %), uno con poca carga y una franja vacía.
- `--reset` borra solo las filas con `is_demo = true` (y sus hijas). Las pruebas manuales se conservan.
- Lo que el personal haga a mano en la app cuenta igual en los KPIs. El script rellena el pasado y las pruebas manuales se suman al presente; para probar meses pasados, la baja y el alta admiten fechas pasadas.

### 11.3 Tests
- **Integración (Vitest contra la BD de pruebas actual):** un conjunto pequeño de datos fijos por KPI, marcados como demo y borrados al terminar, con su resultado exacto, incluidos los casos límite: divisor cero, plan sustituido antes de tiempo, baja con sesiones futuras, cliente reactivado en el mismo mes, ventana de renovación pendiente y festivo en el periodo.
- **Ronda manual de QA** en `qa/rondas/`: flujo de baja y reactivación, filtros, comparativas, objetivos, exportación CSV, permisos (§10.2) y vista móvil.

### 11.4 Limpieza antes del go-live
Todo lo que hay hoy en la BD es de prueba. Antes de empezar a registrar datos reales:
1. Se borran todos los datos de operación: clientes y sus cuentas de acceso, periodos, planes, sesiones, ciclos, registros, feedback y asignaciones de pantallas.
2. Se borran los empleados de prueba y se revisan los reales.
3. Se conservan la estructura y los catálogos del centro: galería de ejercicios, catálogos, festivos, plantillas de ciclo, pantallas, motivos de baja, objetivos de los KPIs y progresión del ciclo.
4. Se desactiva el script de demo.

La lista exacta de tablas se cerrará en un script de limpieza revisado por el propietario antes de ejecutarlo.

---

## 12. Marca blanca

- Nada de Girona Activa en el código. Motivos de baja, objetivos, progresión del ciclo, zona horaria y horas de los empleados son **datos** de cada instancia.
- Los textos de la interfaz son genéricos ("el centro", nunca un nombre).
- Al crear la instancia de un centro nuevo, los datos iniciales (motivos, objetivos y progresión) se cargan con valores por defecto neutros, que el centro ajusta.

---

## 13. Orden de trabajo sugerido

1. Migración del modelo (§7.1-7.7 y 7.10), datos iniciales y permisos nuevos.
2. Baja y reactivación, listado y ficha del cliente (§8), adherencia unificada en la ficha y entrenador obligatorio en el wizard.
3. Horas semanales en la ficha del empleado y duración en las franjas grupales.
4. Funciones SQL `kpi_*` y sus tests de integración.
5. Página `/dashboard/indicadores` (pestañas, filtros, comparativas, objetivos y CSV) y franja en el Panel.
6. Script de demo con escenarios.
7. Ronda de QA.

Antes del go-live: limpieza de la BD (§11.4).

En paralelo o después, y compartido con la vista de cliente: registro de sesiones grupales, vista `client_sessions` y `client_feedback`. Al llegar, rellenan los KPIs que hasta entonces salen vacíos.

---

## 14. Preguntas abiertas

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| Q1 | ¿El "−5 %" de churn de Ezequiel es el máximo mensual aceptable? | Sí, objetivo `churn_max` = 5 % mensual, editable |
| Q2 | ¿La lista de motivos de baja (§7.2) es la que usa Girona Activa? | Validarla con Ezequiel; se edita como datos |
| Q3 | ¿Cuánto duran las sesiones grupales? | 60 min por defecto, configurable por franja |
| Q4 | ¿Una reactivación cuenta como alta en el KPI de altas? | Sí, separada de las altas nuevas |
| Q5 | ¿La ventana de renovación de 14 días encaja con la práctica del centro? | 14 días, configurable |
| Q6 | ¿Las horas semanales de un entrenador que también es admin (Ezequiel) cuentan solo las de entrenar? | Sí: `weekly_hours` = horas disponibles para sesiones, no la jornada completa |
| Q7 | ¿Se registra quién captó o atendió al cliente (comercial) para atribuir las altas? | No en la v1; encaja en el CRM fase 1 |

---

## 15. Implementación v1 (2026-11-06)

| Pieza | Dónde |
|---|---|
| Migraciones | `supabase/migrations/20261106120000_kpis_v1.sql` (modelo, vistas y funciones `kpi_*`) y `20261106130000_kpis_v1_permisos_vistas.sql` (lectura de las vistas para `service_role`) |
| Cálculo | SQL: `kpi_monthly`, `kpi_client_states`, `kpi_progress`, `kpi_alerts`, `kpi_working_days`. TypeScript (funciones puras): `lib/kpis/compute.ts` y `lib/kpis/period.ts`. Carga: `lib/kpis/load.ts`, que pagina las llamadas porque la API devuelve como máximo 1.000 filas |
| Panel | `app/dashboard/indicadores/` (página, filtros, objetivos y `exportar/route.ts`); gráficos en `components/kpis/charts.tsx` (SVG propio, sin librería) |
| Baja y reactivación | `app/actions/client-status.ts`, `app/dashboard/clientes/[id]/status-card.tsx`; listado con filtro de estado en `app/dashboard/clientes/page.tsx` |
| Planes | `lib/plans.ts`: entrenador obligatorio, bloqueo para clientes de baja y fin efectivo del plan sustituido |
| Otros | Horas semanales en la ficha del empleado; duración por franja en las plantillas de ciclo; franja de indicadores en `/dashboard`; entrada "Indicadores" en el menú solo con permiso |
| Demo | `scripts/seed-demo.mts` (`npm run seed:demo` con `ALLOW_DEMO_SEED=true`; `--reset` la borra) |
| Tests | `npm test`: unitarios de las fórmulas (`tests/kpis/compute.test.ts`) y de integración contra la BD (`tests/kpis/db.test.ts`, solo con `ALLOW_DEMO_SEED=true`: escribe y borra datos en marzo de 2024) |

**Diferencias con lo especificado:**
- Las altas y las bajas se filtran por el entrenador y el tipo del último plan del cliente (§4.1).
- La exportación de bajas lista todas las del periodo, sin aplicar los filtros de entrenador y tipo, y no incluye el comentario de la baja (puede contener datos de salud).
- `cycle_week_targets` no tiene editor en la interfaz todavía: se cambia en la BD. Los demás objetivos se editan desde el panel.
- ~~El dolor reportado sale siempre "sin datos" hasta que exista `client_feedback` (vista de cliente).~~ Implementado el 2026-11-08 con el feedback del cliente.
  - `computePain` en `lib/kpis/compute.ts` calcula el % de sesiones con feedback que marcan dolor.
  - Se atribuye por la fecha de la sesión, su entrenador y su tipo de plan (vía `client_sessions`), y respeta los filtros y el periodo de comparación.
- El registro de sesiones grupales sigue pendiente. Ya existe la columna `session_logs.training_session_id` que usan los KPIs y la demo, pero no la pantalla.

