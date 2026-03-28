type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, data?: Record<string, unknown>) {
  const entry: Record<string, unknown> = { level, message, ts: new Date().toISOString() };
  if (data) Object.assign(entry, data);
  const out = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(out);
  } else {
    console.log(out);
  }
}

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
  debug: (msg: string, data?: Record<string, unknown>) => emit("debug", msg, data),
};
