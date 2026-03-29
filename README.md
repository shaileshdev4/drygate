# Drygate

**Production readiness verifier for n8n workflows.**

Paste or upload an exported n8n workflow JSON. Drygate runs static analysis and sandbox execution, scores the workflow 0–100, and generates a prioritized remediation plan - before it breaks in production.

> Built for LovHack Season 2 · March 2026

---

## What it does

n8n workflows that pass every editor test regularly fail in production. Hardcoded credentials, missing error branches, credential references with no attached credential, no global error workflow - none of these surface in the n8n editor. Drygate catches them automatically.

**Pipeline (four stages, runs in ~30–60s):**

```
Parse → Static Analysis → Sandbox Execution → Remediation Plan
```

1. **Parse** - validates JSON shape, nodes array, connection graph, trigger presence
2. **Static gate** - graph and credential rules, **expression** analysis (`{{ }}`), **rate limiting** (loops vs APIs), **webhook** security (auth, response mode, path guessability), **input validation** (trigger → destructive paths), **AI / LangChain** checks (system prompt, memory, errors), **AI prompt-injection** heuristics for untrusted input in LLM parameters, production **manifest** and **egress** guardrails, plus **workflow complexity** (informational score: nodes, branches, depth, sub-workflows). Issues are grouped on the report into **Security**, **Reliability**, **Logic**, **Configuration**, and **AI / Agents**.
3. **Sandbox** - imports the workflow into an isolated n8n instance, coerces triggers to manual, executes, captures per-node traces and runtime errors. **Sticky notes** are excluded from coverage and traces. **Trigger** nodes are classified separately from credential-blocked nodes and appear under **Trigger** in the coverage breakdown, not under **Blocked**.
4. **Remediation** - deterministic fix cards (step-by-step, effort estimates). If **`ANTHROPIC_API_KEY`** is set, up to five **high/critical** issues also get an optional **AI suggestion** block (Claude Haiku) alongside deterministic steps; failures there never block the pipeline.

**Outputs:**

- Readiness score (0–100) with a named band
- **Complexity** badge (low → very high) on the shareable report
- Per-issue list with severity, category, node reference, and code; expandable remediation + optional AI hint
- **Workflow graph** and **simulation coverage** breakdown (executed / blocked / skipped / trigger)
- Simulation coverage % (relative to nodes the sandbox can run)
- Shareable report link (no login required)
- Full verification history

---

## Score bands

| Band                 | Score  | Meaning           |
| -------------------- | ------ | ----------------- |
| `production_ready`   | 85–100 | Ship it           |
| `needs_minor_fixes`  | 65–84  | Fixable gaps      |
| `significant_issues` | 40–64  | Major work needed |
| `not_ready`          | 0–39   | Do not deploy     |

**Fail-closed rule:** if `HARDCODED_SECRET`, `MISSING_TRIGGER`, `CIRCULAR_DEPENDENCY`, or `UNAUTHORIZED_EGRESS_DETECTED` is found, score is capped at 40 regardless of other findings.

---

## Tech stack

| Layer               | Technology                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend + API      | Next.js 14 (App Router)                                                                               |
| Database            | Prisma + **PostgreSQL** only (`DATABASE_URL` + `DIRECT_URL`; use **`?pgbouncer=true`** on Supabase **:6543** transaction pooler to avoid prepared-statement errors) |
| Auth                | **Demo mode** - fixed `demo-user` in API/UI; no sign-in flow                                          |
| Sandbox             | **Persistent** n8n URL (`SANDBOX_N8N_URL`); local stack is `n8nio/n8n:latest` in `docker-compose.yml` |
| Streaming           | Server-Sent Events (SSE)                                                                              |
| Egress interception | Mock gateway container (used by local compose HTTP_PROXY to n8n)                                      |

---

## Local development

### Prerequisites

- Node.js 18+
- Docker Desktop running
- Git

### Setup

```bash
git clone https://github.com/shaileshdev4/drygate.git
cd drygate
npm install
```

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` - you need a **PostgreSQL** URL (local Postgres or Supabase). Set **`DIRECT_URL`** to a direct/session connection for `prisma db push` (see `.env.local.example`).

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SANDBOX_N8N_URL=http://localhost:5678
```

