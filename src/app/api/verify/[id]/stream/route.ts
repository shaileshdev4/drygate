import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSseHistory, sseStreams } from "@/lib/sse/streams";

function sseSandboxLogChunksFromRuntimeJson(runtimeReportJson: string | null): string {
  if (!runtimeReportJson) return "";
  try {
    const rt = JSON.parse(runtimeReportJson) as { executionLog?: unknown };
    if (!Array.isArray(rt.executionLog)) return "";
    const ts = () => new Date().toISOString();
    return rt.executionLog
      .filter((l): l is string => typeof l === "string" && l.length > 0)
      .map((message) =>
        `data: ${JSON.stringify({
          type: "sandbox_log",
          timestamp: ts(),
          payload: { message },
        })}\n\n`
      )
      .join("");
  } catch {
    return "";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Verify the record exists
  const record = await prisma.verification.findUnique({ where: { id } });
  if (!record) {
    return new Response("Verification not found", { status: 404 });
  }

  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive" as const,
  };

  // If already complete: replay in-memory SSE history when present (same process),
  // otherwise rebuild sandbox_log events from persisted executionLog so the UI is not empty.
  if (record.status === "runtime_done" || record.status === "failed") {
    const history = getSseHistory(id);
    if (history.length > 0) {
      return new Response(history.join(""), { headers: sseHeaders });
    }

    const finalData = JSON.stringify({
      type: record.status === "failed" ? "pipeline_error" : "verification_complete",
      timestamp: new Date().toISOString(),
      payload: {
        status: record.status,
        readinessScore: record.readinessScore,
        scoreband: record.scoreband,
        staticReport: record.staticReportJson
          ? JSON.parse(record.staticReportJson)
          : null,
        runtimeReport: record.runtimeReportJson
          ? JSON.parse(record.runtimeReportJson)
          : null,
        remediationPlan: record.remediationJson
          ? JSON.parse(record.remediationJson)
          : null,
        pipelineError: record.pipelineError ?? null,
      },
    });

    const logReplay = sseSandboxLogChunksFromRuntimeJson(record.runtimeReportJson);
    const body =
      logReplay + `data: ${finalData}\n\ndata: {"type":"stream_end"}\n\n`;

    return new Response(body, { headers: sseHeaders });
  }

  // Otherwise, open a live stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // client disconnected
        }
      };

      const sendFinalFromRecord = (finalRecord: Awaited<ReturnType<typeof prisma.verification.findUnique>>) => {
        if (!finalRecord) return;
        const finalData = JSON.stringify({
          type: finalRecord.status === "failed" ? "pipeline_error" : "verification_complete",
          timestamp: new Date().toISOString(),
          payload: {
            status: finalRecord.status,
            readinessScore: finalRecord.readinessScore,
            scoreband: finalRecord.scoreband,
            staticReport: finalRecord.staticReportJson
              ? JSON.parse(finalRecord.staticReportJson)
              : null,
            runtimeReport: finalRecord.runtimeReportJson
              ? JSON.parse(finalRecord.runtimeReportJson)
              : null,
            remediationPlan: finalRecord.remediationJson
              ? JSON.parse(finalRecord.remediationJson)
              : null,
            pipelineError: finalRecord.pipelineError ?? null,
          },
        });
        send(`data: ${finalData}\n\n`);
        send(`data: {"type":"stream_end"}\n\n`);
      };

      // Register this sender
      if (!sseStreams.has(id)) sseStreams.set(id, []);
      sseStreams.get(id)!.push(send);

      // Replay buffered events in case stream attached late.
      const history = getSseHistory(id);
      for (const chunk of history) send(chunk);

      // Send a heartbeat immediately so the browser knows we're alive
      send(`: heartbeat\n\n`);

      // Heartbeat interval
      const heartbeatTimer = setInterval(() => {
        send(`: heartbeat\n\n`);
      }, 15_000);

      // Safety net for race conditions:
      // if final pipeline events were broadcast before this client subscribed,
      // poll DB and emit terminal result once status is complete/failed.
      const completionPollTimer = setInterval(async () => {
        try {
          const latest = await prisma.verification.findUnique({ where: { id } });
          if (!latest) return;
          if (latest.status === "runtime_done" || latest.status === "failed") {
            sendFinalFromRecord(latest);
            cleanup();
          }
        } catch {
          // keep stream alive; heartbeat timer still runs
        }
      }, 2000);

      // Cleanup on close
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeatTimer);
        clearInterval(completionPollTimer);
        const listeners = sseStreams.get(id) ?? [];
        const idx = listeners.indexOf(send);
        if (idx !== -1) listeners.splice(idx, 1);
        if (listeners.length === 0) sseStreams.delete(id);
        try { controller.close(); } catch { /* already closed */ }
      };

      // Auto-cleanup after 3 minutes regardless
      setTimeout(cleanup, 180_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}