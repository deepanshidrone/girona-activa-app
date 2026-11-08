# Especificación — CRM fase 1: leads de la web

- **Estado:** aprobada por el propietario el 2026-11-08. En desarrollo: hechos la migración, el permiso, `/api/leads` y las pantallas (§15); falta la web.
- **Fecha:** 2026-11-08
- **Rama:** `dev` (brotafit) · `dev` (girona-activa-web)
- **Relacionado:** `docs/FRD.md` (§4.15, §5 y roadmap §6, punto 2), `docs/spec-kpis.md` (K1, Q7 y §4.7), `input-negocio-GA/Especificaciones de la app – Girona Activa.pdf` (apartado "CRM y KPIs"), repo `girona-activa-web` (`index.html`, `netlify/functions/submission-created.js`)

---

## 1. Objetivo

**Requisito de negocio:** "los contactos que llegan a través de la web se pueden visualizar en la app".

Cada contacto que una persona deja en el formulario de la web del centro aparece en BrotaFit en segundos, con todo lo que escribió y la prueba de su consentimiento. El admin lo ve, sabe cuáles son nuevos, llama o escribe con un toque desde el móvil, apunta una nota y limpia el spam. Así deja de depender de Notion y la información de captación queda junto a los clientes, que es donde terminará la conversión (fase 2) y los indicadores de leads.

El PDF de Girona Activa define el lead como "contacto interesado que aún no es cliente" y pone el CRM en manos del gestor o coordinador.

---

## 2. Estado actual (revisado en código el 2026-11-08)

| Pieza | Estado | Impacto |
|---|---|---|
| Formulario `contacte` (`girona-activa-web/index.html`) | 9 campos obligatorios: nombre, edad, teléfono, email, cómo nos ha conocido (6 opciones), objetivo, situación actual, disponibilidad e inversión mensual (4 tramos). Más una casilla RGPD obligatoria. Se envía con `fetch` a Netlify Forms | Son los datos del lead de Girona Activa |
| `submission-created.js` | Función de Netlify que se dispara con cada envío (que Akismet no marque como spam) y crea una página en Notion con la API. Claves `NOTION_TOKEN` y `NOTION_DATABASE_ID` en las variables de Netlify. Si Notion falla, devuelve 500 y no reintenta | Es el punto donde se engancha BrotaFit |
| Consentimiento RGPD | La casilla es obligatoria en el navegador, pero **no se guarda**: ni en Notion ni la fecha ni el texto aceptado | Hoy no hay prueba del consentimiento fuera de Netlify Forms |
| Bug en la web | La traducción de "cómo nos ha conocido" usa claves antiguas (`recomanacio`, `passant`, `altre`). 4 de las 6 opciones actuales (`recomanacio-amic`, `recomanacio-metge`, `passava-davant`, `altres`) llegan a Notion como texto en bruto | Se corrige al reescribir la función (§9) |
| Antispam | Solo Akismet de Netlify Forms. No hay campo trampa (*honeypot*) | Se añade (§6.4) |
| `netlify.toml` | Node 18, sin soporte desde 2025 | Se sube a Node 22 (§9) |
| BrotaFit | No existe `app/api`. Las entradas públicas son dos Server Actions (TrainWall y recuperar contraseña). `proxy.ts` no intercepta `/api`, pero llama a `getUser()` en todas las rutas | Hace falta un Route Handler nuevo, que `proxy.ts` debe saltar |
| `clients` | Tiene `email`, no tiene teléfono | "Ya es cliente" solo se detecta por email (§7.3) |

**Datos sensibles:** "objetivo" y "situación actual" suelen llevar datos de salud ("recuperar una lesión"). La edad también es un dato personal. Esto marca la privacidad (§10).

---

