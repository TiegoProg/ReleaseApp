// ============================================================================
// Seedance 2.0 (talking video) vía fal — REST directo (sin SDK extra).
// Provider abstraído: hoy "fal"; mañana se puede agregar "byteplus".
// Si falta FAL_KEY, devuelve un stub visible (la UI sigue mostrando el flujo).
//
// generate_audio: true SIEMPRE (si no, el output sale mudo). Pasamos además la
// voz pineada de Gemini como @Audio1 para el lip-sync. El mp4 final se descarga
// a Supabase (las URLs de fal son temporales).
// ============================================================================

import { randomUUID } from "crypto";
import { getServerSupabase } from "./supabase";

export interface VideoJob {
  status: "rendering" | "ready" | "failed" | "stub";
  videoUrl?: string;
  requestId?: string;
  mode: string;
  error?: string;
}

const FAL_QUEUE = "https://queue.fal.run";

function model(): string {
  return process.env.SEEDANCE_MODEL || "bytedance/seedance-2.0/fast/reference-to-video";
}

// fal devuelve status_url / response_url al encolar; las guardamos por requestId
// (sobrevive HMR vía globalThis) para pollear exactamente esas URLs.
const g = globalThis as unknown as {
  __orbitaFalJobs?: Map<string, { statusUrl: string; responseUrl: string }>;
};
if (!g.__orbitaFalJobs) g.__orbitaFalJobs = new Map();
const falJobs = g.__orbitaFalJobs;

// Parseo defensivo: si el body viene vacío, no reventamos el poll.
async function safeJson(res: Response): Promise<any | null> {
  const txt = await res.text();
  if (!txt.trim()) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function placeholderVideo(): string {
  // Clip de muestra (la UI renderiza <video>); en stub no llamamos a fal.
  return "https://placehold.co/720x1280/0b1220/f472b6.png?text=RENDER+UGC";
}

// Descarga el mp4 de fal (URL temporal) y lo sube a Supabase (URL permanente).
// Reutiliza el bucket público existente bajo videos/. Si no hay storage, null.
async function storeVideo(remoteUrl: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    // no-store: el mp4 (>2MB) no puede entrar al data-cache de Next.js y lo rompe.
    const r = await fetch(remoteUrl, { cache: "no-store" });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const path = `videos/${randomUUID()}.mp4`;
    const { error } = await sb.storage
      .from("orbita-images")
      .upload(path, buf, { contentType: "video/mp4", upsert: true });
    if (error) return null;
    return sb.storage.from("orbita-images").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * Lanza la generación de video en fal (cola async) y devuelve el request_id.
 * No bloquea: el estado real se consulta con pollVideo().
 */
export async function startVideo(input: {
  imageUrl: string;
  audioUrl?: string;
  prompt: string;
}): Promise<VideoJob> {
  const key = process.env.FAL_KEY;
  if (!key) {
    return { status: "stub", videoUrl: placeholderVideo(), mode: "stub" };
  }

  const resolution = process.env.SEEDANCE_RESOLUTION || "720p";
  const duration = process.env.SEEDANCE_DURATION || "8";

  const body: Record<string, any> = {
    prompt: input.prompt,
    image_urls: [input.imageUrl],
    resolution,
    duration,
    aspect_ratio: "9:16",
    generate_audio: true, // el output DEBE traer pista de audio o sale mudo
  };
  // Voz pineada de Gemini como referencia de lip-sync (@Audio1 en el prompt).
  if (input.audioUrl) body.audio_urls = [input.audioUrl];

  try {
    const res = await fetch(`${FAL_QUEUE}/${model()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        status: "failed",
        mode: "fal",
        error: `fal ${res.status}: ${(await res.text()).slice(0, 200)}`,
      };
    }
    const data = await safeJson(res);
    const requestId = data?.request_id ?? data?.requestId;
    if (!requestId) return { status: "failed", mode: "fal", error: "fal no devolvió request_id." };
    // Guarda las URLs canónicas que fal entrega (más fiable que reconstruirlas).
    const statusUrl = data?.status_url ?? `${FAL_QUEUE}/${model()}/requests/${requestId}/status`;
    const responseUrl = data?.response_url ?? `${FAL_QUEUE}/${model()}/requests/${requestId}`;
    falJobs.set(requestId, { statusUrl, responseUrl });
    return { status: "rendering", requestId, mode: "fal" };
  } catch (e: any) {
    return { status: "failed", mode: "fal", error: e?.message ?? String(e) };
  }
}

/** Consulta el estado de un job de fal y, si terminó, devuelve la URL del video. */
export async function pollVideo(requestId: string): Promise<VideoJob> {
  const key = process.env.FAL_KEY;
  if (!key) return { status: "stub", videoUrl: placeholderVideo(), mode: "stub" };

  const urls = falJobs.get(requestId);
  const statusUrl = urls?.statusUrl ?? `${FAL_QUEUE}/${model()}/requests/${requestId}/status`;
  const responseUrl = urls?.responseUrl ?? `${FAL_QUEUE}/${model()}/requests/${requestId}`;

  try {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });
    const status = await safeJson(statusRes);
    const s = status?.status;
    // IN_QUEUE / IN_PROGRESS / null (aún sin body) -> seguimos renderizando.
    if (s !== "COMPLETED") {
      return { status: "rendering", requestId, mode: "fal" };
    }
    const resultRes = await fetch(responseUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });
    const result = await safeJson(resultRes);
    const falUrl = result?.video?.url ?? result?.data?.video?.url ?? result?.videos?.[0]?.url;
    if (!falUrl) {
      return { status: "failed", requestId, mode: "fal", error: "Render listo pero sin URL de video." };
    }
    // Persistimos el mp4 (la URL de fal expira); si no hay storage, usamos la de fal.
    const permanentUrl = (await storeVideo(falUrl)) ?? falUrl;
    return { status: "ready", videoUrl: permanentUrl, requestId, mode: "fal" };
  } catch (e: any) {
    return { status: "failed", requestId, mode: "fal", error: e?.message ?? String(e) };
  }
}
