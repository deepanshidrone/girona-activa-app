# CLAUDE.md — Girona Activa App

Context complet del projecte per a Claude Code. Aquest fitxer es carrega automàticament a l'inici de cada sessió.

---

## Visió general del projecte

**Producte:** Eina web per gestionar i visualitzar plans d'entrenament del centre Girona Activa.
**URL producció:** `app.gironaactiva.com` (pendent de configurar DNS)
**URL dev (Vercel preview):** `https://girona-activa-app-git-dev-brota-ai.vercel.app`
**URL producció (Vercel):** `https://girona-activa-app.vercel.app`
**Idioma MVP:** Castellano
**Estat:** En desenvolupament actiu — MVP

---

## Stack tècnic

| Capa | Tecnologia |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, TypeScript) |
| Estils | Tailwind CSS v4 + shadcn/ui (new-york) |
| Components | shadcn/ui — sidebar, card, button, input, label, select, textarea, badge, avatar, separator |
| Base de dades + Auth | Supabase (PostgreSQL + Supabase Auth) |
| Emmagatzematge imatges | Supabase Storage |
| Hosting | Vercel (brota-ai org, pla Hobby) |
| Repo | `deepanshidrone/girona-activa-app` (públic) |
| Font | Outfit (Google Fonts) — mateixa que la web de màrqueting |

---

## Identitat de marca

```css
--orange: #FF914D;   /* Taronja oficial — color primari de l'app */
--dark:   #1C1C1C;   /* Negre corporatiu — textos principals */
--gray:   #666666;   /* Gris — textos secundaris */
--light:  #F5F5F5;   /* Fons de pàgines */
--border: #E5E5E5;   /* Vores de cards i inputs */
--white:  #ffffff;   /* Fons de cards */
```

**Sidebar:** fons `#1C1C1C` (fosc), text blanc, ítem actiu `#FF914D`.

---

## Estructura de fitxers

```
girona-activa-app/
├── app/
│   ├── layout.tsx                        # Root layout: Outfit font + TooltipProvider
│   ├── globals.css                       # Tailwind v4 + shadcn + variables de marca
│   ├── page.tsx                          # Redirigeix a /login
│   ├── login/
│   │   └── page.tsx                      # Pàgina de login (client component)
│   └── dashboard/
│       ├── layout.tsx                    # Layout dashboard: SidebarProvider + AppSidebar + topbar
│       ├── page.tsx                      # Panel de control (stats + accions ràpides)
│       └── clientes/
│           ├── page.tsx                  # Llistat de clients (buit de moment)
│           └── nuevo/
│               └── page.tsx             # Formulari alta client (PENDENT: migrar a Server Action)
├── components/
│   ├── app-sidebar.tsx                   # Sidebar fosc amb navegació i logout
│   └── ui/                              # Components shadcn/ui
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # createClient() — per a Client Components
│   │   └── server.ts                    # createClient() — per a Server Components
│   └── utils.ts                         # cn() utility (shadcn)
├── proxy.ts                              # Proxy (middleware) — protecció de rutes + refresc sessió
├── .env.local                            # Variables d'entorn locals (NO pujar a Git)
└── CLAUDE.md                             # Aquest fitxer
```

---

## Variables d'entorn

### `.env.local` (local)
```
NEXT_PUBLIC_SUPABASE_URL=https://woomjsjbmrasydpirwap.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://woomjsjbmrasydpirwap.supabase.co/auth/v1/.well-known/jwks.json
```

### Vercel (Production + Preview)
Les mateixes 4 variables configurades al panell de Vercel.

⚠️ **IMPORTANT:** `SUPABASE_SECRET_KEY` mai s'ha d'exposar al navegador.
Només s'usa en Server Actions i Server Components.

---

## Autenticació

- Proveïdor: **Supabase Auth**
- Mètode: email + contrasenya
- El client (`PUBLISHABLE_KEY`) s'usa per fer login des del navegador
- L'admin (`SECRET_KEY`) s'usa per crear usuaris — **sempre des del servidor**

### Per què no es pot crear usuaris des del navegador

