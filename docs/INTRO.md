# Drygate — Project introduction

**Who this is for:** Anyone landing on the repo for the first time — teammates, judges, contributors, or future you. It explains *what* Drygate is and *why* it exists at a high level. For architecture, file map, and deep dives, see **[PROJECT.md](./PROJECT.md)**. For Railway, Supabase, and n8n deployment, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## What is Drygate?

**Drygate** is a **readiness gate for n8n workflows**. You give it an exported n8n workflow (JSON — paste or upload). It runs a **verification pipeline** that combines:

1. **Parsing** — validate that the JSON is a usable workflow.
2. **Static analysis** — graph structure, security-style checks, best-practice rules (no live secrets validation in sandbox).
3. **Sandbox execution** — the workflow is loaded into a real **n8n** instance, triggers are coerced so a run can start deterministically, and the app records what actually executed.
4. **Scoring** — a **0–100 readiness score** and a **band** (e.g. production-ready vs not), driven by static + runtime findings.
5. **Remediation** — an ordered, human-readable **fix plan** derived from the issues.

Results appear in the UI with **live progress** (Server-Sent Events) and a **shareable report link** so others can open the same outcome without repeating the run.

---

## The problem

Teams ship **n8n automation** as JSON: triggers, HTTP calls, integrations, and branches wired together. In practice:

- Workflows are **large and easy to misread**; review does not scale.
- **Static JSON can look fine** while nodes **fail at runtime** (data shape, version quirks, missing credentials).
- Issues like **broken topology**, **hardcoded secrets**, **weak error handling**, or **risky outbound calls** often surface **only after** production or a bad deploy.

There is rarely one place that answers: *“If we run this once in a controlled n8n, with static checks on top, would we still trust it?”*

**Drygate’s goal:** make that question **repeatable** — same pipeline every time, with a **clear score**, **actionable remediation**, and a **linkable report**.

---

## How it solves it (conceptually)

| Layer | Role |
|--------|------|
| **Rules engine** | Deterministic checks over the workflow graph and parameters; outputs structured **issues** (severity, codes, node context). |
| **Sandbox** | A real n8n (persistent URL or optional Docker-per-run) executes the workflow; the app maps execution data back to **coverage** and **runtime traces**. |
| **Scorer** | Turns issues + runtime signals into one **number** and **band** so humans get a simple signal, not only a long list. |
| **Persistence** | Runs are stored (e.g. PostgreSQL via Prisma); each run gets a **share token** for public-style report URLs. |

The product is intentionally **opinionated as a gate**: it is not a full n8n replacement or a general workflow IDE — it is **verify → score → report → remediate**.

---

## What’s in the box (tech, briefly)

- **Next.js (App Router)** — UI, API routes, report pages.
- **Prisma + PostgreSQL** — verifications, scores, stored reports (e.g. Supabase in production).
- **n8n** — pinned or version-aligned image for predictable REST behavior; optional **mock gateway** in Docker for egress visibility in local/ephemeral setups.
- **SSE** — stream pipeline stages and optional technical logs to the verify page.

---

## How to try it quickly

1. Clone the repo, install dependencies, set **`DATABASE_URL`** / **`DIRECT_URL`** (see `.env.local.example` / `.env.production.example`).
2. Run **`docker compose up -d`** if you use the bundled n8n + mock gateway locally.
3. Set **`SANDBOX_N8N_URL`** to that n8n base URL (e.g. `http://localhost:5678`) on the Next app.
4. **`npm run dev`** → open **`/verify`**, paste workflow JSON, run verification, open the report when finished.

Details and production notes: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## Where to read next

| Doc | Purpose |
|-----|---------|
| **[PROJECT.md](./PROJECT.md)** | Full handbook: pipeline stages, scoring intuition, key files, local vs persistent sandbox. |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Railway, Supabase, n8n service, env vars. |
| **[GUARDRAILS.md](./GUARDRAILS.md)** | Optional strict checks (fuzz, allowlists, etc.). |
| **Root [README.md](../README.md)** | Commands and short project blurb. |

---

## Disclaimer (important)

The **readiness score is heuristic**. It combines static rules and at least one sandbox run; it does **not** prove formal safety or cover every production scenario (credentials, data, load, n8n upgrades). Use it as a **strong pre-flight signal**, not a substitute for your own policies and testing.