## 3. Decisiones de producto tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | Los leads llegan **de la función de Netlify a BrotaFit** (servidor a servidor). El navegador sigue enviando a Netlify Forms | Se conservan el antispam y la copia de Netlify Forms, la web sigue siendo estática y el secreto no llega al navegador |
| D2 | **Doble envío (Notion y BrotaFit) hasta que el propietario decida retirar Notion**, sin importar los leads antiguos. Desde el despliegue, la web de producción envía cada lead a los dos sitios, de forma independiente. Lo que ya está en Notion se queda allí. Retirar Notion es una decisión aparte, que se toma al salir a producción o más tarde (revisado 2026-11-08; antes, corte directo) | El centro sigue trabajando en Notion mientras la app no esté en producción, y los leads ya se acumulan en BrotaFit desde el primer día |
| D3 | Permiso nuevo **`leads.gestionar`**: el admin siempre lo tiene y el employee está en `false` por defecto. Configurable en Configuración más adelante | El PDF pone el CRM en manos del gestor |
| D4 | Modelo de datos con **columnas comunes** a cualquier centro (contacto, canal, mensaje, origen, fechas y consentimiento) y el resto del formulario como **respuestas libres** (lista pregunta/respuesta en JSON) | Cada centro tendrá su formulario; ningún campo de Girona Activa en el esquema |
| D5 | **Contador de no vistos** en el menú y etiqueta "Nuevo" en la lista. Un lead queda visto al abrir su detalle. Sin correos | Mismo patrón que el feedback del cliente |
| D6 | **Sin borrado automático.** Solo se borra a mano. Queda pendiente revisar con Girona Activa los temas legales de los datos (§10.3) | Decisión del propietario |
| D7 | La función firma cada envío con **HMAC-SHA256 sobre la hora y el cuerpo**. BrotaFit rechaza firmas no válidas y envíos de más de 5 minutos | Una petición capturada no se puede repetir ni alterar |
| D8 | Sección **"CRM"** en el menú, con la página **Leads** dentro: `/dashboard/crm/leads`. Mientras sea la única, `/dashboard/crm` redirige a ella | Deja sitio para el resto del CRM |
| D9 | **Duplicados:** cada envío es un lead nuevo. Se señala "Ha escrito N veces" (mismo email o teléfono) y "Ya es cliente" (mismo email que una ficha), sin fusionar | No se pierde nada y no hay fusiones equivocadas |
| D10 | Acciones de la fase 1: **enlaces de llamar, WhatsApp y email**, **nota interna**, **marcar como spam** (y desmarcar) y **borrar** | Lo mínimo para atender un lead sin construir aún el seguimiento |
| D11 | Si BrotaFit no responde: **3 intentos** desde la función y, si siguen fallando, error en el log de Netlify con el id del envío. Un **script de reenvío** toma los envíos de Netlify Forms y los manda otra vez; BrotaFit ignora los que ya tiene | Red de seguridad sin correos con datos personales |
| D12 | Hasta el go-live, la web de producción envía al **preview de `dev`** de BrotaFit (`girona-activa-app-git-dev-brota-ai.vercel.app`). Preview y producción usan el mismo proyecto de Supabase, así que los leads quedan en la BD definitiva. En el go-live solo cambia `BROTAFIT_LEADS_URL` en Netlify | BrotaFit todavía no tiene producción. Si un despliegue de `dev` falla, Notion tiene el lead y el reenvío (D11) lo recupera |
| D13 | La limpieza de antes del go-live (`spec-kpis.md` §11.4) **conserva la tabla `leads`** | Serán leads reales desde el primer despliegue |
| D14 | Al borrar un empleado se conserva lo que hizo con los leads (`on delete set null` en `seen_by`, `spam_marked_by` y `notes_updated_by`) | No se pierde el historial del lead |

---

## 4. Qué es un lead

Un **lead** es un contacto que alguien deja al centro por un canal de captación (en la fase 1, solo el formulario web) y que todavía no es cliente. Cada envío del formulario es un lead (D9).

### 4.1 Datos que se guardan

| Dato | Obligatorio | De dónde sale (Girona Activa) |
|---|---|---|
| Nombre | ✅ | `nom` |
| Email | Email o teléfono, al menos uno | `email` |
| Teléfono | Email o teléfono, al menos uno | `telefon` |
| Canal ("cómo nos ha conocido") | ❌ | `com_conegut`, con clave y texto ("Instagram") |
| Mensaje | ❌ | El formulario de GA no tiene un campo libre único; se queda vacío |
| Respuestas del formulario | ❌ | `edat`, `objectiu`, `obstacle`, `disponibilitat` e `inversio`, cada una con su pregunta tal como la ve el usuario en la web (en catalán) |
| Origen | ✅ | `web` (más adelante: teléfono, presencial…) y nombre del formulario (`contacte`) |
| Identificador del envío | ✅ en `web` | `id` del envío de Netlify Forms. Sirve para no duplicar (D11) |
| Fecha de recepción | ✅ | Fecha del envío en Netlify (`created_at`), no la hora de llegada a la app. Es la fecha de negocio (K11 de los KPIs) |
| Página de origen | ❌ | La URL desde la que se envió (`referrer`) |
| Consentimiento | ✅ | Fecha, texto exacto de la casilla aceptada y URL de la política de privacidad. **Sin consentimiento no se guarda el lead** |

