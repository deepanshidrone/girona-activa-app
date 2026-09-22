# CLAUDE.md — Girona Activa App

Contexte complet del projecte per a Claude Code. Es carrega automàticament a l'inici de cada sessió.
**Última actualització:** 2026-09-17

---

## Visió general

**Producte:** Eina web de gestió de plans d'entrenament per al centre Girona Activa (Girona, Espanya).
Permet als entrenadors crear plans individuals i grupals, registrar sessions i fer seguiment de clients.

**URL dev (Vercel preview):** `https://girona-activa-app-git-dev-brota-ai.vercel.app`
**URL producció (Vercel):** `https://girona-activa-app.vercel.app`
**Subdomini propi:** `app.gironaactiva.com` → pendent de configurar DNS
**Idioma de la UI:** Castellà
**Estat:** MVP en desenvolupament actiu — branca `dev`, desplegat a Vercel

---

## Stack tècnic

| Capa | Tecnologia |
|---|---|
| Frontend + Backend | Next.js 16, App Router, TypeScript |
| Estils | Tailwind CSS v4 + shadcn/ui (new-york) |
| BD + Auth | Supabase (PostgreSQL + Supabase Auth) |
| Hosting | Vercel (org brota-ai, pla Hobby) |
| Repo | `deepanshidrone/girona-activa-app` (públic) |
| Font | Outfit (Google Fonts) |

---

## Identitat de marca / tema visual

El dashboard té fons fosc (`#111111` body, `#1C1C1C` cards). El color primari de l'app és el taronja.

```
--orange: #FF914D   /* taronja — color primari, botons, accents */
--dark:   #1C1C1C   /* cards i panels */
--body:   #111111   /* fons general del dashboard */
--border: white/10  /* vores (border-white/10) */
--text:   white     /* text principal */
--muted:  white/40  /* text secundari */
```

**Sidebar:** fons `#1C1C1C`, text blanc, ítem actiu `#FF914D`.
**Botons primaris:** `bg-[#FF914D] hover:bg-[#e07a3a] text-white`
**Cards / panels:** `bg-[#1C1C1C] rounded-2xl border border-white/10`
**Important:** Qualsevol pàgina nova dins del dashboard MUST usar aquesta paleta fosca, no colors clars (`bg-white`, `text-[#1C1C1C]`, etc.).

---

## Variables d'entorn

### `.env.local` (local — mai pujar a Git)
```
NEXT_PUBLIC_SUPABASE_URL=https://woomjsjbmrasydpirwap.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://woomjsjbmrasydpirwap.supabase.co/auth/v1/.well-known/jwks.json
RESEND_API_KEY=re_...
```

### Regla de seguretat crítica
- `SUPABASE_SECRET_KEY` i `RESEND_API_KEY` **mai** s'exposen al navegador
- Totes les operacions d'admin (crear usuaris, bypass RLS) → Server Actions / Server Components
- `lib/supabase/admin.ts` exposa `createAdminClient()` que usa el secret key — **server-only**

---

## Autenticació i rols

- Proveïdor: Supabase Auth (email + contrasenya)
- Middleware `middleware.ts` (o `proxy.ts`): protegeix rutes `/dashboard/**`, redirigeix a `/login` si no hi ha sessió

### Rols

| Rol | Taula `profiles.role` | Accés |
|---|---|---|
| `employee` | `employee` | Dashboard complet (entrenadors, admins) |
| `client` | `client` | Només vista del seu pla (no implementada al MVP) |

### Usuaris empleats (taula `profiles`)

| Nom | UUID | Email |
|---|---|---|
| Ezequiel (admin) | `29a82d0f-bab5-4a42-b4fc-68cfe64db63a` | ezequiel@gironaactiva.com |
| Maria | `62ba0e07-b75f-4528-9e36-87f774418882` | maria@gironaactiva.com |
| Rima Babani | `f47ae5ba-d477-4ddd-9bbb-69bc00d25a40` | miababani@gmail.com |

