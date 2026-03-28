import Dockerode from "dockerode";
import axios from "axios";
import { Issue, N8nWorkflow, NodeCoverage, RuntimeReport, NodeTrace, EgressLog } from "@/types";
import { isRunnable } from "@/lib/validator/classifier";

function createDockerClient() {
  // Windows Docker Desktop exposes the daemon via named pipe.
  if (process.platform === "win32") {
    return new Dockerode({ socketPath: "//./pipe/docker_engine" });
  }
  // Linux/macOS/WSL default socket.
  return new Dockerode({ socketPath: "/var/run/docker.sock" });
}

// Lazy - only instantiated when the ephemeral (local Docker) path is actually used.
// This prevents Railway/serverless environments from crashing at module load time
// because there is no Docker socket available there.
let _docker: Dockerode | null = null;
function getDocker(): Dockerode {
  if (!_docker) _docker = createDockerClient();
  return _docker;
}
// Alias so existing `docker.xxx` call sites keep working with minimal churn.
const docker = new Proxy({} as Dockerode, {
  get(_target, prop) {
    return (getDocker() as any)[prop];
  },
});

// Default to latest so demo workflows (LangChain, etc.) match installed node types.
// Override with SANDBOX_N8N_IMAGE if you need a pinned tag.
const N8N_IMAGE = process.env.SANDBOX_N8N_IMAGE?.trim() || "n8nio/n8n:latest";

/** Optional: n8n public API key (JWT) for 2.x when REST /run is unavailable or rejects Basic auth. */
const SANDBOX_N8N_API_KEY = process.env.SANDBOX_N8N_API_KEY?.trim() || "";
const MOCK_GW_IMAGE = "drygate-mock-gateway:latest";
const SANDBOX_USER = "drygate";
const SANDBOX_PASS = "drygate-sandbox-pw";
const SANDBOX_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 1_500;
/** n8n REST API rejects names longer than 128 chars (Zod `too_big`). */
const MAX_N8N_WORKFLOW_NAME_LEN = 128;

function sanitizeN8nWorkflowName(name: string): string {
  const trimmed = name.trim() || "workflow";
  if (trimmed.length <= MAX_N8N_WORKFLOW_NAME_LEN) return trimmed;
  return trimmed.slice(0, MAX_N8N_WORKFLOW_NAME_LEN);
}

const PERSISTENT_SANDBOX_URL = process.env.SANDBOX_N8N_URL?.trim() || "";
let persistentSessionCookie = "";

// Credentials used when auto-provisioning a fresh n8n sandbox instance.
// Password must satisfy n8n requirements (uppercase + number).
const N8N_SETUP_EMAIL = "drygate@sandbox.local";
const N8N_SETUP_PASS = "DrygateS4ndbox1!";

/** Basic auth for the persistent n8n container (must match docker-compose / SANDBOX_USER). */
function persistentBasicAuth() {
  return { username: SANDBOX_USER, password: SANDBOX_PASS };
}

interface SandboxResult {
  runtimeReport: RuntimeReport;
}

/**
 * Coerce workflow triggers into `manualTrigger` so the sandbox execution can
 * start deterministically without needing an external event (webhook/chat).
 *
 * Important: we preserve the original node `id` and `name` so our trace/
 * coverage mapping remains stable.
 */
function transformWorkflowForManualExecution(workflow: N8nWorkflow): N8nWorkflow {
  const nodes = workflow.nodes.map((n) => {
    const type = (n.type ?? "").toLowerCase();
    const isManualTrigger = type === "n8n-nodes-base.manualtrigger";
    const looksLikeTrigger =
      !isManualTrigger &&
      // Covers webhook/chat/schedule style triggers.
      (type.includes("trigger") || type.includes("webhook"));

    if (!looksLikeTrigger) return n;

    return {
      ...n,
      type: "n8n-nodes-base.manualTrigger",
      // n8n 1.x manualTrigger typeVersion is stable at 1.
      typeVersion: 1,
      // Manual trigger has no meaningful parameters for our use-case.
      parameters: {},
    };
  });

  return { ...workflow, nodes };
}

/** Name of the coerced manual trigger - required for n8n 2.x POST /rest/workflows/:id/run. */
function getManualTriggerNodeName(workflow: N8nWorkflow): string | null {
  const node = workflow.nodes.find((n) => {
    const t = (n.type ?? "").toLowerCase();
    return t === "n8n-nodes-base.manualtrigger";
  });
  return node?.name != null ? String(node.name) : null;
}

