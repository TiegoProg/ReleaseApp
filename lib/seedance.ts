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
  costUsd?: number; // costo estimado del render (USD)
  // URLs canónicas de poll que devuelve fal al encolar. Persistirlas junto al
  // requestId (p.ej. en una producción) permite pollear tras un reinicio del
  // server, cuando la Map en memoria ya no existe.
  statusUrl?: string;
  responseUrl?: string;
}

// Costo estimado por render (USD). NO son precios oficiales de fal — son tarifas
// configurables por env para mostrar un costo aproximado por video en la UI.
export function estimateCostUsd(
  tier: string,
  resolution: string,
  durationSec: number,
  hasVideoInput = false
): number {
  if (tier === "stub") return 0;
  // Tarifas reales de fal (reference-to-video, 720p): pro $0.3024/s, fast $0.2419/s.
  const perSecPro = Number(process.env.SEEDANCE_COST_PRO_PER_SEC || 0.3024);
  const perSecFast = Number(process.env.SEEDANCE_COST_FAST_PER_SEC || 0.2419);
  const base = tier === "fal-pro" ? perSecPro : perSecFast;
  const resMult = resolution.includes("1080") ? 1.5 : 1;
  // fal cobra 0.6× cuando hay video(s) de referencia en reference-to-video.
  const videoInputMult = hasVideoInput ? 0.6 : 1;
  return Math.round(base * durationSec * resMult * videoInputMult * 100) / 100;
}

const FAL_QUEUE = "https://queue.fal.run";

// OJO: en fal solo existen "standard" (sin sufijo, hasta 1080p) y "fast" —
// NO existe tier "pro" (un path /pro/ encola y "completa" con error al instante).
function model(): string {
  return process.env.SEEDANCE_MODEL || "bytedance/seedance-2.0/reference-to-video";
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
 *
 * Multi-referencia (Seedance 2.0): el prompt referencia los materiales por su
 * posición — image_urls[0] = @Image1, image_urls[1] = @Image2, video_urls[0] =
 * @Video1, audio_urls[0] = @Audio1, etc. El caller arma esos arrays en el MISMO
 * orden en que numeró los tags del prompt.
 */
export async function startVideo(input: {
  imageUrls: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  prompt: string;
  model?: string; // override puntual del modelo (p.ej. forzar pro sin tocar el env)
  seed?: number; // seed de movimiento (reproducibilidad entre shots de una secuencia)
}): Promise<VideoJob> {
  const key = process.env.FAL_KEY;
  if (!key) {
    return { status: "stub", videoUrl: placeholderVideo(), mode: "stub", costUsd: 0 };
  }

  const selectedModel = input.model || model();
  const tier = selectedModel.includes("/fast/") ? "fal-fast" : "fal-pro"; // standard = tarifa "pro"
  const resolution = process.env.SEEDANCE_RESOLUTION || "720p";
  const duration = process.env.SEEDANCE_DURATION || "8";
  const hasVideoInput = (input.videoUrls ?? []).some(Boolean);
  const costUsd = estimateCostUsd(tier, resolution, Number(duration) || 8, hasVideoInput);

  const images = (input.imageUrls ?? []).filter(Boolean);
  const videos = (input.videoUrls ?? []).filter(Boolean);
  const audios = (input.audioUrls ?? []).filter(Boolean);

  const body: Record<string, any> = {
    prompt: input.prompt,
    image_urls: images,
    resolution,
    duration,
    aspect_ratio: "9:16",
    generate_audio: true, // el output DEBE traer pista de audio o sale mudo
  };
  // Materiales de referencia adicionales (Seedance 2.0).
  if (videos.length) body.video_urls = videos;
  // Voz pineada de Gemini + audios de referencia (@Audio1.. en el prompt).
  if (audios.length) body.audio_urls = audios;
  // Seed solo si el caller la pide explícitamente (reproducibilidad de secuencia).
  if (typeof input.seed === "number" && Number.isFinite(input.seed)) body.seed = input.seed;

  try {
    const res = await fetch(`${FAL_QUEUE}/${selectedModel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        status: "failed",
        mode: tier,
        error: `fal ${res.status}: ${(await res.text()).slice(0, 200)}`,
        costUsd,
      };
    }
    const data = await safeJson(res);
    const requestId = data?.request_id ?? data?.requestId;
    if (!requestId) return { status: "failed", mode: tier, error: "fal no devolvió request_id.", costUsd };
    // Guarda las URLs canónicas que fal entrega (más fiable que reconstruirlas).
    const statusUrl = data?.status_url ?? `${FAL_QUEUE}/${selectedModel}/requests/${requestId}/status`;
    const responseUrl = data?.response_url ?? `${FAL_QUEUE}/${selectedModel}/requests/${requestId}`;
    falJobs.set(requestId, { statusUrl, responseUrl });
    return { status: "rendering", requestId, mode: tier, costUsd, statusUrl, responseUrl };
  } catch (e: any) {
    return { status: "failed", mode: tier, error: e?.message ?? String(e), costUsd };
  }
}

/**
 * Consulta el estado de un job de fal y, si terminó, devuelve la URL del video.
 * `knownUrls` (opcional) son las URLs canónicas persistidas por el caller — las
 * usa como fallback si la Map en memoria murió (reinicio del server / HMR).
 */
export async function pollVideo(
  requestId: string,
  knownUrls?: { statusUrl?: string; responseUrl?: string }
): Promise<VideoJob> {
  const key = process.env.FAL_KEY;
  if (!key) return { status: "stub", videoUrl: placeholderVideo(), mode: "stub" };

  const urls = falJobs.get(requestId);
  const statusUrl =
    urls?.statusUrl ?? knownUrls?.statusUrl ?? `${FAL_QUEUE}/${model()}/requests/${requestId}/status`;
  const responseUrl =
    urls?.responseUrl ?? knownUrls?.responseUrl ?? `${FAL_QUEUE}/${model()}/requests/${requestId}`;

  try {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });
    const status = await safeJson(statusRes);
    const s = status?.status;
    // Estados terminales de error de fal (hoy se quedaban como "rendering" eterno).
    if (s === "FAILED" || s === "ERROR" || s === "CANCELLED") {
      return { status: "failed", requestId, mode: "fal", error: `fal status ${s}.` };
    }
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
      // Surfacear el error real de fal (p.ej. {"detail":"Path ... not found"}).
      const detail = result?.detail ?? result?.error ?? JSON.stringify(result)?.slice(0, 160);
      return {
        status: "failed",
        requestId,
        mode: "fal",
        error: `Render completó sin URL de video. fal dice: ${detail}`,
      };
    }
    // Persistimos el mp4 (la URL de fal expira); si no hay storage, usamos la de fal.
    const permanentUrl = (await storeVideo(falUrl)) ?? falUrl;
    return { status: "ready", videoUrl: permanentUrl, requestId, mode: "fal" };
  } catch (e: any) {
    return { status: "failed", requestId, mode: "fal", error: e?.message ?? String(e) };
  }
}
