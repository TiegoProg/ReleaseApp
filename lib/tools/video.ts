import type { ToolDef } from "./context";
import { saveDeliverable } from "./board";

/**
 * generate_video — interfaz fija + STUB (Kling).
 * La API de Kling es asíncrona (crea tarea -> polling). Aquí dejamos la interfaz lista:
 * si existe KLING_API_KEY se intenta la llamada real al endpoint configurable
 * KLING_API_URL; si no, devuelve un placeholder con el storyboard del video.
 */
export const generateVideo: ToolDef = {
  schema: {
    name: "generate_video",
    description:
      "Genera un video corto para un anuncio a partir de un prompt / storyboard. Devuelve una referencia al video. Úsalo para producir el creativo en video de un concepto.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt o storyboard del video." },
        duration_seconds: { type: "number", description: "Duración deseada (5-10s típico)." },
        title: { type: "string", description: "Título corto del video." },
      },
      required: ["prompt"],
    },
  },
  handler: async (input, ctx) => {
    const { prompt } = input as { prompt: string; duration_seconds?: number; title?: string };
    const title = input.title || "Video de anuncio";
    const duration = input.duration_seconds ?? 5;
    let url = `https://placehold.co/1280x720/0b1220/f472b6?text=${encodeURIComponent(
      "VIDEO: " + prompt.slice(0, 40)
    )}`;
    let mode = "stub";
    let taskId: string | null = null;

    const klingKey = process.env.KLING_API_KEY;
    const klingUrl = process.env.KLING_API_URL; // endpoint configurable para activar lo real
    if (klingKey && klingUrl) {
      try {
        const res = await fetch(klingUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${klingKey}`,
          },
          body: JSON.stringify({ prompt, duration }),
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error(`Kling ${res.status}: ${await res.text()}`);
        const data = await res.json();
        // Kling es asíncrono: normalmente devuelve un task id que luego se consulta.
        taskId = data?.data?.task_id ?? data?.task_id ?? null;
        if (data?.data?.url) url = data.data.url;
        mode = "kling";
      } catch (err: any) {
        mode = "stub-fallback";
      }
    }

    await saveDeliverable(ctx, {
      type: "video",
      title,
      payload: { prompt, url, duration, mode, taskId },
    });
    return `Video "${title}" (${duration}s) encolado/generado (modo: ${mode}).`;
  },
};