Push the database schema:

```bash
npm run db:push
```

### Start the sandbox (persistent mode - recommended)

```bash
docker compose up -d
```

This starts **n8n** (`n8nio/n8n:latest`) and the **mock gateway** on `sandbox-net`. n8n listens on **`localhost:5678`**. The app’s sandbox controller establishes a session against that instance (owner setup + login on first use). Leave the stack running.

Verify n8n is up:

```bash
curl http://localhost:5678/healthz
```

### Run the app

```bash
npm run dev
```

Open `http://localhost:3000`. Go to `/verify?demo=1` to run the prefilled demo workflow.

---

## Sandbox modes

### Persistent (required in this repo)

Set **`SANDBOX_N8N_URL`** to the base URL of a running n8n (e.g. `http://localhost:5678` or your Railway public URL). The controller imports the workflow, runs it via n8n’s REST APIs (with version fallbacks), and polls executions.

```env
SANDBOX_N8N_URL=http://localhost:5678
SANDBOX_N8N_API_KEY=   # optional - Settings → API in n8n
```

Local **`docker-compose.yml`** uses **`n8nio/n8n:latest`** (aligns with typical Docker Desktop pulls). Override the ephemeral image tag with **`SANDBOX_N8N_IMAGE`** only if you add back per-request Docker mode.

### Ephemeral (not enabled)

If **`SANDBOX_N8N_URL` is unset**, the sandbox layer **throws** - per-request Docker + n8n is **not wired up** in the current build. Use persistent n8n only.

---

## Environment variables

### Required (typical)

| Variable              | Description                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string (pooler ok for runtime; use `?pgbouncer=true` with Supabase transaction pooler if needed) |
| `DIRECT_URL`          | Direct PostgreSQL URL for `prisma db push` (e.g. Supabase session pooler on `:5432`)                                   |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app (server-side report page fetches use this)                                                  |
| `SANDBOX_N8N_URL`     | Base URL of persistent n8n (e.g. `http://localhost:5678`). **Required** - ephemeral mode is disabled.                  |

### Sandbox (optional)

| Variable              | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `SANDBOX_N8N_API_KEY` | n8n API key when using public API routes                                                  |
| `SANDBOX_N8N_IMAGE`   | Only relevant if you restore Docker-per-run sandbox (default in code: `n8nio/n8n:latest`) |

### AI (optional)

| Variable             | Description                                                                 |
| -------------------- | ----------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Enables per-issue **AI fix suggestions** (Claude Haiku) on selected high/critical codes after static + runtime merge; optional AI-enhanced remediation plan |

### Guardrails (optional)

| Variable                                  | Description                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DRYGATE_INPUT_FUZZ`                      | `true` - runs 3 extra executions with varied trigger payloads to test input contract (persistent mode only) |
| `DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST` | Comma-separated credential names that must exist in production (e.g. `Stripe Live,SendGrid Main`)           |
| `DRYGATE_EGRESS_ALLOWLIST`                | Comma-separated hostnames allowed for outbound HTTP (ephemeral mode only, requires mock gateway proxy)      |

---

## Deployment

### Stack

| Service     | Platform               | Cost         |
| ----------- | ---------------------- | ------------ |
| Next.js app | Railway                | ~$2–3/mo     |
| n8n sandbox | Railway (Docker image) | ~$2–3/mo     |
| Database    | Supabase               | Free (500MB) |

Use a **public HTTPS URL** for n8n if private networking to the app is unreliable; set `SANDBOX_N8N_URL` to that URL. See **`docs/DEPLOYMENT.md`** for full detail.

### Step 1 - Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. **Transaction pooler** (often port `6543`) → `DATABASE_URL` (add `?pgbouncer=true` if Prisma reports prepared-statement errors)
3. **Session / direct** (often port `5432`) → `DIRECT_URL` for `prisma db push`

### Step 2 - Railway: n8n service

1. New project → **Dockerfile** from repo **`railway-n8n.dockerfile`** (or equivalent), **or** image `n8nio/n8n:latest` with the same env ideas as the Dockerfile.
2. Add a volume on `/home/node/.n8n` so the instance owner and data survive restarts.
3. **`N8N_SECURE_COOKIE=false`** is set in `railway-n8n.dockerfile` so session cookies work behind Railway’s HTTP proxy.

### Step 3 - Railway: Next.js app

1. **Add Service → GitHub repo** → select this repo
2. Copy variables from **`.env.production.example`** and set **`SANDBOX_N8N_URL`** to a URL the Next service can reach (internal hostname or public n8n URL)
3. **`railway.toml`** start command (non-fatal `db push`, bind **`PORT`**):

```toml
[deploy]
startCommand = "npx prisma db push --skip-generate || echo '[railway] prisma db push failed - check DATABASE_URL / DIRECT_URL env vars' ; npm run start -- -p ${PORT:-3000}"
```

### Environment variables for production (minimal)

```env
NEXT_PUBLIC_APP_URL=https://your-app.up.railway.app

