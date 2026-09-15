# Contexto del proyecto — Girona Activa

## Qué es el proyecto
App de gestión para un centro de entrenamiento físico llamado **Girona Activa**. La app permite a empleados/administradores gestionar clientes, ejercicios, planes de entrenamiento individuales y grupales. Está en producción en Vercel.

## Stack técnico
- **Framework**: Next.js 16 App Router (Server Components + Server Actions)
- **Auth / DB**: Supabase (PostgreSQL + RLS). `createAdminClient()` bypasses RLS para server actions.
- **Frontend**: Tailwind CSS v4 + shadcn/ui, tema oscuro (`bg-[#111111]`, `bg-[#1C1C1C]`)
- **Deploy**: Vercel (rama `dev` activa, `main` es producción)
- **Repo**: `/Users/deepansh.dhawan/girona-activa-app`

## Modelo de datos relevante

### Planes de entrenamiento (`training_plans`)
- `type`: `'individual'` | `'group'`
- `client_id` → FK a `clients`
- `level`: 1 (Groc/Amarillo), 2 (Blau/Azul), 3 (Vermell/Rojo)
- `cycle_id` → FK a `group_cycles` (solo para planes grupales)
- `status`: `'active'` | `'completed'`
- `start_date`, `end_date`, `weekly_frequency`, `session_duration`

### Sesiones del plan (`plan_sessions`)
- `plan_id` → FK a `training_plans`
- `session_date`: fecha de la sesión
- `session_label`: `'A'` | `'B'` | `'C'` (solo planes grupales) — indica rotación A/B/C
- `order_index`

### Ejercicios del plan (`plan_session_exercises`) — solo planes individuales
- `session_id` → FK a `plan_sessions`
- `exercise_id` → FK a `exercises`
- `sets`, `reps`, `weight_kg`, `notes`, `order_index`

### Ciclos grupales (`group_cycles`)
- `id`, `start_date` (inicio del ciclo de 2 semanas), `notes`

### Sesiones grupales (`group_sessions`)
- `cycle_id` → FK a `group_cycles`
- `label`: `'A'` | `'B'` | `'C'`
- `difficulty`: `'base'` | `'regression'` | `'progression'`
  - `base` = definida por el empleado
  - `regression` = auto-generada (ejercicios de regresión de los del base)
  - `progression` = auto-generada (ejercicios de progresión de los del base)

### Ejercicios de sesión grupal (`group_session_exercises`)
- `session_id` → FK a `group_sessions`
- `exercise_id` → FK a `exercises`
- `sets`, `reps`, `weight_kg`, `notes`, `order_index`

### Ejercicios (`exercises`)
- `id`, `name`, `technical_name`
- `level` (1-3), `technical_level`
- `body_zone_id`, `movement_pattern_id`, `equipment_id`, `objective_id`
- `muscle_group_ids` (array)
- `regression_id` → FK a `exercises` (ejercicio más fácil)
- `progression_id` → FK a `exercises` (ejercicio más difícil)

### Clientes (`clients`)
- `id`, `first_name`, `last_name`, `email`
- `active`: boolean

## Lógica de negocio clave

### Planes individuales
- El empleado define manualmente los ejercicios de cada día del calendario.
- El nivel (1/2/3) es informativo para el empleado al diseñar el plan.

### Planes grupales — flujo completo
1. El empleado crea un **ciclo** (2 semanas) con 3 sesiones base (A, B, C).
2. Al crear el ciclo, el sistema **auto-genera** las variantes de regresión y progresión de cada sesión usando `exercises.regression_id` / `exercises.progression_id`. Si un ejercicio no tiene regresión/progresión, se usa el mismo ejercicio como fallback.
3. El empleado asigna un plan grupal a un cliente, eligiendo: ciclo, nivel, duración, frecuencia semanal, días de la semana.
4. El **nivel** determina qué variante de sesión ve el cliente:
   - Nivel 1 → `difficulty = 'regression'`
   - Nivel 2 → `difficulty = 'base'`
   - Nivel 3 → `difficulty = 'progression'`
5. Los días de entrenamiento rotan A → B → C → A → B → C...

### Rotación de sesiones
```
trainingDayIndex % 3 → 0='A', 1='B', 2='C'
```

## Nuevo requerimiento — Sistema de pantallas en sala

**Objetivo**: mostrar en pantallas físicas del centro el entrenamiento de cada persona que está haciendo su sesión en ese momento.

### Casos de uso
- **Entreno individual**: la pantalla muestra los ejercicios del plan individual del cliente para ese día (ejercicio, series, repeticiones, peso).
- **Entreno grupal**: la pantalla muestra los ejercicios de la sesión grupal correspondiente (sesión A/B/C según el día, variante según el nivel del cliente).
- El sistema debe saber **quién está en sala en este momento** y mostrar su entrenamiento activo.

### Restricciones conocidas
- Los empleados usan la app web (Next.js) desde un ordenador/tablet.
- Los clientes no tienen acceso a la app actualmente (solo los empleados/admins).
- Las pantallas son de uso interno del centro.
- No hay infraestructura de HW definida todavía para las pantallas.

## Lo que se quiere diseñar en la nueva conversación
1. **Arquitectura de hardware**: qué dispositivos usar para las pantallas, cómo conectarlos, si hace falta hardware adicional (Raspberry Pi, Chromecast, tablets, etc.)
2. **Diseño preliminar de software**: cómo integrar la funcionalidad en el stack existente (Next.js + Supabase), cómo saber quién está en sala, cómo mostrar el entreno en tiempo real, si se necesita websockets/realtime, etc.