Nota: els empleats necessiten compte a Supabase Auth per aparèixer com a opció d'assignació de plans.
Per donar d'alta un empleat existent (que ja té compte): `UPDATE profiles SET full_name='Nom', role='employee' WHERE id='uuid'`.

---

## Estructura de fitxers (estat actual)

```
girona-activa-app/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                          # Redirigeix a /login
│   ├── login/page.tsx
│   ├── actions/                          # Server Actions (TOTS els fitxers d'aquesta carpeta
│   │   ├── clients.ts                    # createClientAction, getClientsAction
│   │   ├── plans.ts                      # createPlanAction (plans individuals)
│   │   ├── group-sessions.ts             # createGroupPlanAction, createGroupCycleAction
│   │   ├── edit-plan.ts                  # moveSessionAction, addSessionExerciseAction, etc.
│   │   ├── session-logs.ts               # startSessionLogAction, saveExerciseLogAction,
│   │   │                                 # completeSessionLogAction, getTodaySessionsAction,
│   │   │                                 # getSessionDetailAction
│   │   └── delete-client.ts              # deleteClientAction
│   └── dashboard/
│       ├── layout.tsx
│       ├── page.tsx                      # Panell (stats + accions ràpides)
│       ├── hoy/
│       │   ├── page.tsx                  # Agenda del dia — sessions agrupades per entrenador
│       │   └── [sessionId]/
│       │       ├── page.tsx              # Server component — carrega detall sessió
│       │       └── session-runner.tsx    # Client component — registre de la sessió d'entrenament
│       ├── clientes/
│       │   ├── page.tsx                  # Llistat de clients
│       │   ├── nuevo/page.tsx            # Alta client (Server Action)
│       │   └── [id]/
│       │       ├── page.tsx              # Detall client + plans
│       │       └── delete-button.tsx
│       ├── ejercicios/
│       │   └── page.tsx                  # Galeria d'exercicis amb filtres
│       ├── planes/
│       │   ├── page.tsx                  # Llistat de plans
│       │   ├── nuevo/
│       │   │   ├── page.tsx              # Server component — carrega dades per al wizard
│       │   │   ├── wizard.tsx            # Client component — wizard de creació (6 passos)
│       │   │   └── exercise-picker-modal.tsx  # Modal galeria d'exercicis (reutilitzat)
│       │   └── [id]/editar/
│       │       ├── page.tsx              # Server component — carrega sessió per editar
│       │       └── edit-plan-calendar.tsx # Client component — calendari interactiu d'edició
│       └── sesiones/
│           └── nuevo/page.tsx            # Creació de cicles de sessions grupals (A/B/C)
├── components/
│   ├── app-sidebar.tsx                   # Sidebar amb: Hoy, Clientes, Ejercicios, Planes, Sesiones grupales
│   └── ui/                              # Components shadcn/ui
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # createClient() — Client Components
│   │   ├── server.ts                    # createClient() — Server Components
│   │   └── admin.ts                     # createAdminClient() — bypass RLS, server-only
│   ├── group-sessions-utils.ts          # levelToDifficulty(), type Difficulty
│   └── utils.ts                         # cn()
└── middleware.ts                         # Protecció de rutes
```

---

## Base de dades — taules principals

### Taules existents