DATABASE_URL=postgresql://...pooler...:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...session...:5432/postgres

SANDBOX_N8N_URL=https://your-n8n.up.railway.app
```

---

## Project structure

```
drygate/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── verify/
│   │   │   │   ├── route.ts          # POST - starts pipeline
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # GET - terminal snapshot
│   │   │   │       └── stream/       # GET - SSE stream
│   │   │   ├── report/[shareToken]/  # Public report API
│   │   │   └── history/
│   │   │       ├── route.ts          # GET list, DELETE all (demo-user)
│   │   │       └── [id]/route.ts     # DELETE one row
│   │   ├── verify/                   # Upload + pipeline UI
│   │   ├── how-it-works/             # Product walkthrough
│   │   ├── report/[shareToken]/      # Shareable report page
│   │   ├── dashboard/                # History + delete controls (client)
│   │   ├── (marketing)/
│   │   │   └── page.tsx              # Landing (/)
│   │   └── layout.tsx                # Header + Footer
│   ├── lib/
│   │   ├── validator/                # Static analysis
│   │   │   ├── index.ts              # Orchestrator + complexity report
│   │   │   ├── classifier.ts         # Coverage: trigger vs blocked; sticky excluded
│   │   │   ├── complexity.ts         # Maintainability complexity score
│   │   │   ├── parser.ts             # Workflow graph parser
│   │   │   └── checks/               # Per-rule modules
│   │   │       ├── structure.ts
│   │   │       ├── credentials.ts
│   │   │       ├── error-handling.ts
│   │   │       ├── loops.ts
│   │   │       ├── expressions.ts
│   │   │       ├── ai.ts
│   │   │       ├── rateLimiting.ts
│   │   │       ├── webhookSecurity.ts
│   │   │       └── inputValidation.ts
│   │   ├── scorer/
│   │   │   └── index.ts              # Scoring engine + bands
│   │   ├── sandbox/
│   │   │   └── controller.ts         # n8n sandbox + node traces
│   │   ├── remediation/
│   │   │   ├── deterministic.ts      # Fix cards + optional AI-enhanced plan
│   │   │   └── categories.ts         # Issue → Security / Reliability / …
│   │   ├── ai/
│   │   │   └── fixSuggestions.ts     # Optional Haiku hints on issues
│   │   ├── guardrails/               # Egress, credential manifest, fuzz
│   │   ├── sse/
│   │   │   └── streams.ts            # SSE fan-out store
│   │   └── db/
│   │       └── index.ts              # Prisma client (+ pooler URL warning)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── report/
│   │   │   └── ReportCategorizedIssues.tsx
│   │   └── ui/
│   │       ├── WorkflowGraph.tsx
│   │       ├── CoverageBreakdown.tsx
│   │       └── ScoreGauge.tsx
│   └── types/
│       └── index.ts                  # All shared types
├── prisma/
│   └── schema.prisma
├── mock-gateway/                     # HTTP proxy (local compose → n8n egress)
│   ├── Dockerfile
│   └── index.js
├── docker-compose.yml                # Local n8n + mock-gateway
├── railway-n8n.dockerfile            # Optional Railway n8n service
├── railway.toml                      # Railway deploy config
└── docs/
    ├── DEPLOYMENT.md
    ├── INTRO.md
    ├── PROJECT.md
    └── GUARDRAILS.md
