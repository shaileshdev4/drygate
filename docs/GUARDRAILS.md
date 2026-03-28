# Production guardrails (technical)

This document explains **what was implemented**, **why it is technically valid**, and **limits**.

## 1. Input contract fuzzing (multi-run)

**Problem addressed:** A single successful sandbox run only proves the workflow works for **one** payload shape. Production breaks when webhooks/APIs omit fields or change types.

**Implementation:** When `DRYGATE_INPUT_FUZZ=true` and **persistent** sandbox is used, after the baseline execution Drygate runs up to **three** additional executions with different `pinData` on the coerced Manual Trigger:

- Empty object `{}`
- Empty string probe field
- Empty `items` array

If **any** variant produces a **node error** in traces, we emit `INPUT_CONTRACT_FAILURE` (deducted in scorer; total cap per code).

**Why this is valid technically**

- n8n’s manual run API accepts **legacy** payloads that include `workflowData.pinData`, which forces deterministic input into the trigger without external HTTP.
- We reuse the same **node id/name** mapping as the baseline run so traces stay comparable.

**Limits**

- **Ephemeral** Docker mode does not run fuzz yet (same API could be wired later).
- This is **not** a full JSON Schema validator — it is **shape perturbation** to catch common null/empty failures.
- **Optional next step:** accept `meta.drygateInputSchema` (JSON Schema) on the workflow and validate/fuzz against that schema first.

---

## 2. Production credential manifest

**Problem addressed:** A workflow references credential **names** that exist in dev but not in production.

**Implementation:** `DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST` (comma-separated names or JSON array). Every node `credentials.*.name` must match **case-insensitively**. Mismatches → `CREDENTIAL_NOT_IN_MANIFEST`.

**Why it is valid**

- n8n exports reference credentials by **name** (and id); name is what operators reconcile across instances.

**Limits**

- Does not call n8n’s API to prove the credential exists — it is a **declared allowlist** for the gate (CI/deploy sets the list).

---

## 3. Egress policy (allowlist + raw IP)

**Problem addressed:** Workflows should only call **approved** outbound hosts.

**Implementation:** `DRYGATE_EGRESS_ALLOWLIST` (comma-separated hostnames). After sandbox, we parse **`runtimeReport.egressInterceptions`** (from the **mock gateway** in ephemeral mode). Any hostname not allowlisted, or **raw IP**-looking host, → `UNAUTHORIZED_EGRESS_DETECTED` (**fail-closed** in scorer).

**Why it is valid**

- Ephemeral mode routes outbound HTTP via the mock gateway, which logs every request with a URL.

**Limits**

- **Persistent** n8n without HTTP proxy through the gateway produces **no egress log** — policy is skipped unless traffic is captured. Documented operational requirement: use ephemeral sandbox or attach a proxy/logger for enforcement.

---

## 4. Async timeout enforcement

**Problem addressed:** Unbounded waits and HTTP calls exhaust workers.

**Implementation (static):**

- **HTTP Request:** missing timeout → `MISSING_ASYNC_TIMEOUT` (replaces the previous misclassified `LARGE_PAYLOAD_RISK` for the same condition).
- **Wait** with `resume` = `webhook` or `form` → informational long-lived execution note (`MISSING_ASYNC_TIMEOUT`, low severity).

**Limits**

- n8n parameter shapes differ by **typeVersion**; we check common locations (`options.timeout` / root `timeout`).
- Global n8n **execution** timeout is not read from the workflow JSON here — only node-level hints.

---

## Environment variables (summary)

| Variable | Purpose |
|----------|---------|
| `DRYGATE_INPUT_FUZZ` | `true` / `1` — enable trigger pinData fuzz (persistent only) |
| `DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST` | Allowlisted credential **names** |
| `DRYGATE_EGRESS_ALLOWLIST` | Allowlisted outbound **hostnames** (optional `*.suffix.com` style entries) |

---

## Which JSON schema to define first?

If you add **one** schema product: **`meta.drygateInputSchema`** on the workflow object — a **JSON Schema** for the **trigger output** (after webhook body / manual payload). That lets you:

1. **Statically** reject invalid shapes before sandbox.
2. **Generate fuzz cases** from schema (optional fields, nulls, empty arrays) instead of fixed three variants.

The three fixed fuzz variants are a **pragmatic default** until that exists.
