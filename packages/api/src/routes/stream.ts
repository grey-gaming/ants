import { Hono } from "hono";
import type { Env } from "hono/types";
import { eventBus, NotFoundError, type RunEvent } from "@ants/core";
import { sseFormat } from "@ants/llm";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

const encoder = new TextEncoder();

function encodeSSE(data: string): Uint8Array {
  return encoder.encode(data);
}

type RunEventWithId = RunEvent & { runId?: string };

export function createStreamRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.get("/threads/:threadId/runs/:runId/stream", async (c) => {
    const threadId = c.req.param("threadId");
    const runId = c.req.param("runId");
    const userId = c.get("userId");

    const thread = await svc.thread.getById(userId, threadId);
    if (!thread) throw new NotFoundError("Thread", threadId);

    const run = await svc.run.getById(runId);
    if (!run || run.threadId !== threadId) {
      throw new NotFoundError("Run", runId);
    }

    let cleanup: (() => void) | null = null;

    const body = new ReadableStream({
      async start(controller) {
        cleanup = eventBus.on("*", (rawEvent: RunEvent) => {
          const event = rawEvent as RunEventWithId;
          if (event.runId && event.runId !== runId) return;
          try {
            controller.enqueue(encodeSSE(sseFormat(event)));
          } catch {
            // Stream already closed
          }
        });

        const keepaliveId = setInterval(() => {
          try {
            controller.enqueue(encodeSSE(": keepalive\n\n"));
          } catch {
            // Stream already closed
          }
        }, 15000);

        c.req.raw.signal.addEventListener("abort", () => {
          cleanup?.();
          clearInterval(keepaliveId);
          try { controller.close(); } catch { /* already closed */ }
        });
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  return app;
}