export async function runSandbox(
  verificationId: string,
  workflow: N8nWorkflow,
  coverage: NodeCoverage[],
  onLog: (msg: string) => void,
): Promise<SandboxResult> {
  if (PERSISTENT_SANDBOX_URL) {
    return runPersistentSandbox(verificationId, workflow, coverage, onLog);
  }

  const networkName = `drygate-net-${verificationId}`;
  const n8nContainerName = `drygate-n8n-${verificationId}`;
  const gwContainerName = `drygate-gw-${verificationId}`;

  let n8nContainer: Dockerode.Container | null = null;
  let gwContainer: Dockerode.Container | null = null;
  let network: Dockerode.Network | null = null;

  const sandboxStartedAt = new Date().toISOString();

  try {
    // ── 1. Build mock gateway image if needed ─────────────────────
    onLog("Preparing sandbox environment...");
    await ensureMockGatewayImage(onLog);

    // ── 2. Create isolated network ────────────────────────────────
    onLog("Creating isolated network...");
    network = await docker.createNetwork({
      Name: networkName,
      Driver: "bridge",
      // Internal networks on Docker Desktop can block host port publishing.
      // Keep bridge reachable from host so readiness checks can hit localhost.
      Internal: false,
    });

    // ── 3. Start mock gateway ─────────────────────────────────────
    onLog("Starting mock gateway...");
    gwContainer = await docker.createContainer({
      Image: MOCK_GW_IMAGE,
      name: gwContainerName,
      Env: ["GATEWAY_PORT=4000", "LOG_FILE=/tmp/egress-log.json"],
      NetworkingConfig: {
        EndpointsConfig: { [networkName]: {} },
      },
      HostConfig: { NetworkMode: networkName },
    });
    await gwContainer.start();

    // Wait a moment for gateway to be ready
    await sleep(1000);

    // ── 4. Start n8n ──────────────────────────────────────────────
    onLog("Starting n8n sandbox (this takes ~10s on first run)...");
    n8nContainer = await docker.createContainer({
      Image: N8N_IMAGE,
      name: n8nContainerName,
      Env: [
        `N8N_BASIC_AUTH_ACTIVE=true`,
        `N8N_BASIC_AUTH_USER=${SANDBOX_USER}`,
        `N8N_BASIC_AUTH_PASSWORD=${SANDBOX_PASS}`,
        `HTTP_PROXY=http://${gwContainerName}:4000`,
        `HTTPS_PROXY=http://${gwContainerName}:4000`,
        `NO_PROXY=localhost,127.0.0.1,${gwContainerName}`,
        `EXECUTIONS_DATA_SAVE_ON_SUCCESS=all`,
        `EXECUTIONS_DATA_SAVE_ON_ERROR=all`,
        `EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true`,
        `N8N_USER_MANAGEMENT_DISABLED=true`,
        `N8N_DIAGNOSTICS_ENABLED=false`,
        `N8N_VERSION_NOTIFICATIONS_ENABLED=false`,
        `N8N_TEMPLATES_ENABLED=false`,
        `N8N_LOG_LEVEL=warn`,
      ],
      ExposedPorts: { "5678/tcp": {} },
      HostConfig: {
        NetworkMode: networkName,
        PortBindings: {
          // Use random host port to avoid collisions with local processes.
          "5678/tcp": [{ HostPort: "0" }],
        },
      },
    });
    await n8nContainer.start();

    const inspectData = await n8nContainer.inspect();
    const hostPort = (
      inspectData.NetworkSettings.Ports as Record<string, Array<{ HostPort: string }>>
    )["5678/tcp"]?.[0]?.HostPort;
    if (!hostPort) {
      throw new Error("n8n container started but no host port was assigned");
    }

    const n8nBaseUrl = `http://localhost:${hostPort}`;
    onLog(`n8n sandbox running on port ${hostPort}`);

    // ── 5. Wait for n8n to be ready ───────────────────────────────
    onLog("Waiting for n8n to be ready...");
    await waitForN8n(n8nBaseUrl, 120_000, onLog);
    onLog("n8n is ready.");

    // ── 6. Import workflow ────────────────────────────────────────
    onLog("Importing workflow into sandbox...");
    const importedWorkflow = await importWorkflow(n8nBaseUrl, workflow, onLog);
    const workflowId = importedWorkflow.id;
    onLog(`Workflow imported: ID ${workflowId}`);

    // ── 7. Execute ────────────────────────────────────────────────
    onLog("Triggering workflow execution...");
    const executionId = await executeWorkflow(n8nBaseUrl, workflowId, workflow, onLog);
    onLog(`Execution started: ID ${executionId}`);

    // ── 8. Poll for completion ────────────────────────────────────
    onLog("Waiting for execution to complete...");
    const executionData = await pollExecution(n8nBaseUrl, executionId, SANDBOX_TIMEOUT_MS, onLog);

    // ── 9. Extract traces ─────────────────────────────────────────
    onLog("Extracting node traces...");
    const nodeTraces = extractTraces(executionData, workflow, coverage);

    // ── 10. Read egress log from gateway ─────────────────────────
    onLog("Reading egress log from mock gateway...");
    const egressInterceptions = await readEgressLog(gwContainer);

    const simulatableCount = coverage.filter(isRunnable).length;
    const ranCount = nodeTraces.filter(
      (t) => t.status === "success" || t.status === "error",
    ).length;
    const simulationCoverage =
      simulatableCount > 0 ? Math.round((ranCount / simulatableCount) * 100) : 0;

    const sandboxEndedAt = new Date().toISOString();

    return {
      runtimeReport: {
        executionId: String(executionId),
        sandboxStartedAt,
        sandboxEndedAt,
        nodeTraces,
        egressInterceptions,
        simulationCoverage,
        guardrailIssues: [],
      },
    };
  } finally {
    // ── Teardown - always runs ────────────────────────────────────
    onLog("Tearing down sandbox...");
    await safeStop(n8nContainer);
    await safeStop(gwContainer);
    await safeRemoveNetwork(network);
    onLog("Sandbox cleaned up.");
  }
}