**No se guardan** la IP ni el navegador del usuario: no hacen falta para atender el lead y son datos personales.

### 4.2 Datos de gestión

- Visto: cuándo y quién (D5).
- Spam: si está marcado, cuándo y quién (D10).
- Nota interna: texto libre, con quién y cuándo la cambió por última vez (D10).

---

## 5. Cómo llegan los leads

```
Navegador ──POST──▶ Netlify Forms ──(Akismet + honeypot)──▶ submission-created.js
                       │  guarda el envío                      │  arma el JSON (§5.2), firma (§6.1)
                       │  (copia de respaldo)                  ▼
                       │                                  POST https://<app>/api/leads
                       │                                       │  verifica, valida y guarda (§6)
                       └──── scripts/reenviar-leads ───────────┘  (D11, a mano si algo falló)
```

### 5.1 Función de Netlify (web)
- Se dispara con cada envío válido, como hoy.
- Convierte los campos del formulario al contrato (§5.2). Los textos de las preguntas, los de las opciones y el de la casilla RGPD son los de la web. **Viven en el repo de la web, no en BrotaFit.**
- Firma y envía a `BROTAFIT_LEADS_URL`. Hace 3 intentos con espera creciente (0 s, 1 s, 3 s y un tiempo máximo de 2 s por intento) para no pasar del límite de 10 s de la función. Solo reintenta ante errores de red, `429` o `5xx`; con `400` o `401` no.
- Si todo falla, escribe en el log `LEAD NO ENTREGADO <id del envío>` (sin datos personales) y termina. El envío sigue en Netlify Forms.
- Mientras dure el doble envío (D2), crea también la página en Notion como hoy. Los dos envíos son independientes (`Promise.allSettled`): el fallo de uno no impide el otro, y cada resultado se registra en el log por separado. La función solo devuelve error si fallan los dos.

### 5.2 Contrato del envío (versión 1)

`POST /api/leads`, `Content-Type: application/json`, con las cabeceras de firma de §6.1.

```json
{
  "version": 1,
  "source": "web",
  "form": "contacte",
  "external_id": "6740f2…",
  "submitted_at": "2026-11-08T10:15:00Z",
  "page_url": "https://gironaactiva.com/",
  "contact": { "full_name": "Anna Puig", "email": "anna@example.com", "phone": "639 58 27 57" },
  "channel": { "key": "instagram", "label": "Instagram" },
  "message": null,
  "answers": [
    { "key": "edat", "label": "Edat", "value": "35" },
    { "key": "objectiu", "label": "Objectiu", "value": "Recuperar-me d'una lesió de genoll" },
    { "key": "inversio", "label": "Inversió mensual", "value": "50 – 100€" }
  ],
  "consent": {
    "accepted": true,
    "text": "He llegit i accepto la Política de Privacitat i el tractament de les meves dades personals per contactar amb Girona Activa.",
    "policy_url": "https://gironaactiva.com/politica-privacitat.html"
  }
}
```

- El contrato es **genérico**: cualquier web de cualquier centro puede enviar leads con él. Se documenta en este apartado y no cambia sin subir `version`.
- `answers` va en el orden del formulario y la app lo muestra en ese orden.

### 5.3 Respuestas de BrotaFit

| Código | Cuándo | ¿Reintentar? |
|---|---|---|
| `201` | Lead creado | — |
| `200` | Ya existía un lead con ese `source` + `external_id` (no se duplica ni se modifica) | — |
| `400` | JSON o datos no válidos, o sin consentimiento | No |
| `401` | Firma ausente, incorrecta o caducada. Respuesta siempre igual, sin detalle | No |
| `413` | Cuerpo de más de 32 KB | No |
| `429` | Límite de §6.3 superado | Sí, más tarde |
| `5xx` | Error de BrotaFit o de la BD | Sí |

El cuerpo de la respuesta nunca devuelve datos del lead.

### 5.4 Reenvío manual (D11)
- Script `scripts/reenviar-leads.mjs` en el repo de la web. Se ejecuta en local con un token de la API de Netlify (solo lectura de formularios) y el secreto (§6.1), los dos en variables de entorno del momento, nunca en archivos.
- Lee los envíos del formulario `contacte` de los últimos N días (7 por defecto) y los manda a BrotaFit con el mismo formato que la función. Los ya recibidos responden `200` y no se tocan.
- Muestra un resumen: creados, ya existentes y errores.