| Taula | Descripció |
|---|---|
| `profiles` | `id` (FK auth.users), `full_name`, `role` (employee/client) |
| `clients` | Perfil client: `first_name`, `last_name`, `sex`, `birth_date`, `height_cm`, `weight_kg`, `start_date`, `email`, `notes`, `is_active` |
| `body_zones` | Catàleg de zones corporals |
| `muscle_groups` | Catàleg de grups musculars |
| `movement_patterns` | Catàleg de patrons de moviment |
| `equipment` | Catàleg d'equipament |
| `objectives` | Catàleg d'objectius |
| `exercises` | `name`, `technical_name`, `level` (1-3), `technical_level`, `body_zone_id`, `movement_pattern_id`, `equipment_id`, `objective_id`, `regression_id` (FK self), `progression_id` (FK self) |
| `exercise_muscle_groups` | Junction exercici ↔ grup muscular |
| `group_cycles` | Cicles de sessions grupals: `start_date`, `notes` |
| `group_cycle_sessions` | Sessions d'un cicle: `session_label` (A/B/C), `session_time` |
| `group_cycle_session_exercises` | Exercicis d'una sessió de cicle: `exercise_id`, `sets`, `reps`, `weight_kg` |
| `training_plans` | `client_id`, `assigned_employee_id`, `type` (individual/group), `level` (1-3), `status` (active/completed), `duration_months`, `weekly_frequency`, `session_duration`, `start_date`, `end_date` |
| `plan_sessions` | `training_plan_id`, `session_date`, `session_time`, `session_label` (A/B/C per a grupals), `notes` |
| `plan_session_exercises` | `plan_session_id`, `exercise_id`, `sets`, `reps`, `weight_kg`, `notes`, `order_index` |
| `session_logs` | `plan_session_id`, `client_id`, `started_at`, `completed_at`, `status` (in_progress/completed) |
| `exercise_logs` | `session_log_id`, `plan_exercise_id`, `exercise_id`, `sets_done`, `reps_done`, `load_kg`, `rpe` (1-10), `rir` (0-10), `notes`, `skipped` |

### Convencions RLS

Totes les taules usen:
```sql
FOR ALL USING (auth.role() = 'authenticated')
```
(No `is_employee()` — no funciona bé en context de servidor)

Permisos necessaris (executar després de crear taules noves):
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

### Trigger important
```sql
-- Crea automàticament una fila a profiles en crear un usuari a auth.users
-- role per defecte: 'employee'. Per a clients: passar role='client' a raw_user_meta_data
create trigger on_auth_user_created after insert on auth.users ...
```

---

## Funcionalitats implementades (estat actual)

### Clients (`/dashboard/clientes`)
- Llistat amb stats (actius, nous aquest mes)
- Alta client: crea compte Supabase Auth + fila a `clients` + envia email de reset de contrasenya
- Detall client: dades personals + pla actiu + historial de plans
- Des del detall: botó "Nou pla" que preselecciona el client al wizard
- Eliminar client

### Galeria d'exercicis (`/dashboard/ejercicios`)
- Filtres: zona corporal, patró de moviment, grup muscular, equipament, objectiu, nivell
- Cada exercici pot tenir `regression_id` i `progression_id` (FK a exercises)

### Plans d'entrenament (`/dashboard/planes`)

#### Wizard de creació (6 passos) — `planes/nuevo/wizard.tsx`
1. **Client** — selecció del client (es salta si ve de `?client=uuid`)
2. **Entrenador** — selecció de l'empleat assignat (`assigned_employee_id`)
3. **Tipus** — Individual / Grupal + selecció de cicle (si és grupal)
4. **Nivell** — 1 (Regresión), 2 (Base), 3 (Progresión)
5. **Paràmetres** — data inici, hora sessió, mesos durada, freqüència, dies de la setmana, durada per sessió
6. **Calendari** — previsualització + guardar

**Plans grupals:** generen sessions A/B/C en rotació (index % 3) a partir d'un `group_cycle` existent.
- Nivell 1 → `regression` (usa `exercise.regression_id`, fallback a base si null)
- Nivell 2 → `base`
- Nivell 3 → `progression` (usa `exercise.progression_id`, fallback a base si null)

**Plans individuals:** calendari interactiu on s'afegeixen exercicis per dia amb `ExercisePickerModal`.

#### Editar pla — `planes/[id]/editar/`
- Calendari interactiu mensual
- Clic en un dia: bottom sheet amb exercicis d'aquella sessió
- Afegir exercicis: usa `ExercisePickerModal` (galeria amb filtres)
- Editar / eliminar exercicis existents
- Moure sessió a un altre dia

### Agenda del dia (`/dashboard/hoy`)
- Mostra les sessions del dia actual de tots els clients
- Ordenació: sessions del login-user primer, resta agrupades per entrenador
- Stats: total, completades, pendents