async function runPersistentSandbox(
  verificationId: string,
  workflow: N8nWorkflow,
  coverage: NodeCoverage[],
  onLog: (msg: string) => void,
): Promise<SandboxResult> {
  // API key may be absent here and auto-provisioned inside waitForPersistentN8nApi.
  const sandboxStartedAt = new Date().toISOString();
  const sandboxBaseUrl = PERSISTENT_SANDBOX_URL.replace(/\/+$/, "");
  const workflowName = sanitizeN8nWorkflowName(
    `drygate-${verificationId}-${workflow.name || "workflow"}`,
  );
  let remoteWorkflowId: string | null = null;
  const executionWorkflow = transformWorkflowForManualExecution(workflow);

  try {
    onLog(`[sandbox] persistent mode: ${sandboxBaseUrl}`);
    await waitForPersistentN8nApi(sandboxBaseUrl, onLog);

    onLog("[sandbox] create workflow: POST /rest/workflows");
    const createdWorkflow = await createPersistentWorkflow(
      sandboxBaseUrl,
      executionWorkflow,
      workflowName,
    );
    remoteWorkflowId = createdWorkflow.id;
    onLog(`[sandbox] workflow created: ${remoteWorkflowId}`);

    onLog("[sandbox] execute workflow");
    const executionId = await executePersistentWorkflow(
      sandboxBaseUrl,
      remoteWorkflowId,
      createdWorkflow.workflowData,
      executionWorkflow,
      onLog,
    );
    onLog(`[sandbox] execution started: ${executionId}`);

    onLog("[sandbox] poll execution by id");
    const executionData = await pollPersistentExecution(
      sandboxBaseUrl,
      executionId,
      SANDBOX_TIMEOUT_MS,
      onLog,
    );

    onLog("Extracting node traces...");
    const nodeTraces = extractTraces(executionData, workflow, coverage);
    const simulatableCount = coverage.filter(isRunnable).length;
    const ranCount = nodeTraces.filter(
      (t) => t.status === "success" || t.status === "error",
    ).length;
    const simulationCoverage =
      simulatableCount > 0 ? Math.round((ranCount / simulatableCount) * 100) : 0;
    const sandboxEndedAt = new Date().toISOString();

    let guardrailIssues: Issue[] = [];
    const fuzzEnabled =
      process.env.DRYGATE_INPUT_FUZZ === "true" || process.env.DRYGATE_INPUT_FUZZ === "1";
    if (fuzzEnabled && remoteWorkflowId) {
      guardrailIssues = await runPersistentFuzzExecutions(
        sandboxBaseUrl,
        remoteWorkflowId,
        createdWorkflow.workflowData,
        executionWorkflow,
        workflow,
        coverage,
        onLog,
      );
    }

    return {
      runtimeReport: {
        executionId,
        sandboxStartedAt,
        sandboxEndedAt,
        nodeTraces,
        egressInterceptions: [],
        simulationCoverage,
        guardrailIssues,
      },
    };
  } finally {
    if (remoteWorkflowId) {
      try {
        await axios.delete(`${sandboxBaseUrl}/rest/workflows/${remoteWorkflowId}`, {
          headers: persistentHeadersWithOptionalApiKey(),
          auth: persistentRequestAuth(),
          timeout: 10_000,
        });
        onLog(`[sandbox] cleaned remote workflow: ${remoteWorkflowId}`);
      } catch (err) {
        onLog(
          `[sandbox] cleanup warning for workflow ${remoteWorkflowId}: ${(err as Error).message}`,
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function ensureMockGatewayImage(onLog: (m: string) => void) {
  try {
    await docker.getImage(MOCK_GW_IMAGE).inspect();
  } catch {
    onLog("Building mock gateway image (first run only)...");
    await new Promise<void>((resolve, reject) => {
      docker.buildImage(
        { context: process.cwd() + "/mock-gateway", src: ["Dockerfile", "index.js"] },
        { t: MOCK_GW_IMAGE },
        (err: unknown, stream: unknown) => {
          if (err) return reject(err);
          const s = stream as NodeJS.ReadableStream;
          docker.modem.followProgress(
            s,
            (buildErr: Error | null) => (buildErr ? reject(buildErr) : resolve()),
            () => {},
          );
        },
      );
    });
  }
}

function persistentSandboxHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (persistentSessionCookie) {
    headers.Cookie = persistentSessionCookie;
  }
  return headers;
}

function persistentHeadersWithOptionalApiKey(): Record<string, string> {
  const h: Record<string, string> = { ...persistentSandboxHeaders() };
  if (SANDBOX_N8N_API_KEY) {
    h["X-N8N-API-KEY"] = SANDBOX_N8N_API_KEY;
  }
  return h;
}

/**
 * n8n 0.236.2 (pre-v1.0) still supports Basic Auth.
 * Use session cookie when established; fall back to Basic Auth otherwise.
 * (On n8n v1.x+ Basic Auth was removed - session cookie only.)
 */
function persistentRequestAuth() {
  if (persistentSessionCookie) {
    // Cookie is set - don't send Basic Auth to avoid header conflicts on newer n8n.
    return undefined;
  }
  // No session yet - use Basic Auth (supported on n8n 0.x).
  return persistentBasicAuth();
}

function parseExecutionIdFromRunResponse(data: unknown): string | null {
  const body = data as Record<string, unknown>;
  const nested = (body.data as Record<string, unknown> | undefined) ?? {};
  if (nested.waitingForWebhook === true || body.waitingForWebhook === true) {
    return null;
  }
  const raw = nested.executionId ?? body.executionId ?? nested.id ?? body.id;
  if (typeof raw === "string" || typeof raw === "number") {
    return String(raw);
  }
  return null;
}

function responseIndicatesWebhookWait(data: unknown): boolean {
  const body = data as Record<string, unknown>;
  const nested = (body.data as Record<string, unknown> | undefined) ?? {};
  return nested.waitingForWebhook === true || body.waitingForWebhook === true;
}

async function ensurePersistentSession(baseUrl: string, onLog: (m: string) => void) {
  persistentSessionCookie = "";

  const auth = persistentBasicAuth();
  const settingsRes = await axios.get(`${baseUrl}/rest/settings`, {
    timeout: 5_000,
    validateStatus: () => true,
    auth,
  });
  if (settingsRes.status !== 200) {
    throw new Error(
      `n8n /rest/settings failed (${settingsRes.status}) - check Basic Auth (user "${SANDBOX_USER}") and SANDBOX_N8N_URL.`,
    );
  }
  const settingsData = (settingsRes.data as Record<string, unknown>).data as
    | Record<string, unknown>
    | undefined;
  const userManagement = settingsData?.userManagement as Record<string, unknown> | undefined;
  const showSetup = Boolean(userManagement?.showSetupOnFirstLoad);

  if (showSetup) {
    onLog("[sandbox] first-time setup: creating n8n owner account...");
    const setup = await axios.post(
      `${baseUrl}/rest/owner/setup`,
      {
        email: N8N_SETUP_EMAIL,
        firstName: "Drygate",
        lastName: "Sandbox",
        password: N8N_SETUP_PASS,
      },
      { timeout: 15_000, validateStatus: () => true, auth },
    );
    if (setup.status !== 200) {
      throw new Error(
        `n8n owner setup failed (${setup.status}): ${JSON.stringify(setup.data).slice(0, 300)}`,
      );
    }
  }

  onLog("[sandbox] logging in to n8n...");
  // n8n login schema differs by version; in newer builds it expects
  // `emailOrLdapLoginId` instead of `email`.
  const tryLogin = async (payload: Record<string, unknown>) => {
    const resp = await axios.post(`${baseUrl}/rest/login`, payload, {
      timeout: 10_000,
      validateStatus: () => true,
      auth,
    });
    return resp;
  };

  let login = await tryLogin({
    email: N8N_SETUP_EMAIL,
    password: N8N_SETUP_PASS,
  });

  if (login.status !== 200) {
    login = await tryLogin({
      emailOrLdapLoginId: N8N_SETUP_EMAIL,
      password: N8N_SETUP_PASS,
    });
  }

  if (login.status === 200) {
    const setCookieHeader = login.headers?.["set-cookie"] as string[] | undefined;
    const n8nAuthCookie = setCookieHeader?.find((c) => c.startsWith("n8n-auth="));
    if (n8nAuthCookie) {
      persistentSessionCookie = n8nAuthCookie.split(";")[0];
      onLog("[sandbox] session cookie acquired - using cookie auth.");
      return;
    }
    onLog("[sandbox] login OK but no n8n-auth cookie - falling back to Basic Auth.");
    return;
  }

  // Login failed - Basic Auth fallback will be used for all subsequent calls.
  onLog(
    `[sandbox] login failed (${login.status}) - will use Basic Auth fallback. Response: ${JSON.stringify(login.data).slice(0, 200)}`,
  );

  // With N8N_USER_MANAGEMENT_DISABLED=true there is no user DB; /rest/login fails
  // even though REST accepts Basic Auth (same as browser: first dialog only).
  onLog(
    `[sandbox] session login not available (${login.status}); using Basic Auth for REST (normal when user management is disabled).`,
  );
}

async function waitForPersistentN8nApi(baseUrl: string, onLog: (m: string) => void) {
  // n8n can take 60-90s on cold start (DB migrations). Give it 3 minutes total.
  const deadline = Date.now() + 180_000;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const auth = persistentBasicAuth();
      // Use 10s per request - n8n may be slow to respond during DB migrations.
      const health = await axios.get(`${baseUrl}/healthz`, {
        timeout: 10_000,
        validateStatus: () => true,
        auth,
      });
      const settings = await axios.get(`${baseUrl}/rest/settings`, {
        timeout: 10_000,
        validateStatus: () => true,
        auth,
      });
      onLog(
        `[sandbox] persistent probe #${attempt}: healthz=${health.status} rest-settings=${settings.status}`,
      );

      if (health.status !== 200 || settings.status !== 200) {
        await sleep(3_000);
        continue;
      }

      // n8n process is up and editor REST is reachable, now establish session.
      await ensurePersistentSession(baseUrl, onLog);
      return;
    } catch (err) {
      onLog(`[sandbox] persistent probe #${attempt}: error ${(err as Error).message}`);
    }
    await sleep(3_000);
  }
  throw new Error("Persistent sandbox did not become ready in time (180s).");
}

async function createPersistentWorkflow(
  baseUrl: string,
  workflow: N8nWorkflow,
  workflowName: string,
) {
  const response = await axios.post(
    `${baseUrl}/rest/workflows`,
    {
      name: workflowName,
      active: false,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings ?? {},
      staticData: null,
    },
    {
      headers: persistentHeadersWithOptionalApiKey(),
      auth: persistentRequestAuth(),
      timeout: 10_000,
      validateStatus: () => true,
    },
  );
  if (response.status >= 400) {
    throw new Error(
      `Persistent create workflow failed (${response.status}): ${JSON.stringify(response.data).slice(0, 400)}`,
    );
  }
  const body = response.data as Record<string, unknown>;
  const nested = (body.data as Record<string, unknown> | undefined) ?? {};
  const idRaw = nested.id ?? body.id;
  const id = typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw) : null;
  if (!id) {
    throw new Error(
      `Persistent create workflow returned no id: ${JSON.stringify(response.data).slice(0, 400)}`,
    );
  }
  return {
    id,
    workflowData: nested,
  };
}

/**
 * Fetches the most recent execution ID for a workflow.
 * Used when n8n 0.x returns execution data inline instead of an executionId.
 */
async function fetchLatestExecutionId(
  baseUrl: string,
  workflowId: string,
  config: Parameters<typeof axios.get>[1],
): Promise<string | null> {
  try {
    const resp = await axios.get(`${baseUrl}/rest/executions`, {
      ...config,
      params: { workflowId, limit: 1 },
      timeout: 10_000,
    });
    if (resp.status >= 400) return null;
    const body = resp.data as Record<string, unknown>;
    const list =
      (body.data as unknown[] | undefined) ??
      (Array.isArray(body.results) ? (body.results as unknown[]) : null) ??
      (Array.isArray(body) ? (body as unknown[]) : null);
    if (!list || list.length === 0) return null;
    const first = list[0] as Record<string, unknown>;
    const id = first.id;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  } catch {
    return null;
  }
}

async function executePersistentWorkflow(
  baseUrl: string,
  workflowId: string,
  workflowData: Record<string, unknown>,
  executionWorkflow: N8nWorkflow,
  onLog: (m: string) => void,
) {
  const triggerName = getManualTriggerNodeName(executionWorkflow);
  if (!triggerName) {
    throw new Error(
      "Sandbox could not find a Manual Trigger node after coercion; cannot run workflow.",
    );
  }

  const runConfig = {
    headers: persistentHeadersWithOptionalApiKey(),
    auth: persistentRequestAuth(),
    timeout: 120_000,
    validateStatus: () => true,
  };

  // ── Attempt 1: n8n 0.x (0.236.2) ─────────────────────────────────────────
  // Endpoint: POST /rest/workflows/run  (no ID in path - workflow sent in body)
  const v0Body = {
    workflowData: { ...workflowData, id: workflowId },
    startNodes: [triggerName],
    destinationNode: "",
  };

  let restResponse = await axios.post(`${baseUrl}/rest/workflows/run`, v0Body, runConfig);

  onLog(`[sandbox] v0 run attempt: ${restResponse.status}`);

  if (restResponse.status < 400) {
    if (responseIndicatesWebhookWait(restResponse.data)) {
      throw new Error("n8n returned waitingForWebhook - start node is not a manual trigger.");
    }
    const id = parseExecutionIdFromRunResponse(restResponse.data);
    if (id) return id;
    // n8n 0.x returns execution data inline (no executionId in body).
    // Fetch the most recent execution for this workflow instead of polling.
    onLog("[sandbox] v0 run OK but no execution id - fetching latest execution from list...");
    const latestId = await fetchLatestExecutionId(baseUrl, workflowId, runConfig);
    if (latestId) {
      onLog(`[sandbox] found latest execution id: ${latestId}`);
      return latestId;
    }
    onLog("[sandbox] could not resolve execution id from list; trying v1 endpoint...");
  } else {
    onLog(`[sandbox] v0 run ${restResponse.status}; trying v1 endpoint...`);
  }

  // ── Attempt 2: n8n 1.x ────────────────────────────────────────────────────
  // Endpoint: POST /rest/workflows/{id}/run  with workflowData in body
  const v1Body = {
    workflowData: { ...workflowData, id: workflowId },
    runData: {},
    startNodes: [{ name: triggerName }],
    destinationNode: "",
  };

  restResponse = await axios.post(`${baseUrl}/rest/workflows/${workflowId}/run`, v1Body, runConfig);

  onLog(`[sandbox] v1 run attempt: ${restResponse.status}`);

  if (restResponse.status < 400) {
    if (responseIndicatesWebhookWait(restResponse.data)) {
      throw new Error(
        "n8n returned waitingForWebhook (v1 run) - cannot complete sandbox execution.",
      );
    }
    const id = parseExecutionIdFromRunResponse(restResponse.data);
    if (id) return id;
    onLog("[sandbox] v1 run OK but no execution id; trying v2 endpoint...");
  } else {
    onLog(`[sandbox] v1 run ${restResponse.status}; trying v2 endpoint...`);
  }

  // ── Attempt 3: n8n 2.x+ ───────────────────────────────────────────────────
  // Endpoint: POST /rest/workflows/{id}/run  with destinationNode only
  const v2Body = {
    destinationNode: { nodeName: triggerName, mode: "inclusive" as const },
  };

  restResponse = await axios.post(`${baseUrl}/rest/workflows/${workflowId}/run`, v2Body, runConfig);

  onLog(`[sandbox] v2 run attempt: ${restResponse.status}`);

  if (restResponse.status < 400) {
    if (responseIndicatesWebhookWait(restResponse.data)) {
      throw new Error(
        "n8n returned waitingForWebhook (v2 run) - cannot complete sandbox execution.",
      );
    }
    const id = parseExecutionIdFromRunResponse(restResponse.data);
    if (id) return id;
  }

  const restErr = JSON.stringify(restResponse.data).slice(0, 280);
  throw new Error(
    `Persistent execute failed after v0/v1/v2 attempts. Last status: ${restResponse.status} ${restErr}`,
  );
}

/**
 * Optional **input contract fuzz**: re-runs the workflow with altered trigger `pinData`
 * (empty object, null probe field, empty array) to surface fragile `$json` access.
 * Enable with `DRYGATE_INPUT_FUZZ=true`. Only runs in persistent sandbox after baseline success.
 */
async function runPersistentFuzzExecutions(
  baseUrl: string,
  workflowId: string,
  baseWorkflowData: Record<string, unknown>,
  executionWorkflow: N8nWorkflow,
  originalWorkflow: N8nWorkflow,
  coverage: NodeCoverage[],
  onLog: (msg: string) => void,
): Promise<Issue[]> {
  const triggerName = getManualTriggerNodeName(executionWorkflow);
  if (!triggerName) return [];

  const fuzzVariants: Array<{ label: string; json: Record<string, unknown> }> = [
    { label: "empty_object", json: {} },
    { label: "empty_string_field", json: { _drygate_probe: "" } },
    { label: "empty_items_array", json: { items: [] } },
  ];

  const issues: Issue[] = [];
  const runConfig = {
    headers: persistentHeadersWithOptionalApiKey(),
    auth: persistentRequestAuth(),
    timeout: 120_000,
    validateStatus: () => true,
  };

  const triggerNode = originalWorkflow.nodes.find((n) => n.name === triggerName);
  const triggerId = triggerNode?.id ?? triggerName;

  for (const v of fuzzVariants) {
    try {
      onLog(`[sandbox] input fuzz variant: ${v.label}`);
      const pinData: Record<string, Array<{ json: Record<string, unknown> }>> = {
        [triggerName]: [{ json: v.json }],
      };
      const legacyWorkflowData = {
        ...baseWorkflowData,
        id: workflowId,
        pinData,
      };
      const body = {
        workflowData: legacyWorkflowData,
        runData: {},
        startNodes: [{ name: triggerName }],
        destinationNode: "",
      };
      const restResponse = await axios.post(
        `${baseUrl}/rest/workflows/${workflowId}/run`,
        body,
        runConfig,
      );
      if (restResponse.status >= 400) continue;
      if (responseIndicatesWebhookWait(restResponse.data)) continue;
      const execId = parseExecutionIdFromRunResponse(restResponse.data);
      if (!execId) continue;
      const execData = await pollPersistentExecution(baseUrl, execId, 30_000, onLog);
      const traces = extractTraces(execData, originalWorkflow, coverage);
      if (traces.some((t) => t.status === "error")) {
        issues.push({
          issueCode: "INPUT_CONTRACT_FAILURE",
          nodeId: triggerId,
          nodeName: triggerName,
          nodeType: "n8n-nodes-base.manualTrigger",
          severity: "high",
          title: `Input contract failed under fuzz "${v.label}"`,
          detail: `Trigger pinData was varied (${v.label}) and at least one node errored. Production payloads that drift from your happy path can break this workflow.`,
          remediationHint:
            "Use defensive expressions, Set nodes with defaults, or validate payload shape (e.g. IF + Stop) before accessing nested fields.",
        });
      }
    } catch (err) {
      onLog(`[sandbox] fuzz ${v.label} skipped: ${(err as Error).message}`);
    }
  }

  return issues;
}

async function pollPersistentExecution(
  baseUrl: string,
  executionId: string,
  timeoutMs: number,
  onLog: (m: string) => void,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    let response = await axios.get(`${baseUrl}/rest/executions/${executionId}?includeData=true`, {
      headers: persistentHeadersWithOptionalApiKey(),
      auth: persistentRequestAuth(),
      timeout: 5_000,
      validateStatus: () => true,
    });
    if (response.status >= 400) {
      response = await axios.get(`${baseUrl}/api/v1/executions/${executionId}`, {
        headers: persistentHeadersWithOptionalApiKey(),
        auth: persistentRequestAuth(),
        timeout: 5_000,
        validateStatus: () => true,
        params: { includeData: true },
      });
    }
    if (response.status >= 400) {
      throw new Error(
        `Persistent execution poll failed (${response.status}): ${JSON.stringify(response.data).slice(0, 300)}`,
      );
    }
    const exec =
      (response.data as Record<string, unknown>).data ?? (response.data as Record<string, unknown>);
    const status = (exec as Record<string, unknown>).status;
    const finished = (exec as Record<string, unknown>).finished;
    onLog(`[sandbox] persistent execution status: ${String(status ?? finished)}`);
    if (finished || status === "success" || status === "error") {
      return exec as Record<string, unknown>;
    }
  }
  throw new Error("Persistent execution timed out after 45 seconds.");
}

