# Drygate — Project handbook

**Audience:** Engineers, reviewers, or operators who are new to this repository and want **ground-zero** context: why the product exists, how it solves the problem, and how the current codebase implements that solution.

**Related docs:** Operational guardrail details live in [`GUARDRAILS.md`](./GUARDRAILS.md). Day-to-day commands and a shorter technical overview are in the root [`README.md`](../README.md).

---

## 1. What Drygate is (in one paragraph)

**Drygate** is a **production-readiness gate** for **n8n** automation workflows. A user supplies workflow JSON (paste or file upload). The system **parses** it, runs **deterministic static checks**, performs **at least one controlled execution** inside an **isolated or dedicated n8n sandbox**, merges static and runtime findings into a **single score (0–100)** and **band**, generates a **prioritized remediation plan**, and exposes results through the UI plus a **shareable report link**. Progress is streamed live to the browser using **Server-Sent Events (SSE)**.

---

## 2. The problem (why this exists)

### 2.1 Context

n8n workflows are graphs of **nodes** (triggers, HTTP calls, transforms, integrations) wired by **connections**. Teams export workflows as JSON and promote them across environments. In practice, many workflows are **never formally verified** before production.

### 2.2 Concrete failure modes

| Category | What goes wrong | Business / ops impact |
|----------|-----------------|------------------------|
| **Structure** | Disconnected nodes, missing triggers, broken graph topology | Silent no-ops, partial runs, “works on my machine” |
| **Secrets** | Hardcoded API keys, tokens in parameters | Credential leaks, audit failure, incident response |
| **Credentials** | References to credential names that exist in dev but not prod | Deploy-time breakage, manual firefighting |
| **Resilience** | No error branches, no global error workflow | Single node failure stops or corrupts the chain |
| **Loops & waits** | Unbounded loops, long or unbounded HTTP / wait nodes | Worker exhaustion, cost spikes, stuck executions |
| **Runtime reality** | Static JSON looks fine but nodes error on real data | Production incidents after go-live |
| **Outbound access** | HTTP nodes call unexpected hosts or raw IPs | Data exfiltration risk, compliance violations |
| **Input shape** | Webhook/API payloads change (nulls, missing fields) | Intermittent failures that are hard to reproduce |

### 2.3 Why manual review is not enough

- Workflow JSON is **large** and **easy to misread** at scale.
- **Runtime behavior** depends on n8n version, node versions, and data — reviewers rarely execute every path.
- There is no single place that combines **static risk**, **one real execution**, and a **numeric gate** unless you build it.

**Drygate’s problem statement:** Give teams a **repeatable, automatable pipeline** that approximates “would we trust this in production?” by combining **static analysis + sandbox execution + scoring + remediation**, with **live feedback** and **shareable reports**.

---

## 3. How Drygate solves it (solution design)

The solution is intentionally **layered**. Each layer addresses a different part of the problem; together they form a **verification pipeline**.

### 3.1 Parse and normalize

**Problem:** Invalid or non-workflow JSON must fail fast with clear errors.

**Solution:** The API accepts several JSON shapes (`workflow`, `workflowJson`, `data`, or a raw workflow object). A dedicated **parser** validates expected fields (e.g. `nodes`, `connections`) and builds an internal model used by all later stages.

**Where:** `src/lib/validator/parser.ts`, orchestration in `src/lib/validator/index.ts`, entry in `src/app/api/verify/route.ts`.

### 3.2 Static analysis (deterministic rules)

**Problem:** Structural and policy issues should be caught **without** running n8n.

**Solution:** Modular **checks** (structure, credentials references, error handling, loops, performance/async hints) emit a list of **issues** with **codes**, **severity**, **node context**, and **remediation hints**. A **classifier** labels each node by how well it can be simulated in a sandbox (e.g. fully runnable vs credential-blocked vs destructive-blocked).

**Where:** `src/lib/validator/checks/`, `src/lib/validator/classifier.ts`, `src/lib/validator/index.ts`.

### 3.3 Scoring and bands

**Problem:** Humans need a **simple signal** (number + label), not only a raw issue list.

**Solution:** A **deduction-based scorer** starts from a perfect score and subtracts for each finding, with **per-code caps**, **fail-closed** rules for critical classes (e.g. missing trigger, hardcoded secrets), and **runtime** deductions for nodes that error in the sandbox. The result maps to a **score band** (e.g. production_ready vs not_ready).

**Where:** `src/lib/scorer/index.ts`.