### Registre de sessió (`/dashboard/hoy/[sessionId]`)
- Flux d'entrenament sessió a sessió: exercici per exercici
- Per cada exercici: Series, Reps, Carga (kg), RPE (1-10), RIR (0-10), Comentarios, opció "Saltar"
- RPE: verd ≤ 3, groc ≤ 6, vermell > 6
- RIR: vermell ≤ 2, groc ≤ 5, verd > 5 (lògica invertida)
- "Completar sesión" només actiu quan tots els exercicis estan guardats

### Cicles de sessions grupals (`/dashboard/sesiones/nuevo`)
- Crea cicles amb sessions A, B, C
- Cada sessió: exercicis amb sèries, reps, pes

---

## Patrons importants de codi

### `export const dynamic = 'force-dynamic'`
Afegir a totes les pàgines Server Component que fan fetch de Supabase, per evitar caché de Vercel.

### Server Actions — tots els exports han de ser `async`
En fitxers marcats `'use server'`, **tots** els exports (tipus, funcions) han de ser `async`.
Exportar un tipus no-async o una funció no-async trenca Turbopack amb:
`Error: Only async functions are allowed to be exported in a "use server" file.`
**Solució:** moure tipus/funcions no-async a fitxers separats (ex: `lib/group-sessions-utils.ts`).

### PostgREST retorna relations com a arrays
Quan es fa un join amb `select('training_plans(...)')`, TypeScript pot inferir array.
Cal fer guard:
```ts
const getPlan = (s: any) => Array.isArray(s.training_plans) ? s.training_plans[0] : s.training_plans
```

### `ExercisePickerModal` — component reutilitzat
Definit a `app/dashboard/planes/nuevo/exercise-picker-modal.tsx`.
Usat a:
- `planes/nuevo/wizard.tsx` (creació de plans individuals)
- `planes/[id]/editar/edit-plan-calendar.tsx` (edició de plans)

Props necessàries: `exercises`, `exerciseCatalog`, `existingExercises`, `bodyZones`, `movementPatterns`, `muscleGroups`, `equipment`, `objectives`, `dayLabel`, `onAdd`, `onRemove`, `onUpdate`, `onClose`.
Els exercicis han de tenir `muscle_group_ids: string[]` (join via `exercise_muscle_groups`).

---

## Git workflow

```
dev   → preview Vercel (branca de treball habitual)
main  → producció Vercel
```

```bash
git add [fitxers]
git commit -m "feat/fix/chore: descripció"
git push origin dev
```

---

## Pendent (roadmap MVP)

- [ ] **DNS:** configurar `app.gironaactiva.com` → Vercel
- [ ] **Merge dev → main** quan MVP estable, tag `v1.0.0`
- [ ] **Vista client:** calendari mòbil del pla actiu (el client veu el seu pla)
- [ ] **Imatges d'exercicis:** Supabase Storage — mostrar foto/vídeo a la galeria
- [ ] **Zones d'exercici pendents:** rodilla, cadera, columna/core, hombro (venen d'Excels del client)
- [ ] **Gràfics d'evolució:** RPE/RIR/carga per exercici al llarg del temps (diferit)
- [ ] **Long press al calendari (wizard):** click llarg sobre un dia de sessió → modal de confirmació per eliminar-lo (alternativa a la cruceta actual, més adequada per mòbil)
- [ ] **Gestió de plans:** veure actiu/historial des del perfil del client (millora UX)
- [ ] **Més empleats:** afegir entrenadors nous quan s'incorporin

---

## Notes per a futures sessions

- **Supabase project ID:** `woomjsjbmrasydpirwap`
- **Vercel org:** `brota-ai`
- La galeria d'exercicis **no està completa** — els exercicis s'estan afegint progressivament per zones. `regression_id` / `progression_id` estaran buits fins que la galeria estigui completa; el codi ja fa fallback al base si són null.
- L'app usa el mateix sistema de disseny que la web de màrqueting de BrotaAI però en mode fosc.
- El client principal és Girona Activa (centre d'entrenament, zona Girona). Els usuaris reals del dashboard són els entrenadors.