async function waitForN8n(baseUrl: string, timeoutMs: number, onLog: (m: string) => void) {
  const deadline = Date.now() + timeoutMs;
  const probes = [`${baseUrl}/healthz`, `${baseUrl}/rest/settings`];
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    let serverUp = false;
    for (const url of probes) {
      try {
        const res = await axios.get(url, {
          timeout: 3000,
          validateStatus: () => true,
          auth: { username: SANDBOX_USER, password: SANDBOX_PASS },
        });
        if (res.status >= 200 && res.status < 300) {
          onLog(`[sandbox] readiness probe #${attempts}: ${url} -> ${res.status}`);
          serverUp = true;
          break;
        }
      } catch (err) {
        onLog(`[sandbox] readiness probe #${attempts}: ${url} -> error ${(err as Error).message}`);
      }
    }

    // Prevent false-ready: wait until the workflow API route exists.
    // n8n may return 404 on /api/v1/workflows during early startup.
    if (serverUp) {
      try {
        const apiProbe = await axios.get(`${baseUrl}/api/v1/workflows`, {
          timeout: 3000,
          validateStatus: () => true,
          auth: { username: SANDBOX_USER, password: SANDBOX_PASS },
        });

        // Any non-404 means routing is initialized.
        onLog(`[sandbox] api route probe #${attempts}: /api/v1/workflows -> ${apiProbe.status}`);
        if (apiProbe.status !== 404) return;
      } catch (err) {
        onLog(
          `[sandbox] api route probe #${attempts}: /api/v1/workflows -> error ${(err as Error).message}`,
        );
      }
    }

    await sleep(2000);
  }
  throw new Error("n8n sandbox did not become ready in time (120s).");
}