### 3.4 Sandbox execution

**Problem:** Static analysis cannot prove that nodes **execute** correctly with real n8n behavior.

**Solution:** The **sandbox controller** imports the workflow into n8n, coerces common **triggers** to a **manual trigger** so execution is **repeatable**, runs the workflow via n8n’s REST APIs (with version-specific fallbacks), polls **executions**, and builds a **runtime report** (per-node traces, simulation coverage, optional egress logs in ephemeral setups).

**Two deployment modes:**

| Mode | When | Behavior |
|------|------|----------|
| **Persistent** | `SANDBOX_N8N_URL` points at a long-lived n8n (e.g. local Docker Compose) | Faster iteration; no per-request container lifecycle |
| **Ephemeral** | URL unset | Docker network + **n8n** + **mock gateway** per run; stronger isolation; egress can be logged through the gateway |

**Where:** `src/lib/sandbox/controller.ts`, `docker-compose.yml`, `mock-gateway/`.

### 3.5 Guardrails (production-oriented checks)

**Problem:** One happy-path run is insufficient; prod differs (credentials, egress, input shapes).

**Solution:** Optional **env-driven** guardrails: input **fuzz** variants on the manual trigger, **credential name allowlist** against exported references, **egress allowlist** when traffic is visible to the mock gateway, and static **timeout** hints on risky nodes. Issues merge into the static report and scorer.

**Where:** `src/lib/guardrails/`, `docs/GUARDRAILS.md`.

### 3.6 Remediation

**Problem:** A score without **actionable next steps** does not shorten time-to-fix.

**Solution:** A **deterministic** remediation generator turns issues into ordered **cards** (priority, effort estimate, steps) for the UI and API consumers.

**Where:** `src/lib/remediation/deterministic.ts`.

### 3.7 Persistence, sharing, and live UX

**Problem:** Users need **history**, **live progress**, and a **link** stakeholders can open without logging in as the same user.

**Solution:**

- Each run creates a **`Verification`** row in the database (status, scores, JSON payloads, errors, **shareToken**).
- The server pushes **SSE events** (stages, sandbox logs, completion/error) keyed by verification id; late subscribers get a **short replay buffer**.
- The **`POST /api/verify`** response returns **`id`** (verification id) and **`shareToken`**; the UI opens **`/report/[shareToken]`** after completion.

**Where:** `prisma/schema.prisma`, `src/lib/sse/streams.ts`, `src/app/api/verify/route.ts`, `src/app/api/verify/[id]/stream/route.ts`, `src/app/verify/page.tsx`, `src/app/report/[shareToken]/page.tsx`.

### 3.8 Auth (optional)

**Problem:** Internal deployments may require signed-in users; demos may not have Clerk configured.

**Solution:** **Clerk** protects routes when a real publishable key is set; otherwise the verify API can use a **demo user** path so local development still works. The **Header** avoids Clerk hooks when Clerk is not configured.

**Where:** `src/app/layout.tsx`, `src/app/api/verify/route.ts`, `src/components/layout/Header.tsx`.

---

## 4. End-to-end flow (mental model)

```
User (browser)
    │
    ├─► POST /api/verify  { workflow: <n8n JSON> }
    │         │
    │         ├─► Prisma: create Verification (pending), clear SSE buffer
    │         ├─► Return { id, shareToken } immediately
    │         └─► Background: pipeline runs…
    │                 ├─► stage_update (parsing → static → sandbox → remediation)
    │                 ├─► sandbox_log lines
    │                 ├─► static_complete / runtime paths
    │                 └─► verification_complete OR pipeline_error
    │                 └─► stream_end
    │
    ├─► GET /api/verify/:id/stream  (EventSource, default "message" events)
    │
    └─► Navigate to /report/:shareToken  (human-readable report)
```

**Authoritative JSON snapshot** for integrations: `GET /api/verify/:id`.

---

## 5. Technology stack (every major tool and why)

### 5.1 Runtime and language

| Technology | Role in Drygate |
|------------|-----------------|
| **Node.js** | Server runtime for Next.js API routes and sandbox orchestration |
| **TypeScript** | Typed codebase for validator, scorer, API, and UI |

### 5.2 Web application

| Technology | Role |
|------------|------|
| **Next.js 14 (App Router)** | Full-stack framework: React pages (`src/app/...`), API routes (`src/app/api/...`), layouts, metadata |
| **React 18** | UI components and client islands (`"use client"` where needed) |
| **Tailwind CSS** | Utility-first styling aligned with design tokens in `globals.css` |
| **PostCSS + Autoprefixer** | CSS pipeline for Tailwind |