### 5.5 Leads existentes en Notion
No se importan (D2). Durante el doble envío, Notion sigue recibiendo los nuevos. Cuando el propietario decida retirarlo, se quita esa parte de la función, Notion queda como archivo de solo lectura y se retiran `NOTION_TOKEN` y `NOTION_DATABASE_ID` de Netlify.

---

## 6. Seguridad de la entrada

`/api/leads` es la **tercera entrada pública** de la app, junto con el token de TrainWall y "Olvidé mi contraseña". Va comentada como excepción en el código y en `CLAUDE.md`.

### 6.1 Autenticación de la web (D7)
- Secreto compartido de al menos 32 bytes aleatorios, uno por instancia:
  - en Vercel, `LEADS_WEBHOOK_SECRET`, y para cambiarlo sin cortar el servicio, `LEADS_WEBHOOK_SECRET_PREVIOUS` (opcional; se acepta cualquiera de los dos mientras dure el cambio);
  - en Netlify, `BROTAFIT_LEADS_SECRET` y `BROTAFIT_LEADS_URL`.
- Cabeceras:
  - `X-Brotafit-Timestamp`: segundos Unix;
  - `X-Brotafit-Signature`: `sha256=` + HMAC-SHA256 en hexadecimal de `<timestamp>.<cuerpo exacto>`.
- BrotaFit:
  - lee el cuerpo en bruto antes de interpretarlo;
  - recalcula la firma y compara con `timingSafeEqual`;
  - rechaza si la hora se desvía más de 5 minutos.
- Una repetición dentro de esos 5 minutos no crea nada nuevo, por el `external_id` único.
- Sin el secreto configurado, la ruta responde `503` y no acepta nada (nunca "abierta por defecto").

### 6.2 Validación de datos
Se hace en el servidor, con un esquema estricto (se rechazan campos desconocidos en la raíz):

| Campo | Regla |
|---|---|
| `version` | `1` |
| `source` | `web` en la fase 1 |
| `form`, `external_id` | Texto de 1 a 100 caracteres |
| `submitted_at` | Fecha ISO válida, no más de 5 minutos en el futuro. Si es de más de 90 días atrás, se acepta (reenvíos) |
| `full_name` | 1 a 120 caracteres |
| `email` | Formato válido, como mucho 254 caracteres; se guarda en minúsculas y sin espacios |
| `phone` | Como mucho 30 caracteres; solo dígitos, espacios, `+`, `-`, `(` y `)`. Se guarda tal cual y además normalizado (§7.1) |
| Contacto | Email o teléfono, al menos uno |
| `channel` | Opcional; `key` como mucho de 50 caracteres y `label` de 100 |
| `message` | Opcional; como mucho 5.000 caracteres |
| `answers` | Como mucho 30; `key` de 50, `label` de 200 y `value` de 2.000 caracteres; solo texto |
| `consent` | `accepted = true` obligatorio; `text` de 1 a 1.000 caracteres; `policy_url` es una URL `https` opcional |
| `page_url` | URL `http(s)` opcional, como mucho 500 caracteres |

- Se quitan los caracteres de control y se recortan los espacios de los extremos.
- Todo se guarda y se muestra como **texto**, nunca como HTML (React lo escapa).
- Los enlaces de llamar, WhatsApp y email se construyen solo con el teléfono normalizado y el email ya validados.

### 6.3 Spam y abusos
- **En la web:** Akismet de Netlify (como hoy) y un campo trampa (`netlify-honeypot="bot-field"`). Netlify descarta el envío si se rellena y la función ni se dispara.
- **En BrotaFit:**
  - límite global de **60 leads nuevos por hora** por instancia: a partir de ahí responde `429` y escribe en el log; los reenvíos de leads existentes no cuentan;
  - cuerpo de como mucho 32 KB;
  - firmas incorrectas: `401` sin detalle y una línea de log sin el cuerpo.
- El límite protege ante una fuga del secreto o un bucle. Sin el secreto nadie puede escribir.
- Lo que se cuele se marca como spam o se borra a mano (D10).