async function importWorkflow(baseUrl: string, workflow: N8nWorkflow, onLog: (m: string) => void) {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      onLog(`[sandbox] import request #${attempt}: POST /api/v1/workflows`);
      const response = await axios.post(
        `${baseUrl}/api/v1/workflows`,
        {
          name: sanitizeN8nWorkflowName(workflow.name || "workflow"),
          nodes: workflow.nodes,
          connections: workflow.connections,
          settings: workflow.settings ?? {},
          staticData: null,
        },
        {
          auth: { username: SANDBOX_USER, password: SANDBOX_PASS },
          timeout: 10_000,
        },
      );

      const body = response.data as Record<string, unknown> | string;
      if (typeof body === "string" && body.toLowerCase().includes("starting up")) {
        onLog(`[sandbox] import response #${attempt}: n8n still starting up; retrying...`);
        await sleep(2000);
        continue;
      }

      const nested =
        typeof body === "object" && body !== null
          ? (((body as Record<string, unknown>).data as Record<string, unknown> | undefined) ?? {})
          : {};
      const workflowIdRaw =
        (typeof body === "object" && body !== null
          ? (body as Record<string, unknown>).id
          : undefined) ?? nested.id;
      const workflowId =
        typeof workflowIdRaw === "string" || typeof workflowIdRaw === "number"
          ? String(workflowIdRaw)
          : null;

      if (!workflowId) {
        throw new Error(
          `Import workflow returned no workflow id. body=${JSON.stringify(response.data).slice(0, 400)}`,
        );
      }

      return { id: workflowId };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const body = JSON.stringify(err.response?.data ?? "");
        onLog(
          `[sandbox] import response #${attempt}: status=${status ?? "unknown"} body=${body.slice(0, 300)}`,
        );
        if (status === 401 && body.includes("X-N8N-API-KEY")) {
          throw new Error(
            "n8n API rejected basic auth and requires X-N8N-API-KEY. Create an n8n API key or pin n8n to a compatible version.",
          );
        }
        if (status === 404 && attempt < 10) {
          await sleep(2000);
          continue;
        }
        if (status === 404) {
          throw new Error(
            "n8n workflow API route returned 404 at /api/v1/workflows. The n8n API surface is not fully ready or differs for this image.",
          );
        }
        throw new Error(
          `Import workflow failed at /api/v1/workflows with status ${status ?? "unknown"}: ${body.slice(0, 300)}`,
        );
      }
      throw err;
    }
  }
  throw new Error("Import workflow timed out waiting for n8n API readiness.");
}