### 5.3 Data

| Technology | Role |
|------------|------|
| **Prisma** | ORM and migrations workflow; schema in `prisma/schema.prisma` |
| **SQLite** (default) | Embedded DB via `DATABASE_URL`; stores verification rows and JSON blobs |

### 5.4 Auth

| Technology | Role |
|------------|------|
| **Clerk (`@clerk/nextjs`)** | Optional user sessions and `UserButton`; gated when env keys are real |

### 5.5 Sandbox and HTTP

| Technology | Role |
|------------|------|
| **Docker / Docker Compose** | Persistent n8n (+ optional mock-gateway) for local sandboxes |
| **dockerode** | Programmatic Docker control for **ephemeral** sandbox networks and containers |
| **axios** | HTTP client for n8n REST calls from the controller |
| **mock-gateway** (Node HTTP proxy) | Logs outbound requests in ephemeral topologies for egress policy |

### 5.6 Validation and utilities

| Technology | Role |
|------------|------|
| **zod** | Runtime schema validation where used (e.g. defensive parsing) |
| **nanoid** | URL-safe **shareToken** generation |
| **clsx** + **tailwind-merge** | Conditional class names (`cn()` helper in `src/lib/utils`) |

### 5.7 UI extras (graphs / motion)

| Technology | Role |
|------------|------|
| **React Flow / @reactflow/core / reactflow** | Workflow or graph visualization where used in the app |
| **framer-motion** | Motion and transitions on marketing or interactive UI |

### 5.8 Dev dependencies

