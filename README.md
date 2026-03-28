# Drygate

**Drygate** is a production-readiness verifier for **n8n workflows**. Users upload or paste exported workflow JSON; the system runs **static analysis**, executes the workflow in a **sandboxed n8n instance**, computes a **readiness score** and **band**, and returns **remediation guidance** and a **shareable report**.

This document is technical: architecture, pipeline logic, grading rules, conditional behavior, outputs, and operational limits.

---

## 1. Problem statement

Teams ship n8n workflows that are **structurally fragile** (disconnected nodes, missing triggers), **unsafe** (hardcoded secrets, unbounded loops), **operationally risky** (no error handling, credential drift), or **unverified at runtime** (nodes never exercised). Drygate automates a **repeatable gate**: parse → static checks → **one controlled execution** in isolation → score → fixes.

---

## 2. High-level architecture

| Layer | Role |
|--------|------|
| **Next.js 14 (App Router)** | UI (`/verify`, `/report`, `/dashboard`), API routes |
| **Prisma + SQLite** | `Verification` records: status, scores, JSON payloads, errors |
| **Clerk** | Auth when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is a real key; otherwise a demo user path can apply (see `src/app/api/verify/route.ts`) |
| **Validator** | Deterministic static rules (`src/lib/validator/`) |
| **Scorer** | Deduction-based score + bands (`src/lib/scorer/index.ts`) |
| **Sandbox** | n8n execution via **persistent URL** (`SANDBOX_N8N_URL`) or **ephemeral Docker** (`dockerode` + per-run containers + mock gateway) (`src/lib/sandbox/controller.ts`) |
| **SSE** | Server-Sent Events for live pipeline + sandbox logs (`src/lib/sse/streams.ts`, `/api/verify/[id]/stream`) |
| **Remediation** | Deterministic plan from issues (`src/lib/remediation/`) |

---

## 3. Verification pipeline (ordered stages)

The pipeline is implemented in `src/app/api/verify/route.ts` (background task after `POST /api/verify`).

### 3.1 Normal (always executed) steps

1. **Parsing**  
   - Accepts JSON body: `workflow`, `workflowJson`, `data`, or raw workflow object.  
   - Validates shape (`nodes` array, `connections` object) via `validateWorkflow` → `parseWorkflow` / checks.

2. **Static analysis**  
   - Modules: **structure**, **credentials**, **error_handling**, **loops**, **performance** (`src/lib/validator/index.ts`).  
   - Produces `StaticReport`: `issues[]`, `coverageClassification[]`, `checksRun`, `passedChecks`, `failedChecks`, node counts.

3. **Score (static-only)**  
   - `computeScore({ issues, coverage, runtimeReport: null })` — used to persist an interim score after static analysis (then superseded after sandbox unless sandbox fails in a degraded path).

4. **Sandbox execution**  
   - `runSandbox(verificationId, workflow, coverage, onLog)` imports workflow into n8n, runs it, polls execution, builds `RuntimeReport` (traces, `simulationCoverage`, optional egress data in ephemeral mode).

5. **Score (static + runtime)**  
   - `computeScore({ issues, coverage, runtimeReport })` — **final** `readinessScore` / `scoreband` for successful runs.

6. **Remediation**  
   - `generateRemediationPlan(report.issues)` — ordered fix cards (deterministic; optional AI hooks may exist in env).

7. **Persistence + SSE**  
   - Updates Prisma `Verification`, broadcasts completion or error events.

### 3.2 Conditional / branching behavior

| Condition | Behavior |
|-----------|----------|
| **`SANDBOX_N8N_URL` set** (e.g. `http://localhost:5678`) | **Persistent sandbox**: HTTP to long-lived n8n; no per-request Docker network/container for n8n. |
| **`SANDBOX_N8N_URL` unset** | **Ephemeral sandbox**: creates Docker network, **mock gateway** container, **n8n** container with random host port, tears down after run. |
| **Sandbox throws** | **Degraded runtime**: empty/minimal `runtimeReport` with `sandboxError`, `simulationCoverage: 0`; score still computed from static + empty traces; **`status: "failed"`**, **`pipelineError`** set; SSE `pipeline_error`. |
| **Sandbox succeeds** | **`status: "runtime_done"`**, `runtimeReportJson` populated, `pipelineError: null`. |
| **Clerk** | If publishable key missing or placeholder, auth may resolve to a demo user (see route). If Clerk enabled and no user → `401` on `POST /api/verify`. |