async function executeWorkflow(
  _baseUrl: string,
  _workflowId: string,
  _workflow: N8nWorkflow,
  _onLog: (m: string) => void,
): Promise<string> {
  // n8n's public API (/api/v1/workflows/:id/run|execute) does not exist as a stable
  // endpoint across n8n versions. Ephemeral mode uses the pinned n8n image (0.236.2)
  // which requires the REST internal endpoint, not the public API.
  throw new Error(
    "Ephemeral sandbox execution is not supported in this build. " +
      "Set SANDBOX_N8N_URL to use persistent sandbox mode.",
  );
}

async function pollExecution(
  baseUrl: string,
  executionId: string,
  timeoutMs: number,
  onLog: (m: string) => void,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "";

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const response = await axios.get(`${baseUrl}/api/v1/executions/${executionId}`, {
      auth: { username: SANDBOX_USER, password: SANDBOX_PASS },
      timeout: 5_000,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      throw new Error(
        `Poll execution failed at /api/v1/executions/${executionId} with status ${response.status}: ${JSON.stringify(response.data).slice(0, 300)}`,
      );
    }

    const exec = response.data.data ?? response.data;
    const status = (exec.status ?? exec.finished) ? "finished" : "running";

    if (status !== lastStatus) {
      onLog(`Execution status: ${status}`);
      lastStatus = status;
    }

    if (exec.finished || exec.status === "success" || exec.status === "error") {
      return exec;
    }
  }

  throw new Error("Execution timed out after 45 seconds.");
}

