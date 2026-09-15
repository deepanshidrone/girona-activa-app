# Arquitectura — Sistema de pantallas en sala

Diseño de hardware y software preliminar para el sistema de pantallas físicas del centro, que muestran el entrenamiento activo de cada cliente (individual o grupal). Contexto de negocio y modelo de datos existente en [context-pantallas.md](./context-pantallas.md).

## Decisiones de partida (acordadas)

- **Check-in**: manual por el empleado. El empleado selecciona el cliente (o la clase grupal), confirma/ajusta la sesión (por defecto la de hoy, editable por si hay cambios de última hora) y elige en qué pantalla mostrarla.
- **Pantallas**: 4 pantallas de 32", para todo el centro. Mismo tipo de pantalla y mismo hardware se usa tanto para mostrar sesiones individuales como grupales — no hay una pantalla "especial" para grupal.
- **Sin monitores instalados todavía** → se compra hardware y pantalla desde cero.

## 1. Arquitectura de hardware

### Por unidad de pantalla (x4)

| Componente | Elección | Motivo |
|---|---|---|
| Panel | Monitor/TV 32" **LED/LCD, no Smart, no OLED** | No Smart: esa capa la aporta el Android TV box, pagar por un Smart TV sería coste redundante. No OLED: el contenido (tabla de ejercicios) es mayormente estático durante toda la sesión → riesgo de quemado de imagen en OLED. |
| "Cerebro" | Android TV box (Android 9+, ≥2GB RAM, Google Play) | Barato (~40-70€), reproduce cualquier web en modo kiosko, sin las limitaciones de Fire TV (sin Play Store) ni de navegadores embebidos de Smart TV. |
| Software kiosko | **Fully Kiosk Browser** + licencia PLUS (pago único, **7,90€/dispositivo** → ~32€ los 4) | Carga la URL de la pantalla a pantalla completa, se recupera sola de cuelgues, arranca sola tras un corte de luz, y desbloquea **administración remota** (recargar, reiniciar, ver estado) sin moverte de la pantalla física. |

> **Nota sobre "administración remota":** no es un dispositivo ni una pantalla física adicional — es una página web. Con la licencia PLUS (única, 7,90€/dispositivo) ya se incluye la **admin remota local**: desde un ordenador conectado a la misma red del centro, entras a `http://<ip-del-dispositivo>:2323` de cada box y lo gestionas. Suficiente para 4 pantallas en un solo local. Existe además **Fully Cloud** (suscripción aparte, ~1,18€/mes por dispositivo) para gestionar desde fuera de la red del centro — opcional, no necesario en este caso.

### Configuración por dispositivo (x4)

1. Conectar el Android TV box al TV (HDMI) y a la red (WiFi o Ethernet).
2. Instalar Fully Kiosk Browser (Google Play si está disponible, o APK desde fully-kiosk.com).
3. Conceder los permisos que pide la app (superposición sobre otras apps / accesibilidad) — necesarios para el bloqueo de modo kiosco.
4. Ajustes → Start URL: `.../pantalla/<screenId>?token=...` (una URL distinta por pantalla).
5. Activar: inicio automático al arrancar, pantalla siempre encendida, bloqueo de modo kiosco.
6. Comprar y activar la licencia PLUS; configurar contraseña de Remote Admin.
7. Repetir en las 4 unidades, verificar acceso a `http://<ip>:2323` desde el ordenador del centro.
| Conexión | Ethernet si hay toma cerca; si no, WiFi | Ethernet da más estabilidad a la suscripción en tiempo real; con 4 pantallas fijas, si el centro tiene opción de cablear es preferible. |
| Encendido | Enchufe siempre activo + Fully Kiosk configurado para lanzar la app automáticamente al arrancar | El personal no debe tener que "iniciar" nada cada mañana. |

### Coste aproximado total (4 pantallas)

- 4× monitor/TV 32" básico: ~120-180€/u → 480-720€
- 4× Android TV box: ~50€/u → 200€
- 4× licencia Fully Kiosk Pro: ~10€/u → 40€
- **Total estimado: ~750-950€** para las 4 pantallas completas.

### Por qué no otras opciones (resumen de la conversación previa)
Raspberry Pi exige que construyas tú mismo el modo kiosko y la gestión remota (más trabajo, mismo resultado). Fire TV Stick complica meter Fully Kiosk al no tener Play Store. Smart TV con su navegador integrado no tiene gestión remota real y muchas no reabren el navegador solas tras un corte de luz. Con solo 4 unidades el ahorro de las alternativas "baratas" no compensa el tiempo que os ahorra tener gestión remota de fábrica.

## 2. Modelo de datos (nuevas tablas)