### 3.3 Sandbox-specific techniques

- **Trigger coercion**: Webhook/chat/schedule-style triggers are rewritten to `n8n-nodes-base.manualTrigger` for deterministic execution (`transformWorkflowForManualExecution`), preserving node `id` / `name` for trace mapping.
- **n8n 2.x manual run**: `POST /rest/workflows/:id/run` uses a body with `destinationNode: { nodeName, mode: "inclusive" }` (DB-backed workflow); legacy n8n 1.x-style payload is retried on failure.
- **Public API fallback**: Optional `POST /api/v1/workflows/:id/run` / `.../execute` with optional `SANDBOX_N8N_API_KEY`.
- **Ephemeral mode**: Outbound HTTP from n8n can be routed through a **mock gateway** for egress logging (destructive/side-effect control in design).

---

## 4. Grading model

Implementation: `src/lib/scorer/index.ts`.

### 4.1 Principle

- Start from **100** conceptual points.  
- **Subtract** per finding using **issue codes** (static) and **sandbox node errors** (runtime).  
- Apply **per-code caps** so repeated issues (e.g. many disconnected nodes) cannot zero the score.  
- Apply **fail-closed cap** for critical classes.  
- Apply **blocked-coverage penalty** when most nodes cannot be meaningfully simulated.

### 4.2 Score bands (`scoreband`)

| Band | Score | Typical meaning |
|------|-------|-----------------|
| `production_ready` | **85–100** | Strong readiness |
| `needs_minor_fixes` | **65–84** | Fixable gaps |
| `significant_issues` | **40–64** | Major work needed |
| `not_ready` | **0–39** | Not suitable as-is |

There is **no separate `isDeployable` flag** in the schema; product meaning is conveyed by **`readinessScore`**, **`scoreband`**, **`status`**, and **`pipelineError`**.

### 4.3 Static issue deductions (selected)

Default deduction per occurrence; unknown codes default to **5**. Partial codes have **maximum total deduction per code** (e.g. `DISCONNECTED_NODE` capped at 20 total).

| Code | Points (indicative) | Notes |
|------|---------------------|--------|
| `MISSING_TRIGGER` | 25 | **Fail-closed** (see below) |
| `HARDCODED_SECRET` | 20 | **Fail-closed** |
| `CIRCULAR_DEPENDENCY` | 20 | **Fail-closed** |
| `DISABLED_NODE_IN_PATH` | 12 | |
| `MISSING_ERROR_OUTPUT` | 8 | Capped total per code |
| `CREDENTIAL_REF_MISSING` / `CREDENTIAL_REF_INCONSISTENT` | 8 | |
| `UNBOUNDED_LOOP` | 15 | |
| `DISCONNECTED_NODE` | 5 | Capped total per code |
| `NO_GLOBAL_ERROR_WORKFLOW` | 10 | |
| `LONG_SYNCHRONOUS_WAIT` | 5 | |
| `LARGE_PAYLOAD_RISK` | 3 | Capped total per code |

### 4.4 Runtime deductions

- **`NODE_ERRORED_IN_SANDBOX`**: **15** per errored node trace, with a **total cap** for that code (e.g. 30).

### 4.5 Additional rules

- **Blocked ratio penalty**: If **> 60%** of nodes are classified `credential_blocked`, `destructive_blocked`, or `structural_only`, add **10** points deduction (low confidence in score).  
- **Fail-closed**: If any issue is `MISSING_TRIGGER`, `HARDCODED_SECRET`, or `CIRCULAR_DEPENDENCY`, **final score is capped at 40** (even if arithmetic would be higher), with `failClosedTriggered` / `failClosedReason` in the breakdown.

### 4.6 Node coverage (inputs to scorer)

`src/lib/validator/classifier.ts` assigns each node a **class** (e.g. fully simulatable, mock-intercepted HTTP, credential-dependent blocked, destructive blocked, structural-only). This feeds both **reporting** and the **blocked-ratio** penalty.

---

## 5. Data model (`Verification`)

`prisma/schema.prisma`:

- **`status`**: e.g. `pending` → `static_done` → `sandbox_running` → **`runtime_done`** | **`failed`**.  
- **`readinessScore`**, **`scoreband`**: final values after pipeline (static-only score overwritten when runtime completes).  
- **`simulationCoverage`**: fraction of runnable nodes that ran in sandbox (0–100).  
- **`staticReportJson`**, **`runtimeReportJson`**, **`remediationJson`**: JSON strings.  
- **`pipelineError`**: set when sandbox or pipeline fails fatally (e.g. n8n unreachable).  
- **`shareToken`**: public report link key.

