type SseSend = (chunk: string) => void;

// Process-local SSE fan-out store keyed by verification id.
export const sseStreams = new Map<string, SseSend[]>();

// Keep a small in-memory history so late subscribers can replay logs/events.
const sseEventHistory = new Map<string, string[]>();
const MAX_HISTORY_EVENTS = 400;

export function pushSseEvent(verificationId: string, event: unknown) {
  const chunk = `data: ${JSON.stringify(event)}\n\n`;
  const history = sseEventHistory.get(verificationId) ?? [];
  history.push(chunk);
  if (history.length > MAX_HISTORY_EVENTS) {
    history.splice(0, history.length - MAX_HISTORY_EVENTS);
  }
  sseEventHistory.set(verificationId, history);

  const listeners = sseStreams.get(verificationId) ?? [];
  for (const send of listeners) send(chunk);
}

export function getSseHistory(verificationId: string) {
  return [...(sseEventHistory.get(verificationId) ?? [])];
}

export function clearSseHistory(verificationId: string) {
  sseEventHistory.delete(verificationId);
}
