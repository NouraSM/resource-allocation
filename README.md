# RA Copilot

**Resource Allocation Copilot for Government Consulting Centers**

Turn incoming consulting demand into explainable, capacity-aware resource allocation decisions.

```
Demand → Prioritization → Capacity → Matching → Scenario → Decision → Monitoring
```

RA Copilot helps a government consulting center answer, every day:

- Which requests should we prioritize?
- Who should work on them, and can we meet the deadline?
- What resources are overloaded right now?
- What happens to the existing portfolio if a new urgent request arrives?

All scoring, matching, capacity, and risk decisions are made by **deterministic business
logic** (see [`src/engine/`](./src/engine)) — not by AI. AI is used only to read request
text, suggest structured fields for human review, and explain results that were already
computed. The product works fully with **no AI key configured**.

---

## Table of contents

1. [Architecture](#architecture)
2. [Technology stack](#technology-stack)
3. [Local setup](#local-setup)
4. [Supabase setup](#supabase-setup)
5. [Environment variables](#environment-variables)
6. [Database migrations](#database-migrations)
7. [Seed data](#seed-data)
8. [Run / build / test commands](#run--build--test-commands)
9. [AI configuration](#ai-configuration)
10. [Demo accounts](#demo-accounts)
11. [Demo story walkthrough](#demo-story-walkthrough)
12. [Testing](#testing)
13. [Implemented features](#implemented-features)
14. [Known limitations](#known-limitations)
15. [V2 roadmap](#v2-roadmap)

---

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  React + TypeScript + Vite  │  https │        Supabase project       │
│  (Cloudflare Pages)         ├───────►│  Postgres + Auth + RLS         │
│                              │        │  Edge Functions (ai-analyze,  │
│  src/engine/*  (pure TS)    │        │  ai-copilot) hold the OpenAI   │
│  deterministic decision      │        │  key server-side               │
│  logic, unit tested          │        └──────────────────────────────┘
└─────────────────────────────┘
```

- **Frontend**: a single-page app (no server-side rendering). All screens read/write
  Supabase directly through `@supabase/supabase-js`, protected by Postgres Row Level
  Security — the browser never has elevated access.
- **Decision engines** (`src/engine/`) are plain, framework-free TypeScript modules with
  no Supabase or React imports. Pages and hooks map Supabase rows into the engines'
  input types (`src/lib/mappers.ts`), call the engine, and render the result. This is the
  one place formulas live — nothing is duplicated in components.
- **AI** only ever runs inside two Supabase Edge Functions (`supabase/functions/ai-analyze`,
  `supabase/functions/ai-copilot`). The `OPENAI_API_KEY` is a server-side secret and is
  never bundled into the browser build. If it isn't set, both functions return a
  `{ error: "AI Assistant Not Configured" }` payload and the UI falls back to manual entry
  / plain deterministic answers — every core workflow keeps working.
- **Multi-tenancy** is enforced at the database level: every tenant table carries
  `organization_id`, and Postgres RLS policies (not client-side filtering) scope every
  query to `current_org_id()` — a `SECURITY DEFINER` function reading the caller's own
  `profiles` row. See `supabase/migrations/0006_row_level_security.sql`.
- Nothing here is Supabase-specific at the data-model level: it's plain PostgreSQL
  (tables, `check` constraints, triggers, RLS). Moving off Supabase later means replacing
  the auth/edge-function plumbing, not the schema.

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript (strict), Vite |
| Styling | Tailwind CSS v4, hand-rolled shadcn-style UI kit (`src/components/ui`), Lucide icons |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| AI (optional) | Any OpenAI-compatible Chat Completions API, called only from Edge Functions |
| i18n | Custom lightweight dictionary provider (`src/lib/i18n`), English + Arabic, full RTL |
| Testing | Vitest (+ Testing Library) for the decision engines |
| Deployment | Cloudflare Pages (static build) + Supabase project |

## Local setup

```bash
git clone <this repo>
cd resource-allocation
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, see "Supabase setup" below
npm run dev
```

Until `.env` is filled in, the app boots to a clear "Supabase needs credentials" screen
instead of a blank page or hidden crash.

## Supabase setup

You need a Supabase project (either the hosted [supabase.com](https://supabase.com) or a
local one via the Supabase CLI).

### Option A — hosted Supabase (fastest)

1. Create a project at supabase.com.
2. In the SQL Editor, run every file in [`supabase/migrations/`](./supabase/migrations) in
   filename order (`0001_...` through `0007_...`).
3. Run [`supabase/seed.sql`](./supabase/seed.sql) the same way to load the demo
   organization ("Government Advisory Center") — see [Seed data](#seed-data).
4. Copy the project's URL and anon key (Project Settings → API) into `.env`.
5. (Optional) Set `OPENAI_API_KEY` as an **Edge Function secret** (never a `VITE_` var —
   see [AI configuration](#ai-configuration)) and deploy the two functions in
   `supabase/functions/`.

### Option B — Supabase CLI (local Postgres via Docker)

```bash
npx supabase start           # spins up local Postgres + Auth + Studio
npx supabase db reset        # applies supabase/migrations/*.sql, then supabase/seed.sql
```

Then point `.env` at the local URL/anon key printed by `supabase start`.

## Environment variables

See [`.env.example`](./.env.example).

```bash
VITE_SUPABASE_URL=            # safe to expose in the browser bundle
VITE_SUPABASE_ANON_KEY=       # safe to expose — tenant isolation is enforced by RLS, not secrecy

OPENAI_API_KEY=               # set ONLY via `supabase secrets set`, never as a VITE_ var
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

## Database migrations

All schema lives in [`supabase/migrations/`](./supabase/migrations), applied in order:

| File | Contents |
|---|---|
| `0001_extensions_and_core.sql` | `organizations`, `profiles` |
| `0002_resources_and_skills.sql` | `resources`, `skills`, `resource_skills`, `historical_projects`, `resource_availability` |
| `0003_requests_and_allocation.sql` | `work_requests`, `request_skills`, `deliverables`, `assignments`, `risks`, `allocation_recommendations`, `scenario_runs` |
| `0004_audit_and_notifications.sql` | `audit_logs`, `notifications` |
| `0005_functions_and_triggers.sql` | `current_org_id()`/`current_role()`/`current_resource_id()` auth helpers, request numbering, `updated_at`, new-user provisioning, role-escalation guard |
| `0006_row_level_security.sql` | RLS policies for every tenant table |
| `0007_notification_triggers.sql` | workflow-based notification triggers (at-risk, critical-unallocated) |

`src/types/database.ts` mirrors this schema by hand; regenerate it with
`supabase gen types typescript` once the project is linked, if you prefer generated types.

## Seed data

`supabase/seed.sql` is **generated**, not hand-written:

```bash
npm run seed:generate   # writes supabase/seed.sql from scripts/generate-seed.mjs
```

It creates a realistic "Government Advisory Center" tenant:

- 7 departments, 20 skills, 26 resources (one part-time, one inactive)
- 18 work requests spanning all priority levels and statuses, including 4 `at_risk`
- 31 assignments engineered so **3 resources land in the overloaded/critical band**
  while others stay healthy or underutilized (edge cases you'll want for a live demo)
- historical projects (with a few resources intentionally left with none — an edge case
  the experience engine has to handle), leave/training availability records, risks,
  notifications, and an audit trail
- 4 demo accounts (see below)

Dates are computed relative to whenever you run the generator, so upcoming-deadline and
urgency displays stay meaningful no matter when you seed. The committed `supabase/seed.sql`
was generated and smoke-tested against a real PostgreSQL 16 instance (migrations + seed
apply cleanly, RLS enables on all 16 tenant tables, the notification triggers fire).

## Run / build / test commands

```bash
npm run dev            # start the Vite dev server
npm run build           # tsc -b type-check, then production build
npm run preview         # preview the production build locally
npm run lint             # oxlint
npm run test              # run the engine unit tests once
npm run test:watch        # watch mode
npm run seed:generate     # regenerate supabase/seed.sql
```

## Deployment

**Frontend — Cloudflare Pages:**

1. Connect this repository to a new Cloudflare Pages project.
2. Build command: `npm run build`. Output directory: `dist`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages environment variables
   (these are safe to expose — see [Environment variables](#environment-variables)).
4. Do **not** set `OPENAI_API_KEY` here — it belongs only in Supabase Edge Function
   secrets, never in the frontend build.

**Backend — Supabase:** host the project on Supabase (hosted or self-hosted). Run the
migrations and seed once (see [Supabase setup](#supabase-setup)), then deploy the two
Edge Functions if you want AI enabled (see below). Because the schema avoids
Supabase-proprietary features (plain tables, `check` constraints, standard triggers,
RLS), the same SQL runs on any PostgreSQL 15+ instance if you later move off Supabase —
only the Auth/Edge-Function plumbing would need replacing.

## AI configuration

RA Copilot works completely with **no AI configured** — every allocation, scenario, and
risk feature is deterministic. AI only adds two conveniences, both server-side:

- **Request analysis** (`supabase/functions/ai-analyze`): given a title/description,
  suggests request type, complexity, an effort range, and candidate skills. The user
  reviews and edits every suggestion before it's saved; the priority score itself is
  always computed by `src/engine/priority.ts`, never by the model.
- **Copilot explanations** (`supabase/functions/ai-copilot`): the client
  (`src/lib/copilotEngine.ts`) always computes the real answer first from live data, then
  (optionally) asks the model to phrase it in natural language from that exact JSON — the
  model is instructed never to invent a number that isn't in the context it was given.

To enable AI: deploy the two functions and set the key as a **function secret**, e.g.

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase functions deploy ai-analyze
npx supabase functions deploy ai-copilot
```

Without this, both functions (and therefore the client) report "AI Assistant Not
Configured" and the app falls back to manual entry / plain computed answers.

## Demo accounts

Created by `supabase/seed.sql` (via `auth.users` + the auto-provisioning trigger). All four
share the same demo password.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@racopilot.demo` | `RaCopilot!Demo1` |
| Resource Manager | `manager@racopilot.demo` | `RaCopilot!Demo1` |
| Consultant | `consultant@racopilot.demo` | `RaCopilot!Demo1` |
| Executive Viewer | `executive@racopilot.demo` | `RaCopilot!Demo1` |

These are development-only credentials seeded into your own Supabase project — never use
them (or this password) for a real deployment.

## Demo story walkthrough

This is the scenario the seed data is built to support end-to-end:

1. Sign in as `manager@racopilot.demo`.
2. Command Center shows live KPIs, 3 resources already flagged overloaded, and 4 at-risk
   requests under **Executive Attention Required**.
3. Go to **Work Requests → New Request**. Enter a new urgent executive request with a
   near-term deadline. Priority computes live and lands on **Critical**.
4. Click **Generate Allocation**. The team builder evaluates every active resource,
   hard-filters the infeasible ones (inactive, missing mandatory skill, no capacity, or
   mostly on leave — shown under "Not Feasible" with a reason, never hidden), and returns
   three ranked scenarios.
5. The obvious top-skill match is a resource who's already nearly overloaded — take that
   scenario and click **Run What-if**: the dialog shows their utilization jumping from a
   healthy number past 100%, and recommends **against** approving it.
6. Compare scenarios in the table below the cards; approve the balanced alternative
   instead (e.g., two mid-load consultants sharing the work). Approving creates real
   `assignments` rows, moves the request to `allocated`, and writes an audit log entry.
7. Back on the Command Center, KPIs (unallocated count, utilization, executive attention)
   update immediately from the same live data.

## Testing

```bash
npm run test
```

123 deterministic unit tests cover every engine in `src/engine/__tests__/`: priority,
urgency (including working-day math and manager overrides), capacity (including the
zero-capacity edge case), skill matching, experience, workload balance, deadline
feasibility, resource fit + hard filters, delivery risk, team construction (including
"all resources overloaded" and "effort exceeds portfolio capacity" edge cases), the
what-if engine, and a static guard that fails the build if any tenant table's RLS policy
is ever removed or stops scoping by `organization_id`.

Full RLS *enforcement* (as opposed to the policies existing) can only be verified against
a live Postgres instance with real JWTs. The schema, triggers, and RLS policies in
`supabase/migrations/` were smoke-tested by hand against a real PostgreSQL 16 server
during development (migrations + seed apply cleanly; the notification triggers were
exercised directly). We recommend `supabase test db` (pgTAP) for CI once the project is
linked to a Supabase instance.

## Implemented features

- Command Center with 8 KPIs, Executive Attention, upcoming deadlines, department
  capacity, and priority-vs-capacity charts
- Work Requests: search, filter (priority/status/deadline/entity/unallocated/risk),
  detail view with priority breakdown, urgency override (with required reason + audit)
- New Request flow: AI analysis with manual fallback, live priority score, structured
  business-importance controls
- Allocation Workspace: 3 generated team scenarios, hard-filter transparency, comparison
  table, Approve / Modify / Reject workflow (with reason codes) that creates real
  assignments and writes audit history
- What-if simulator: before/after utilization, request risk impact, alternative
  suggestion, persisted (non-destructively) to `scenario_runs`
- Resources + Resource Profile: search/filter, weekly capacity chart, utilization trend,
  skills, relevant experience, availability/leave, "can this person take more work?"
- Portfolio: table, timeline, and kanban views with working status-advance actions
- Copilot: deterministic-first Q&A (capacity, risk, skills, overload, "why is X risky",
  "can we accept another request") with an optional AI phrasing layer and clickable
  actions to the underlying request/resource
- Notifications (DB triggers for at-risk/critical-unallocated, client-raised for overload
  and approval-required) and Audit Log
- Settings: organization thresholds, user role/active management, skills catalog, CSV
  export (resources/requests/assignments/portfolio/capacity) and CSV import with
  per-row validation for all 5 templates (resources, skills, resource_skills,
  work_requests, assignments)
- First-time Setup Wizard (organization → resources → skills → assignments → ready)
- Full bilingual (English/Arabic) UI with true RTL layout and a language toggle
- Role-based navigation and route guards for Admin / Resource Manager / Consultant /
  Executive Viewer
- Mobile bottom navigation (dashboard, requests, alerts, approvals, resources); desktop
  sidebar for everything else

## Known limitations

- **i18n coverage**: all navigation, core workflow screens (Command Center, Work
  Requests, Request Detail, New Request, Allocation Workspace, Resources, Copilot) and
  every status/priority/risk/role label go through the `t()` dictionary
  (`src/lib/i18n/en.ts` / `ar.ts`) and are fully RTL-aware. Some secondary
  admin-facing surfaces (Settings' CSV import panel copy, the Setup Wizard's helper
  prose, a couple of dialog field labels) are still English-only pending translation —
  the dictionary structure supports adding them without any component changes.
- **Bundle size**: the production JS bundle is ~235 KB gzipped in one chunk; fine for an
  internal tool, but a good candidate for route-based code-splitting later.
- **Deadline-approaching notifications**: Command Center surfaces upcoming deadlines
  visually, but a scheduled (cron) notification job wasn't added, to avoid introducing
  scheduler infrastructure for the MVP — see the roadmap below.
- **Modify Team** lets a manager add/remove members and change allocation % before
  approving, but doesn't re-run every derived score (skill coverage, etc.) live as you
  edit — the original scenario's scores are shown until you approve.
- **CSV import** matches resources/skills/requests by natural key (employee code, skill
  name, request number) rather than supporting update-in-place or partial-catalog
  auto-creation.
- Full Row Level Security *enforcement* testing requires a live Supabase project with
  real user JWTs; this repo includes a static policy-shape guard in the unit tests plus a
  manual smoke test against real Postgres, but not automated pgTAP RLS tests.
- Historical-project "relevant experience" matching is deliberately simple
  (sector/project-type overlap + recorded performance score) per the V1 spec — no
  embeddings.

## V2 roadmap

- Scheduled Edge Function (pg_cron or Supabase Scheduled Functions) for deadline-approaching
  and other time-based notifications
- Route-based code splitting and virtualization for large portfolios
- Richer Modify Team editor that re-scores live as the team changes
- pgTAP RLS test suite wired into CI
- CSV import: update-in-place, dry-run diff view, bulk resource_availability import
- Drag-and-drop Kanban
- Configurable priority/risk/team-score weights per organization (currently fixed per spec)
- Notification delivery channels (email/Slack) via Edge Functions