### 6.4 Implementación prevista
- Route Handler `app/api/leads/route.ts`, solo `POST`, en el runtime de Node.js. **Antes de programarlo, leer la guía de Route Handlers en `node_modules/next/dist/docs/`** (Next 16, `AGENTS.md`).
- Escribe con `createAdminClient()` tras verificar la firma. Es la única excepción a "toda escritura pasa por `requireStaff()`", y va comentada.
- `proxy.ts` salta `/api/leads` (como las rutas de auth) para no llamar a `getUser()` sin motivo.
- **Vercel:** los *preview deployments* pueden tener la protección de despliegue activada, que bloquearía a Netlify. Como hasta el go-live la web de producción envía al preview de `dev` (D12), es **imprescindible**: o se usa el *Protection Bypass for Automation* de Vercel (cabecera secreta `x-vercel-protection-bypass`, en la variable de Netlify `BROTAFIT_VERCEL_BYPASS`), o se comprueba que la protección está desactivada. Se comprueba antes de probar.

---

## 7. Modelo de datos

Va en una migración nueva (`supabase/migrations/`), que se prueba antes en una transacción que se deshace y se aplica solo con la aprobación del propietario.

### 7.1 Tabla nueva `leads`
```
leads
  id                  uuid pk default gen_random_uuid()
  source              text not null            'web' (fase 1); más adelante 'telefono', 'presencial'…
  form_name           text null                'contacte'
  external_id         text null                id del envío en Netlify
  received_at         timestamptz not null     fecha del envío (fecha de negocio)
  full_name           text not null
  email               text null                en minúsculas
  phone               text null                tal como lo escribió
  phone_normalized    text null                formato internacional sin "+" (E.164): 34639582757
  channel_key         text null                'instagram'
  channel_label       text null                'Instagram'
  message             text null
  answers             jsonb not null default '[]'   [{key, label, value}], en orden
  page_url            text null
  consent_at          timestamptz not null
  consent_text        text not null
  privacy_policy_url  text null
  seen_at             timestamptz null
  seen_by             uuid null → profiles (on delete set null)
  is_spam             boolean not null default false
  spam_marked_at      timestamptz null
  spam_marked_by      uuid null → profiles (on delete set null)
  internal_notes      text null
  notes_updated_at    timestamptz null
  notes_updated_by    uuid null → profiles (on delete set null)
  created_at, updated_at  timestamptz not null default now()

  CHECK (email is not null or phone is not null)
  UNIQUE (source, external_id)
  INDEX (received_at desc) · INDEX (email) · INDEX (phone_normalized)
  INDEX parcial de no vistos: (received_at) where seen_at is null and not is_spam
```
- `answers` es un **array** (no un objeto) para conservar el orden de las preguntas.
- `phone_normalized` lleva siempre el prefijo internacional: si el número llega con `+` o `00` se respeta; si no, se le pone el del centro (`center_settings.default_country_code`, `34` por defecto, nunca fijo en el código). Así sirve igual para los duplicados y para el enlace de WhatsApp (decidido al implementar; la spec decía "sin prefijo", que era ambiguo con números extranjeros).

### 7.2 Permisos y RLS
- RLS activada **sin políticas para `authenticated`**, y `revoke all ... from public, anon, authenticated`; `grant all ... to service_role`. Mismo patrón que `password_reset_requests`.
- Motivo: el permiso `leads.gestionar` es configurable y un employee sin él no debe poder leer los leads por la API con su sesión. Todas las lecturas y escrituras pasan por el servidor, después de `requirePermission('leads.gestionar')`.
- Ni los clientes ni las pantallas tienen acceso.

### 7.3 Duplicados (D9)
Para cada lead se calcula, al leer:
- **"Ha escrito N veces":** otros leads no marcados como spam con el mismo `email` o el mismo `phone_normalized`. El detalle los lista con su fecha y enlace.
- **"Ya es cliente":** existe una ficha en `clients` con el mismo email (sin distinguir mayúsculas). Enlace a la ficha. Por teléfono no se puede porque `clients` no lo tiene.

### 7.4 Lo que no cambia
- No se toca `clients`. La conversión a cliente es de la fase 2 (§11).
- Nada de la tabla tiene un valor propio de Girona Activa: las preguntas y los canales llegan como datos.

---

## 8. Pantallas

### 8.1 Navegación
- Entrada **"CRM"** en el menú lateral, visible solo con `leads.gestionar` (hoy solo el admin). Lleva el **contador de leads no vistos** (sin spam). Sin leads nuevos, no se muestra contador.
- `/dashboard/crm` redirige a `/dashboard/crm/leads`.
- Sin el permiso, las páginas responden 404 (como los indicadores) y las acciones devuelven "No autorizado".