function extractTraces(
  executionData: Record<string, unknown>,
  workflow: N8nWorkflow,
  coverage: NodeCoverage[],
): NodeTrace[] {
  const traces: NodeTrace[] = [];
  const coverageMap = new Map(coverage.map((c) => [c.nodeName, c]));

  // n8n stores run data in data.resultData.runData keyed by node name
  const runData = (executionData.data as Record<string, unknown>)?.resultData as
    | Record<string, unknown>
    | undefined;
  const nodeRunData = (runData?.runData as Record<string, unknown[]>) ?? {};

  for (const node of workflow.nodes) {
    const cov = coverageMap.get(node.name);
    const runs = nodeRunData[node.name];

    if (!cov || !isRunnable(cov)) {
      traces.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status: "blocked",
        durationMs: 0,
        inputSummary: null,
        outputSummary: null,
        errorMessage: cov?.blockReason ?? "Blocked from sandbox execution",
      });
      continue;
    }

    if (!runs || runs.length === 0) {
      traces.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status: "skipped",
        durationMs: 0,
        inputSummary: null,
        outputSummary: null,
        errorMessage: "Node did not execute (may be on an untaken branch)",
      });
      continue;
    }

    // Take the last run of this node
    const lastRun = runs[runs.length - 1] as Record<string, unknown>;
    const hasError = !!lastRun.error;

    traces.push({
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status: hasError ? "error" : "success",
      durationMs: typeof lastRun.executionTime === "number" ? lastRun.executionTime : 0,
      inputSummary: summarize((lastRun.data as Record<string, unknown>)?.main?.[0]?.[0] ?? null),
      outputSummary: hasError
        ? null
        : summarize((lastRun.data as Record<string, unknown>)?.main?.[0]?.[0] ?? null),
      errorMessage: hasError
        ? String((lastRun.error as Record<string, unknown>)?.message ?? "Unknown error")
        : null,
    });
  }

  return traces;
}