---

## 6. User-facing outputs

### 6.1 Live UI (`/verify`)

- **SSE stream** (`/api/verify/[id]/stream`): stages, sandbox logs, completion or `pipeline_error`. Buffered replay for late subscribers (`src/lib/sse/streams.ts`).  
- **Stage cards**: parsing, static analysis, sandbox, remediation.  
- **Score gauge**, **band label**, **Production Gate** copy (static + runtime).  
- **Terminal-style sandbox logs** (capped length client-side).

### 6.2 API

- **`POST /api/verify`**: body with workflow JSON; returns `verificationId` and related ids for streaming.  
- **`GET /api/verify/[id]`**: authoritative terminal snapshot (status, score, reports, `pipelineError`).  
- **`GET /api/verify/[id]/stream`**: SSE.  
- **`GET /api/report/[shareToken]`** (and page **`/report/[shareToken]`**): shareable read-only report.

### 6.3 What the user “gets”

- A **numeric score** and **band**.  
- **Issue list** with severities and codes (static).  
- **Runtime traces** (per node success/error) when sandbox succeeds.  
- **Simulation coverage** percentage.  
- **Remediation plan** (deterministic steps).  
- **Share link** via `shareToken`.  
- If sandbox fails: **error message** in `pipelineError` and degraded runtime data — score still reflects static findings, but **`status: failed`** indicates the pipeline did not complete runtime verification.

---

## 7. System capabilities and limits

**Capabilities**

- Deterministic **static** rules across graph structure, credentials references, error handling, loops, and basic performance smells.  
- **One-shot sandbox execution** with trigger coercion for repeatable runs.  
- **Optional** persistent n8n (demo-friendly) vs **full Docker** isolation (egress gateway in ephemeral design).  
- **Real-time** progress via SSE + **history replay**.

**Limits (inherent)**

- Scoring is **heuristic**, not a formal proof of production safety.  
- Sandbox cannot validate **real credentials** or **tenant-specific** data; credential-dependent nodes are often **blocked** or partially simulated.  
- **n8n version** must support imported node types; mismatched templates may fail at import/execute.  
- **Fail-closed** and **blocked-ratio** rules intentionally pessimistic for demo/security narrative.

---

## 8. Running locally (minimal)

1. **Dependencies**: Node.js, `npm install`.  
2. **Environment**: copy `.env.local.example` → `.env.local` (or use `.env`). Set `DATABASE_URL`, Clerk keys if using auth, `NEXT_PUBLIC_APP_URL`.  
3. **Database**: `npm run db:push` (SQLite by default).  
4. **Sandbox** (choose one):  
   - **Persistent**: `docker compose up -d` in repo root (see `docker-compose.yml`), set `SANDBOX_N8N_URL=http://localhost:5678`, optional `SANDBOX_N8N_API_KEY` for n8n 2.x public API.  
   - **Ephemeral**: Docker Desktop running; controller pulls/builds images as needed.  
5. **App**: `npm run dev` → open `/verify`.

---

## 9. Production guardrails (credential manifest, egress, fuzz, timeouts)

See **`docs/GUARDRAILS.md`** for technical rationale, env vars (`DRYGATE_*`), and known limits.

---

## 10. Key source files

| Area | Path |
|------|------|
| Pipeline orchestration | `src/app/api/verify/route.ts` |
| Static validation | `src/lib/validator/` |
| Scoring | `src/lib/scorer/index.ts` |
| Sandbox | `src/lib/sandbox/controller.ts` |
| SSE | `src/lib/sse/streams.ts`, `src/app/api/verify/[id]/stream/route.ts` |
| Types / bands | `src/types/index.ts` |
| Mock gateway (ephemeral) | `mock-gateway/` |

---

## 11. Glossary

| Term | Meaning |
|------|--------|
| **Readiness score** | 0–100 after deductions + caps |
| **Score band** | `production_ready` / `needs_minor_fixes` / `significant_issues` / `not_ready` |
| **Simulation coverage** | % of runnable nodes that executed in sandbox |
| **Fail-closed** | Certain issue types cap score at 40 |
| **Degraded sandbox** | Runtime failed; static score may remain, `pipelineError` set |

---

*Generated for the Drygate codebase. Adjust thresholds and copy in `src/lib/scorer/index.ts` and UI components if product requirements change.*