### 8.2 Listado `/dashboard/crm/leads`
- Cabecera: total del periodo, nuevos sin ver y botón "Marcar todos como vistos".
- **Filtros** (en la URL, para poder guardar la vista):
  - periodo: últimos 30 días (por defecto), este mes, mes anterior, este año, todos;
  - estado: todos, sin ver, vistos;
  - canal: los canales presentes en los leads;
  - respuesta: elegir una pregunta del formulario y uno de los valores que han llegado (por ejemplo, "Inversió mensual = 50 – 100€");
  - búsqueda por nombre, email o teléfono;
  - interruptor "Mostrar spam" (oculto por defecto).
- Orden: más recientes primero. Paginación de 50 en 50.
- **Escritorio:** tabla con fecha y hora de recepción, nombre (con "Nuevo" si no está visto), contacto, canal, avisos ("Ha escrito 2 veces", "Ya es cliente", "Nota") y un resumen de la primera respuesta.
- **Móvil:** una tarjeta por lead (nombre, fecha relativa, canal y avisos) con los botones de llamar y WhatsApp directamente en la tarjeta.
- **Estado vacío:** "Todavía no ha llegado ningún contacto desde la web".

```
/dashboard/crm/leads
┌───────────────────────────────────────────────────────────────────┐
│ Leads                       12 en 30 días · 3 sin ver [Marcar vistos]│
│ [Últimos 30 días ▾] [Todos ▾] [Canal ▾] [Respuesta ▾] [🔍 Buscar ]  │
├───────────────────────────────────────────────────────────────────┤
│ 08/11 10:15  ● Anna Puig       639 58 27 57  Instagram  Ya es cliente│
│ 07/11 19:02  ● Marc Soler      marc@…        Google     2 veces      │
│ 05/11 09:40    Laia Roca       612 …         Recomanació  📝          │
└───────────────────────────────────────────────────────────────────┘
```

### 8.3 Detalle `/dashboard/crm/leads/[id]`
- Al abrirlo queda **visto** (quién y cuándo), si no lo estaba.
- **Cabecera:** nombre, fecha de recepción, canal y origen ("Formulario web · contacte").
- **Acciones de contacto:** Llamar (`tel:`), WhatsApp (`https://wa.me/<prefijo+número>`) y Email (`mailto:`). Solo aparecen las que tienen dato. En el móvil van fijas abajo.
- **Respuestas del formulario**, en su orden, con la pregunta tal como la vio la persona.
- **Avisos:** "Ya es cliente" con enlace a la ficha y "Ha escrito N veces" con la lista de sus otros envíos.
- **Nota interna:** texto editable con "Guardar", y debajo "Última edición: nombre, fecha".
- **Consentimiento:** fecha y texto aceptado, con enlace a la política. Plegado por defecto.
- **Más acciones:** "Marcar como spam" / "No es spam" y "Borrar lead", con confirmación ("No se puede deshacer").
- Volver al listado mantiene los filtros.

### 8.4 Tema
El oscuro del dashboard, con los mismos tokens que el resto. Los textos de la interfaz son genéricos ("el centro"), nunca un nombre.

---

## 9. Cambios en la web de Girona Activa (`girona-activa-web`, rama `dev`)

Se avisa al propietario antes de tocar este repo.

1. **`submission-created.js`:** se reescribe para enviar a BrotaFit (§5.1 y §5.2) y mantener el envío a Notion mientras dure el doble envío (D2). Se corrigen los textos de "cómo nos ha conocido" con las 6 opciones actuales y se añade el texto de la casilla RGPD y la URL de la política.
2. **`index.html`:** campo trampa `bot-field` con `netlify-honeypot`.
3. **`netlify.toml`:** de Node 18 a Node 22.
4. **`scripts/reenviar-leads.mjs`:** script de reenvío (§5.4).
5. **Variables de Netlify:**
   - añadir `BROTAFIT_LEADS_URL`, `BROTAFIT_LEADS_SECRET` y, si hace falta, `BROTAFIT_VERCEL_BYPASS`. Hasta el go-live, los dos contextos (`dev` y producción) apuntan al preview de `dev` de BrotaFit (D12). En el go-live, producción pasa a la URL de producción;
   - retirar `NOTION_TOKEN` y `NOTION_DATABASE_ID` cuando se decida quitar Notion (D2).
6. **`CLAUDE.md` de la web:** flujo nuevo y contrato (en catalán, como el resto del archivo).

---

## 10. Permisos y privacidad

### 10.1 Permiso nuevo en `lib/auth/permissions.ts`