```
screens
- id (uuid, pk)
- name              -- "Pantalla 1", "Zona funcional", etc.
- location          -- opcional, texto libre
- access_token      -- secreto no adivinable, va en la URL que carga el Android TV box
- created_at

screen_assignments
- id (uuid, pk)
- screen_id         -- FK a screens
- session_type      -- 'individual' | 'group'
- client_id         -- FK a clients (solo cuando session_type = 'individual')
- plan_session_id   -- FK a plan_sessions (solo individual)
- group_session_id  -- FK a group_sessions (solo group; es la sesión "base" del día — ver §4)
- assigned_by       -- empleado que hizo el check-in
- started_at
- ended_at          -- null mientras está activa
```

Solo puede haber **una `screen_assignment` activa (`ended_at is null`) por `screen_id`**: al crear una nueva para esa pantalla, se cierra automáticamente la anterior (`ended_at = now()`).

## 3. Flujo de check-in (UI del empleado)

Nueva pantalla en la app existente, `/pantallas` (o botón "Enviar a pantalla" desde la ficha del cliente). Dos modos, porque el dato de origen es distinto:

**Individual**
1. Empleado busca/selecciona cliente (autocomplete, como ya existe en la app).
2. El sistema resuelve automáticamente la `plan_session` de hoy para el plan individual activo de ese cliente.
3. Empleado confirma o cambia la sesión propuesta (dropdown editable, por si hay un cambio de última hora).
4. Empleado elige la pantalla destino, viendo el estado actual de las 4 (libre / "en uso por Marc, hace 8 min").
5. Al confirmar → se crea el `screen_assignment` → la pantalla se actualiza sola (ver §5).

**Grupal**
1. Empleado selecciona la clase grupal (el sistema ya sabe qué sesión toca hoy vía rotación A/B/C del ciclo activo — no hace falta que el empleado calcule nada).
2. Empleado elige la pantalla destino.
3. Al confirmar → se crea el `screen_assignment` de tipo `group`, sin `client_id` (una clase grupal la ven varias personas a la vez en la misma pantalla).

Falta un botón "Finalizar" (o auto-fin pasado `session_duration` minutos) para liberar la pantalla cuando el cliente/grupo termina.

## 4. Cómo se muestra una sesión grupal en pantalla

Un `group_session` tiene 3 variantes (`regression` / `base` / `progression`) porque cada cliente de la clase puede tener un nivel distinto. Como la pantalla es compartida por todo el grupo, no tiene sentido mostrar solo una variante: **la pantalla grupal muestra los ejercicios en una tabla con 3 columnas** (una por dificultad), así cada participante busca su propia fila/nivel. Es la única diferencia real de layout entre pantalla individual y grupal — el resto (dispositivo, ruta, mecanismo de actualización) es idéntico.

## 5. Tiempo real: cómo se entera la pantalla

- La pantalla es una ruta Next.js: `/pantalla/[screenId]?token=...` — el `token` es el `access_token` de la tabla `screens`, para que la URL no sea adivinable (no hay login posible en un Android TV box).
- Al cargar, la página se suscribe con **Supabase Realtime** (`postgres_changes` sobre `screen_assignments`, filtrado por `screen_id`) — ya forma parte del mismo proyecto Supabase, sin infраestructura nueva.
- Cuando el empleado hace check-in, el `INSERT`/`UPDATE` llega a la pantalla por WebSocket en tiempo real y el componente re-renderiza con la nueva sesión, sin recargar la página ni hacer polling.
- Estado "idle" (pantalla sin asignación activa): logo del centro / mensaje neutro, para que no quede una pantalla en blanco entre sesiones.

## 6. Seguridad

- Lectura de `screen_assignments`/pantalla vía Realtime desde el propio Android TV box usa la `anon key` de Supabase — se necesita una política RLS de **solo lectura**, acotada a las columnas necesarias para pintar la pantalla (nombre del ejercicio, series, reps, peso, notas, nombre del cliente/clase). Nada de emails, teléfonos ni otros datos del cliente.
- Ninguna escritura debe ser posible desde el token de pantalla — el check-in siempre pasa por Server Actions autenticadas del lado del empleado, usando `createAdminClient()` como ya se hace en el resto de la app.
- El `access_token` de cada pantalla no debe ser correlativo/adivinable (usar `crypto.randomUUID()` o similar).

## 7. Fases

**MVP (esto)**: check-in manual (individual y grupal), 4 pantallas Android TV box + Fully Kiosk, actualización en tiempo real vía Supabase Realtime, pantalla idle con logo.

**Después del MVP** (no bloquea el MVP, pero el modelo de datos ya lo admite):
- Check-in automático (QR/NFC) en vez de manual.
- Auto-fin de sesión pasado `session_duration` sin acción del empleado.
- Panel de salud de dispositivos más allá de Fully Kiosk (ej. alertas si una pantalla lleva X tiempo sin heartbeat).