| Technology | Role |
|------------|------|
| **typescript**, **@types/*** | Typing |
| **prisma** CLI | `db push`, `generate`, Studio |
| **tailwindcss** | Build-time Tailwind |

---

## 6. Repository map (where to look first)

| Path | Responsibility |
|------|----------------|
| `src/app/layout.tsx` | Root layout, global CSS import, optional `ClerkProvider`, **`<Header />`** |
| `src/app/page.tsx` | Landing / marketing home |
| `src/app/verify/page.tsx` | Verify UI: upload/paste, `POST /api/verify`, SSE `message` handler, redirect to report |
| `src/app/report/[shareToken]/page.tsx` | Server-rendered shareable report (fetches `GET /api/report/:token`) |
| `src/app/dashboard/page.tsx` | History / listing (uses history API) |
| `src/app/api/verify/route.ts` | **Pipeline orchestration** (background task after POST) |
| `src/app/api/verify/[id]/route.ts` | JSON snapshot for one verification |
| `src/app/api/verify/[id]/stream/route.ts` | SSE stream + replay + completion polling |
| `src/app/api/report/[shareToken]/route.ts` | Report JSON for share links |
| `src/app/api/history/route.ts` | Past verifications for dashboard |
| `src/lib/validator/` | Parse, classify, static checks |
| `src/lib/scorer/index.ts` | Score + band computation |
| `src/lib/remediation/deterministic.ts` | Remediation cards |
| `src/lib/sandbox/controller.ts` | n8n import, run, poll, runtime report |
| `src/lib/sse/streams.ts` | In-memory SSE fan-out + bounded history |
| `src/lib/guardrails/` | Egress policy, manifest, fuzz orchestration hooks |
| `src/lib/db/index.ts` | Prisma client singleton |
| `src/types/index.ts` | Shared TypeScript types (issues, bands, remediation) |
| `src/components/ui/*` | Reusable UI: gauges, cards, badges, remediation accordion |
| `src/components/layout/Header.tsx` | Global nav + auth affordances |
| `globals.css` | Design tokens, glass styles, buttons, typography |
| `docker-compose.yml` | Persistent **n8n** (+ **mock-gateway** on `sandbox-net`) |
| `mock-gateway/` | Egress logging sidecar for advanced sandbox setups |
| `public/sample-workflow.json` | Demo / fixture workflow |
| `docs/GUARDRAILS.md` | Deep dive on fuzz, credential manifest, egress, timeouts |

---

## 7. Data model (what gets stored)

**Model:** `Verification` (`prisma/schema.prisma`)

| Field (conceptual) | Purpose |
|--------------------|---------|
| `id` | Primary key; used in `/api/verify/:id` and SSE |
| `shareToken` | Public opaque token; used in `/report/:shareToken` |
| `userId` | Owner when Clerk (or demo path) applies |
| `workflowName`, `nodeCount` | Summary metadata |
| `status` | Lifecycle: e.g. `pending` → `static_done` → `sandbox_running` → `runtime_done` or `failed` |
| `readinessScore`, `scoreband` | Final grading |
| `simulationCoverage` | % of runnable nodes exercised in sandbox |
| `staticReportJson`, `runtimeReportJson`, `remediationJson` | Serialized reports |
| `pipelineError` | Human-readable failure when sandbox/pipeline cannot complete normally |

---

## 8. Environment variables (orientation)

Exact names should be taken from `.env.local.example` (if present) and [`README.md`](../README.md). Conceptual groups:

| Group | Examples | Purpose |
|-------|----------|---------|
| **Database** | `DATABASE_URL` | Prisma / SQLite path |
| **App URL** | `NEXT_PUBLIC_APP_URL`, `VERCEL_URL` | Absolute URLs for server-side fetch (e.g. report page) |
| **Clerk** | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, secret key | Auth when enabled |
| **Sandbox** | `SANDBOX_N8N_URL`, `SANDBOX_N8N_API_KEY`, `SANDBOX_USER`, `SANDBOX_PASS` | Target n8n and basic auth |
| **Guardrails** | `DRYGATE_INPUT_FUZZ`, `DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST`, `DRYGATE_EGRESS_ALLOWLIST` | Optional production gate behavior |

---

## 9. API contract (for integrators)

| Method | Path | Returns / behavior |
|--------|------|---------------------|
| `POST` | `/api/verify` | **`{ id, shareToken }`**; pipeline continues in background |
| `GET` | `/api/verify/:id` | Full JSON snapshot (status, score, reports, `pipelineError`) |
| `GET` | `/api/verify/:id/stream` | `text/event-stream`; each event is `data: { type, payload, ... }` |
| `GET` | `/api/report/:shareToken` | Report JSON for the share page |
| `GET` | `/api/history` | List past runs (see route for auth rules) |

**SSE event types** (non-exhaustive): `stage_update`, `sandbox_log`, `static_complete`, `sandbox_start`, `runtime_complete`, `verification_complete`, `pipeline_error`, `stream_end`. The verify UI listens on the **`message`** event (unnamed SSE events).

---

## 10. What Drygate does **not** claim (limits)

- **Not a formal proof** of security or correctness — scoring is **heuristic** and tunable in `src/lib/scorer/index.ts`.
- **Does not validate real tenant secrets** inside n8n — credential-dependent nodes may be **blocked** or partially simulated; manifest checks are **declarative**.
- **n8n version / node compatibility** matters; unsupported or mismatched nodes may fail at import or execute time.
- **Egress policy** requires **visibility** into HTTP (ephemeral + mock gateway or equivalent); persistent n8n without a logging proxy may not produce egress interceptions.
- **Ephemeral vs persistent** feature parity may differ (e.g. some fuzz paths are documented as persistent-only in `GUARDRAILS.md`).

---

## 11. Onboarding checklist (new developer)

1. Read **sections 2–3** of this document (problem + solution).
2. Clone the repo, `npm install`, copy env from example, `npm run db:push`, `npm run db:generate`.
3. Start **persistent n8n** (`docker compose up -d`) or plan for **ephemeral** Docker.
4. Run `npm run dev`, open **`/verify`**, upload `public/sample-workflow.json`.
5. Trace one request: **`route.ts`** (POST) → validator → scorer → sandbox → SSE → report page.
6. Read **`docs/GUARDRAILS.md`** before changing scoring or sandbox behavior.

---

## 12. Glossary

| Term | Meaning |
|------|---------|
| **Readiness score** | Integer 0–100 after deductions and caps |
| **Score band** | Label such as `production_ready`, `needs_minor_fixes`, `significant_issues`, `not_ready` |
| **Simulation coverage** | Approximate % of runnable nodes that executed successfully in sandbox |
| **Fail-closed** | Certain issue types cap the score (e.g. at 40) regardless of other positives |
| **Degraded sandbox** | Sandbox threw; static findings may remain but `status`/`pipelineError` reflect failure |
| **Share token** | Opaque id for public report URLs |
| **Trigger coercion** | Replacing webhook/schedule triggers with manual trigger for deterministic runs |

---

*This handbook describes the **intent** and **current implementation** of the Drygate repository. When code and docs diverge, treat the source files listed in section 6 as authoritative and update this document in the same change.*