| Permiso | employee (por defecto) | Uso |
|---|---|---|
| `leads.gestionar` | `false` | Menú CRM, listado, detalle, nota, spam y borrado de leads |

Como `indicadores.ver`: existe para que la página de Configuración pueda abrirlo al employee sin tocar las acciones. Si más adelante se quiere separar "ver" de "borrar", se añade `leads.borrar` sin cambiar el resto.

### 10.2 Datos de los leads
- Son datos personales de personas que **todavía no son clientes**. Las respuestas pueden llevar datos de salud.
- Solo los ve quien tiene el permiso; nunca los clientes, las pantallas ni el registro de la API.
- Los logs (Netlify y Vercel) nunca llevan datos del lead: solo el id del envío y el resultado.
- No hay exportación en la fase 1.
- El borrado es físico y definitivo (derecho de supresión). Borra también la nota.

### 10.3 Pendiente: revisión legal con Girona Activa (D6)
Antes de pasar la web a producción con el doble envío, o como muy tarde antes del go-live, el propietario revisa con Girona Activa:
- **plazo de conservación** de los leads que no se convierten (hoy no hay borrado automático y la política de la web no fija un plazo concreto);
- **datos de salud en las respuestas libres:** si el texto de la casilla y la política los cubren, o si hay que ajustar el formulario;
- **encargado del tratamiento:** BrotaAI (y sus proveedores Supabase, Vercel y Netlify) tratan los datos por cuenta de Girona Activa; contrato de encargo y mención en la política (hoy la política no cita a Netlify ni a Notion);
- texto de la casilla RGPD y versión de la política que se guarda con cada lead.

Si se decide un plazo, se añade un borrado automático configurable sin cambiar el modelo.

---

## 11. Después de la fase 1 (sin construir, sin cerrar la puerta)

| Pieza | Cómo encaja con lo de la fase 1 |
|---|---|
| **Estados del lead** (nuevo, contactado, contacto fallido, convertido, descartado) | Columna `status` nueva. Los leads existentes pasan a `nuevo`, o a `contactado` si tienen nota. "Visto" y "spam" siguen aparte: visto no es contactado y el spam no es un estado comercial |
| **Seguimiento de llamadas e intentos** | Tabla `lead_activities` (lead, tipo: llamada / WhatsApp / email / visita / nota, resultado: contestó / no contestó / buzón…, fecha y quién). "Contacto fallido" sale de los intentos sin respuesta. La nota interna de la fase 1 pasa a ser la primera actividad |
| **Conversión a cliente** | Botón "Crear cliente" en el detalle, que abre el alta de cliente con el nombre y el email ya rellenos. Columnas `converted_client_id` (→ `clients`, `on delete set null`), `converted_at` y `converted_by` en `leads`. El aviso "Ya es cliente" ofrece enlazar el lead a esa ficha |
| **Quién lo atendió** (Q7 de `spec-kpis.md`) | `assigned_to` (→ `profiles`) en `leads` y `by` en cada actividad. La atribución de altas sale del lead convertido |
| **Indicadores de leads** (§4.7 de `spec-kpis.md`) | Leads por mes y por canal, % de conversión, tiempo hasta el primer contacto y contactos fallidos, todo con `received_at` como fecha de negocio. Pestaña o tarjeta en `/dashboard/indicadores` con `indicadores.ver` |
| **Otros orígenes** | Alta manual de un lead (llamada, visita, Instagram) con `source` distinto de `web` y sin `external_id` |
| **Avisos por correo** | Si se piden, un correo sin datos de salud con el nombre y un enlace (D5 lo descarta hoy) |

---

## 12. Marca blanca

- BrotaFit no sabe nada del formulario de cada centro. Recibe el contrato genérico (§5.2) con las preguntas, los canales y el texto del consentimiento que ponga cada web.
- Una instancia por centro: cada una con su URL de `/api/leads` y su secreto. La función de Netlify (u otra integración: WordPress, Typeform…) es de la web de cada centro.
- Ningún texto, color ni dato de Girona Activa en el código de la app. El prefijo telefónico por defecto va en `center_settings`.
- Para otro centro basta con implementar el contrato en su web; la app no cambia.

---

## 13. Orden de trabajo sugerido