function summarize(data: unknown): unknown {
  if (!data) return null;
  const str = JSON.stringify(data);
  if (str.length > 500) {
    return JSON.parse(str.substring(0, 500) + "...truncated");
  }
  return data;
}

async function readEgressLog(gwContainer: Dockerode.Container): Promise<EgressLog[]> {
  try {
    const exec = await gwContainer.exec({
      Cmd: ["cat", "/tmp/egress-log.json"],
      AttachStdout: true,
      AttachStderr: true,
    });

    const output = await new Promise<string>((resolve, reject) => {
      exec.start({}, (err: unknown, stream: unknown) => {
        if (err) return reject(err);
        const s = stream as NodeJS.ReadableStream;
        let data = "";
        s.on("data", (chunk: Buffer) => {
          // Docker multiplexes stdout/stderr - skip 8-byte header
          data += chunk.slice(8).toString();
        });
        s.on("end", () => resolve(data));
        s.on("error", reject);
      });
    });

    return JSON.parse(output.trim()) as EgressLog[];
  } catch {
    return [];
  }
}

async function safeStop(container: Dockerode.Container | null) {
  if (!container) return;
  try {
    await container.stop({ t: 3 });
    await container.remove({ force: true });
  } catch {
    // Non-fatal - container may already be gone
  }
}

async function safeRemoveNetwork(network: Dockerode.Network | null) {
  if (!network) return;
  try {
    await network.remove();
  } catch {
    // Non-fatal
  }
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