`supabase.auth.admin.createUser()` requereix la SECRET_KEY (clau d'administrador).
Exposar-la al navegador permetria que qualsevol persona la robi i gestioni tots els usuaris.
**Solució:** Server Actions de Next.js — el formulari del navegador crida una funció que
s'executa al servidor, on la clau és segura.

### Flux de sessió

```
Usuari fa login → Supabase Auth → Cookie de sessió
proxy.ts intercepta cada petició:
  - Ruta protegida sense sessió → redirigeix a /login
  - /login amb sessió activa → redirigeix a /dashboard
```

### Rutes protegides (proxy.ts)
```
/dashboard, /clientes, /ejercicios, /planes
```

---

## Base de dades (Supabase)

### Taules principals

| Taula | Descripció |
|---|---|
| `profiles` | Rol de cada usuari (employee / client). FK → auth.users |
| `clients` | Perfil complet del client |
| `exercises` | Galeria d'exercicis |
| `movement_patterns` | Catàleg: empuje, tirón, bisagra, sentadilla, core, cargada, isométrico, cardio |
| `muscle_groups` | Catàleg: pecho, espalda, piernas, glúteos, hombros, bíceps, tríceps, core, full body |
| `exercise_movement_patterns` | Junction: exercici ↔ patró de moviment |
| `exercise_muscle_groups` | Junction: exercici ↔ grup muscular |
| `training_plans` | Plans d'entrenament (individual / grupal) |
| `plan_sessions` | Cada dia d'entrenament dins d'un pla |
| `plan_session_exercises` | Exercicis assignats a cada sessió |
| `group_plan_templates` | 3 plantilles predefinides (nivell 1, 2, 3) |
| `group_template_sessions` | Sessions dins d'una plantilla grupal |
| `group_template_session_exercises` | Exercicis dins d'una sessió de plantilla |

### Trigger important

```sql
-- Es dispara automàticament en crear un usuari a auth.users
-- Crea una fila a profiles amb role='employee' per defecte
-- Cal passar role='client' a raw_user_meta_data per crear clients
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### RLS (Row Level Security)

Totes les taules tenen RLS activat.
- `is_employee()` → accés total a totes les taules
- `is_client()` → només lectura de les seves pròpies dades

---

## Rols i usuaris

| Rol | Com es crea | Accés |
|---|---|---|
| `employee` | Manualment des de Supabase Auth dashboard | Dashboard complet |
| `client` | Via Server Action des del formulari d'alta | Només vista del seu pla |

**Usuaris de prova:**
- `ezequiel@gironaactiva.com` → rol: employee

---

## Pàgines implementades

### `/login`
- Client Component
- Login amb email + contrasenya via `supabase.auth.signInWithPassword()`
- Redirigeix a `/dashboard` si èxit

### `/dashboard`
- Server Component
- Stats (clientes, ejercicios, planes) — de moment valors estàtics
- Accions ràpides: Nuevo cliente, Nuevo plan, Ejercicios

### `/dashboard/clientes`
- Llistat de clients (de moment estat buit)
- Botó "Nuevo cliente"

### `/dashboard/clientes/nuevo`
- Formulari d'alta de client (9 camps)
- ⚠️ PENDENT: migrar creació d'usuari a Server Action
- En guardar: crea registre a `clients` + envia email de reset de contrasenya al client

---

## Decisions tècniques importants

### Per què Supabase en lloc de Notion per a la BD
Notion no és una BD relacional. La galeria d'exercicis amb filtres múltiples i
l'estructura de plans (setmanes → dies → exercicis → sèries/reps) és massa
complexa per a l'API de Notion (limitada, lenta, sense joins).

### Per què Vercel en lloc de Netlify
Next.js i Vercel són del mateix equip. App Router + Server Components funcionen
de forma nativa a Vercel. A Netlify hi ha limitacions de compatibilitat.

### Per què el repo és públic
Vercel pla Hobby no permet col·laboració en repos privats. Per al MVP és
acceptable (les claus d'entorn mai van al repo). Avaluar canvi a privat / Pro quan
el projecte estigui en producció real.

### shadcn/ui + Tailwind v4
shadcn init sobreescriu globals.css. Després de cada `shadcn init` cal verificar:
1. `--font-sans` no sigui circular (`var(--font-sans)` → canviar per `"Outfit", Arial, sans-serif`)
2. `--primary` apunti al taronja de marca (`#FF914D`)

### Server Actions per a operacions d'admin
Qualsevol operació que requereixi `SUPABASE_SECRET_KEY` (crear usuaris, etc.)
s'ha d'implementar com a Server Action a `app/actions/` — mai en Client Components.

---

## Git workflow

```
main    → producció (girona-activa-app.vercel.app)
dev     → preview (girona-activa-app-git-dev-brota-ai.vercel.app)
```

**Procés estàndard:**
```bash
git add [fitxers]
git commit -m "feat/fix/chore: descripció"
git push origin dev
# Quan aprovat → merge a main
```

---

## Pròxims passos (MVP)

- [ ] Server Action per crear usuaris client de forma segura
- [ ] Llistat de clients amb dades reals de Supabase
- [ ] Galeria d'exercicis (CRUD)
- [ ] Generació de pla grupal
- [ ] Generació de pla individual (calendari + selector d'exercicis)
- [ ] Vista client (calendari del pla actiu)
- [ ] Configurar subdomini `app.gironaactiva.com` → Vercel