```

---

## Scoring model

Starts at 100 and deducts per finding.

### Static deductions (selected)

| Issue code                     | Deduction | Notes              |
| ------------------------------ | --------- | ------------------ |
| `MISSING_TRIGGER`              | 25        | Fail-closed        |
| `HARDCODED_SECRET`             | 20        | Fail-closed        |
| `CIRCULAR_DEPENDENCY`          | 20        | Fail-closed        |
| `UNAUTHORIZED_EGRESS_DETECTED` | 40        | Fail-closed        |
| `INPUT_CONTRACT_FAILURE`       | 25        | Capped at 50 total |
| `UNBOUNDED_LOOP`               | 15        |                    |
| `MISSING_ASYNC_TIMEOUT`        | 15        |                    |
| `DISABLED_NODE_IN_PATH`        | 12        |                    |
| `CREDENTIAL_NOT_IN_MANIFEST`   | 12        |                    |
| `MISSING_ERROR_OUTPUT`         | 8         | Capped at 24 total |
| `CREDENTIAL_REF_MISSING`       | 8         |                    |
| `CREDENTIAL_REF_INCONSISTENT`  | 8         |                    |
| `NO_GLOBAL_ERROR_WORKFLOW`     | 10        |                    |
| `DISCONNECTED_NODE`            | 5         | Capped at 20 total |
| `LONG_SYNCHRONOUS_WAIT`        | 5         |                    |
| `LOOP_NO_RATE_LIMITING`        | 18        | Capped at 36 total |
| `SPLIT_IN_BATCHES_NO_WAIT`     | 15        | Capped at 30 total |
| `HTTP_REQUEST_RETRY_DISABLED`  | 8         | Capped at 16 total |
| `SCHEDULE_TOO_AGGRESSIVE`      | 5         | Capped at 5 total  |
| `WEBHOOK_NO_AUTHENTICATION`    | 12        | Capped at 24 total |
| `WEBHOOK_NO_RESPONSE_HANDLING` | 8         | Capped at 16 total |
| `WEBHOOK_EXPOSED_ON_PUBLIC_PATH` | 5       | Capped at 5 total  |
| `AI_PROMPT_INJECTION_RISK`     | 20        | Capped at 40 total |
| `NO_INPUT_VALIDATION`          | 15        | Capped at 30 total |
| `LARGE_DATASET_NO_BATCHING`    | 10        | Capped at 20 total |
| `DESTRUCTIVE_WITH_NO_GUARD`    | 18        | Capped at 36 total |

*(Expression and other codes are defined in `src/lib/scorer/index.ts`.)*

### Runtime deductions

| Issue code                | Deduction   | Notes              |
| ------------------------- | ----------- | ------------------ |
| `NODE_ERRORED_IN_SANDBOX` | 15 per node | Capped at 30 total |

### Blocked coverage penalty

If more than 60% of analyzed nodes are `credential_blocked`, `destructive_blocked`, or `structural_only` (excluding **trigger** nodes and sticky notes, which are not part of coverage), score takes an additional 10-point deduction (low confidence in result).

---

## API

### POST `/api/verify`

Start a verification.

**Body:**

```json
{ "workflow": { "name": "...", "nodes": [...], "connections": {...} } }
```

**Response:**

```json
{ "id": "cuid", "shareToken": "nanoid" }
```

### GET `/api/verify/:id/stream`

SSE stream. The server emits **default `message` events** with JSON bodies shaped as `{ "type": "...", "payload": { ... } }`. Common `type` values:

| `type`                  | When                       |
| ----------------------- | -------------------------- |
| `stage_update`          | Pipeline stage changes     |
| `static_complete`       | Static analysis done       |
| `sandbox_start`         | Sandbox beginning          |
| `sandbox_log`           | Live sandbox log line      |
| `runtime_complete`      | Sandbox execution finished |
| `verification_complete` | Full pipeline done         |
| `pipeline_error`        | Fatal error                |
| `stream_end`            | Stream closing             |

### GET `/api/verify/:id`

Terminal snapshot - final score, issues, reports.

### GET `/api/report/:shareToken`

Public report - no auth required.

### `GET /api/history` · `DELETE /api/history` · `DELETE /api/history/:id`

History for **`userId === "demo-user"`** (matches current app). `DELETE` removes rows from the database; shared report URLs for deleted rows stop working.

### `GET /api/health`

Liveness / diagnostics (deployment debugging).

---

## Known limits

- Scoring is heuristic, not a formal proof of production safety
- Sandbox cannot validate real credentials - integration nodes are usually `credential_blocked`; **workflow triggers** are labeled `trigger`, not blocked, for clearer reporting
- **Ephemeral** Docker-per-request sandbox is **disabled**; use persistent n8n only
- **Egress allowlist** guardrails assume traffic can be observed (mock gateway path); persistent public n8n won’t see the same proxy setup
- Very new n8n exports can still surface import/API quirks - pin n8n if you need a frozen baseline

---

## Roadmap

### Shipped in this codebase

- **Expression static analysis** - null/array/fallback and dead `$node` reference checks across `{{ }}` parameters.
- **Extended static rules** - rate limiting, webhook hardening, input validation, AI agent hygiene, prompt-injection heuristics, workflow complexity metric, categorized issues on the report.
- **Optional AI** - Claude Haiku suggestions on a small set of high/critical issues when `ANTHROPIC_API_KEY` is set.

### Still open

The sandbox still has a **coverage gap** on credential-heavy workflows: most integration nodes stay `credential_blocked`, so simulation coverage is often low. The main lever for higher execution coverage without real secrets is **pinData simulation** (below).

### Layer 1 - pinData simulation

n8n's official `pinData` feature lets you inject synthetic output into any node
so downstream nodes receive it and execute normally. This is exactly what the
n8n editor uses for testing.

For every credential-blocked node in a workflow, Drygate will generate
realistic synthetic output based on the node type - Gmail returns a message
object, Postgres returns rows, OpenAI returns a completion - and inject it as
`pinData`. The full downstream chain then executes against real data flow.

Estimated coverage improvement: 8% → 70–90% on typical integration workflows.
No credentials required. No Docker required. Works on Vercel.

The pinData generator needs coverage for approximately 30 node types to cover
80% of community workflows.

### Layer 2 - AI simulation (workflow-wide)

For workflows where even pinData cannot produce meaningful coverage (complex
branching, dynamic expressions, AI agent chains), Drygate will send the full
workflow JSON plus node type registry to Claude and ask it to:

- Trace data flow through the execution graph with realistic synthetic inputs
- Identify expressions that will fail under specific payload shapes
- Predict which branches are unreachable given the trigger configuration
- Surface logic errors that neither static analysis nor execution catches

This produces findings similar to runtime traces without requiring any
execution. One API call per workflow.

### Layer 3 - Security expression scanning

n8n has had five critical RCE vulnerabilities in the last four months
(CVE-2025-68613, CVE-2026-27577, CVE-2026-27493, CVE-2026-27495,
CVE-2026-27497) - all from unsafe expression evaluation. Over 100,000
vulnerable instances were identified on the internet.

Drygate will add a dedicated security layer:

- Scan every `{{ }}` expression for patterns matching known injection vectors
- Flag Code nodes using constructs that have historically enabled sandbox
  escapes (prototype chain access, `process.mainModule`, `child_process`)
- Flag Form trigger nodes exposed publicly (the CVE-2026-27493 attack surface)
- Check workflow metadata for n8n version references against the known CVE
  timeline

This turns Drygate from a quality gate into a security gate - a distinct value
proposition for enterprise teams running self-hosted n8n at scale.

### Coverage projection

| Layer                     | Status / goal                          | Applies to                               |
| ------------------------- | -------------------------------------- | ---------------------------------------- |
| Static + expressions      | **Shipped**                            | 100% of workflows                        |
| pinData simulation        | Planned — higher sandbox coverage      | Credential-heavy workflows               |
| AI simulation (full graph)| Planned                                | Complex branching                        |
| Security expression scan  | Planned — deeper than current heuristics | All workflows                        |

Per-issue **AI suggestions** (Haiku) are already available for a subset of codes when `ANTHROPIC_API_KEY` is set.

---

## License

MIT

---

_Drygate - Ship n8n workflows without guessing._