1. Aprobación de esta spec.
2. **BrotaFit:** migración (`leads` y `center_settings.default_country_code`), probada en una transacción que se deshace y aplicada con aprobación. Permiso `leads.gestionar`.
3. **BrotaFit:** `app/api/leads/route.ts` (firma, validación, límites e idempotencia) con tests de Vitest: firma correcta, incorrecta o caducada, sin consentimiento, duplicado por `external_id`, límites de tamaño, campos desconocidos y sin secreto configurado. Salto en `proxy.ts`.
4. **BrotaFit:** listado, detalle, acciones y contador del menú.
5. **Web (con aviso previo):** función con doble envío, honeypot, Node 22 y script de reenvío, en `dev` contra el preview de BrotaFit. Prueba de extremo a extremo con un envío real desde `dev--gironaactiva.netlify.app`: el lead aparece en la app y en Notion.
6. Ronda de QA en `qa/rondas/`: flujo completo, permisos (un employee y un cliente no ven el menú, reciben 404 y no leen `leads` por la API), duplicados, spam, borrado, móvil y reenvío.
7. **Web en producción** (merge `dev` → `main` de la web, con aprobación): desde ese momento, los leads reales llegan a Notion y a BrotaFit (D2 y D12).
8. FRD y `CLAUDE.md` de los dos repos.
9. **En el go-live de BrotaFit:** `BROTAFIT_LEADS_URL` de producción → producción de Vercel.
10. **Cuando el propietario decida:** retirar Notion de la función y sus variables.

---

## 14. Preguntas abiertas

Resueltas el 2026-11-08:
- **P1:** hasta que BrotaFit salga a producción, los leads siguen viéndose en Notion, pero también se registran en la app desde el despliegue (doble envío, D2 y D12).
- **P2:** se conservan en la limpieza del go-live (D13).
- **P3:** se conserva lo hecho por un empleado borrado (D14).
- **P4:** aceptado.

| # | Pendiente | Responsable |
|---|---|---|
| P4 | Comprobar el límite mensual de envíos de Netlify Forms en el plan Free y el volumen de Girona Activa antes de pasar la web a producción | Claude, al tocar la web |

---

## 15. Implementación

| Pieza | Estado | Dónde |
|---|---|---|
| Migración | ✅ aplicada el 2026-11-08, después de probarla en una transacción deshecha (restricciones, idempotencia y permisos: `anon` y `authenticated` sin acceso) | `supabase/migrations/20261108163821_crm_leads.sql` |
| Permiso | ✅ `leads.gestionar` (employee `false`) | `lib/auth/permissions.ts` |
| Entrada | ✅ `POST /api/leads`: firma, tamaño, validación, idempotencia y límite por hora | `app/api/leads/route.ts`, `lib/leads/signature.ts`, `lib/leads/validate.ts`; salto en `proxy.ts` |
| Tests | ✅ 45 tests (firma, normalización del teléfono, validación y la ruta con la BD simulada) | `tests/leads/leads.test.ts` |
| Prueba local de extremo a extremo | ✅ 2026-11-08 contra la BD real: 201, reenvío 200, secreto incorrecto y firma caducada 401, sin consentimiento 400, GET 405. Fila de prueba borrada | — |
| Pantallas y contador del menú | ✅ 2026-11-08. Probadas en local con un admin: listado, filtros (periodo, visto, canal, respuesta, búsqueda y spam), detalle, marcar visto al abrir y todos a la vez, nota, spam, borrado y contador. Vista móvil sin revisar a ojo | `app/dashboard/crm/`, `app/actions/leads.ts`, `lib/leads/{data,filters,duplicates,contact}.ts`, `components/app-sidebar.tsx`; 21 tests en `tests/leads/list.test.ts` |
| Web de Girona Activa | ⏳ | §9 |
| Secreto en Vercel y protección del preview | ⏳ | §6.1 y §6.4 |

**Diferencias con lo especificado:**
- `phone_normalized` en formato internacional (§7.1). El comentario de la columna en la BD todavía dice "sin el prefijo del país": se corregirá en la próxima migración del CRM.
- En los campos de una línea se juntan los espacios repetidos, además de quitar los caracteres de control.
- El lead se marca como visto desde el navegador al abrir el detalle, no al pintar la página en el servidor, para que una precarga del enlace no lo marque.
- Filtro "Respuesta": solo ofrece preguntas con entre 2 y 12 valores distintos que no sean números (la edad y los textos libres no salen). "Primera respuesta" del listado muestra la primera respuesta de texto.
- El color del centro llega a las pantallas nuevas como variable CSS `--brand` (desde `lib/brand.ts`, definida en el layout del dashboard), sin escribir el color en el código.
