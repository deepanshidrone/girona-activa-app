# FRD — Girona Activa App
**Functional Requirements Document**
Versión: 1.1 | Última actualización: 2026-08-14 | Repo: `deepanshidrone/girona-activa-app`

---

## Índice
1. [Visión general](#1-visión-general)
2. [Usuarios y roles](#2-usuarios-y-roles)
3. [Autenticación](#3-autenticación)
4. [Stack técnico](#4-stack-técnico)
5. [Funcionalidades — Empleado](#5-funcionalidades--empleado)
6. [Funcionalidades — Cliente](#6-funcionalidades--cliente)
7. [Galería de ejercicios](#7-galería-de-ejercicios)
8. [Planes grupales predefinidos](#8-planes-grupales-predefinidos)
9. [Out of scope — MVP](#9-out-of-scope--mvp)
10. [Roadmap Fase 2](#10-roadmap-fase-2)
11. [Estado de implementación](#11-estado-de-implementación)

---

## 1. Visión general

Herramienta web para la gestión y visualización de planes de entrenamiento del centro Girona Activa. Permite a los empleados crear y asignar planes personalizados a sus clientes, y a los clientes consultar su plan activo en un calendario.

| | |
|---|---|
| **URL** | `app.gironaactiva.com` (pendiente DNS) / `dev--girona-activa-app.vercel.app` |
| **Idioma MVP** | Castellano (interfaz empleado) / Catalán (contenido ejercicios) |
| **Dispositivos** | Empleados: PC / tablet · Clientes: móvil (mobile-first) |

---

## 2. Usuarios y roles

| Rol | Descripción | Acceso MVP |
|---|---|---|
| **Empleado** | Entrenador del centro | Alta clientes + creación de planes + galería de ejercicios |
| **Cliente** | Miembro del centro | Vista de su plan activo en calendario |
| **Admin** | *(fuera del MVP)* | — |

Un único rol de empleado para el MVP. Sin distinción admin/entrenador.

---

## 3. Autenticación

- Login por email + contraseña para ambos roles
- El empleado crea la cuenta del cliente (el cliente no se registra solo)
- Sesión persistente (no expirar en cada visita)
- Proveedor: **Supabase Auth**
- El cliente recibe un email de invitación con link de acceso directo

---

## 4. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, Server Components, Server Actions) |
| Base de datos + Auth | Supabase (PostgreSQL + Auth + RLS) |
| Almacenamiento | Supabase Storage (bucket `avatars`) |
| Hosting | Vercel |
| UI | Tailwind CSS v4 + shadcn/ui |
| Dominio | `app.gironaactiva.com` (pendiente configuración DNS) |
| Repo | `deepanshidrone/girona-activa-app` |

### Esquema de base de datos

| Tabla | Schema | Descripción |
|---|---|---|
| `users` | `auth` | Credenciales + email + `app_metadata.role` |
| `profiles` | `public` | Nombre visible + avatar. FK → `auth.users` |
| `clients` | `public` | Datos físicos/entrenamiento del cliente. FK → `auth.users` |
| `exercises` | `public` | Catálogo de ejercicios con metadata completa |
| `body_zones` | `public` | Partes del cuerpo (pie/turmell, rodilla, cadera…) |
| `movement_patterns` | `public` | Patrones de movimiento |
| `muscle_groups` | `public` | Grupos musculares |
| `equipment` | `public` | Equipamiento necesario |
| `objectives` | `public` | Objetivos del ejercicio |
| `exercise_muscle_groups` | `public` | Relación N:M ejercicios ↔ grupos musculares |
| `plans` | `public` | Planes de entrenamiento |
| `plan_days` | `public` | Días de entrenamiento dentro de un plan |
| `plan_exercises` | `public` | Ejercicios asignados a un día del plan |

### Ramas Git

| Rama | Propósito |
|---|---|
| `main` | Producción estable |
| `dev` | Desarrollo activo — deploy automático en Vercel (preview) |
| `feature/*` | Funcionalidades nuevas — se mergean a `dev` |

---

## 5. Funcionalidades — Empleado

### 5.1 Alta de cliente nuevo ✅

Formulario con los siguientes campos:

| Campo | Tipo | Obligatorio |
|---|---|---|
| Nombre | Texto | ✅ |
| Apellido | Texto | ✅ |
| Sexo | Desplegable (Hombre / Mujer / Otro) | ✅ |
| Fecha de nacimiento | Fecha | ✅ |
| Altura (cm) | Número | ✅ |
| Peso (kg) | Número | ✅ |
| Fecha de inicio | Fecha | ✅ |
| Email | Email | ✅ |
| Comentarios adicionales | Texto largo | ❌ |

**Resultado:** Registro en `public.clients` + cuenta de acceso en `auth.users` vía Supabase invite + fila en `public.profiles`.

---

### 5.2 Generación de plan individual ✅

**Paso 1 — Selección de cliente**
Desplegable con todos los clientes activos (`is_active = true`). Muestra nombre + apellido.

**Paso 2 — Tipo de entrenamiento**
Selector: Grupal / Individual.

**Paso 3 — Nivel del cliente**
| Nivel | Descripción |
|---|---|
| Nivel 1 (Groc) | Amateur, sin experiencia previa |
| Nivel 2 (Blau) | Experiencia básica-intermedia |
| Nivel 3 (Vermell) | Experiencia avanzada |

**Paso 4 — Parámetros del ciclo (solo Individual)**
| Parámetro | Opciones |
|---|---|
| Duración del ciclo | Número de meses (libre) |
| Frecuencia semanal | Días/semana (libre) |
| Días de la semana | Selector multi-día (L/M/X/J/V/S/D) |
| Duración por sesión | 30 min / 1 hora |

**Paso 5 — Planificación día a día**
- Vista de calendario mensual con los días de entrenamiento disponibles
- Al clicar un día → se abre el **modal de selección de ejercicios** (pantalla completa)

**Modal de selección de ejercicios:**
- Galería con filtros en sidebar izquierdo:
  - Parte del cuerpo (body zone)
  - Nivel (Groc / Blau / Vermell)
  - Patrón de movimiento
  - Músculo
  - Equipamiento
  - Objetivo
- Búsqueda por nombre / nombre técnico
- Al seleccionar un ejercicio se configuran: Series · Repeticiones · Peso (kg, opcional) · Notas (opcional)
- Se pueden agregar múltiples ejercicios por día
- Se pueden eliminar ejercicios de un día

**Paso 6 — Confirmación**
El empleado guarda el plan completo → queda activo para el cliente.

---

### 5.3 Generación de plan grupal ⏳

El plan se asigna automáticamente según el nivel seleccionado. Hay 3 plantillas predefinidas (una por nivel) almacenadas en Supabase. El empleado confirma la asignación → el plan queda activo.

> **Pendiente:** recibir las 3 plantillas predefinidas del cliente para cargarlas en Supabase.

---

### 5.4 Gestión de planes ⏳

- Ver el plan activo de cualquier cliente
- Ver el historial de planes anteriores de un cliente
- Un cliente solo puede tener 1 plan activo simultáneamente
- Al asignar un plan nuevo, el anterior pasa automáticamente a histórico

---

### 5.5 Perfil de empleado ✅

- Editar nombre visible
- Subir foto de perfil (almacenada en Supabase Storage, bucket `avatars`)
- Email visible (no editable)
- Nombre y avatar se muestran en el footer del sidebar

---

### 5.6 Galería de ejercicios ✅

Ver sección 7.

---

## 6. Funcionalidades — Cliente (MVP)

| Funcionalidad | Estado |
|---|---|
| Vista del plan activo en calendario | ⏳ Pendiente |
| Navegación entre semanas/meses | ⏳ Pendiente |
| Vista detalle de un día (ejercicios + parámetros) | ⏳ Pendiente |
| Diseño mobile-first | ⏳ Pendiente |

---

## 7. Galería de ejercicios

### Gestión ✅
- Catálogo almacenado en Supabase (no estático — se pueden añadir ejercicios)
- Actualmente: **41 ejercicios** de la zona tobillo/pie (turmell/peu)
- Importados desde Excel via script Python → SQL

### Campos por ejercicio

| Campo | Tipo | Estado |
|---|---|---|
| `name` | Texto (catalán) | ✅ |
| `technical_name` | Nombre técnico inglés | ✅ |
| `exercise_code` | Código único (ej. `ANK_MOB_001`) | ✅ |
| `subpattern` | Subpatrón de movimiento | ✅ |
| `level` | 1 / 2 / 3 | ✅ |
| `technical_level` | basico / intermedio / avanzado | ✅ |
| `progression` | Ejercicio de progresión | ✅ |
| `regression` | Ejercicio de regresión | ✅ |
| `secondary_muscles` | Músculos secundarios | ✅ |
| `contraindications` | Contraindicaciones | ✅ |
| `technical_notes` | Notas técnicas | ✅ |
| `common_errors` | Errores comunes | ✅ |
| `body_zone_id` | FK → `body_zones` | ✅ |
| `movement_pattern_id` | FK → `movement_patterns` | ✅ |
| `equipment_id` | FK → `equipment` | ✅ |
| `objective_id` | FK → `objectives` | ✅ |
| Imagen | Supabase Storage | ⏳ Pendiente |
| Vídeo | YouTube/Vimeo link | ❌ Fuera MVP |

### Filtros de la galería ✅

- Parte del cuerpo
- Nivel (Groc / Blau / Vermell)
- Patrón de movimiento
- Músculo
- Equipamiento
- Objetivo
- Nivel técnico (Básico / Intermedio / Avanzado)
- Búsqueda por nombre

### Partes del cuerpo planificadas

El catálogo se irá ampliando por zonas. Cada zona tiene su propio Excel de ejercicios:

| Zona | Estado |
|---|---|
| Tobillo / Pie (turmell/peu) | ✅ Importado (41 ejercicios) |
| Rodilla | ⏳ Pendiente recibir Excel |
| Cadera | ⏳ Pendiente recibir Excel |
| Columna / Core | ⏳ Pendiente recibir Excel |
| Hombro | ⏳ Pendiente recibir Excel |

---

## 8. Planes grupales predefinidos

- 3 plantillas (una por nivel: Groc / Blau / Vermell)
- Almacenadas en Supabase, editables por el empleado desde la app
- Misma estructura que un plan individual: días + ejercicios + parámetros
- **Estado:** ⏳ Pendiente recibir las 3 plantillas del cliente

---

## 9. Out of scope — MVP

| | |
|---|---|
| ❌ | Notificaciones (email, push) |
| ❌ | Rol admin diferenciado |
| ❌ | Registro de entrenamiento por parte del cliente (pesos, RPE, sensaciones) |
| ❌ | Vídeos en la galería de ejercicios |
| ❌ | Multi-idioma (català / inglés) |
| ❌ | App nativa (iOS / Android) |
| ❌ | Integración con wearables o apps de fitness |
| ❌ | Métricas del centro (bajas, altas, leads) |

---

## 10. Roadmap Fase 2

Funcionalidades identificadas para después del MVP:

| Funcionalidad | Descripción |
|---|---|
| Duplicar plan | Al crear un plan nuevo para un cliente, poder duplicar el plan anterior como base |
| Sugerencias de rutina | El sistema sugiere ejercicios del plan anterior |
| Registro de sesión | El empleado apunta pesos y observaciones desde tablet durante la sesión |
| Visualización en TV | Ver sesiones activas en pantalla grande |
| Métricas del centro | Dashboard con bajas, altas, leads, contactos fallidos |
| Galería visual por zona | Clicar en una parte del cuerpo → ver ejercicios agrupados visualmente |
| Contraseña personalizable | El cliente puede cambiar su contraseña desde la app |

---

## 11. Estado de implementación

### ✅ Implementado

- Autenticación (login dark UI, sesión persistente, roles empleado/cliente)
- Dashboard empleado (dark theme, sidebar con perfil)
- Perfil de empleado (nombre, avatar, Supabase Storage)
- Alta de clientes (formulario completo + Supabase invite)
- Lista de clientes (tabla con badges de nivel)
- Galería de ejercicios (41 ejercicios, filtros completos, dark theme)
- Importación de ejercicios desde Excel (script Python → SQL)
- Plan individual — wizard completo (selección cliente, nivel, parámetros, calendario, modal ejercicios)
- Modal de selección de ejercicios (pantalla completa, mismos filtros que galería)
- Base de datos: `body_zones`, `profiles`, `exercises` con metadata extendida

### ⏳ Pendiente (MVP)

- Vista del cliente (calendario con plan activo, mobile-first)
- Planes grupales (bloqueado: pendiente plantillas del cliente)
- Gestión de planes (ver activo/historial desde perfil cliente)
- Imágenes de ejercicios en Supabase Storage
- DNS: `app.gironaactiva.com` → Vercel
- Deploy producción: merge `dev` → `main`

### 🔜 Próximos pasos inmediatos

1. Recibir plantillas de planes grupales del cliente
2. Recibir Excels de ejercicios de otras zonas corporales
3. Implementar vista cliente (calendario)
4. Configurar DNS
