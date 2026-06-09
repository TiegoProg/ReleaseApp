import { NextRequest } from "next/server";
import { getLog, subscribe } from "@/lib/agents/events";
import type { AgentEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE: stream en vivo de los eventos de una campaña.
 *   GET /api/agent/run?campaignId=...&since=<ISO opcional>
 * Reproduce el log (filtrado por `since`) y luego transmite eventos nuevos.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const since = searchParams.get("since");
  if (!campaignId) {
    return new Response("missing campaignId", { status: 400 });
  }

  const encoder = new TextEncoder();
  const sinceTs = since ? Date.parse(since) : 0;

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentEvent) => {
        if (sinceTs && Date.parse(event.ts) <= sinceTs) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* controller cerrado */
        }
      };

      // 1) replay del log
      for (const ev of getLog(campaignId)) send(ev);

      // 2) suscripción en vivo
      unsubscribe = subscribe(campaignId, send);

      // 3) heartbeat para mantener viva la conexión
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* noop */
        }
      }, 15000);

      // 4) limpieza al cerrar
      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* noop */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
