const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.GATEWAY_PORT || 4000;
const LOG_FILE = process.env.LOG_FILE || "/tmp/egress-log.json";

// In-memory log - flushed to disk periodically
const egressLog = [];

// Known destructive URL patterns - return 403
const DESTRUCTIVE_PATTERNS = [
  /mail\.google\.com/i,
  /smtp\./i,
  /sendgrid\.com/i,
  /mailgun\.com/i,
  /twilio\.com/i,
  /delete/i,
  /\/destroy/i,
  /\/remove/i,
];

function isDestructive(url, method) {
  if (["DELETE", "PURGE"].includes(method.toUpperCase())) return true;
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(url));
}

// Accept all content types
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ type: "*/*", limit: "10mb" }));

// Handle CONNECT for HTTPS tunneling
app.use((req, res, next) => {
  if (req.method === "CONNECT") {
    // For HTTPS proxying - just send 200 and let the TLS flow
    res.writeHead(200, "Connection Established");
    res.end();
    return;
  }
  next();
});

// Main intercept handler - catches all requests.
// Use app.use() to stay compatible with both Express 4 and 5.
app.use((req, res) => {
  const targetUrl = req.url.startsWith("http") ? req.url : `http://${req.headers.host}${req.url}`;

  const method = req.method;
  const destructive = isDestructive(targetUrl, method);

  const logEntry = {
    timestamp: new Date().toISOString(),
    method,
    url: targetUrl,
    statusReturned: destructive ? 403 : 200,
    interceptType: destructive ? "destructive_blocked" : "mocked",
    requestHeaders: filterSafeHeaders(req.headers),
    requestBodyPreview:
      typeof req.body === "string"
        ? req.body.substring(0, 200)
        : JSON.stringify(req.body).substring(0, 200),
  };

  egressLog.push(logEntry);
  flushLog();

  if (destructive) {
    console.log(`[MOCK-GATEWAY] BLOCKED destructive: ${method} ${targetUrl}`);
    return res.status(403).json({
      error: "Blocked by Drygate mock gateway - destructive operation",
      url: targetUrl,
      method,
    });
  }

  console.log(`[MOCK-GATEWAY] Intercepted: ${method} ${targetUrl}`);

  // Return a sensible mock response based on method
  const mockResponse = buildMockResponse(method, targetUrl);
  res.setHeader("X-Drygate-Mocked", "true");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(mockResponse);
});

function buildMockResponse(method, url) {
  // Try to return a contextually plausible mock
  const urlLower = url.toLowerCase();

  if (urlLower.includes("/users") || urlLower.includes("/user")) {
    return { id: "mock-user-001", name: "Mock User", email: "mock@example.com", mocked: true };
  }
  if (urlLower.includes("/items") || urlLower.includes("/list")) {
    return { data: [{ id: "mock-001", name: "Mock Item" }], total: 1, mocked: true };
  }
  if (method === "POST") {
    return { id: "mock-created-001", success: true, mocked: true };
  }
  if (method === "PUT" || method === "PATCH") {
    return { id: "mock-updated-001", success: true, mocked: true };
  }

  // Default
  return { success: true, mocked: true, data: null };
}

function filterSafeHeaders(headers) {
  // Don't log authorization headers - even though they're mocks
  const safe = { ...headers };
  delete safe.authorization;
  delete safe["x-api-key"];
  delete safe.cookie;
  return safe;
}

function flushLog() {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(egressLog, null, 2));
  } catch {
    // Non-fatal
  }
}

app.listen(PORT, () => {
  console.log(`[MOCK-GATEWAY] Running on port ${PORT}`);
  console.log(`[MOCK-GATEWAY] Logging to ${LOG_FILE}`);
});

// Graceful shutdown - ensure final log flush
process.on("SIGTERM", () => {
  flushLog();
  process.exit(0);
});
